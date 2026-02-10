import { NodeRecord } from './db';
import { loadConfig } from './config';

// Provider selection priority:
//  1. FOREST_EMBED_PROVIDER env var (explicit override)
//  2. ~/.forestrc embedProvider setting
//  3. Default: 'openrouter'
//
// API keys (config file takes priority over env var):
//  - openrouterApiKey in ~/.forestrc OR FOREST_OR_KEY env var
//  - openaiApiKey in ~/.forestrc OR OPENAI_API_KEY env var
//  - FOREST_EMBED_MODEL to override default model per provider

export type EmbeddingProvider = 'openrouter' | 'openai' | 'mock' | 'none';

export function getEmbeddingProvider(): EmbeddingProvider {
  // Env var takes priority (explicit override)
  const envVar = process.env.FOREST_EMBED_PROVIDER?.toLowerCase();
  if (envVar) {
    if (envVar === 'openrouter') return 'openrouter';
    if (envVar === 'openai') return 'openai';
    if (envVar === 'mock') return 'mock';
    if (envVar === 'none' || envVar === 'off' || envVar === 'disabled') return 'none';
    return 'mock'; // Unknown value falls back to mock
  }

  // Fall back to config file
  const config = loadConfig();
  if (config.embedProvider) {
    return config.embedProvider;
  }

  // Default
  return 'openrouter';
}

export function getEmbeddingModel(): string {
  const provider = getEmbeddingProvider();

  // Priority: env var > config file > provider default
  const envModel = process.env.FOREST_EMBED_MODEL;
  if (envModel) return envModel;

  const config = loadConfig();
  if (config.embedModel) return config.embedModel;

  // Provider defaults
  switch (provider) {
    case 'openrouter': return 'qwen/qwen3-embedding-8b';
    case 'openai': return 'text-embedding-3-small';
    default: return '';
  }
}

export function embeddingsEnabled(): boolean {
  return getEmbeddingProvider() !== 'none';
}

export async function embedNoteText(text: string): Promise<number[] | undefined> {
  const provider = getEmbeddingProvider();
  if (provider === 'none') return undefined;
  if (provider === 'openrouter') return embedOpenRouter(text);
  if (provider === 'openai') return embedOpenAI(text);
  return embedMock(text);
}

// --- Retry + Timeout helpers ---

const EMBED_TIMEOUT_MS = 30_000;
const EMBED_MAX_RETRIES = 2;
const EMBED_BACKOFF_BASE_MS = 1_000;

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= EMBED_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
      });
      if (res.status >= 500 && attempt < EMBED_MAX_RETRIES) {
        // Retry on server errors
        lastError = new Error(`HTTP ${res.status} ${res.statusText}`);
        await new Promise((r) => setTimeout(r, EMBED_BACKOFF_BASE_MS * 2 ** attempt));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err as Error;
      if (attempt < EMBED_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, EMBED_BACKOFF_BASE_MS * 2 ** attempt));
        continue;
      }
    }
  }
  throw new Error(`Embedding API failed after ${EMBED_MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}

// --- Providers ---

// Mock hashing embedding: deterministic 384-dim vector via token hashing
// Useful for offline testing and CI pipelines
async function embedMock(text: string): Promise<number[]> {
  const dim = 384;
  const vec = new Float32Array(dim);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = (h >>> 0) * 16777619;
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return Array.from(vec);
}

// OpenRouter provider - unified API for multiple embedding models
// Default: qwen/qwen3-embedding-8b (32K context, $0.01/M tokens)
async function embedOpenRouter(text: string): Promise<number[]> {
  const config = loadConfig();
  const apiKey = config.openrouterApiKey || process.env.FOREST_OR_KEY;
  if (!apiKey) throw new Error('OpenRouter API key required: set openrouterApiKey in ~/.forestrc or FOREST_OR_KEY env var');
  const model = getEmbeddingModel();
  const res = await fetchWithRetry('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/forest-cli',
      'X-Title': 'Forest CLI',
    },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter embeddings error: ${res.status} ${res.statusText} - ${body}`);
  }
  const json: any = await res.json();
  const arr: number[] = json.data?.[0]?.embedding;
  if (!Array.isArray(arr)) throw new Error('Invalid embedding response from OpenRouter');
  return arr;
}

// OpenAI provider using text-embedding-3-small (1536-d)
async function embedOpenAI(text: string): Promise<number[]> {
  const config = loadConfig();
  const apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key required: set openaiApiKey in ~/.forestrc or OPENAI_API_KEY env var');
  const model = getEmbeddingModel();
  const res = await fetchWithRetry('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embeddings error: ${res.status} ${res.statusText} - ${body}`);
  }
  const json: any = await res.json();
  const arr: number[] = json.data?.[0]?.embedding;
  if (!Array.isArray(arr)) throw new Error('Invalid embedding response');
  return arr;
}

export async function computeEmbeddingForNode(n: Pick<NodeRecord, 'title' | 'body'>): Promise<number[] | undefined> {
  const text = `${n.title}\n${n.body}`;
  return embedNoteText(text);
}
