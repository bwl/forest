# Forest Refactoring Guide

This guide provides step-by-step instructions for refactoring Forest to support thin client mode with clean architecture.

## Quick Links
- [Architecture Overview](./ARCHITECTURE.md)
- [Current Issues](#current-issues)
- [Refactoring Steps](#refactoring-steps)
- [Code Examples](#code-examples)

---

## Current Issues

### Issue 1: Core Layer Has Circular Dependencies 🔴 CRITICAL

**Problem**:
```typescript
// src/core/nodes.ts
import { linkAgainstExisting } from '../cli/shared/linking';  // ❌ Core → CLI
import { eventBus } from '../server/events/eventBus';         // ❌ Core → Server
```

**Why Bad**:
- Violates clean architecture (core should be innermost layer)
- Cannot reuse core in different contexts
- Hard to test in isolation
- Prevents thin client implementation

**Impact**: 🔴 Blocks thin client mode

### Issue 2: Business Logic in CLI Layer 🟡

**Problem**:
- `cli/shared/linking.ts` contains graph algorithms
- `cli/shared/explore.ts` mixes graph logic with display formatting
- Duplicated logic between CLI and potential API usage

**Why Bad**:
- Cannot reuse logic in API server
- CLI becomes fat and complex
- Testing requires CLI environment

**Impact**: 🟡 Maintenance burden, code duplication

### Issue 3: No Data Access Abstraction 🔴

**Problem**:
```typescript
// Every file that needs data
import { listNodes, getNodeById } from '../lib/db';
```

**Why Bad**:
- Tight coupling to SQLite
- Cannot swap data sources
- No mocking for tests
- Cannot implement thin client

**Impact**: 🔴 Blocks thin client mode

### Issue 4: Event System Tied to Server 🟡

**Problem**:
```typescript
// src/core/nodes.ts
import { eventBus } from '../server/events/eventBus';  // ❌
```

**Why Bad**:
- Core depends on server infrastructure
- Cannot use core without server
- Circular dependency

**Impact**: 🟡 Architectural debt

---

## Refactoring Steps

### Step 1: Extract Business Logic from CLI (2-3 days)

#### 1.1 Move Linking Logic

**File**: `cli/shared/linking.ts` → split into:
- `core/linking.ts` (business logic)
- `cli/shared/linking.ts` (formatting only)

**Before** (`cli/shared/linking.ts`):
```typescript
export async function linkAgainstExisting(
  node: NodeRecord,
  autoAcceptThreshold: number,
  suggestionThreshold: number,
): Promise<{ accepted: number; suggested: number }> {
  const existingNodes = listNodes({ limit: 10000 });
  const newEdges: EdgeRecord[] = [];

  for (const existing of existingNodes) {
    if (existing.id === node.id) continue;

    const score = computeHybridScore(node, existing);

    if (score >= autoAcceptThreshold) {
      const edge = createEdge({
        sourceId: node.id,
        targetId: existing.id,
        score,
        status: 'accepted',
      });
      newEdges.push(edge);
    } else if (score >= suggestionThreshold) {
      const edge = createEdge({
        sourceId: node.id,
        targetId: existing.id,
        score,
        status: 'suggested',
      });
      newEdges.push(edge);
    }
  }

  return {
    accepted: newEdges.filter(e => e.status === 'accepted').length,
    suggested: newEdges.filter(e => e.status === 'suggested').length,
  };
}
```

**After** (`core/linking.ts`):
```typescript
import { NodeRecord, EdgeRecord } from '../lib/db';
import { computeHybridScore } from '../lib/scoring';

export type LinkingResult = {
  accepted: number;
  suggested: number;
  edges: EdgeRecord[];
};

export type LinkingOptions = {
  autoAcceptThreshold: number;
  suggestionThreshold: number;
  excludeIds?: string[];
  limit?: number;
};

/**
 * Pure business logic for linking a node against existing nodes.
 * No database access - caller provides existing nodes.
 */
export function computeLinks(
  node: NodeRecord,
  existingNodes: NodeRecord[],
  options: LinkingOptions,
): LinkingResult {
  const { autoAcceptThreshold, suggestionThreshold, excludeIds = [] } = options;
  const edges: EdgeRecord[] = [];

  for (const existing of existingNodes) {
    if (existing.id === node.id || excludeIds.includes(existing.id)) {
      continue;
    }

    const score = computeHybridScore(node, existing);

    if (score >= autoAcceptThreshold) {
      edges.push({
        id: '', // Will be set by caller
        sourceId: node.id < existing.id ? node.id : existing.id,
        targetId: node.id < existing.id ? existing.id : node.id,
        score,
        status: 'accepted',
        edgeType: 'semantic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: null,
      });
    } else if (score >= suggestionThreshold) {
      edges.push({
        id: '',
        sourceId: node.id < existing.id ? node.id : existing.id,
        targetId: node.id < existing.id ? existing.id : node.id,
        score,
        status: 'suggested',
        edgeType: 'semantic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: null,
      });
    }
  }

  return {
    accepted: edges.filter(e => e.status === 'accepted').length,
    suggested: edges.filter(e => e.status === 'suggested').length,
    edges,
  };
}
```

**After** (`core/nodes.ts` - updated import):
```typescript
import { computeLinks } from './linking';  // ✅ Core → Core

export async function createNodeCore(data: CreateNodeInput): Promise<NodeRecord> {
  // ... create node ...

  if (data.autoLink) {
    const existingNodes = await listNodes({ limit: 10000 });
    const linkingResult = computeLinks(node, existingNodes, {
      autoAcceptThreshold: 0.5,
      suggestionThreshold: 0.25,
    });

    // Save edges
    for (const edge of linkingResult.edges) {
      await createEdge(edge);
    }
  }

  return node;
}
```

**Testing**:
```typescript
// test/core/linking.spec.ts
describe('computeLinks', () => {
  it('should create accepted edges above threshold', () => {
    const node = createMockNode({ title: 'Test' });
    const existing = [createMockNode({ title: 'Test 2' })];

    const result = computeLinks(node, existing, {
      autoAcceptThreshold: 0.5,
      suggestionThreshold: 0.25,
    });

    expect(result.accepted).toBeGreaterThan(0);
  });
});
```

#### 1.2 Move Explore Logic

**File**: `cli/shared/explore.ts` → split into:
- `core/explore.ts` (graph algorithms)
- `cli/shared/explore.ts` (formatting only)

**Before** (`cli/shared/explore.ts`):
```typescript
export async function buildNeighborhood(
  nodeId: string,
  depth: number,
): Promise<NodeRecord[]> {
  // Graph traversal logic mixed with formatting
}
```

**After** (`core/explore.ts`):
```typescript
export type NeighborhoodOptions = {
  depth: number;
  includeStatus?: EdgeStatus[];
  limit?: number;
};

export type NeighborhoodResult = {
  nodes: NodeRecord[];
  edges: EdgeRecord[];
  centerNode: NodeRecord;
};

/**
 * Pure graph traversal - no side effects
 */
export function buildNeighborhood(
  centerNode: NodeRecord,
  allNodes: Map<string, NodeRecord>,
  allEdges: EdgeRecord[],
  options: NeighborhoodOptions,
): NeighborhoodResult {
  const { depth, includeStatus = ['accepted'], limit } = options;
  const visited = new Set<string>([centerNode.id]);
  const resultNodes: NodeRecord[] = [centerNode];
  const resultEdges: EdgeRecord[] = [];

  let currentLayer = [centerNode.id];

  for (let d = 0; d < depth; d++) {
    const nextLayer: string[] = [];

    for (const nodeId of currentLayer) {
      const neighbors = allEdges
        .filter(e => includeStatus.includes(e.status))
        .filter(e => e.sourceId === nodeId || e.targetId === nodeId)
        .map(e => e.sourceId === nodeId ? e.targetId : e.sourceId);

      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          const neighborNode = allNodes.get(neighborId);
          if (neighborNode) {
            resultNodes.push(neighborNode);
            nextLayer.push(neighborId);

            // Find edge
            const edge = allEdges.find(
              e => (e.sourceId === nodeId && e.targetId === neighborId) ||
                   (e.targetId === nodeId && e.sourceId === neighborId)
            );
            if (edge) resultEdges.push(edge);
          }
        }
      }
    }

    currentLayer = nextLayer;
    if (limit && resultNodes.length >= limit) break;
  }

  return {
    nodes: limit ? resultNodes.slice(0, limit) : resultNodes,
    edges: resultEdges,
    centerNode,
  };
}
```

**After** (`cli/shared/explore.ts` - formatting only):
```typescript
import { buildNeighborhood } from '../../core/explore';
import { formatNodeForDisplay } from './utils';

export async function displayNeighborhood(nodeId: string, depth: number) {
  // Load data
  const allNodes = await loadAllNodes();
  const allEdges = await loadAllEdges();
  const centerNode = allNodes.get(nodeId);

  if (!centerNode) {
    console.error('Node not found');
    return;
  }

  // Business logic
  const result = buildNeighborhood(centerNode, allNodes, allEdges, { depth });

  // Formatting only
  console.log(formatNodeForDisplay(result.centerNode));
  for (const node of result.nodes) {
    console.log(`  → ${formatNodeForDisplay(node)}`);
  }
}
```

### Step 2: Abstract Event System (1 day)

**Create** `lib/events.ts`:
```typescript
/**
 * Event bus interface - allows core to emit events without
 * depending on specific implementation.
 */
export interface IEventBus {
  emit<T = unknown>(event: string, data: T): void;
  on<T = unknown>(event: string, handler: (data: T) => void): () => void;
  once<T = unknown>(event: string, handler: (data: T) => void): () => void;
}

/**
 * No-op event bus for environments without event support
 */
export class NoOpEventBus implements IEventBus {
  emit<T = unknown>(_event: string, _data: T): void {
    // Do nothing
  }

  on<T = unknown>(_event: string, _handler: (data: T) => void): () => void {
    return () => {}; // Return no-op unsubscribe
  }

  once<T = unknown>(_event: string, _handler: (data: T) => void): () => void {
    return () => {};
  }
}

/**
 * Simple in-memory event bus implementation
 */
export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<(data: unknown) => void>>();

  emit<T = unknown>(event: string, data: T): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.forEach(handler => handler(data));
    }
  }

  on<T = unknown>(event: string, handler: (data: T) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as (data: unknown) => void);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler as (data: unknown) => void);
    };
  }

  once<T = unknown>(event: string, handler: (data: T) => void): () => void {
    const wrappedHandler = (data: T) => {
      handler(data);
      this.handlers.get(event)?.delete(wrappedHandler as (data: unknown) => void);
    };

    return this.on(event, wrappedHandler);
  }
}

// Global instance (can be swapped for testing)
export let globalEventBus: IEventBus = new EventBus();

export function setGlobalEventBus(bus: IEventBus): void {
  globalEventBus = bus;
}
```

**Update** `core/nodes.ts`:
```typescript
// BEFORE
import { eventBus } from '../server/events/eventBus';  // ❌

// AFTER
import { globalEventBus } from '../lib/events';  // ✅

export async function createNodeCore(data: CreateNodeInput): Promise<NodeRecord> {
  const node = await insertNode(data);

  // Emit event (works in both CLI and server)
  globalEventBus.emit('node:created', { nodeId: node.id });

  return node;
}
```

**Server setup** (`server/index.ts`):
```typescript
import { setGlobalEventBus } from '../lib/events';
import { createWebSocketEventBus } from './events/websocketEventBus';

// In server mode, use WebSocket-enabled event bus
const wsEventBus = createWebSocketEventBus();
setGlobalEventBus(wsEventBus);
```

**CLI setup** (`cli/index.ts`):
```typescript
import { setGlobalEventBus, NoOpEventBus } from '../lib/events';

// In CLI mode, use no-op event bus (no WebSocket needed)
setGlobalEventBus(new NoOpEventBus());
```

### Step 3: Create Data Access Layer (3-4 days)

#### 3.1 Define Interface

**Create** `data/IDataProvider.ts`:
```typescript
import {
  NodeRecord,
  EdgeRecord,
  DocumentRecord,
  EdgeStatus,
  EdgeType,
} from '../lib/db';

// Request types
export type ListNodesOptions = {
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sort?: 'created' | 'updated' | 'title';
  order?: 'asc' | 'desc';
};

export type GetNodeOptions = {
  includeBody?: boolean;
  includeEdges?: boolean;
  edgesLimit?: number;
};

export type CreateNodeInput = {
  title: string;
  body: string;
  tags?: string[];
  autoLink?: boolean;
};

export type UpdateNodeInput = {
  title?: string;
  body?: string;
  tags?: string[];
  relink?: boolean;
};

export type ListEdgesOptions = {
  status?: EdgeStatus;
  edgeType?: EdgeType;
  sourceId?: string;
  targetId?: string;
  minScore?: number;
  maxScore?: number;
  limit?: number;
  offset?: number;
};

export type SearchOptions = {
  limit?: number;
  minScore?: number;
  tags?: string[];
};

// Response types
export type ListNodesResult = {
  nodes: NodeRecord[];
  total: number;
  hasMore: boolean;
};

export type GetNodeResult = {
  node: NodeRecord;
  edges?: EdgeRecord[];
  edgesTotal?: number;
};

export type SearchResult = {
  results: Array<{
    node: NodeRecord;
    score: number;
  }>;
  total: number;
};

export type StatsResult = {
  nodes: {
    total: number;
    recent: NodeRecord[];
  };
  edges: {
    accepted: number;
    suggested: number;
    total: number;
  };
  tags: {
    total: number;
    topTags: Array<{ name: string; count: number }>;
  };
};

export type HealthResult = {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    connected: boolean;
    path?: string;
    size?: number;
  };
  embeddings: {
    provider: string;
    available: boolean;
  };
  uptime?: number;
};

/**
 * Data provider interface - abstraction over data source.
 *
 * Implementations:
 * - LocalProvider: Direct database access
 * - RemoteProvider: HTTP API client
 */
export interface IDataProvider {
  // Node operations
  listNodes(options?: ListNodesOptions): Promise<ListNodesResult>;
  getNode(id: string, options?: GetNodeOptions): Promise<GetNodeResult>;
  createNode(data: CreateNodeInput): Promise<NodeRecord>;
  updateNode(id: string, data: UpdateNodeInput): Promise<NodeRecord>;
  deleteNode(id: string): Promise<void>;

  // Edge operations
  listEdges(options?: ListEdgesOptions): Promise<EdgeRecord[]>;
  acceptEdge(edgeId: string): Promise<EdgeRecord>;
  rejectEdge(edgeId: string): Promise<EdgeRecord>;

  // Search
  search(query: string, options?: SearchOptions): Promise<SearchResult>;

  // System
  getStats(): Promise<StatsResult>;
  getHealth(): Promise<HealthResult>;

  // Tags
  listTags(): Promise<Array<{ name: string; count: number }>>;

  // Lifecycle
  close?(): Promise<void>;
}
```

#### 3.2 Implement LocalProvider

**Create** `data/providers/LocalProvider.ts`:
```typescript
import {
  IDataProvider,
  ListNodesOptions,
  ListNodesResult,
  GetNodeOptions,
  GetNodeResult,
  CreateNodeInput,
  UpdateNodeInput,
  ListEdgesOptions,
  SearchOptions,
  SearchResult,
  StatsResult,
  HealthResult,
} from '../IDataProvider';

import { listNodes as coreListNodes, createNodeCore } from '../../core/nodes';
import { searchCore } from '../../core/search';
import { statsCore } from '../../core/stats';
import { healthCore } from '../../core/health';
import { NodeRecord, EdgeRecord } from '../../lib/db';

/**
 * Local data provider - uses direct database access via core functions.
 */
export class LocalProvider implements IDataProvider {
  async listNodes(options?: ListNodesOptions): Promise<ListNodesResult> {
    const result = await coreListNodes(options || {});
    return {
      nodes: result.nodes,
      total: result.total,
      hasMore: result.nodes.length < result.total,
    };
  }

  async getNode(id: string, options?: GetNodeOptions): Promise<GetNodeResult> {
    const node = await getNodeById(id);
    if (!node) {
      throw new Error(`Node not found: ${id}`);
    }

    let edges: EdgeRecord[] | undefined;
    let edgesTotal: number | undefined;

    if (options?.includeEdges) {
      edges = await listEdges({
        sourceId: id,
        limit: options.edgesLimit || 50,
      });
      edgesTotal = edges.length;
    }

    return {
      node,
      edges,
      edgesTotal,
    };
  }

  async createNode(data: CreateNodeInput): Promise<NodeRecord> {
    return createNodeCore(data);
  }

  async updateNode(id: string, data: UpdateNodeInput): Promise<NodeRecord> {
    return updateNodeCore(id, data);
  }

  async deleteNode(id: string): Promise<void> {
    await deleteNodeCore(id);
  }

  async listEdges(options?: ListEdgesOptions): Promise<EdgeRecord[]> {
    return listEdgesCore(options || {});
  }

  async acceptEdge(edgeId: string): Promise<EdgeRecord> {
    return acceptEdgeCore(edgeId);
  }

  async rejectEdge(edgeId: string): Promise<EdgeRecord> {
    return rejectEdgeCore(edgeId);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    return searchCore(query, options || {});
  }

  async getStats(): Promise<StatsResult> {
    return statsCore();
  }

  async getHealth(): Promise<HealthResult> {
    return healthCore();
  }

  async listTags(): Promise<Array<{ name: string; count: number }>> {
    return listTagsCore();
  }
}
```

#### 3.3 Implement RemoteProvider

**Create** `data/providers/RemoteProvider.ts`:
```typescript
import {
  IDataProvider,
  ListNodesOptions,
  ListNodesResult,
  GetNodeOptions,
  GetNodeResult,
  CreateNodeInput,
  UpdateNodeInput,
  ListEdgesOptions,
  SearchOptions,
  SearchResult,
  StatsResult,
  HealthResult,
} from '../IDataProvider';
import { NodeRecord, EdgeRecord } from '../../lib/db';

export type RemoteProviderConfig = {
  apiUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
};

/**
 * Remote data provider - makes HTTP requests to Forest API server.
 */
export class RemoteProvider implements IDataProvider {
  private config: Required<RemoteProviderConfig>;

  constructor(config: RemoteProviderConfig) {
    this.config = {
      apiUrl: config.apiUrl.replace(/\/$/, ''), // Remove trailing slash
      apiKey: config.apiKey || '',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || 'API request failed');
        }

        return data.data as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          throw error;
        }

        // Exponential backoff
        if (attempt < this.config.retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  async listNodes(options?: ListNodesOptions): Promise<ListNodesResult> {
    const params = new URLSearchParams();
    if (options?.search) params.set('search', options.search);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.sort) params.set('sort', options.sort);
    if (options?.order) params.set('order', options.order);
    if (options?.tags?.length) params.set('tags', options.tags.join(','));

    const query = params.toString();
    const endpoint = `/api/v1/nodes${query ? `?${query}` : ''}`;

    return this.request<ListNodesResult>(endpoint);
  }

  async getNode(id: string, options?: GetNodeOptions): Promise<GetNodeResult> {
    const params = new URLSearchParams();
    if (options?.includeBody !== false) params.set('includeBody', 'true');
    if (options?.includeEdges) params.set('includeEdges', 'true');
    if (options?.edgesLimit) params.set('edgesLimit', String(options.edgesLimit));

    const query = params.toString();
    const endpoint = `/api/v1/nodes/${id}${query ? `?${query}` : ''}`;

    return this.request<GetNodeResult>(endpoint);
  }

  async createNode(data: CreateNodeInput): Promise<NodeRecord> {
    return this.request<NodeRecord>('/api/v1/nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNode(id: string, data: UpdateNodeInput): Promise<NodeRecord> {
    return this.request<NodeRecord>(`/api/v1/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNode(id: string): Promise<void> {
    await this.request<void>(`/api/v1/nodes/${id}`, {
      method: 'DELETE',
    });
  }

  async listEdges(options?: ListEdgesOptions): Promise<EdgeRecord[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));

    const query = params.toString();
    const endpoint = `/api/v1/edges${query ? `?${query}` : ''}`;

    const result = await this.request<{ edges: EdgeRecord[] }>(endpoint);
    return result.edges;
  }

  async acceptEdge(edgeId: string): Promise<EdgeRecord> {
    return this.request<EdgeRecord>(`/api/v1/edges/${edgeId}/accept`, {
      method: 'POST',
    });
  }

  async rejectEdge(edgeId: string): Promise<EdgeRecord> {
    return this.request<EdgeRecord>(`/api/v1/edges/${edgeId}/reject`, {
      method: 'POST',
    });
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const params = new URLSearchParams({ query });
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.minScore) params.set('minScore', String(options.minScore));

    return this.request<SearchResult>(`/api/v1/search?${params.toString()}`);
  }

  async getStats(): Promise<StatsResult> {
    return this.request<StatsResult>('/api/v1/stats');
  }

  async getHealth(): Promise<HealthResult> {
    return this.request<HealthResult>('/api/v1/health');
  }

  async listTags(): Promise<Array<{ name: string; count: number }>> {
    const result = await this.request<{ tags: Array<{ name: string; count: number }> }>(
      '/api/v1/tags',
    );
    return result.tags;
  }
}
```

#### 3.4 Create Factory

**Create** `data/DataProviderFactory.ts`:
```typescript
import { IDataProvider } from './IDataProvider';
import { LocalProvider } from './providers/LocalProvider';
import { RemoteProvider } from './providers/RemoteProvider';

export type ForestMode = 'local' | 'client';

export function getForestMode(): ForestMode {
  const mode = process.env.FOREST_MODE?.toLowerCase();
  if (mode === 'client') return 'client';
  return 'local';
}

/**
 * Creates appropriate data provider based on FOREST_MODE environment variable.
 *
 * Modes:
 * - local (default): Direct database access
 * - client: HTTP API client
 */
export function createDataProvider(): IDataProvider {
  const mode = getForestMode();

  switch (mode) {
    case 'client': {
      const apiUrl = process.env.FOREST_API_URL;
      if (!apiUrl) {
        throw new Error(
          'FOREST_API_URL environment variable required in client mode.\n' +
          'Example: export FOREST_API_URL=https://forest-api.example.com'
        );
      }

      return new RemoteProvider({
        apiUrl,
        apiKey: process.env.FOREST_API_KEY,
        timeout: process.env.FOREST_REQUEST_TIMEOUT
          ? parseInt(process.env.FOREST_REQUEST_TIMEOUT, 10)
          : undefined,
      });
    }

    case 'local':
    default:
      return new LocalProvider();
  }
}

/**
 * Singleton instance (lazy-initialized)
 */
let providerInstance: IDataProvider | null = null;

export function getDataProvider(): IDataProvider {
  if (!providerInstance) {
    providerInstance = createDataProvider();
  }
  return providerInstance;
}

/**
 * Reset provider (useful for testing)
 */
export function resetDataProvider(): void {
  providerInstance = null;
}
```

### Step 4: Update CLI Commands (2-3 days)

**Update** `cli/commands/stats.ts`:

**Before**:
```typescript
import { statsCore } from '../../core/stats';

export function createStatsCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'stats',
      description: 'Show graph statistics',
    },
    async () => {
      const stats = await statsCore();

      // Format and display...
    },
  );
}
```

**After**:
```typescript
import { getDataProvider } from '../../data/DataProviderFactory';
import { formatStatsForDisplay } from '../formatters/stats';

export function createStatsCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'stats',
      description: 'Show graph statistics',
    },
    async () => {
      const provider = getDataProvider();
      const stats = await provider.getStats();

      // Format and display...
      console.log(formatStatsForDisplay(stats));
    },
  );
}
```

**Update all commands**:
- `health.ts`
- `search.ts`
- `capture.ts`
- `node.ts`
- `edges.ts`
- `tags.ts`
- `explore.ts`

### Step 5: Testing (2 days)

**Create** `test/data/RemoteProvider.spec.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { RemoteProvider } from '../../src/data/providers/RemoteProvider';
import { createServer } from '../../src/server';

describe('RemoteProvider', () => {
  let provider: RemoteProvider;
  let server: any;

  beforeAll(async () => {
    // Start test server
    const { app } = createServer({ port: 13000 });
    server = app;

    // Create provider pointing to test server
    provider = new RemoteProvider({
      apiUrl: 'http://localhost:13000',
      timeout: 5000,
    });
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should fetch health status', async () => {
    const health = await provider.getHealth();
    expect(health.status).toBe('healthy');
  });

  it('should list nodes', async () => {
    const result = await provider.listNodes({ limit: 10 });
    expect(result.nodes).toBeArray();
    expect(result.total).toBeNumber();
  });

  it('should handle network errors with retries', async () => {
    const badProvider = new RemoteProvider({
      apiUrl: 'http://localhost:99999', // Invalid port
      retries: 2,
      timeout: 1000,
    });

    await expect(badProvider.getHealth()).rejects.toThrow();
  });
});
```

---

## Code Examples

### Example 1: Creating a Node (Before/After)

**Before** (direct DB access):
```typescript
// cli/commands/capture.ts
import { insertNode } from '../../lib/db';
import { computeEmbeddingForNode } from '../../lib/embeddings';
import { linkAgainstExisting } from '../shared/linking';

async function captureCommand(args: CaptureArgs) {
  const node = await insertNode({
    title: args.title,
    body: args.body,
    tags: args.tags,
  });

  await computeEmbeddingForNode(node);

  if (args.autoLink) {
    await linkAgainstExisting(node, 0.5, 0.25);
  }

  console.log(`Created node: ${node.id}`);
}
```

**After** (using DAL):
```typescript
// cli/commands/capture.ts
import { getDataProvider } from '../../data/DataProviderFactory';

async function captureCommand(args: CaptureArgs) {
  const provider = getDataProvider();

  const node = await provider.createNode({
    title: args.title,
    body: args.body,
    tags: args.tags,
    autoLink: args.autoLink,
  });

  console.log(`Created node: ${node.id}`);
}
```

### Example 2: Search (Before/After)

**Before**:
```typescript
// cli/commands/search.ts
import { searchCore } from '../../core/search';

async function searchCommand(query: string) {
  const results = await searchCore(query, { limit: 20 });

  for (const result of results.results) {
    console.log(`${result.node.title} (${result.score.toFixed(2)})`);
  }
}
```

**After**:
```typescript
// cli/commands/search.ts
import { getDataProvider } from '../../data/DataProviderFactory';

async function searchCommand(query: string) {
  const provider = getDataProvider();
  const results = await provider.search(query, { limit: 20 });

  for (const result of results.results) {
    console.log(`${result.node.title} (${result.score.toFixed(2)})`);
  }
}
```

---

## Validation Checklist

After refactoring, verify:

### Architectural Checks
- [ ] No imports from `src/core` to `src/cli`
- [ ] No imports from `src/core` to `src/server`
- [ ] Core only imports from `src/lib` and other `src/core` modules
- [ ] CLI commands use `DataProviderFactory`
- [ ] Server routes use core functions directly

### Functional Checks
- [ ] All CLI commands work in local mode
- [ ] All CLI commands work in client mode (with API server)
- [ ] API server endpoints return correct data
- [ ] Tests pass for core, data providers, CLI, server

### Dependency Check Tool
```bash
# Install madge (circular dependency checker)
npm install -g madge

# Check for circular dependencies
madge --circular src/

# Should return empty or only lib/* cycles
```

---

## Rollback Plan

If issues arise during refactoring:

1. **Commit frequently** - Each step should be a separate commit
2. **Tag stable points** - Tag after each phase completes
3. **Feature flags** - Use env var `FOREST_LEGACY_MODE` to switch back
4. **Parallel branches** - Keep `main` stable, work in `refactor/thin-client`

---

## Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Full architecture documentation
- [Clean Architecture Blog](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
