/**
 * Context topology algorithm — cluster detection, PageRank, and budget-aware assembly.
 *
 * Given a seed (tag, query, or both), builds a subgraph, runs PageRank to find
 * hubs, detects bridges to external clusters, and assembles a budget-constrained
 * structural summary for agent consumption.
 */

import { NodeRecord, EdgeRecord, listNodes, listEdges } from '../lib/db';
import { buildGraph } from '../lib/graph';
import { getNodesByTagCore } from './tags';
import { semanticSearchCore } from './search';
import { formatId } from '../cli/shared/utils';
import Graph from 'graphology';

// ── Types ────────────────────────────────────────────────────────────────

export type NodeRole = 'hub' | 'bridge' | 'periphery';

export interface ContextNodeInfo {
  id: string;
  shortId: string;
  title: string;
  tags: string[];
  roles: NodeRole[];
  pagerank: number;
  bodyPreview: string;
  degree: { internal: number; external: number };
  bridgeTo?: string[]; // external tag clusters this node bridges to
  createdAt: string;
  updatedAt: string;
}

export interface ContextEdgeInfo {
  sourceId: string;
  sourceTitle: string;
  targetId: string;
  targetTitle: string;
  score: number;
  semanticScore: number | null;
  tagScore: number | null;
}

export interface ContextSummary {
  seedTags: string[];
  seedQuery: string;
  totalNodes: number;
  hubCount: number;
  bridgeCount: number;
  peripheryCount: number;
  internalEdges: number;
  externalEdges: number;
  dominantTags: string[];
  dateRange: string;
  budgetTokens: number;
  usedTokens: number;
}

export interface ContextResult {
  summary: ContextSummary;
  hubs: ContextNodeInfo[];
  bridges: ContextNodeInfo[];
  periphery: ContextNodeInfo[];
  edges: ContextEdgeInfo[];
}

export interface ContextOptions {
  tag?: string;
  query?: string;
  budget?: number;
}

// ── Core function ────────────────────────────────────────────────────────

export async function contextCore(options: ContextOptions): Promise<ContextResult> {
  if (!options.tag && !options.query) {
    throw new Error('At least one of --tag or --query is required');
  }

  const budget = options.budget ?? 8000;

  // 1. Resolve seed nodes
  const seedNodeIds = await resolveSeedNodes(options);
  if (seedNodeIds.size === 0) {
    throw new Error('No nodes matched the seed criteria');
  }

  // 2. Build full graph
  const graph = await buildGraph();

  // 3. Extract subgraph (seed nodes + internal edges + boundary expansion)
  const { subgraph, internalEdges, externalEdges, seedTags } = extractSubgraph(
    graph,
    seedNodeIds,
    options.tag,
  );

  // 4. Run PageRank on subgraph
  const pagerankScores = computePageRank(subgraph);

  // 5. Classify roles
  const allNodes = await listNodes();
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  const roles = classifyRoles(pagerankScores, seedNodeIds, graph, subgraph);

  // 6. Build node info objects
  const nodeInfos = buildNodeInfos(
    subgraph,
    graph,
    pagerankScores,
    roles,
    seedNodeIds,
    nodeMap,
    options.tag,
  );

  // 7. Build edge info objects
  const edgeInfos = buildEdgeInfos(subgraph, internalEdges, externalEdges, nodeMap);

  // 8. Classify into groups
  const hubs = nodeInfos.filter((n) => n.roles.includes('hub'));
  const bridges = nodeInfos.filter(
    (n) => n.roles.includes('bridge') && !n.roles.includes('hub'),
  );
  const periphery = nodeInfos.filter(
    (n) => !n.roles.includes('hub') && !n.roles.includes('bridge'),
  );

  // Sort each group by pagerank desc
  hubs.sort((a, b) => b.pagerank - a.pagerank);
  bridges.sort((a, b) => b.pagerank - a.pagerank);
  periphery.sort((a, b) => b.pagerank - a.pagerank);

  // 9. Compute summary
  const dominantTags = computeDominantTags(nodeInfos);
  const dateRange = computeDateRange(nodeInfos);

  // 10. Budget-aware assembly
  const result = applyBudget(
    { hubs, bridges, periphery, edges: edgeInfos },
    {
      seedTags: options.tag ? [options.tag] : seedTags,
      seedQuery: options.query ?? '',
      dominantTags,
      dateRange,
      internalEdgeCount: internalEdges.length,
      externalEdgeCount: externalEdges.length,
    },
    budget,
  );

  return result;
}

// ── Seed resolution ──────────────────────────────────────────────────────

async function resolveSeedNodes(options: ContextOptions): Promise<Set<string>> {
  const seedIds = new Set<string>();

  if (options.tag && !options.query) {
    // Tag-only: get all nodes with this tag (no pagination limit)
    const result = await getNodesByTagCore(options.tag, { limit: 10000, offset: 0 });
    for (const node of result.nodes) {
      seedIds.add(node.id);
    }
  } else if (options.query && !options.tag) {
    // Query-only (hybrid): semantic search → find shared tags → expand via tags
    const searchResult = await semanticSearchCore(options.query, { limit: 30 });
    if (searchResult.nodes.length === 0) return seedIds;

    // Find tags shared by 3+ results
    const tagCounts = new Map<string, number>();
    for (const { node } of searchResult.nodes) {
      for (const tag of node.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const sharedTags = [...tagCounts.entries()]
      .filter(([_, count]) => count >= 3)
      .map(([tag]) => tag);

    if (sharedTags.length > 0) {
      // Expand cluster via shared tags
      for (const tag of sharedTags) {
        const tagResult = await getNodesByTagCore(tag, { limit: 10000, offset: 0 });
        for (const node of tagResult.nodes) {
          seedIds.add(node.id);
        }
      }
    } else {
      // Fallback: use search results directly
      for (const { node } of searchResult.nodes) {
        seedIds.add(node.id);
      }
    }
  } else if (options.tag && options.query) {
    // Intersection: tag cluster filtered/ranked by query
    const tagResult = await getNodesByTagCore(options.tag, { limit: 10000, offset: 0 });
    for (const node of tagResult.nodes) {
      seedIds.add(node.id);
    }
    // Query is used for ranking during budget trimming, not for filtering seed set
  }

  return seedIds;
}

// ── Subgraph extraction ──────────────────────────────────────────────────

function extractSubgraph(
  graph: Graph,
  seedNodeIds: Set<string>,
  seedTag?: string,
): {
  subgraph: Graph;
  internalEdges: Array<{ key: string; source: string; target: string; attrs: any }>;
  externalEdges: Array<{ key: string; source: string; target: string; attrs: any }>;
  seedTags: string[];
} {
  const subgraph = new Graph({ type: 'undirected', multi: false });
  const internalEdges: Array<{ key: string; source: string; target: string; attrs: any }> = [];
  const externalEdges: Array<{ key: string; source: string; target: string; attrs: any }> = [];
  const seedTags: string[] = [];

  // Add seed nodes to subgraph
  for (const nodeId of seedNodeIds) {
    if (!graph.hasNode(nodeId)) continue;
    const attrs = graph.getNodeAttributes(nodeId);
    subgraph.addNode(nodeId, { ...attrs });
  }

  // Add internal edges (between seed nodes)
  for (const nodeId of seedNodeIds) {
    if (!graph.hasNode(nodeId)) continue;
    graph.forEachEdge(nodeId, (edgeKey, attrs, source, target) => {
      const otherNode = source === nodeId ? target : source;
      if (seedNodeIds.has(otherNode)) {
        if (!subgraph.hasEdge(source, target)) {
          try {
            subgraph.addUndirectedEdgeWithKey(edgeKey, source, target, { ...attrs });
            internalEdges.push({ key: edgeKey, source, target, attrs });
          } catch {
            // Edge already exists (undirected duplicate)
          }
        }
      }
    });
  }

  // Boundary expansion: top-N strongest edges per boundary node to external nodes
  const externalNodesAdded = new Set<string>();
  const MAX_EXTERNAL_PER_NODE = 3;

  for (const nodeId of seedNodeIds) {
    if (!graph.hasNode(nodeId)) continue;

    // Collect external edges sorted by score
    const extEdges: Array<{ key: string; neighbor: string; attrs: any }> = [];
    graph.forEachEdge(nodeId, (edgeKey, attrs, source, target) => {
      const neighbor = source === nodeId ? target : source;
      if (!seedNodeIds.has(neighbor)) {
        extEdges.push({ key: edgeKey, neighbor, attrs });
      }
    });

    // Sort by score desc, take top N
    extEdges.sort((a, b) => (b.attrs.score ?? 0) - (a.attrs.score ?? 0));
    const topExtEdges = extEdges.slice(0, MAX_EXTERNAL_PER_NODE);

    for (const { key, neighbor, attrs } of topExtEdges) {
      // Add external node if not already present
      if (!subgraph.hasNode(neighbor) && graph.hasNode(neighbor)) {
        const neighborAttrs = graph.getNodeAttributes(neighbor);
        subgraph.addNode(neighbor, { ...neighborAttrs });
        externalNodesAdded.add(neighbor);
      }

      // Add edge
      if (subgraph.hasNode(nodeId) && subgraph.hasNode(neighbor) && !subgraph.hasEdge(nodeId, neighbor)) {
        try {
          subgraph.addUndirectedEdgeWithKey(key, nodeId, neighbor, { ...attrs });
          externalEdges.push({
            key,
            source: nodeId < neighbor ? nodeId : neighbor,
            target: nodeId < neighbor ? neighbor : nodeId,
            attrs,
          });
        } catch {
          // Already exists
        }
      }
    }
  }

  // Compute seed tags if no explicit tag was given
  if (!seedTag) {
    const tagCounts = new Map<string, number>();
    for (const nodeId of seedNodeIds) {
      if (!graph.hasNode(nodeId)) continue;
      const attrs = graph.getNodeAttributes(nodeId);
      for (const tag of (attrs.tags as string[]) ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
    seedTags.push(...sorted.slice(0, 5).map(([tag]) => tag));
  }

  return { subgraph, internalEdges, externalEdges, seedTags };
}

// ── PageRank ─────────────────────────────────────────────────────────────

function computePageRank(
  graph: Graph,
  dampingFactor = 0.85,
  maxIterations = 100,
  tolerance = 0.0001,
): Map<string, number> {
  const nodes = graph.nodes();
  const n = nodes.length;
  if (n === 0) return new Map();

  // Initialize scores
  const scores = new Map<string, number>();
  const initial = 1 / n;
  for (const node of nodes) {
    scores.set(node, initial);
  }

  // Iterative power method with edge weight support
  for (let iter = 0; iter < maxIterations; iter++) {
    const newScores = new Map<string, number>();
    let delta = 0;

    for (const node of nodes) {
      let incomingSum = 0;

      graph.forEachNeighbor(node, (neighbor) => {
        const neighborScore = scores.get(neighbor) ?? 0;
        const neighborDegree = graph.degree(neighbor);
        if (neighborDegree === 0) return;

        // Weight by edge score
        const edgeKey = graph.edge(node, neighbor);
        const edgeWeight = edgeKey ? (graph.getEdgeAttribute(edgeKey, 'score') ?? 1) : 1;

        // Total weighted degree of neighbor
        let totalWeightedDegree = 0;
        graph.forEachEdge(neighbor, (_ek, attrs) => {
          totalWeightedDegree += attrs.score ?? 1;
        });

        if (totalWeightedDegree > 0) {
          incomingSum += (neighborScore * edgeWeight) / totalWeightedDegree;
        }
      });

      const newScore = (1 - dampingFactor) / n + dampingFactor * incomingSum;
      newScores.set(node, newScore);
      delta += Math.abs(newScore - (scores.get(node) ?? 0));
    }

    // Update scores
    for (const [node, score] of newScores) {
      scores.set(node, score);
    }

    if (delta < tolerance) break;
  }

  return scores;
}

// ── Role classification ──────────────────────────────────────────────────

function classifyRoles(
  pagerankScores: Map<string, number>,
  seedNodeIds: Set<string>,
  fullGraph: Graph,
  subgraph: Graph,
): Map<string, Set<NodeRole>> {
  const roles = new Map<string, Set<NodeRole>>();

  // Initialize all as periphery
  for (const nodeId of subgraph.nodes()) {
    roles.set(nodeId, new Set(['periphery']));
  }

  // Hub detection via natural break
  const sortedScores = [...pagerankScores.entries()]
    .filter(([id]) => subgraph.hasNode(id))
    .sort((a, b) => b[1] - a[1]);

  if (sortedScores.length >= 2) {
    // Compute gaps between consecutive scores
    const gaps: Array<{ index: number; gap: number }> = [];
    for (let i = 0; i < sortedScores.length - 1; i++) {
      gaps.push({
        index: i,
        gap: sortedScores[i][1] - sortedScores[i + 1][1],
      });
    }

    // Find median pagerank score
    const medianScore = sortedScores[Math.floor(sortedScores.length / 2)][1];

    // Find largest gap above median
    const gapsAboveMedian = gaps.filter(
      (g) => sortedScores[g.index][1] > medianScore,
    );

    let hubCutoff: number;
    if (gapsAboveMedian.length > 0) {
      const largestGap = gapsAboveMedian.reduce(
        (max, g) => (g.gap > max.gap ? g : max),
        gapsAboveMedian[0],
      );
      hubCutoff = largestGap.index + 1; // nodes before this index are hubs
    } else {
      // Fallback: top 15%
      hubCutoff = Math.max(1, Math.ceil(sortedScores.length * 0.15));
    }

    for (let i = 0; i < hubCutoff && i < sortedScores.length; i++) {
      const nodeId = sortedScores[i][0];
      const nodeRoles = roles.get(nodeId) ?? new Set();
      nodeRoles.delete('periphery');
      nodeRoles.add('hub');
      roles.set(nodeId, nodeRoles);
    }
  } else if (sortedScores.length === 1) {
    // Single node is automatically the hub
    const nodeId = sortedScores[0][0];
    roles.set(nodeId, new Set(['hub']));
  }

  // Bridge detection: node has edges to nodes outside the seed cluster
  for (const nodeId of seedNodeIds) {
    if (!subgraph.hasNode(nodeId) || !fullGraph.hasNode(nodeId)) continue;

    let hasExternalEdge = false;
    fullGraph.forEachNeighbor(nodeId, (neighbor) => {
      if (!seedNodeIds.has(neighbor)) {
        hasExternalEdge = true;
      }
    });

    if (hasExternalEdge) {
      const nodeRoles = roles.get(nodeId) ?? new Set();
      nodeRoles.add('bridge');
      nodeRoles.delete('periphery'); // bridge overrides periphery unless also hub
      roles.set(nodeId, nodeRoles);
    }
  }

  return roles;
}

// ── Node info building ───────────────────────────────────────────────────

function buildNodeInfos(
  subgraph: Graph,
  fullGraph: Graph,
  pagerankScores: Map<string, number>,
  roles: Map<string, Set<NodeRole>>,
  seedNodeIds: Set<string>,
  nodeMap: Map<string, NodeRecord>,
  seedTag?: string,
): ContextNodeInfo[] {
  const nodeInfos: ContextNodeInfo[] = [];

  for (const nodeId of subgraph.nodes()) {
    const nodeRecord = nodeMap.get(nodeId);
    if (!nodeRecord) continue;

    const nodeRoles = roles.get(nodeId) ?? new Set<NodeRole>(['periphery']);

    // Compute internal/external degree within subgraph
    let internalDeg = 0;
    let externalDeg = 0;
    if (fullGraph.hasNode(nodeId)) {
      fullGraph.forEachNeighbor(nodeId, (neighbor) => {
        if (seedNodeIds.has(neighbor)) {
          internalDeg++;
        } else {
          externalDeg++;
        }
      });
    }

    // Bridge-to: which external tag clusters does this node connect to?
    let bridgeTo: string[] | undefined;
    if (nodeRoles.has('bridge') && fullGraph.hasNode(nodeId)) {
      const externalTagCounts = new Map<string, number>();
      fullGraph.forEachNeighbor(nodeId, (neighbor) => {
        if (!seedNodeIds.has(neighbor) && fullGraph.hasNode(neighbor)) {
          const neighborAttrs = fullGraph.getNodeAttributes(neighbor);
          for (const tag of (neighborAttrs.tags as string[]) ?? []) {
            // Skip the seed tag itself
            if (seedTag && tag === seedTag) continue;
            externalTagCounts.set(tag, (externalTagCounts.get(tag) ?? 0) + 1);
          }
        }
      });

      // Format as "tag (N edges)"
      bridgeTo = [...externalTagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => `${tag} (${count} edges)`);
    }

    const bodyPreview = nodeRecord.body.slice(0, 100).replace(/\n/g, ' ');

    nodeInfos.push({
      id: nodeRecord.id,
      shortId: formatId(nodeRecord.id),
      title: nodeRecord.title,
      tags: nodeRecord.tags,
      roles: [...nodeRoles] as NodeRole[],
      pagerank: pagerankScores.get(nodeId) ?? 0,
      bodyPreview,
      degree: { internal: internalDeg, external: externalDeg },
      bridgeTo: bridgeTo && bridgeTo.length > 0 ? bridgeTo : undefined,
      createdAt: nodeRecord.createdAt,
      updatedAt: nodeRecord.updatedAt,
    });
  }

  return nodeInfos;
}

// ── Edge info building ───────────────────────────────────────────────────

function buildEdgeInfos(
  subgraph: Graph,
  internalEdges: Array<{ key: string; source: string; target: string; attrs: any }>,
  externalEdges: Array<{ key: string; source: string; target: string; attrs: any }>,
  nodeMap: Map<string, NodeRecord>,
): ContextEdgeInfo[] {
  const allEdges = [...internalEdges, ...externalEdges];
  return allEdges.map((e) => ({
    sourceId: e.source,
    sourceTitle: nodeMap.get(e.source)?.title ?? '(unknown)',
    targetId: e.target,
    targetTitle: nodeMap.get(e.target)?.title ?? '(unknown)',
    score: e.attrs.score ?? 0,
    semanticScore: e.attrs.semanticScore ?? null,
    tagScore: e.attrs.tagScore ?? null,
  }));
}

// ── Dominant tags ────────────────────────────────────────────────────────

function computeDominantTags(nodeInfos: ContextNodeInfo[]): string[] {
  const tagCounts = new Map<string, number>();
  for (const node of nodeInfos) {
    for (const tag of node.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  return [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);
}

// ── Date range ───────────────────────────────────────────────────────────

function computeDateRange(nodeInfos: ContextNodeInfo[]): string {
  if (nodeInfos.length === 0) return '';

  let earliest = nodeInfos[0].createdAt;
  let latest = nodeInfos[0].updatedAt;

  for (const node of nodeInfos) {
    if (node.createdAt < earliest) earliest = node.createdAt;
    if (node.updatedAt > latest) latest = node.updatedAt;
  }

  const fmt = (d: string) => d.slice(0, 10); // YYYY-MM-DD
  return `${fmt(earliest)} to ${fmt(latest)}`;
}

// ── Token estimation ─────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  // ~4 tokens per word
  return Math.ceil(text.split(/\s+/).length * 4);
}

// ── Budget-aware assembly ────────────────────────────────────────────────

function applyBudget(
  data: {
    hubs: ContextNodeInfo[];
    bridges: ContextNodeInfo[];
    periphery: ContextNodeInfo[];
    edges: ContextEdgeInfo[];
  },
  meta: {
    seedTags: string[];
    seedQuery: string;
    dominantTags: string[];
    dateRange: string;
    internalEdgeCount: number;
    externalEdgeCount: number;
  },
  budget: number,
): ContextResult {
  const totalNodes = data.hubs.length + data.bridges.length + data.periphery.length;

  // Estimate base tokens (summary + node headers without body previews)
  let tokenEstimate = 200; // summary overhead

  // Each node header: ~20 tokens (id, title, tags, role, degree)
  tokenEstimate += totalNodes * 20;

  // Body previews: ~25 tokens each (100 chars ≈ 25 words ≈ 100 tokens, but we estimate conservatively)
  const bodyPreviewTokens = totalNodes * 30;

  // Edges: ~15 tokens each
  const edgeTokens = data.edges.length * 15;

  // Bridge-to info: ~10 tokens per bridge
  const bridgeToTokens = data.bridges.length * 10;

  tokenEstimate += bodyPreviewTokens + edgeTokens + bridgeToTokens;

  let usedEdges = data.edges;
  let usedPeriphery = data.periphery;
  let peripheryCollapsed = false;

  // Budget trimming
  if (tokenEstimate > budget) {
    // Step 1: Strip body previews
    for (const node of [...data.hubs, ...data.bridges, ...data.periphery]) {
      node.bodyPreview = '';
    }
    tokenEstimate -= bodyPreviewTokens;
  }

  if (tokenEstimate > budget) {
    // Step 2: Strip periphery↔periphery edges (keep hub/bridge edges)
    const hubBridgeIds = new Set([
      ...data.hubs.map((n) => n.id),
      ...data.bridges.map((n) => n.id),
    ]);

    usedEdges = data.edges.filter(
      (e) => hubBridgeIds.has(e.sourceId) || hubBridgeIds.has(e.targetId),
    );
    const removedEdgeTokens = (data.edges.length - usedEdges.length) * 15;
    tokenEstimate -= removedEdgeTokens;
  }

  if (tokenEstimate > budget) {
    // Step 3: Collapse peripheral nodes to summary count
    const peripheryTokensSaved = usedPeriphery.length * 20;
    peripheryCollapsed = true;
    tokenEstimate -= peripheryTokensSaved;
    tokenEstimate += 10; // collapsed summary line
    usedPeriphery = [];
  }

  const summary: ContextSummary = {
    seedTags: meta.seedTags,
    seedQuery: meta.seedQuery,
    totalNodes,
    hubCount: data.hubs.length,
    bridgeCount: data.bridges.length,
    peripheryCount: data.periphery.length,
    internalEdges: meta.internalEdgeCount,
    externalEdges: meta.externalEdgeCount,
    dominantTags: meta.dominantTags,
    dateRange: meta.dateRange,
    budgetTokens: budget,
    usedTokens: Math.min(tokenEstimate, budget),
  };

  return {
    summary,
    hubs: data.hubs,
    bridges: data.bridges,
    periphery: usedPeriphery,
    edges: usedEdges,
  };
}
