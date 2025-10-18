import { NodeRecord, EdgeStatus } from './db';
import { tokensFromTitle } from './text';

export type ScoreComponents = {
  tagOverlap: number;
  tokenSimilarity: number;
  titleSimilarity: number;
};

const DEFAULT_AUTO_ACCEPT = 0.5;
const DEFAULT_SUGGESTION_THRESHOLD = 0.15;

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

  const score = 0.6 * tokenSimilarity + 0.25 * tagOverlap + 0.15 * titleSimilarity;
  return { score, components: { tagOverlap, tokenSimilarity, titleSimilarity } };
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

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  if (keys.size === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const key of keys) {
    const valA = a[key] ?? 0;
    const valB = b[key] ?? 0;
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
