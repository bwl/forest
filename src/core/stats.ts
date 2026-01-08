import { listEdges, listNodes, NodeRecord } from '../lib/db.js';
import { describeSuggestion } from '../cli/shared/edges.js';

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
  const nodes = await listNodes();
  const edges = await listEdges('accepted');
  const allEdges = await listEdges('all');
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  // Compute degree stats from edge counts (faster than graph.degree())
  const nodeDegrees = new Map<string, number>();
  for (const edge of edges) {
    nodeDegrees.set(edge.sourceId, (nodeDegrees.get(edge.sourceId) ?? 0) + 1);
    nodeDegrees.set(edge.targetId, (nodeDegrees.get(edge.targetId) ?? 0) + 1);
  }

  const degrees = nodes.map((node) => nodeDegrees.get(node.id) ?? 0);
  const sortedDegrees = [...degrees].sort((a, b) => a - b);
  const sumDegrees = degrees.reduce((acc, value) => acc + value, 0);
  const avg = degrees.length ? sumDegrees / degrees.length : 0;
  const median = sortedDegrees.length
    ? sortedDegrees[Math.floor(sortedDegrees.length / 2)]
    : 0;
  const p90 = sortedDegrees.length
    ? sortedDegrees[Math.floor(sortedDegrees.length * 0.9)]
    : 0;

  const tagCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  for (const node of nodes) {
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

  const top = typeof options.top === 'number' && Number.isFinite(options.top) && options.top > 0
    ? Math.floor(options.top)
    : 10;

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([tag, count]) => ({ tag, count }));
  const topPairs = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([pair, count]) => ({ pair, count }));

  // Graph health metrics (from doctor)
  const recent = [...nodes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const highDegree = nodes
    .map((node) => ({
      node,
      degree: nodeDegrees.get(node.id) ?? 0,
    }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 5);

  const suggestions = (await listEdges('suggested'))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    counts: {
      nodes: nodes.length,
      edges: edges.length,
      suggested: allEdges.filter((e) => e.status === 'suggested').length,
    },
    degree: { avg, median, p90, max: Math.max(0, ...degrees) },
    tags: topTags,
    tagPairs: topPairs,
    recent: recent.map((node) => ({
      id: node.id,
      title: node.title,
      tags: node.tags,
      updatedAt: node.updatedAt,
    })),
    highDegree: highDegree.map((entry) => ({
      id: entry.node.id,
      title: entry.node.title,
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
