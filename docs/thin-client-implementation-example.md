# Thin Client Mode: Implementation Example

This document shows concrete code examples for implementing thin client mode in Forest.

## Proof of Concept: Minimal Changes Required

The beauty of thin client mode is that **most code doesn't change** because Forest already has the 3-layer architecture.

### 1. HTTP Client Adapter

```typescript
// src/lib/adapters/http-client-adapter.ts

export interface HttpClientConfig {
  url: string;
  apiKey?: string;
  timeout?: number;
}

export class HttpClientAdapter {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.url.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Forest-CLI/0.3.0',
      ...(options.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: response.statusText };
        }

        throw new Error(
          `Forest API Error (${response.status}): ${errorData.error?.message || errorData.message || 'Unknown error'}`
        );
      }

      const data = await response.json();
      return data.data || data; // Unwrap { success: true, data: ... } envelope
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  // Node operations - mirror the API endpoints
  async listNodes(params: {
    search?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
    sort?: 'created' | 'updated' | 'title';
    order?: 'asc' | 'desc';
  } = {}) {
    const queryParams = new URLSearchParams();

    if (params.search) queryParams.set('search', params.search);
    if (params.tags) queryParams.set('tags', params.tags.join(','));
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    if (params.sort) queryParams.set('sort', params.sort);
    if (params.order) queryParams.set('order', params.order);

    const query = queryParams.toString();
    return this.request(`/api/v1/nodes${query ? `?${query}` : ''}`);
  }

  async getNode(id: string) {
    return this.request(`/api/v1/nodes/${id}`);
  }

  async createNode(data: {
    title: string;
    body: string;
    tags?: string[];
  }) {
    return this.request('/api/v1/nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNode(id: string, data: {
    title?: string;
    body?: string;
    tags?: string[];
  }) {
    return this.request(`/api/v1/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNode(id: string) {
    return this.request(`/api/v1/nodes/${id}`, {
      method: 'DELETE',
    });
  }

  // Search operations
  async search(query: string, options: {
    tags?: string[];
    limit?: number;
    offset?: number;
    minScore?: number;
  } = {}) {
    const queryParams = new URLSearchParams({ q: query });

    if (options.tags) queryParams.set('tags', options.tags.join(','));
    if (options.limit) queryParams.set('limit', options.limit.toString());
    if (options.offset) queryParams.set('offset', options.offset.toString());
    if (options.minScore !== undefined) {
      queryParams.set('minScore', options.minScore.toString());
    }

    return this.request(`/api/v1/search/semantic?${queryParams.toString()}`);
  }

  // Edge operations
  async listEdges(params: {
    status?: 'accepted' | 'suggested';
    limit?: number;
    offset?: number;
  } = {}) {
    const queryParams = new URLSearchParams();

    if (params.status) queryParams.set('status', params.status);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());

    const query = queryParams.toString();
    return this.request(`/api/v1/edges${query ? `?${query}` : ''}`);
  }

  // System operations
  async getHealth() {
    return this.request('/api/v1/health');
  }

  async getStats() {
    return this.request('/api/v1/stats');
  }

  // Tags
  async listTags() {
    return this.request('/api/v1/tags');
  }
}
```

### 2. Client Factory

```typescript
// src/lib/http-client-factory.ts

import { HttpClientAdapter } from './adapters/http-client-adapter';

let httpClient: HttpClientAdapter | null = null;

export function getHttpClient(): HttpClientAdapter {
  if (!httpClient) {
    const apiUrl = process.env.FOREST_API_URL;

    if (!apiUrl) {
      throw new Error(
        'FOREST_API_URL is required in client mode.\n' +
        '\n' +
        'Set the URL of your Forest API server:\n' +
        '  export FOREST_API_URL=https://forest.company.com:3000\n' +
        '\n' +
        'Or switch to local mode:\n' +
        '  export FOREST_MODE=local'
      );
    }

    httpClient = new HttpClientAdapter({
      url: apiUrl,
      apiKey: process.env.FOREST_API_KEY,
      timeout: parseInt(process.env.FOREST_API_TIMEOUT || '30000'),
    });
  }

  return httpClient;
}

export function isClientMode(): boolean {
  const mode = process.env.FOREST_MODE;
  const apiUrl = process.env.FOREST_API_URL;

  // Explicit client mode
  if (mode === 'client') return true;

  // Auto-detect: API URL set and mode not explicitly local
  if (apiUrl && mode !== 'local') return true;

  return false;
}

export function resetHttpClient(): void {
  httpClient = null;
}
```

### 3. Update Core Functions (Example: Search)

```typescript
// src/core/search.ts (enhanced)

import { semanticSearchLocal } from '../lib/search'; // Rename existing function
import { getHttpClient, isClientMode } from '../lib/http-client-factory';

export interface SearchOptions {
  limit?: number;
  offset?: number;
  minScore?: number;
  tags?: string[];
}

export interface SearchResult {
  nodes: Array<{
    node: NodeRecord;
    similarity: number;
  }>;
  total: number;
}

export async function semanticSearchCore(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  // Client mode: use HTTP API
  if (isClientMode()) {
    const client = getHttpClient();
    const response = await client.search(query, options);

    // Transform API response to match internal format
    return {
      nodes: response.nodes.map((item: any) => ({
        node: item,
        similarity: item.similarity,
      })),
      total: response.pagination?.total || response.nodes.length,
    };
  }

  // Local mode: use database (existing code)
  return semanticSearchLocal(query, options);
}
```

### 4. CLI Commands (No Changes!)

```typescript
// src/cli/commands/search.ts
// This code doesn't change at all!

export function createSearchCommand(clerc: ClercModule) {
  return clerc.defineCommand({
    name: 'search',
    parameters: ['<query>'],
    flags: {
      limit: { type: Number, default: 20 },
      tags: { type: String },
      json: { type: Boolean, default: false },
    },
  }, async (context) => {
    // Works in both local and client mode!
    const results = await semanticSearchCore(
      context.parameters.query,
      {
        limit: context.flags.limit,
        tags: context.flags.tags?.split(','),
      }
    );

    if (context.flags.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      displaySearchResults(results);
    }
  });
}
```

## Testing Locally

### Step 1: Start Forest Server

```bash
# Terminal 1: Start the server
cd forest
npm run build
forest serve --port 3000

# Output:
# 🌲 Forest server running at http://localhost:3000
# 📚 API docs available at http://localhost:3000/swagger
```

### Step 2: Configure Client Mode

```bash
# Terminal 2: Use thin client
export FOREST_MODE=client
export FOREST_API_URL=http://localhost:3000

# Run commands - they hit the server!
forest health
forest search "test"
forest stats
```

### Step 3: Test with curl

```bash
# Verify server is responding
curl http://localhost:3000/api/v1/health

# Search
curl "http://localhost:3000/api/v1/search/semantic?q=test&limit=5"

# List nodes
curl "http://localhost:3000/api/v1/nodes?limit=10"
```

## Production Example: Claude Code Environment

### Your Setup (Host Machine)

```bash
# 1. Start Forest server with your team's database
export FOREST_DB_TYPE=postgres
export FOREST_DB_URL=postgresql://forest:pass@localhost:5432/team_kb
forest serve --port 3000 --host 0.0.0.0

# 2. Expose via ngrok (or your company's tunnel)
ngrok http 3000
# Forwarding https://abc123.ngrok.io -> http://localhost:3000

# 3. Share the URL
# Tell Claude Code: "Use https://abc123.ngrok.io"
```

### My Setup (Claude Code / Anthropic Sandbox)

```bash
# 1. Configure thin client
export FOREST_MODE=client
export FOREST_API_URL=https://abc123.ngrok.io

# 2. Test connection
forest health
# ✓ Connected to Forest API v0.3.0
# ✓ Database: PostgreSQL

# 3. Query your team's knowledge!
forest search "authentication"
# Found 8 matches from your team's Forest:
#   7fa7acb2  "OAuth 2.0 implementation" (Alice)
#   3e4f5g6h  "ADR: Use Auth0 for auth" (Bob)
#   ...

forest node read 7fa7acb2
# [Shows your team's actual authentication documentation]

# 4. I can now write code based on YOUR team's decisions!
```

## Error Handling

### Graceful Degradation

```typescript
// src/lib/http-client-adapter.ts (enhanced)

async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  try {
    // ... existing fetch logic ...
  } catch (error) {
    // Network error - provide helpful message
    if (error.name === 'AbortError') {
      throw new Error(
        `Request timeout after ${this.timeout}ms.\n` +
        `Check that the Forest server is running and accessible at ${this.baseUrl}`
      );
    }

    if (error.message.includes('ECONNREFUSED')) {
      throw new Error(
        `Cannot connect to Forest server at ${this.baseUrl}.\n` +
        `\n` +
        `Troubleshooting:\n` +
        `  1. Check server is running: forest serve --port 3000\n` +
        `  2. Verify FOREST_API_URL is correct\n` +
        `  3. Check network connectivity\n` +
        `  4. Ensure domain is whitelisted (if in sandboxed environment)`
      );
    }

    if (error.message.includes('ENOTFOUND')) {
      throw new Error(
        `Cannot resolve hostname: ${this.baseUrl}\n` +
        `\n` +
        `Check that:\n` +
        `  1. FOREST_API_URL hostname is correct\n` +
        `  2. DNS is working\n` +
        `  3. VPN is connected (if using internal domain)`
      );
    }

    throw error;
  }
}
```

### Fallback to Local Mode

```typescript
// Optional: auto-fallback if server unreachable
export async function semanticSearchCore(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  if (isClientMode()) {
    try {
      const client = getHttpClient();
      return await client.search(query, options);
    } catch (error) {
      // If auto-fallback is enabled
      if (process.env.FOREST_FALLBACK_TO_LOCAL === 'true') {
        console.warn(`⚠️  API server unreachable, falling back to local mode`);
        return semanticSearchLocal(query, options);
      }
      throw error;
    }
  }

  return semanticSearchLocal(query, options);
}
```

## Performance Considerations

### Caching (Optional Enhancement)

```typescript
// src/lib/adapters/http-client-adapter.ts (with caching)

import { LRUCache } from 'lru-cache';

export class HttpClientAdapter {
  private cache: LRUCache<string, any>;

  constructor(config: HttpClientConfig) {
    // ... existing setup ...

    // Cache GET requests for 5 minutes
    this.cache = new LRUCache({
      max: 100,
      ttl: 5 * 60 * 1000, // 5 minutes
    });
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const method = options.method || 'GET';
    const cacheKey = `${method}:${endpoint}`;

    // Check cache for GET requests
    if (method === 'GET' && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as T;
    }

    const result = await this.fetchRequest<T>(endpoint, options);

    // Cache GET responses
    if (method === 'GET') {
      this.cache.set(cacheKey, result);
    }

    return result;
  }
}
```

### Batch Operations

```typescript
// For multiple node reads, batch into single request
async getBatch(ids: string[]) {
  return this.request('/api/v1/nodes/batch', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}
```

## Security: API Key Authentication

### Server Side (Optional)

```typescript
// src/server/middleware/auth.ts

const VALID_API_KEYS = new Set(
  (process.env.FOREST_API_KEYS || '').split(',').filter(Boolean)
);

export function requireAuth() {
  return async (context: any) => {
    // Skip auth if no keys configured
    if (VALID_API_KEYS.size === 0) return;

    const authHeader = context.headers['authorization'];
    const apiKey = authHeader?.replace('Bearer ', '');

    if (!apiKey || !VALID_API_KEYS.has(apiKey)) {
      context.set.status = 401;
      throw new Error('Unauthorized: Valid API key required');
    }
  };
}

// Apply to server
app.use(requireAuth());
```

### Client Side

```bash
# Generate API key on server
forest admin:generate-api-key
# Generated API key: sk_abc123xyz

# Use on client
export FOREST_API_KEY=sk_abc123xyz
forest search "test"  # Includes Authorization header
```

## Monitoring

### Client-Side Metrics

```typescript
// Track request metrics
class HttpClientAdapter {
  private metrics = {
    requests: 0,
    errors: 0,
    totalDuration: 0,
  };

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    this.metrics.requests++;
    const start = Date.now();

    try {
      const result = await this.fetchRequest<T>(endpoint, options);
      this.metrics.totalDuration += Date.now() - start;
      return result;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      avgDuration: this.metrics.requests > 0
        ? this.metrics.totalDuration / this.metrics.requests
        : 0,
      errorRate: this.metrics.requests > 0
        ? this.metrics.errors / this.metrics.requests
        : 0,
    };
  }
}

// Expose via forest stats
forest stats --client
# Client Mode Statistics:
#   API URL: https://forest.company.com:3000
#   Requests: 42
#   Errors: 0
#   Avg Duration: 125ms
#   Error Rate: 0%
```

## Migration Checklist

- [ ] Implement `HttpClientAdapter` class
- [ ] Create `http-client-factory.ts`
- [ ] Update `semanticSearchCore` to support both modes
- [ ] Update `listNodesCore` to support both modes
- [ ] Update `getNodeCore` to support both modes
- [ ] Update `createNodeCore` to support both modes
- [ ] Add mode detection to preflight script
- [ ] Add error messages for misconfiguration
- [ ] Test with local server (localhost:3000)
- [ ] Test with ngrok tunnel
- [ ] Test in Claude Code environment
- [ ] Add caching (optional)
- [ ] Add API key auth (optional)
- [ ] Document setup in README
- [ ] Create troubleshooting guide

## Summary

Thin client mode requires:
1. ✅ **~200 lines of code** - `HttpClientAdapter` class
2. ✅ **Minimal core changes** - Just add mode detection
3. ✅ **Zero CLI changes** - Commands work unchanged
4. ✅ **Server already exists** - Just expose it!

**Result**: Forest works in any environment (local, remote, sandboxed) with the same commands! 🎉
