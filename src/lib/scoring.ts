import { NodeRecord, EdgeStatus } from './db.js';
import { tokensFromTitle } from './text.js';

export type ScoreComponents = {
  tagOverlap: number;
  tokenSimilarity: number;
  titleSimilarity: number;
  embeddingSimilarity: number;
  penalty: number;
};

const DEFAULT_AUTO_ACCEPT = 0.5;
const DEFAULT_SUGGESTION_THRESHOLD = 0.25;

export function getAutoAcceptThreshold(): number {
  return process.env.FOREST_AUTO_ACCEPT ? Number(process.env.FOREST_AUTO_ACCEPT) : DEFAULT_AUTO_ACCEPT;
}

export function getSuggestionThreshold(): number {
  return process.env.FOREST_SUGGESTION_THRESHOLD
    ? Number(process.env.FOREST_SUGGESTION_THRESHOLD)
    : DEFAULT_SUGGESTION_THRESHOLD;
}

export function computeScore(a: NodeRecord, b: NodeRecord): { score: number; components: ScoreComponents } {
  const tagOverlap = jaccard(a.tags, b.tags);
  const tokenSimilarity = cosineSimilarity(a.tokenCounts, b.tokenCounts);
  const titleSimilarity = titleCosine(a.title, b.title);
  const embeddingSimilarityRaw = cosineEmbeddings(a.embedding, b.embedding);
  // Mild nonlinearity to reduce mid-range crowding; preserve high similarities
  const embeddingSimilarity = Math.pow(Math.max(0, embeddingSimilarityRaw), 1.25);

  // Hybrid score: increase embedding influence to reduce lexical tie clusters
  let score =
    0.25 * tokenSimilarity +
    0.55 * embeddingSimilarity +
    0.15 * tagOverlap +
    0.05 * titleSimilarity;
  // Penalize pairs with zero lexical/title overlap to avoid purely semantic weak links flooding suggestions
  const penalty = (tagOverlap === 0 && titleSimilarity === 0) ? 0.9 : 1.0;
  score *= penalty;
  return { score, components: { tagOverlap, tokenSimilarity, titleSimilarity, embeddingSimilarity, penalty } };
}

export function classifyScore(score: number): EdgeStatus | 'discard' {
  if (score >= getAutoAcceptThreshold()) return 'accepted';
  if (score >= getSuggestionThreshold()) return 'suggested';
  return 'discard';
}

export function normalizeEdgePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  let union = setA.size;
  for (const token of setB) {
    if (setA.has(token)) {
      intersection += 1;
    } else {
      union += 1;
    }
  }
  return union === 0 ? 0 : intersection / union;
}

// Down-weight generic technical terms that over-connect unrelated domains
const TOKEN_DOWNWEIGHT: Record<string, number> = {
  flow: 0.4,
  flows: 0.4,
  stream: 0.4,
  streams: 0.4,
  pipe: 0.4,
  pipes: 0.4,
  branch: 0.4,
  branches: 0.4,
  terminal: 0.4,
  terminals: 0.4,
};

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  if (keys.size === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const key of keys) {
    const w = TOKEN_DOWNWEIGHT[key] ?? 1;
    const valA = (a[key] ?? 0) * w;
    const valB = (b[key] ?? 0) * w;
    dot += valA * valB;
    magA += valA * valA;
    magB += valB * valB;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function titleCosine(a: string, b: string): number {
  const tokensA = tokensFromTitle(a);
  const tokensB = tokensFromTitle(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setB = new Set(tokensB);
  let overlap = 0;
  for (const token of tokensA) {
    if (setB.has(token)) overlap += 1;
  }
  const denom = Math.sqrt(tokensA.length * tokensB.length);
  return denom === 0 ? 0 : overlap / denom;
}

export function cosineEmbeddings(a?: number[], b?: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const dim = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < dim; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
