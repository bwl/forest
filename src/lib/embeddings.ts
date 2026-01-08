import { NodeRecord } from './db.js';

// Provider selection via env:
//  - FOREST_EMBED_PROVIDER=mock | openai | none
//  - OPENAI_API_KEY required if provider=openai

export type EmbeddingProvider = 'mock' | 'openai' | 'local' | 'none';

export function getEmbeddingProvider(): EmbeddingProvider {
  const raw = (process.env.FOREST_EMBED_PROVIDER || 'local').toLowerCase();
  if (raw === 'openai') return 'openai';
  if (raw === 'local' || raw === 'transformers' || raw === 'xenova') return 'local';
  if (raw === 'none' || raw === 'off' || raw === 'disabled') return 'none';
  return 'mock';
}

export function embeddingsEnabled(): boolean {
  return getEmbeddingProvider() !== 'none';
}

export async function embedNoteText(text: string): Promise<number[] | undefined> {
  const provider = getEmbeddingProvider();
  if (provider === 'none') return undefined;
  if (provider === 'openai') return embedOpenAI(text);
  if (provider === 'local') return embedLocal(text);
  return embedMock(text);
}

// --- Providers ---

// Mock hashing embedding: deterministic 384-dim vector via token hashing
// Not semantic, but useful offline to exercise the pipeline.
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

// OpenAI provider using text-embedding-3-small (1536-d)
async function embedOpenAI(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for openai embedding provider');
  const model = process.env.FOREST_EMBED_MODEL || 'text-embedding-3-small';
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

// Local provider via @xenova/transformers
let localExtractorPromise: Promise<any> | null = null;
async function getLocalExtractor(): Promise<any> {
  if (localExtractorPromise) return localExtractorPromise;
  const model = process.env.FOREST_EMBED_LOCAL_MODEL || 'Xenova/all-MiniLM-L6-v2';
  const mod = (await import('@xenova/transformers')) as any;
  const pipeline = mod.pipeline as (task: string, model: string) => Promise<any>;
  localExtractorPromise = pipeline('feature-extraction', model);
  return localExtractorPromise;
}

async function embedLocal(text: string): Promise<number[]> {
  const extractor = await getLocalExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  const arr: number[] = Array.from(output.data as Float32Array);
  return arr;
}
