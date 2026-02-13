/**
 * LocalBackend — IForestBackend implementation using direct core function calls.
 *
 * Each method calls the corresponding core function and transforms the result
 * to match the API response types (same shapes the server routes produce).
 */

import type { IForestBackend } from './backend';
import type {
  CreateNodeInput,
  CreateNodeResult,
  GetNodeResult,
  ListNodesResult,
  DeleteNodeResult,
  UpdateNodeInput,
  UpdateNodeResult,
  NodeHistoryResult,
  RestoreNodeVersionResult,
  SearchResult,
  MetadataSearchOptions,
  MetadataSearchResult,
  ListEdgesResult,
  CreateEdgeInput,
  CreateEdgeResult,
  DeleteEdgeResult,
  ExplainEdgeResult,
  ListTagsResult,
  RenameTagResult,
  GetNodesByTagResult,
  TagStatsResult,
  AddTagsResult,
  RemoveTagsResult,
  SynthesizeInput,
  SynthesizeResult,
  WriteInput,
  WriteResult,
  ImportInput,
  ImportResult,
  PathResult,
  LinkNodesInput,
  LinkNodesResult,
  NeighborhoodResult,
  ExportJsonResult,
  ListDocumentsResult,
  GetDocumentResult,
  GetDocumentChunksResult,
  DeleteDocumentResult,
  DocumentStatsResult,
  EdgeThresholdsResult,
  SuggestResultRemote,
  HealthResult,
  StatsResult,
  NodeSummary,
  EdgeSummary,
  ContextResultRemote,
} from './client';

import { formatId } from '../cli/shared/utils';

// ── Core imports ────────────────────────────────────────────────────────

import { getStats as getCoreStats } from '../core/stats';
import {
  createNodeCore,
  getNodeCore,
  listNodesCore,
  deleteNodeCore,
  deleteDocumentCore,
  updateNodeCore,
  getNodeEdgesCore,
  getNodeHistoryCore,
  restoreNodeVersionCore,
} from '../core/nodes';
import { semanticSearchCore, metadataSearchCore } from '../core/search';
import {
  listEdgesCore,
  createEdgeCore,
  deleteEdgeCore,
  explainEdgeCore,
} from '../core/edges';
import {
  listTagsCore,
  getNodesByTagCore,
  renameTagCore,
  getTagStatsCore,
} from '../core/tags';
import { linkNodesCore } from '../core/link';
import { findPath } from '../core/graph';
import { importDocumentCore } from '../core/import';
import { getHealthReport, isHealthy } from '../core/health';
import { suggestCore } from '../core/suggest';
import { contextCore } from '../core/context';
import { deduplicateChunks } from './reconstruction';

// ── DB imports (for operations not covered by core) ─────────────────────

import {
  NodeRecord,
  getNodeById,
  listNodes as dbListNodes,
  listEdges as dbListEdges,
  listDocuments,
  getDocumentById,
  getDocumentChunks,
  updateNodeIndexData,
} from './db';
import { getSemanticThreshold, getTagThreshold } from './scoring';
import { resolveEdgeReference } from '../cli/shared/edges';
import { buildNeighborhoodPayload } from '../cli/shared/explore';

// ── Helpers (reuse the server helpers for consistent formatting) ─────────

import {
  formatNodeForList,
  formatNodeForDetail,
  createPaginationInfo,
  resolveNodeId,
} from '../server/utils/helpers';

// ── LocalBackend ────────────────────────────────────────────────────────

export class LocalBackend implements IForestBackend {
  readonly isRemote = false;

  // ── Nodes ──────────────────────────────────────────────────────────

  async createNode(data: CreateNodeInput): Promise<CreateNodeResult> {
    const result = await createNodeCore({
      title: data.title,
      body: data.body,
      tags: data.tags,
      autoLink: data.autoLink !== false,
      metadata: data.metadata as any,
    });
    return {
      node: formatNodeForDetail(result.node) as any,
      linking: {
        edgesCreated: result.linking.edgesCreated,
        edgesRemoved: 0,
        totalEdges: result.linking.edgesCreated,
      },
    };
  }

  async getNode(
    id: string,
    opts?: { includeBody?: boolean; includeEdges?: boolean },
  ): Promise<GetNodeResult> {
    const result = await getNodeCore(id, {
      includeBody: opts?.includeBody !== false,
      includeEdges: opts?.includeEdges !== false,
    });

    const formattedEdges = await Promise.all(
      result.edges.map(async (edge) => {
        const sourceNode = await getNodeById(edge.sourceId);
        const targetNode = await getNodeById(edge.targetId);
        return {
          id: edge.id,
          connectedNodeId:
            edge.sourceId === result.node.id ? edge.targetId : edge.sourceId,
          connectedNode: (edge.sourceId === result.node.id ? targetNode : sourceNode)
            ? {
                id: (edge.sourceId === result.node.id ? targetNode : sourceNode)!.id,
                shortId: formatId(
                  (edge.sourceId === result.node.id ? targetNode : sourceNode)!.id,
                ),
                title: (edge.sourceId === result.node.id ? targetNode : sourceNode)!
                  .title,
                tags: (edge.sourceId === result.node.id ? targetNode : sourceNode)!.tags,
              }
            : null,
          score: edge.score,
          status: edge.status,
          createdAt: edge.createdAt,
        };
      }),
    );

    return {
      node: formatNodeForDetail(result.node, {
        includeBody: opts?.includeBody !== false,
      }) as any,
      edges: formattedEdges,
      edgesTotal: result.edgesTotal,
    };
  }

  async listNodes(
    opts?: { limit?: number; offset?: number; sort?: string; order?: string },
  ): Promise<ListNodesResult> {
    const result = await listNodesCore({
      limit: opts?.limit,
      offset: opts?.offset,
      sort: opts?.sort as any,
      order: opts?.order as any,
    });
    return {
      nodes: result.nodes.map((n) => formatNodeForList(n) as any),
      pagination: createPaginationInfo(
        result.total,
        opts?.limit ?? 20,
        opts?.offset ?? 0,
      ),
    };
  }

  async deleteNode(id: string): Promise<DeleteNodeResult> {
    const result = await deleteNodeCore(id);
    return {
      deleted: { nodeId: result.nodeId, edgesRemoved: result.edgesDeleted },
    };
  }

  async updateNode(id: string, data: UpdateNodeInput): Promise<UpdateNodeResult> {
    const result = await updateNodeCore(id, {
      title: data.title,
      body: data.body,
      tags: data.tags,
      autoLink: data.autoLink !== false,
    });
    return {
      node: formatNodeForDetail(result.node) as any,
      linking: result.linking,
    };
  }

  async getNodeHistory(
    id: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<NodeHistoryResult> {
    const result = await getNodeHistoryCore(id, {
      limit: opts?.limit,
      offset: opts?.offset,
    });
    return {
      node: formatNodeForList(result.node) as any,
      entries: result.entries,
      total: result.total,
      currentVersion: result.currentVersion,
    };
  }

  async restoreNodeVersion(
    id: string,
    version: number,
    opts?: { autoLink?: boolean },
  ): Promise<RestoreNodeVersionResult> {
    const result = await restoreNodeVersionCore(id, version, {
      autoLink: opts?.autoLink !== false,
    });
    return {
      node: formatNodeForDetail(result.node) as any,
      restoredFromVersion: result.restoredFromVersion,
      restoredToVersion: result.restoredToVersion,
      linking: result.linking,
    };
  }

  // ── Search ─────────────────────────────────────────────────────────

  async searchSemantic(
    q: string,
    opts?: { limit?: number; offset?: number; minScore?: number; tags?: string },
  ): Promise<SearchResult> {
    const tags = opts?.tags
      ? opts.tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
      : undefined;
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;

    const result = await semanticSearchCore(q, {
      limit,
      offset,
      minScore: opts?.minScore ?? 0.0,
      tags,
    });

    // Deduplicate chunks — replace chunks with their parent documents
    const deduplicatedNodes = await deduplicateChunks(
      result.nodes.map((item) => item.node),
    );

    // Map back with best similarity scores
    const deduplicatedResults = deduplicatedNodes.map((node) => {
      const matchingScores = result.nodes
        .filter((item) => {
          if (item.node.id === node.id) return true;
          if (item.node.isChunk && item.node.parentDocumentId === node.id) return true;
          return false;
        })
        .map((item) => item.similarity);
      const similarity = matchingScores.length > 0 ? Math.max(...matchingScores) : 0;
      return { node, similarity };
    });

    deduplicatedResults.sort((a, b) => b.similarity - a.similarity);

    const formattedNodes = deduplicatedResults.map((item) => ({
      ...(formatNodeForList(item.node) as any),
      similarity: item.similarity,
    }));

    return {
      query: q,
      nodes: formattedNodes,
      pagination: createPaginationInfo(deduplicatedResults.length, limit, offset),
    };
  }

  async searchMetadata(opts: MetadataSearchOptions): Promise<MetadataSearchResult> {
    const result = await metadataSearchCore({
      id: opts.id,
      title: opts.title,
      term: opts.term,
      limit: opts.limit,
      tagsAll: opts.tagsAll,
      tagsAny: opts.tagsAny,
      since: opts.since,
      until: opts.until,
      sort: opts.sort,
      showChunks: opts.showChunks,
      origin: opts.origin,
      createdBy: opts.createdBy,
    });

    const formattedMatches = result.matches.map((m) => ({
      ...(formatNodeForList(m.node) as any),
      score: m.score,
    }));

    return {
      matches: formattedMatches,
      total: result.total,
    };
  }

  // ── Edges ──────────────────────────────────────────────────────────

  async listEdges(
    opts?: { limit?: number; offset?: number; nodeId?: string },
  ): Promise<ListEdgesResult> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;

    const result = await listEdgesCore({
      nodeId: opts?.nodeId,
      limit,
      offset,
    });

    const formattedEdges: EdgeSummary[] = await Promise.all(
      result.edges.map(async (edge) => {
        const sourceNode = await getNodeById(edge.sourceId);
        const targetNode = await getNodeById(edge.targetId);
        return {
          id: edge.id,
          ref: `${formatId(edge.sourceId).slice(0, 4)}${formatId(edge.targetId).slice(0, 4)}`.toUpperCase(),
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          sourceNode: sourceNode
            ? { id: sourceNode.id, shortId: formatId(sourceNode.id), title: sourceNode.title }
            : null,
          targetNode: targetNode
            ? { id: targetNode.id, shortId: formatId(targetNode.id), title: targetNode.title }
            : null,
          score: edge.score,
          status: edge.status,
          createdAt: edge.createdAt,
          updatedAt: edge.updatedAt,
        };
      }),
    );

    return {
      edges: formattedEdges,
      pagination: createPaginationInfo(result.total, limit, offset),
    };
  }

  async createEdge(data: CreateEdgeInput): Promise<CreateEdgeResult> {
    const result = await createEdgeCore({
      sourceId: data.sourceId,
      targetId: data.targetId,
      score: data.score,
    });
    return {
      edge: {
        id: result.edge.id,
        ref: `${formatId(result.edge.sourceId).slice(0, 4)}${formatId(result.edge.targetId).slice(0, 4)}`.toUpperCase(),
        sourceId: result.edge.sourceId,
        targetId: result.edge.targetId,
        sourceNode: null,
        targetNode: null,
        score: result.edge.score,
        status: result.edge.status,
        createdAt: result.edge.createdAt,
        updatedAt: result.edge.updatedAt,
      },
    };
  }

  async deleteEdge(ref: string): Promise<DeleteEdgeResult> {
    const edges = await dbListEdges('accepted');
    const edge = resolveEdgeReference(ref, edges);
    if (!edge) throw new Error(`No edge matched reference: ${ref}`);

    const result = await deleteEdgeCore(edge);
    return {
      deleted: {
        edgeId: result.deleted.edgeId,
        ref: `${formatId(result.deleted.sourceId).slice(0, 4)}${formatId(result.deleted.targetId).slice(0, 4)}`.toUpperCase(),
      },
    };
  }

  async explainEdge(ref: string): Promise<ExplainEdgeResult> {
    const edges = await dbListEdges('accepted');
    const edge = resolveEdgeReference(ref, edges);
    if (!edge) throw new Error(`No edge matched reference: ${ref}`);

    return await explainEdgeCore(edge);
  }

  // ── Tags ───────────────────────────────────────────────────────────

  async listTags(
    opts?: { sort?: string; order?: string },
  ): Promise<ListTagsResult> {
    const result = await listTagsCore({
      sort: opts?.sort as any,
      order: opts?.order as any,
    });
    return {
      tags: result.tags,
      total: result.total,
    };
  }

  async renameTag(oldName: string, newName: string): Promise<RenameTagResult> {
    const result = await renameTagCore(oldName, newName);
    return {
      renamed: result,
    };
  }

  async getNodesByTag(
    name: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<GetNodesByTagResult> {
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;
    const result = await getNodesByTagCore(name, { limit, offset });
    return {
      tag: result.tag,
      nodes: result.nodes.map((n) => formatNodeForList(n) as any),
      pagination: createPaginationInfo(result.total, limit, offset),
    };
  }

  async getTagStats(
    opts?: { focusTag?: string; minCount?: number; top?: number },
  ): Promise<TagStatsResult> {
    return await getTagStatsCore({
      focusTag: opts?.focusTag,
      minCount: opts?.minCount,
      top: opts?.top,
    });
  }

  async addTags(nodeId: string, tags: string[]): Promise<AddTagsResult> {
    const resolved = await resolveNodeId(nodeId);
    const node = resolved;

    const tagsToAdd = tags
      .map((t) => t.trim().replace(/^#/, '').toLowerCase())
      .filter((t) => t.length > 0);
    const nextTags = Array.from(
      new Set([...node.tags, ...tagsToAdd].map((t) => t.toLowerCase())),
    ).sort();
    await updateNodeIndexData(node.id, nextTags, node.tokenCounts);

    return { nodeId: node.id, added: tagsToAdd, tags: nextTags };
  }

  async removeTags(nodeId: string, tags: string[]): Promise<RemoveTagsResult> {
    const resolved = await resolveNodeId(nodeId);
    const node = resolved;

    const tagsToRemove = new Set(
      tags.map((t) => t.trim().replace(/^#/, '').toLowerCase()),
    );
    const before = node.tags.map((t) => t.toLowerCase());
    const nextTags = before.filter((t) => !tagsToRemove.has(t)).sort();
    const removed = before.filter((t) => tagsToRemove.has(t));

    await updateNodeIndexData(node.id, nextTags, node.tokenCounts);

    return { nodeId: node.id, removed, tags: nextTags };
  }

  // ── Synthesize / Write ─────────────────────────────────────────────

  async synthesize(data: SynthesizeInput): Promise<SynthesizeResult> {
    const { synthesizeNodesCore } = await import('../core/synthesize');

    const result = await synthesizeNodesCore(data.nodeIds, {
      model: data.model as any,
      reasoning: data.reasoning as any,
      verbosity: data.verbosity as any,
      maxTokens: data.maxTokens,
    });

    let nodeData: any = undefined;
    let linkingData: any = undefined;

    if (!data.preview) {
      const autoLink = data.autoLink !== false;
      const nodeResult = await createNodeCore({
        title: result.title,
        body: result.body,
        tags: result.suggestedTags,
        autoLink,
        metadata: {
          origin: 'synthesize',
          createdBy: 'ai',
          model: result.model,
          sourceNodes: result.sourceNodeIds,
        },
      });
      nodeData = formatNodeForDetail(nodeResult.node) as any;
      linkingData = nodeResult.linking;
    }

    return {
      title: result.title,
      body: result.body,
      suggestedTags: result.suggestedTags,
      sourceNodeIds: result.sourceNodeIds,
      model: result.model,
      reasoningEffort: result.reasoningEffort,
      verbosity: result.verbosity,
      cost: result.cost,
      tokensUsed: result.tokensUsed,
      node: nodeData,
      linking: linkingData,
    };
  }

  async write(data: WriteInput): Promise<WriteResult> {
    const { writeArticleCore } = await import('../core/write');

    const result = await writeArticleCore(data.topic, {
      model: data.model as any,
      reasoning: data.reasoning as any,
      verbosity: data.verbosity as any,
      maxTokens: data.maxTokens,
    });

    let nodeData: any = undefined;
    let linkingData: any = undefined;

    if (!data.preview) {
      const autoLink = data.autoLink !== false;
      const nodeResult = await createNodeCore({
        title: result.title,
        body: result.body,
        tags: result.suggestedTags,
        autoLink,
        metadata: {
          origin: 'write',
          createdBy: 'ai',
          model: result.model,
        },
      });
      nodeData = formatNodeForDetail(nodeResult.node) as any;
      linkingData = nodeResult.linking;
    }

    return {
      title: result.title,
      body: result.body,
      suggestedTags: result.suggestedTags,
      model: result.model,
      reasoningEffort: result.reasoningEffort,
      verbosity: result.verbosity,
      cost: result.cost,
      tokensUsed: result.tokensUsed,
      node: nodeData,
      linking: linkingData,
    };
  }

  // ── Import ─────────────────────────────────────────────────────────

  async importDocument(data: ImportInput): Promise<ImportResult> {
    const result = await importDocumentCore(data.body, {
      documentTitle: data.title,
      tags: data.tags,
      chunkStrategy: data.chunkStrategy as any,
      maxTokens: data.maxTokens,
      overlap: data.overlap,
      autoLink: data.autoLink,
      createParent: data.createParent,
      linkSequential: data.linkSequential,
    });

    return {
      documentTitle: result.documentTitle,
      rootNode: result.rootNode
        ? {
            id: result.rootNode.id,
            shortId: formatId(result.rootNode.id),
            title: result.rootNode.title,
            bodyPreview: result.rootNode.body.slice(0, 100),
            bodyLength: result.rootNode.body.length,
            tags: result.rootNode.tags,
            hasEmbedding: Boolean(result.rootNode.embedding),
            createdAt: result.rootNode.createdAt,
            updatedAt: result.rootNode.updatedAt,
          }
        : null,
      chunks: result.chunks.map((c) => ({
        id: c.node.id,
        title: c.node.title,
        tags: c.node.tags,
        chunkIndex: c.chunk.metadata.chunkIndex,
        estimatedTokens: c.chunk.metadata.estimatedTokens,
      })),
      totalChunks: result.totalChunks,
      linking: result.linking,
    };
  }

  // ── Graph ──────────────────────────────────────────────────────────

  async findPath(from: string, to: string): Promise<PathResult> {
    const fromNode = await resolveNodeId(from);
    const toNode = await resolveNodeId(to);
    return await findPath(fromNode.id, toNode.id);
  }

  async linkNodes(data: LinkNodesInput): Promise<LinkNodesResult> {
    const sourceNode = await resolveNodeId(data.sourceId);
    const targetNode = await resolveNodeId(data.targetId);
    return await linkNodesCore({
      sourceId: sourceNode.id,
      targetId: targetNode.id,
      name: data.name,
    });
  }

  async getNeighborhood(
    id: string,
    opts?: { depth?: number; limit?: number },
  ): Promise<NeighborhoodResult> {
    const depth = opts?.depth ?? 1;
    const limit = opts?.limit ?? 50;
    const { payload } = await buildNeighborhoodPayload(id, depth, limit);
    return payload;
  }

  // ── Export ─────────────────────────────────────────────────────────

  async exportJson(
    opts?: { body?: boolean; edges?: boolean },
  ): Promise<ExportJsonResult> {
    const includeBody = opts?.body !== false;
    const includeEdges = opts?.edges !== false;

    const nodes = await dbListNodes();
    const edges = includeEdges ? await dbListEdges('all') : [];

    return {
      nodes: nodes.map((node) => ({
        id: node.id,
        title: node.title,
        tags: node.tags,
        body: includeBody ? node.body : undefined,
        tokenCounts: node.tokenCounts,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        status: edge.status,
        score: edge.score,
        metadata: edge.metadata,
        createdAt: edge.createdAt,
        updatedAt: edge.updatedAt,
      })),
    };
  }

  async exportGraphviz(
    opts: { id: string; depth?: number; limit?: number },
  ): Promise<{ dot: string }> {
    const depth = opts.depth ?? 1;
    const limit = opts.limit ?? 25;

    const { payload } = await buildNeighborhoodPayload(opts.id, depth, limit);
    const nodes = await dbListNodes();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const lines: string[] = [];
    lines.push('graph forest {');
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=box, fontname="Helvetica"];');

    const defined = new Set<string>();
    const ensureNodeDefined = (id: string) => {
      if (defined.has(id)) return;
      const title = nodeMap.get(id)?.title ?? id;
      const escaped = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      lines.push(`  "${id}" [label="${formatId(id)} ${escaped}"];`);
      defined.add(id);
    };

    payload.nodes.forEach((n) => ensureNodeDefined(n.id));
    payload.edges.forEach((edge) => {
      ensureNodeDefined(edge.source);
      ensureNodeDefined(edge.target);
      lines.push(
        `  "${edge.source}" -- "${edge.target}" [label="${edge.score.toFixed(3)}"];`,
      );
    });

    lines.push('}');
    return { dot: lines.join('\n') };
  }

  // ── Documents ──────────────────────────────────────────────────────

  async listDocuments(): Promise<ListDocumentsResult> {
    const documents = await listDocuments();
    return { documents, count: documents.length };
  }

  async getDocument(id: string): Promise<GetDocumentResult> {
    const document = await getDocumentById(id);
    if (!document) throw new Error(`Document not found: ${id}`);
    return { document };
  }

  async getDocumentChunks(id: string): Promise<GetDocumentChunksResult> {
    const document = await getDocumentById(id);
    if (!document) throw new Error(`Document not found: ${id}`);
    const chunks = await getDocumentChunks(id);
    return { chunks, count: chunks.length };
  }

  async deleteDocument(id: string): Promise<DeleteDocumentResult> {
    const result = await deleteDocumentCore(id);
    return {
      deleted: {
        documentId: result.documentId,
        nodesRemoved: result.nodesRemoved,
        edgesRemoved: result.edgesRemoved,
      },
    };
  }

  async getDocumentStats(): Promise<DocumentStatsResult> {
    const documents = await listDocuments();

    let totalChunks = 0;
    let totalVersions = 0;
    const sources = new Map<string, number>();
    const strategies = new Map<string, number>();

    for (const doc of documents) {
      const metadata = doc.metadata as any;
      totalVersions += doc.version;
      if (metadata) {
        if (metadata.chunkCount) totalChunks += metadata.chunkCount;
        if (metadata.source) {
          sources.set(metadata.source, (sources.get(metadata.source) ?? 0) + 1);
        }
        if (metadata.chunkStrategy) {
          strategies.set(
            metadata.chunkStrategy,
            (strategies.get(metadata.chunkStrategy) ?? 0) + 1,
          );
        }
      }
    }

    const avgVersion = documents.length > 0 ? totalVersions / documents.length : 0;
    const avgChunks = documents.length > 0 ? totalChunks / documents.length : 0;

    return {
      totalDocuments: documents.length,
      totalChunks,
      avgChunksPerDocument: Math.round(avgChunks * 10) / 10,
      avgVersion: Math.round(avgVersion * 10) / 10,
      bySource: Object.fromEntries(sources),
      byStrategy: Object.fromEntries(strategies),
    };
  }

  // ── Context ────────────────────────────────────────────────────────

  async getContext(
    opts: { tag?: string; query?: string; budget?: number },
  ): Promise<ContextResultRemote> {
    return await contextCore({
      tag: opts.tag,
      query: opts.query,
      budget: opts.budget,
    });
  }

  // ── System ─────────────────────────────────────────────────────────

  async getEdgeThresholds(): Promise<EdgeThresholdsResult> {
    return {
      semanticThreshold: getSemanticThreshold(),
      tagThreshold: getTagThreshold(),
    };
  }

  async suggest(
    opts?: { project?: string; limit?: number },
  ): Promise<SuggestResultRemote> {
    const result = await suggestCore({
      project: opts?.project,
      limit: opts?.limit,
    });
    return result as SuggestResultRemote;
  }

  async getHealth(): Promise<HealthResult> {
    const report = await getHealthReport();
    const healthy = isHealthy(report);
    return {
      status: healthy ? 'healthy' : 'degraded',
      database: {
        connected: report.database.status === 'ok',
        path: report.database.path,
        size: report.database.sizeBytes,
      },
      embeddings: {
        provider: report.embeddingProvider.provider ?? 'unknown',
        available: report.embeddingProvider.status === 'ok',
      },
      uptime: process.uptime(),
    };
  }

  async getStats(opts?: { top?: number }): Promise<StatsResult> {
    const top =
      typeof opts?.top === 'number' && Number.isFinite(opts.top) && opts.top > 0
        ? Math.floor(opts.top)
        : 10;
    const stats = await getCoreStats({ top });

    return {
      nodes: {
        total: stats.counts.nodes,
        recentCount: stats.recent.length,
        recent: stats.recent.map((n) => ({
          id: n.id,
          title: n.title,
          createdAt: n.updatedAt,
        })),
      },
      edges: { total: stats.counts.edges },
      degree: stats.degree,
      tags: {
        total: stats.tags.reduce((s, t) => s + t.count, 0),
        topTags: stats.tags.map((t) => ({ name: t.tag, count: t.count })),
      },
      tagPairs: stats.tagPairs,
      highDegreeNodes: stats.highDegree.map((n) => ({
        id: n.id,
        title: n.title,
        edgeCount: n.degree,
      })),
    };
  }
}
