// Forest API Client
// Connects to Forest REST API server (default: localhost:3000)

export interface Node {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  node: Node;
  similarity: number;
}

export interface Stats {
  nodes: {
    total: number;
    withEmbeddings: number;
  };
  edges: {
    total: number;
    accepted: number;
    suggested: number;
  };
  tags: {
    total: number;
  };
}

export interface HealthStatus {
  status: string;
  version: string;
  timestamp: string;
}

export class ForestAPI {
  constructor(private baseUrl: string) {}

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`API Error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const result = await this.request<{ nodes: SearchResult[] }>(
      `/api/v1/search/semantic?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    return result.nodes;
  }

  async getNode(id: string): Promise<Node> {
    const result = await this.request<{ node: Node }>(`/api/v1/nodes/${id}`);
    return result.node;
  }

  async listNodes(params?: {
    limit?: number;
    offset?: number;
    tags?: string[];
  }): Promise<{ nodes: Node[]; total: number }> {
    const queryParams = new URLSearchParams({
      limit: (params?.limit || 20).toString(),
      offset: (params?.offset || 0).toString(),
    });

    if (params?.tags?.length) {
      queryParams.set('tags', params.tags.join(','));
    }

    const result = await this.request<{ nodes: Node[]; pagination: { total: number } }>(
      `/api/v1/nodes?${queryParams}`
    );

    return {
      nodes: result.nodes,
      total: result.pagination.total,
    };
  }

  async getStats(): Promise<Stats> {
    return this.request<Stats>('/api/v1/stats');
  }

  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/api/v1/health');
  }
}
