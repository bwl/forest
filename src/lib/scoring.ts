import { NodeRecord } from './db';

const DEFAULT_SEMANTIC_THRESHOLD = 0.5;
const DEFAULT_TAG_THRESHOLD = 0.3;
const DEFAULT_PROJECT_EDGE_FLOOR = 0.3;
const DEFAULT_PROJECT_EDGE_LIMIT = 10;

export type TagIdfContext = {
  totalNodes: number;
  maxIdf: number;
  idfByTag: Map<string, number>;
};

export type TagScoreComponents = {
  jaccard: number;
  avgIdf: number;
  maxIdf: number;
  normalizedIdf: number;
  bridgeScore?: number;
  bridgeTags?: string;
};

export type TagScoreResult = {
  score: number | null;
  sharedTags: string[];
  components: TagScoreComponents;
};

export type EdgeScoreResult = {
  score: number;
  semanticScore: number | null;
  tagScore: number | null;
  sharedTags: string[];
  components: {
    tag: TagScoreComponents;
  };
};

export function getSemanticThreshold(): number {
  if (!process.env.FOREST_SEMANTIC_THRESHOLD) {
    return DEFAULT_SEMANTIC_THRESHOLD;
  }
  const parsed = Number(process.env.FOREST_SEMANTIC_THRESHOLD);
  return Number.isFinite(parsed) ? parsed : DEFAULT_SEMANTIC_THRESHOLD;
}

export function getTagThreshold(): number {
  if (!process.env.FOREST_TAG_THRESHOLD) {
    return DEFAULT_TAG_THRESHOLD;
  }
  const parsed = Number(process.env.FOREST_TAG_THRESHOLD);
  return Number.isFinite(parsed) ? parsed : DEFAULT_TAG_THRESHOLD;
}

export function getProjectEdgeFloor(): number {
  if (!process.env.FOREST_PROJECT_EDGE_FLOOR) {
    return DEFAULT_PROJECT_EDGE_FLOOR;
  }
  const parsed = Number(process.env.FOREST_PROJECT_EDGE_FLOOR);
  if (!Number.isFinite(parsed)) return DEFAULT_PROJECT_EDGE_FLOOR;
  return Math.max(0, Math.min(1, parsed));
}

export function getProjectEdgeLimit(): number {
  if (!process.env.FOREST_PROJECT_EDGE_LIMIT) {
    return DEFAULT_PROJECT_EDGE_LIMIT;
  }
  const parsed = Number(process.env.FOREST_PROJECT_EDGE_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_PROJECT_EDGE_LIMIT;
  return Math.max(1, Math.floor(parsed));
}

export function extractProjectTags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized.startsWith('project:')) {
      out.add(normalized);
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

export function hasSharedProjectTag(tags: string[]): boolean {
  return extractProjectTags(tags).length > 0;
}

export function buildTagIdfContext(nodes: Array<Pick<NodeRecord, 'tags'>>): TagIdfContext {
  const totalNodes = nodes.length;
  const docFreqByTag = new Map<string, number>();

  for (const node of nodes) {
    const uniqueTags = new Set(node.tags.map((tag) => tag.toLowerCase()));
    for (const tag of uniqueTags) {
      docFreqByTag.set(tag, (docFreqByTag.get(tag) ?? 0) + 1);
    }
  }

  const idfByTag = new Map<string, number>();
  for (const [tag, docFreq] of docFreqByTag.entries()) {
    const idf = totalNodes > 0 && docFreq > 0 ? Math.log(totalNodes / docFreq) : 0;
    idfByTag.set(tag, idf);
  }

  const maxIdf = totalNodes > 0 ? Math.log(totalNodes / 1) : 0;
  return { totalNodes, maxIdf, idfByTag };
}

export function computeSemanticScore(a: NodeRecord, b: NodeRecord): number | null {
  if (!a.embedding || !b.embedding || a.embedding.length === 0 || b.embedding.length === 0) return null;
  const raw = cosineEmbeddings(a.embedding, b.embedding);
  return Math.max(0, Math.min(1, raw));
}

export function computeTagScore(aTags: string[], bTags: string[], context: TagIdfContext): TagScoreResult {
  const setA = new Set(aTags.map((tag) => tag.toLowerCase()));
  const setB = new Set(bTags.map((tag) => tag.toLowerCase()));

  if (setA.size === 0 && setB.size === 0) {
    return {
      score: null,
      sharedTags: [],
      components: { jaccard: 0, avgIdf: 0, maxIdf: context.maxIdf, normalizedIdf: 0 },
    };
  }

  const sharedTags: string[] = [];
  let union = setA.size;
  for (const tag of setB) {
    if (setA.has(tag)) {
      sharedTags.push(tag);
    } else {
      union += 1;
    }
  }

  sharedTags.sort((x, y) => x.localeCompare(y));

  const intersection = sharedTags.length;
  const jaccard = union === 0 ? 0 : intersection / union;

  if (intersection === 0) {
    return {
      score: null,
      sharedTags: [],
      components: { jaccard, avgIdf: 0, maxIdf: context.maxIdf, normalizedIdf: 0 },
    };
  }

  let idfSum = 0;
  let bridgeIdfSum = 0;
  const bridgeTags: string[] = [];
  for (const tag of sharedTags) {
    const idf = context.idfByTag.get(tag) ?? 0;
    idfSum += idf;
    if (tag.startsWith('link/')) {
      bridgeTags.push(tag);
      bridgeIdfSum += idf;
    }
  }
  const avgIdf = idfSum / sharedTags.length;
  const normalizedIdf = context.maxIdf > 0 ? avgIdf / context.maxIdf : 0;

  const baseScore = Math.max(0, Math.min(1, jaccard * normalizedIdf));
  const bridgeScore = (() => {
    if (bridgeTags.length === 0) return null;
    if (context.maxIdf <= 0) return 0;
    const avgBridgeIdf = bridgeIdfSum / bridgeTags.length;
    return Math.max(0, Math.min(1, avgBridgeIdf / context.maxIdf));
  })();
  const score = bridgeScore === null ? baseScore : Math.max(baseScore, bridgeScore);

  return {
    score,
    sharedTags,
    components: {
      jaccard,
      avgIdf,
      maxIdf: context.maxIdf,
      normalizedIdf,
      ...(bridgeScore === null ? {} : { bridgeScore, bridgeTags: bridgeTags.join(', ') }),
    },
  };
}

export function computeEdgeScore(a: NodeRecord, b: NodeRecord, context: TagIdfContext): EdgeScoreResult {
  const semanticScore = computeSemanticScore(a, b);
  const tagResult = computeTagScore(a.tags, b.tags, context);
  const tagScore = tagResult.score;
  const score = fuseEdgeScores(semanticScore, tagScore);

  return {
    score,
    semanticScore,
    tagScore,
    sharedTags: tagResult.sharedTags,
    components: { tag: tagResult.components },
  };
}

export function classifyEdgeScores(
  semanticScore: number | null,
  tagScore: number | null,
  sharedTags: string[] = [],
): 'accepted' | 'discard' {
  const semanticOk = semanticScore !== null && semanticScore >= getSemanticThreshold();
  const tagOk = tagScore !== null && tagScore >= getTagThreshold();
  if (semanticOk || tagOk) return 'accepted';

  if (hasSharedProjectTag(sharedTags)) {
    const fused = fuseEdgeScores(semanticScore, tagScore);
    if (fused >= getProjectEdgeFloor()) {
      return 'accepted';
    }
  }

  return 'discard';
}

export function normalizeEdgePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
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

export function fuseEdgeScores(semanticScore: number | null, tagScore: number | null): number {
  const semantic = clamp01(semanticScore ?? 0);
  const tag = clamp01(tagScore ?? 0);

  const dominant = Math.max(semantic, tag);
  const supporting = Math.min(semantic, tag);
  const geometric = Math.sqrt(semantic * tag);
  const disagreementPenalty = Math.abs(semantic - tag);

  // Keep one strong signal useful, but reward agreement between channels.
  return clamp01(
    (0.7 * dominant) +
    (0.2 * supporting) +
    (0.1 * geometric) -
    (0.1 * disagreementPenalty),
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
