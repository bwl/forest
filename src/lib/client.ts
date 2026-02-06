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
}

export interface CreateNodeInput {
  title?: string;
  body: string;
  tags?: string[];
  autoLink?: boolean;
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
  tags: { total: number; topTags: Array<{ name: string; count: number }> };
  highDegreeNodes: Array<{ id: string; title: string; edgeCount: number }>;
}

// ── Health types ───────────────────────────────────────────────────────

export interface HealthResult {
  status: 'healthy' | 'degraded';
  database: { connected: boolean; path?: string; size?: number };
  embeddings: { provider: string; available: boolean };
  uptime: number;
}

// ── Client ─────────────────────────────────────────────────────────────

export class ForestClient {
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

  // ── Stats ──────────────────────────────────────────────────────────

  async getStats(): Promise<StatsResult> {
    return this.request<StatsResult>('GET', '/api/v1/stats');
  }

  // ── Health ─────────────────────────────────────────────────────────

  async getHealth(): Promise<HealthResult> {
    return this.request<HealthResult>('GET', '/api/v1/health');
  }
}
