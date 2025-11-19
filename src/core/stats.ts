import {
  countNodes,
  countEdges,
  getNodeTagsOnly,
  getRecentNodes,
  getHighDegreeNodes,
  getDegreeStats,
  listEdges,
  NodeRecord,
  getNodeById,
} from '../lib/db';
import { describeSuggestion } from '../cli/shared/edges';

export type StatsResult = {
  counts: {
    nodes: number;
    edges: number;
    suggested: number;
  };
  degree: {
    avg: number;
    median: number;
    p90: number;
    max: number;
  };
  tags: Array<{ tag: string; count: number }>;
  tagPairs: Array<{ pair: string; count: number }>;
  recent: Array<{
    id: string;
    title: string;
    tags: string[];
    updatedAt: string;
  }>;
  highDegree: Array<{
    id: string;
    title: string;
    degree: number;
  }>;
  topSuggestions: Array<{
    index: number;
    id: string;
    shortId: string;
    code: string;
    score: number;
    sourceId: string;
    targetId: string;
    sourceTitle: string | null;
    targetTitle: string | null;
  }>;
};

export type StatsOptions = {
  top?: number;
};

export async function getStats(options: StatsOptions = {}): Promise<StatsResult> {
  const top = typeof options.top === 'number' && Number.isFinite(options.top) && options.top > 0
    ? Math.floor(options.top)
    : 10;

  // Optimized: Use COUNT queries instead of loading all nodes
  const nodeCount = await countNodes();
  const edgeCount = await countEdges('accepted');
  const suggestedCount = await countEdges('suggested');

  // Optimized: Compute degree stats directly in SQL
  const degreeStats = await getDegreeStats();

  // Optimized: Load only tags for tag stats
  const nodeTagsOnly = await getNodeTagsOnly();
  const tagCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  for (const node of nodeTagsOnly) {
    const uniqueTags = Array.from(new Set(node.tags));
    for (const tag of uniqueTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    for (let i = 0; i < uniqueTags.length; i += 1) {
      for (let j = i + 1; j < uniqueTags.length; j += 1) {
        const a = uniqueTags[i];
        const b = uniqueTags[j];
        const key = a < b ? `${a}::${b}` : `${b}::${a}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([tag, count]) => ({ tag, count }));
  const topPairs = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([pair, count]) => ({ pair, count }));

  // Optimized: Use SQL to get recent nodes
  const recent = await getRecentNodes(5);

  // Optimized: Use SQL to get high degree nodes
  const highDegree = await getHighDegreeNodes(5);

  // Get top suggestions
  const suggestions = (await listEdges('suggested'))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Build nodeMap only for suggestions (much smaller set)
  const nodeMap = new Map<string, NodeRecord>();
  for (const edge of suggestions) {
    if (!nodeMap.has(edge.sourceId)) {
      const node = await getNodeById(edge.sourceId);
      if (node) nodeMap.set(edge.sourceId, node);
    }
    if (!nodeMap.has(edge.targetId)) {
      const node = await getNodeById(edge.targetId);
      if (node) nodeMap.set(edge.targetId, node);
    }
  }
  // For stats, we only need suggestions for edge prefix calculation
  const allEdges = suggestions;

  return {
    counts: {
      nodes: nodeCount,
      edges: edgeCount,
      suggested: suggestedCount,
    },
    degree: {
      avg: degreeStats.avg,
      median: degreeStats.median,
      p90: degreeStats.p90,
      max: degreeStats.max,
    },
    tags: topTags,
    tagPairs: topPairs,
    recent: recent.map((node) => ({
      id: node.id,
      title: node.title,
      tags: node.tags,
      updatedAt: node.updatedAt,
    })),
    highDegree: highDegree.map((entry) => ({
      id: entry.id,
      title: entry.title,
      degree: entry.degree,
    })),
    topSuggestions: suggestions.map((edge, index) => {
      const desc = describeSuggestion(edge, nodeMap, { longIds: true, allEdges });
      return {
        index: index + 1,
        id: edge.id,
        shortId: desc.shortId,
        code: desc.code,
        score: edge.score,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        sourceTitle: desc.sourceTitle,
        targetTitle: desc.targetTitle,
      };
    }),
  };
}
