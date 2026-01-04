import { NodeRecord } from './db';
import { loadConfig } from './config';

// Provider selection priority:
//  1. FOREST_EMBED_PROVIDER env var (explicit override)
//  2. ~/.forestrc embedProvider setting
//  3. Default: 'openrouter'
//
// API keys:
//  - FOREST_OR_KEY required if provider=openrouter
//  - OPENAI_API_KEY required if provider=openai
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
  const envModel = process.env.FOREST_EMBED_MODEL;
  if (envModel) return envModel;

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
// Default: qwen/qwen3-embedding-8b (33K context, $0.01/M tokens)
async function embedOpenRouter(text: string): Promise<number[]> {
  const apiKey = process.env.FOREST_OR_KEY;
  if (!apiKey) throw new Error('FOREST_OR_KEY is required for openrouter embedding provider');
  const model = getEmbeddingModel();
  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for openai embedding provider');
  const model = getEmbeddingModel();
  const res = await fetch('https://api.openai.com/v1/embeddings', {
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
