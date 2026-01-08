import GraphModule from 'graphology';
import type { AbstractGraph } from 'graphology-types';
import { EdgeRecord, EdgeStatus, NodeRecord, listEdges, listNodes } from './db.js';

// Type assertion for ESM compatibility
const Graph = GraphModule as any as new (options?: any) => AbstractGraph;

export async function buildGraph(options: { includeSuggestions?: boolean } = {}) {
  const { includeSuggestions = false } = options;
  const nodes = await listNodes();
  const edges = await listEdges(includeSuggestions ? 'all' : 'accepted');
  return graphFromRecords(nodes, includeSuggestions ? edges : edges.filter((edge) => edge.status === 'accepted'));
}

export function graphFromRecords(nodes: NodeRecord[], edges: EdgeRecord[]): AbstractGraph {
  const graph = new Graph({ type: 'undirected', multi: false });

  for (const node of nodes) {
    graph.addNode(node.id, {
      title: node.title,
      tags: node.tags,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    });
  }

  for (const edge of edges) {
    if (!graph.hasNode(edge.sourceId) || !graph.hasNode(edge.targetId)) continue;
    if (graph.hasEdge(edge.sourceId, edge.targetId)) continue;
    graph.addUndirectedEdgeWithKey(edge.id, edge.sourceId, edge.targetId, {
      score: edge.score,
      status: edge.status,
    });
  }

  return graph;
}

export function collectNeighborhood(graph: AbstractGraph, centerId: string, depth: number, limit: number) {
  const visited = new Set<string>();
  const queue: Array<{ id: string; distance: number }> = [{ id: centerId, distance: 0 }];
  const nodes: Set<string> = new Set();
  const edges: Set<string> = new Set();

  while (queue.length > 0 && nodes.size < limit) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    nodes.add(current.id);

    if (current.distance >= depth) continue;

    graph.forEachNeighbor(current.id, (neighbor: string, attributes: any) => {
      const edgeKey = graph.edge(current.id, neighbor);
      if (edgeKey) {
        edges.add(edgeKey);
      }
      if (!visited.has(neighbor)) {
        queue.push({ id: neighbor, distance: current.distance + 1 });
      }
    });
  }

  return {
    nodes: [...nodes],
    edges: [...edges].map((key) => ({
      key,
      source: graph.source(key),
      target: graph.target(key),
      attributes: graph.getEdgeAttributes(key),
    })),
  };
}
