/**
 * Graph algorithms for Forest
 * - Path finding (BFS)
 * - Cluster detection (future)
 * - Bridge node detection (future)
 */

import { listEdges, getNodeById, EdgeRecord, NodeRecord } from '../lib/db';

export type PathStep = {
  nodeId: string;
  nodeTitle: string;
  edgeId?: string;
  edgeScore?: number;
  edgeType?: string;
};

export type PathResult = {
  found: boolean;
  path: PathStep[];
  totalScore: number;
  hopCount: number;
};

/**
 * Find a path between two nodes using BFS
 * Returns the shortest path (by hop count) if one exists
 */
export async function findPath(
  sourceId: string,
  targetId: string
): Promise<PathResult> {
  // Handle self-loop
  if (sourceId === targetId) {
    const node = await getNodeById(sourceId);
    if (!node) {
      return { found: false, path: [], totalScore: 0, hopCount: 0 };
    }
    return {
      found: true,
      path: [{ nodeId: sourceId, nodeTitle: node.title }],
      totalScore: 0,
      hopCount: 0,
    };
  }

  // Build adjacency list from all edges
  const edges = await listEdges('accepted');
  const adjacency = buildAdjacencyList(edges);

  // BFS to find shortest path
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; path: string[]; edges: EdgeRecord[] }> = [];

  queue.push({ nodeId: sourceId, path: [sourceId], edges: [] });
  visited.add(sourceId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current.nodeId) || [];

    for (const { neighborId, edge } of neighbors) {
      if (neighborId === targetId) {
        // Found the target - build result
        const fullPath = [...current.path, targetId];
        const fullEdges = [...current.edges, edge];
        return await buildPathResult(fullPath, fullEdges);
      }

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({
          nodeId: neighborId,
          path: [...current.path, neighborId],
          edges: [...current.edges, edge],
        });
      }
    }
  }

  // No path found
  return { found: false, path: [], totalScore: 0, hopCount: 0 };
}

type AdjacencyEntry = { neighborId: string; edge: EdgeRecord };

function buildAdjacencyList(edges: EdgeRecord[]): Map<string, AdjacencyEntry[]> {
  const adj = new Map<string, AdjacencyEntry[]>();

  for (const edge of edges) {
    // Edges are undirected - add both directions
    if (!adj.has(edge.sourceId)) adj.set(edge.sourceId, []);
    if (!adj.has(edge.targetId)) adj.set(edge.targetId, []);

    adj.get(edge.sourceId)!.push({ neighborId: edge.targetId, edge });
    adj.get(edge.targetId)!.push({ neighborId: edge.sourceId, edge });
  }

  return adj;
}

async function buildPathResult(
  nodeIds: string[],
  edges: EdgeRecord[]
): Promise<PathResult> {
  const path: PathStep[] = [];
  let totalScore = 0;

  for (let i = 0; i < nodeIds.length; i++) {
    const nodeId = nodeIds[i];
    const node = await getNodeById(nodeId);
    const step: PathStep = {
      nodeId,
      nodeTitle: node?.title || '(unknown)',
    };

    if (i > 0 && edges[i - 1]) {
      const edge = edges[i - 1];
      step.edgeId = edge.id;
      step.edgeScore = edge.score;
      step.edgeType = edge.edgeType;
      totalScore += edge.score;
    }

    path.push(step);
  }

  return {
    found: true,
    path,
    totalScore,
    hopCount: edges.length,
  };
}
