/**
 * ForestClient — HTTP wrapper for the Forest REST API.
 *
 * Pure TypeScript using built-in `fetch`. No external dependencies.
 * Reusable by any client (CLI, Telegram bot, desktop app, scripts).
 */

// ── Error class ────────────────────────────────────────────────────────

export class ForestClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ForestClientError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────

export interface ForestClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Shape returned by the API for success responses */
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: { timestamp: string; version: string };
}

/** Shape returned by the API for error responses */
interface ApiErrorResponse {
  success: false;
  error: { code: string; message: string; details: Record<string, unknown> };
  meta: { timestamp: string; version: string };
}

// ── Node types ─────────────────────────────────────────────────────────

export interface NodeSummary {
  id: string;
  shortId: string;
  title: string;
  bodyPreview: string;
  bodyLength: number;
  tags: string[];
  hasEmbedding: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NodeDetail extends NodeSummary {
  body?: string;
  tokenCounts?: Record<string, number>;
  metadata?: {
    origin?: string;
    createdBy?: string;
    sourceNodes?: string[];
    sourceFile?: string;
    model?: string;
    [key: string]: unknown;
  } | null;
}

export interface CreateNodeInput {
  title?: string;
  body: string;
  tags?: string[];
  autoLink?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateNodeResult {
  node: NodeDetail;
  linking: { edgesCreated: number; edgesRemoved: number; totalEdges: number };
}

export interface GetNodeResult {
  node: NodeDetail;
  edges: any[];
  edgesTotal: number;
}

export interface ListNodesResult {
  nodes: NodeSummary[];
  pagination: PaginationInfo;
}

export interface DeleteNodeResult {
  deleted: { nodeId: string; edgesRemoved: number };
}

// ── Search types ───────────────────────────────────────────────────────

export interface SearchResult {
  query: string;
  nodes: Array<NodeSummary & { similarity: number }>;
  pagination: PaginationInfo;
}

// ── Metadata search types ──────────────────────────────────────────────

export interface MetadataSearchOptions {
  id?: string;
  title?: string;
  term?: string;
  limit?: number;
  tagsAll?: string[];
  tagsAny?: string[];
  since?: string;
  until?: string;
  sort?: 'score' | 'recent' | 'degree';
  showChunks?: boolean;
  origin?: string;
  createdBy?: string;
}

export interface MetadataSearchMatch extends NodeSummary {
  score: number;
  metadata?: {
    origin?: string;
    createdBy?: string;
    sourceNodes?: string[];
    sourceFile?: string;
    model?: string;
    [key: string]: unknown;
  } | null;
}

export interface MetadataSearchResult {
  matches: MetadataSearchMatch[];
  total: number;
}

// ── Edge types ─────────────────────────────────────────────────────────

export interface EdgeSummary {
  id: string;
  ref: string;
  sourceId: string;
  targetId: string;
  sourceNode: { id: string; shortId: string; title: string } | null;
  targetNode: { id: string; shortId: string; title: string } | null;
  score: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListEdgesResult {
  edges: EdgeSummary[];
  pagination: PaginationInfo;
}

// ── Tag types ──────────────────────────────────────────────────────────

export interface TagEntry {
  name: string;
  count: number;
}

export interface ListTagsResult {
  tags: TagEntry[];
  total: number;
}

// ── Stats types ────────────────────────────────────────────────────────

export interface StatsResult {
  nodes: { total: number; recentCount: number; recent: Array<{ id: string; title: string; createdAt: string }> };
  edges: { total: number };
  degree: { avg: number; median: number; p90: number; max: number };
  tags: { total: number; topTags: Array<{ name: string; count: number }> };
  tagPairs: Array<{ pair: string; count: number }>;
  highDegreeNodes: Array<{ id: string; title: string; edgeCount: number }>;
}

// ── Update node types ─────────────────────────────────────────────────

export interface UpdateNodeInput {
  title?: string;
  body?: string;
  tags?: string[];
  autoLink?: boolean;
}

export interface UpdateNodeResult {
  node: NodeDetail;
  linking: { edgesCreated: number };
}

// ── Edge mutation types ───────────────────────────────────────────────

export interface CreateEdgeInput {
  sourceId: string;
  targetId: string;
  score?: number;
}

export interface CreateEdgeResult {
  edge: EdgeSummary;
}

export interface DeleteEdgeResult {
  deleted: { edgeId: string; ref: string };
}

export interface ExplainEdgeResult {
  edge: {
    id: string;
    sourceId: string;
    targetId: string;
    score: number;
    semanticScore: number | null;
    tagScore: number | null;
    sharedTags: string[];
  };
  breakdown: {
    semanticScore: number | null;
    tagScore: number | null;
    sharedTags: string[];
    tagComponents: Record<string, unknown>;
  };
  classification: {
    status: string;
    semanticThreshold: number;
    tagThreshold: number;
  };
}

// ── Tag mutation types ────────────────────────────────────────────────

export interface RenameTagResult {
  renamed: { from: string; to: string; nodesAffected: number };
}

export interface GetNodesByTagResult {
  tag: string;
  nodes: NodeSummary[];
  pagination: PaginationInfo;
}

export interface TagStatsResult {
  totalTags: number;
  topTags: Array<{ name: string; count: number; lastUsed: string }>;
  coOccurrences?: Array<{ tag: string; count: number }>;
}

export interface AddTagsResult {
  nodeId: string;
  added: string[];
  tags: string[];
}

export interface RemoveTagsResult {
  nodeId: string;
  removed: string[];
  tags: string[];
}

// ── Synthesize/Write types ────────────────────────────────────────────

export interface SynthesizeInput {
  nodeIds: string[];
  model?: string;
  reasoning?: string;
  verbosity?: string;
  maxTokens?: number;
  preview?: boolean;
  autoLink?: boolean;
}

export interface SynthesizeResult {
  title: string;
  body: string;
  suggestedTags: string[];
  sourceNodeIds: string[];
  model: string;
  reasoningEffort: string;
  verbosity: string;
  cost: number;
  tokensUsed: { reasoning: number; output: number };
  node?: NodeDetail;
  linking?: { edgesCreated: number };
}

export interface WriteInput {
  topic: string;
  model?: string;
  reasoning?: string;
  verbosity?: string;
  maxTokens?: number;
  preview?: boolean;
  autoLink?: boolean;
}

export interface WriteResult {
  title: string;
  body: string;
  suggestedTags: string[];
  model: string;
  reasoningEffort: string;
  verbosity: string;
  cost: number;
  tokensUsed: { reasoning: number; output: number };
  node?: NodeDetail;
  linking?: { edgesCreated: number };
}

// ── Import types ──────────────────────────────────────────────────────

export interface ImportInput {
  body: string;
  title?: string;
  tags?: string[];
  chunkStrategy?: string;
  maxTokens?: number;
  overlap?: number;
  autoLink?: boolean;
  createParent?: boolean;
  linkSequential?: boolean;
}

export interface ImportResult {
  documentTitle: string;
  rootNode: NodeSummary | null;
  chunks: Array<{
    id: string;
    title: string;
    tags: string[];
    chunkIndex: number;
    estimatedTokens: number;
  }>;
  totalChunks: number;
  linking: {
    parentChildEdges: number;
    sequentialEdges: number;
    semanticAccepted: number;
  };
}

// ── Path types ────────────────────────────────────────────────────────

export interface PathStep {
  nodeId: string;
  nodeTitle: string;
  edgeId?: string;
  edgeScore?: number;
  edgeType?: string;
}

export interface PathResult {
  found: boolean;
  path: PathStep[];
  totalScore: number;
  hopCount: number;
}

// ── Link types ────────────────────────────────────────────────────────

export interface LinkNodesInput {
  sourceId: string;
  targetId: string;
  name?: string;
}

export interface LinkNodesResult {
  tag: string;
  nodes: Array<{ id: string; shortId: string; title: string }>;
  edge: {
    sourceId: string;
    targetId: string;
    status: string;
    score: number;
    semanticScore: number | null;
    tagScore: number | null;
    sharedTags: string[];
  };
}

// ── Neighborhood types ────────────────────────────────────────────────

export interface NeighborhoodNode {
  id: string;
  title: string;
  tags: string[];
  snippet: string;
  createdAt: string;
  updatedAt: string;
}

export interface NeighborhoodEdge {
  id: string;
  source: string;
  target: string;
  score: number;
}

export interface NeighborhoodResult {
  center: string;
  nodes: NeighborhoodNode[];
  edges: NeighborhoodEdge[];
}

// ── Export types ───────────────────────────────────────────────────────

export interface ExportJsonResult {
  nodes: Array<{
    id: string;
    title: string;
    tags: string[];
    body?: string;
    tokenCounts?: Record<string, number>;
    createdAt: string;
    updatedAt: string;
  }>;
  edges: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    status: string;
    score: number;
    metadata: unknown;
    createdAt: string;
    updatedAt: string;
  }>;
}

// ── Document types ────────────────────────────────────────────────────

export interface DocumentSummary {
  id: string;
  title: string;
  version: number;
  rootNodeId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListDocumentsResult {
  documents: DocumentSummary[];
  count: number;
}

export interface GetDocumentResult {
  document: DocumentSummary & { body?: string };
}

export interface DocumentChunk {
  documentId: string;
  segmentId: string;
  nodeId: string;
  offset: number;
  length: number;
  chunkOrder: number;
  checksum: string;
}

export interface GetDocumentChunksResult {
  chunks: DocumentChunk[];
  count: number;
}

export interface DocumentStatsResult {
  totalDocuments: number;
  totalChunks: number;
  avgChunksPerDocument: number;
  avgVersion: number;
  bySource: Record<string, number>;
  byStrategy: Record<string, number>;
}

// ── Edge threshold types ─────────────────────────────────────────────

export interface EdgeThresholdsResult {
  semanticThreshold: number;
  tagThreshold: number;
}

// ── Suggest types ────────────────────────────────────────────────────

export interface SuggestResultRemote {
  project: string;
  source: string;
  suggestions: Array<{
    id: string;
    shortId: string;
    title: string;
    tags: string[];
    excerpt: string;
    matchType: string;
    score: number | null;
  }>;
  total: number;
}

// ── Context types ─────────────────────────────────────────────────────

export interface ContextNodeRemote {
  id: string;
  shortId: string;
  title: string;
  tags: string[];
  roles: string[];
  pagerank: number;
  bodyPreview: string;
  degree: { internal: number; external: number };
  bridgeTo?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContextEdgeRemote {
  sourceId: string;
  targetId: string;
  score: number;
  semanticScore: number | null;
  tagScore: number | null;
}

export interface ContextSummaryRemote {
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

export interface ContextResultRemote {
  summary: ContextSummaryRemote;
  hubs: ContextNodeRemote[];
  bridges: ContextNodeRemote[];
  periphery: ContextNodeRemote[];
  edges: ContextEdgeRemote[];
}

// ── Health types ───────────────────────────────────────────────────────

export interface HealthResult {
  status: 'healthy' | 'degraded';
  database: { connected: boolean; path?: string; size?: number };
  embeddings: { provider: string; available: boolean };
  uptime: number;
}

// ── Client ─────────────────────────────────────────────────────────────

import type { IForestBackend } from './backend';

export class ForestClient implements IForestBackend {
  readonly isRemote = true;
  private baseUrl: string;
  private apiKey?: string;

  constructor(options: ForestClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
  }

  // ── Generic request ────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; query?: Record<string, string | number | undefined> } = {},
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    if (options.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const init: RequestInit = { method, headers };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      throw new ForestClientError(
        'NETWORK_ERROR',
        `Failed to connect to ${this.baseUrl}: ${(err as Error).message}`,
        0,
      );
    }

    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new ForestClientError(
        'PARSE_ERROR',
        `Invalid JSON response from server (HTTP ${response.status})`,
        response.status,
      );
    }

    if (!response.ok || json.success === false) {
      const apiError = (json as ApiErrorResponse).error ?? { code: 'UNKNOWN', message: 'Unknown error', details: {} };
      throw new ForestClientError(
        apiError.code,
        apiError.message,
        response.status,
        apiError.details,
      );
    }

    return (json as ApiSuccessResponse<T>).data;
  }

  // ── Nodes ──────────────────────────────────────────────────────────

  async createNode(data: CreateNodeInput): Promise<CreateNodeResult> {
    return this.request<CreateNodeResult>('POST', '/api/v1/nodes', { body: data });
  }

  async getNode(id: string, opts?: { includeBody?: boolean; includeEdges?: boolean }): Promise<GetNodeResult> {
    return this.request<GetNodeResult>('GET', `/api/v1/nodes/${encodeURIComponent(id)}`, {
      query: {
        includeBody: opts?.includeBody !== false ? 'true' : 'false',
        includeEdges: opts?.includeEdges !== false ? 'true' : 'false',
      },
    });
  }

  async listNodes(opts?: { limit?: number; offset?: number; sort?: string; order?: string }): Promise<ListNodesResult> {
    return this.request<ListNodesResult>('GET', '/api/v1/nodes', {
      query: {
        limit: opts?.limit,
        offset: opts?.offset,
        sort: opts?.sort,
        order: opts?.order,
      },
    });
  }

  async deleteNode(id: string): Promise<DeleteNodeResult> {
    return this.request<DeleteNodeResult>('DELETE', `/api/v1/nodes/${encodeURIComponent(id)}`);
  }

  // ── Search ─────────────────────────────────────────────────────────

  async searchSemantic(q: string, opts?: { limit?: number; offset?: number; minScore?: number; tags?: string }): Promise<SearchResult> {
    return this.request<SearchResult>('GET', '/api/v1/search/semantic', {
      query: {
        q,
        limit: opts?.limit,
        offset: opts?.offset,
        minScore: opts?.minScore,
        tags: opts?.tags,
      },
    });
  }

  async searchMetadata(opts: MetadataSearchOptions): Promise<MetadataSearchResult> {
    return this.request<MetadataSearchResult>('GET', '/api/v1/search/metadata', {
      query: {
        id: opts.id,
        title: opts.title,
        term: opts.term,
        limit: opts.limit,
        tags: opts.tagsAll?.join(','),
        anyTag: opts.tagsAny?.join(','),
        since: opts.since,
        until: opts.until,
        sort: opts.sort,
        showChunks: opts.showChunks ? 'true' : undefined,
        origin: opts.origin,
        createdBy: opts.createdBy,
      },
    });
  }

  // ── Edges ──────────────────────────────────────────────────────────

  async listEdges(opts?: { limit?: number; offset?: number; nodeId?: string }): Promise<ListEdgesResult> {
    return this.request<ListEdgesResult>('GET', '/api/v1/edges', {
      query: {
        limit: opts?.limit,
        offset: opts?.offset,
        nodeId: opts?.nodeId,
      },
    });
  }

  // ── Tags ───────────────────────────────────────────────────────────

  async listTags(opts?: { sort?: string; order?: string }): Promise<ListTagsResult> {
    return this.request<ListTagsResult>('GET', '/api/v1/tags', {
      query: {
        sort: opts?.sort,
        order: opts?.order,
      },
    });
  }

  async updateNode(id: string, data: UpdateNodeInput): Promise<UpdateNodeResult> {
    return this.request<UpdateNodeResult>('PUT', `/api/v1/nodes/${encodeURIComponent(id)}`, { body: data });
  }

  // ── Edges ──────────────────────────────────────────────────────────

  async createEdge(data: CreateEdgeInput): Promise<CreateEdgeResult> {
    return this.request<CreateEdgeResult>('POST', '/api/v1/edges', { body: data });
  }

  async deleteEdge(ref: string): Promise<DeleteEdgeResult> {
    return this.request<DeleteEdgeResult>('DELETE', `/api/v1/edges/${encodeURIComponent(ref)}`);
  }

  async explainEdge(ref: string): Promise<ExplainEdgeResult> {
    return this.request<ExplainEdgeResult>('GET', `/api/v1/edges/${encodeURIComponent(ref)}/explain`);
  }

  // ── Tags ───────────────────────────────────────────────────────────

  async renameTag(oldName: string, newName: string): Promise<RenameTagResult> {
    return this.request<RenameTagResult>('PUT', `/api/v1/tags/${encodeURIComponent(oldName)}`, {
      body: { newName },
    });
  }

  async getNodesByTag(name: string, opts?: { limit?: number; offset?: number }): Promise<GetNodesByTagResult> {
    return this.request<GetNodesByTagResult>('GET', `/api/v1/tags/${encodeURIComponent(name)}/nodes`, {
      query: {
        limit: opts?.limit,
        offset: opts?.offset,
      },
    });
  }

  async getTagStats(opts?: { focusTag?: string; minCount?: number; top?: number }): Promise<TagStatsResult> {
    return this.request<TagStatsResult>('GET', '/api/v1/tags/stats', {
      query: {
        focusTag: opts?.focusTag,
        minCount: opts?.minCount,
        top: opts?.top,
      },
    });
  }

  async addTags(nodeId: string, tags: string[]): Promise<AddTagsResult> {
    return this.request<AddTagsResult>('POST', `/api/v1/nodes/${encodeURIComponent(nodeId)}/tags`, {
      body: { tags },
    });
  }

  async removeTags(nodeId: string, tags: string[]): Promise<RemoveTagsResult> {
    return this.request<RemoveTagsResult>('DELETE', `/api/v1/nodes/${encodeURIComponent(nodeId)}/tags`, {
      body: { tags },
    });
  }

  // ── Synthesize ─────────────────────────────────────────────────────

  async synthesize(data: SynthesizeInput): Promise<SynthesizeResult> {
    return this.request<SynthesizeResult>('POST', '/api/v1/nodes/synthesize', { body: data });
  }

  // ── Write ──────────────────────────────────────────────────────────

  async write(data: WriteInput): Promise<WriteResult> {
    return this.request<WriteResult>('POST', '/api/v1/nodes/write', { body: data });
  }

  // ── Import ─────────────────────────────────────────────────────────

  async importDocument(data: ImportInput): Promise<ImportResult> {
    return this.request<ImportResult>('POST', '/api/v1/documents/import', { body: data });
  }

  // ── Path ───────────────────────────────────────────────────────────

  async findPath(from: string, to: string): Promise<PathResult> {
    return this.request<PathResult>('GET', '/api/v1/graph/path', {
      query: { from, to },
    });
  }

  // ── Link ───────────────────────────────────────────────────────────

  async linkNodes(data: LinkNodesInput): Promise<LinkNodesResult> {
    return this.request<LinkNodesResult>('POST', '/api/v1/nodes/link', { body: data });
  }

  // ── Neighborhood ───────────────────────────────────────────────────

  async getNeighborhood(id: string, opts?: { depth?: number; limit?: number }): Promise<NeighborhoodResult> {
    return this.request<NeighborhoodResult>('GET', `/api/v1/nodes/${encodeURIComponent(id)}/neighborhood`, {
      query: {
        depth: opts?.depth,
        limit: opts?.limit,
      },
    });
  }

  // ── Export ─────────────────────────────────────────────────────────

  async exportJson(opts?: { body?: boolean; edges?: boolean }): Promise<ExportJsonResult> {
    return this.request<ExportJsonResult>('GET', '/api/v1/export/json', {
      query: {
        body: opts?.body !== false ? 'true' : 'false',
        edges: opts?.edges !== false ? 'true' : 'false',
      },
    });
  }

  // ── Documents ────────────────────────────────────────────────────────

  async listDocuments(): Promise<ListDocumentsResult> {
    return this.request<ListDocumentsResult>('GET', '/api/v1/documents');
  }

  async getDocument(id: string): Promise<GetDocumentResult> {
    return this.request<GetDocumentResult>('GET', `/api/v1/documents/${encodeURIComponent(id)}`);
  }

  async getDocumentChunks(id: string): Promise<GetDocumentChunksResult> {
    return this.request<GetDocumentChunksResult>('GET', `/api/v1/documents/${encodeURIComponent(id)}/chunks`);
  }

  async getDocumentStats(): Promise<DocumentStatsResult> {
    return this.request<DocumentStatsResult>('GET', '/api/v1/documents/stats');
  }

  // ── Edge Thresholds ─────────────────────────────────────────────────

  async getEdgeThresholds(): Promise<EdgeThresholdsResult> {
    return this.request<EdgeThresholdsResult>('GET', '/api/v1/edges/threshold');
  }

  // ── Suggest ─────────────────────────────────────────────────────────

  async suggest(opts?: { project?: string; limit?: number }): Promise<SuggestResultRemote> {
    return this.request<SuggestResultRemote>('GET', '/api/v1/suggest', {
      query: {
        project: opts?.project,
        limit: opts?.limit,
      },
    });
  }

  // ── Export Graphviz ─────────────────────────────────────────────────

  async exportGraphviz(opts: { id: string; depth?: number; limit?: number }): Promise<{ dot: string }> {
    return this.request<{ dot: string }>('GET', '/api/v1/export/graphviz', {
      query: {
        id: opts.id,
        depth: opts.depth,
        limit: opts.limit,
      },
    });
  }

  // ── Context ────────────────────────────────────────────────────────

  async getContext(opts: { tag?: string; query?: string; budget?: number }): Promise<ContextResultRemote> {
    return this.request<ContextResultRemote>('GET', '/api/v1/context', {
      query: {
        tag: opts.tag,
        query: opts.query,
        budget: opts.budget,
      },
    });
  }

  // ── Stats ──────────────────────────────────────────────────────────

  async getStats(opts?: { top?: number }): Promise<StatsResult> {
    return this.request<StatsResult>('GET', '/api/v1/stats', {
      query: { top: opts?.top },
    });
  }

  // ── Health ─────────────────────────────────────────────────────────

  async getHealth(): Promise<HealthResult> {
    return this.request<HealthResult>('GET', '/api/v1/health');
  }
}
