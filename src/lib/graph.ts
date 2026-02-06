import Graph from 'graphology';
import { EdgeRecord, NodeRecord, listEdges, listNodes } from './db';

export async function buildGraph() {
  const nodes = await listNodes();
  const edges = await listEdges('accepted');
  return graphFromRecords(nodes, edges);
}

export function graphFromRecords(nodes: NodeRecord[], edges: EdgeRecord[]): Graph {
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
      semanticScore: edge.semanticScore,
      tagScore: edge.tagScore,
      sharedTags: edge.sharedTags,
      status: edge.status,
      edgeType: edge.edgeType,
    });
  }

  return graph;
}

export function collectNeighborhood(graph: Graph, centerId: string, depth: number, limit: number) {
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

    graph.forEachNeighbor(current.id, (neighbor, attributes) => {
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
