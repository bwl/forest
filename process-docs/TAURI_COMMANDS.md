# Tauri Commands Reference

This document lists all available Tauri commands for the Forest Desktop GUI.

## Available Commands

### 1. `get_stats`
Get graph statistics.

**Returns**: `ForestStats`
```typescript
{
  nodes: number,
  edges: number,
  suggested: number
}
```

**Example**:
```typescript
const stats = await invoke<ForestStats>('get_stats');
console.log(`Graph has ${stats.nodes} nodes and ${stats.edges} edges`);
```

---

### 2. `search_nodes`
Search nodes using semantic similarity.

**Parameters**:
- `query: string` - Search query text
- `limit: usize` - Maximum number of results

**Returns**: `SearchResult[]`
```typescript
{
  id: string,
  title: string,
  body: string,
  tags: string[],
  similarity: number
}
```

**Example**:
```typescript
const results = await invoke<SearchResult[]>('search_nodes', {
  query: 'Rust programming',
  limit: 10
});
```

---

### 3. `get_node`
Get a single node by ID.

**Parameters**:
- `id: string` - Node ID (supports short ID prefixes)

**Returns**: `NodeDetail`
```typescript
{
  id: string,
  title: string,
  body: string,
  tags: string[],
  created_at: string,
  updated_at: string
}
```

**Example**:
```typescript
const node = await invoke<NodeDetail>('get_node', { id: 'abc123' });
```

---

### 4. `get_node_connections`
Get all connected nodes for a given node (accepted edges only).

**Parameters**:
- `id: string` - Node ID

**Returns**: `NodeConnection[]`
```typescript
{
  node_id: string,
  title: string,
  score: number,
  edge_type: string  // "Semantic", "ParentChild", "Sequential", "Manual"
}
```

**Example**:
```typescript
const connections = await invoke<NodeConnection[]>('get_node_connections', {
  id: 'abc123'
});
```

---

### 5. `create_node`
Create a new node with optional auto-linking.

**Parameters**:
- `title: string` - Node title
- `body: string` - Node body content
- `tags: Option<Vec<String>>` - Optional tags (auto-extracted if not provided)
- `auto_link: bool` - Whether to auto-link against existing nodes

**Returns**: `NodeCreationResult`
```typescript
{
  id: string,
  title: string,
  accepted_edges: number,
  suggested_edges: number
}
```

**Example**:
```typescript
const result = await invoke<NodeCreationResult>('create_node', {
  title: 'My Note',
  body: 'Content here',
  tags: ['tag1', 'tag2'],
  autoLink: true
});

console.log(`Created node ${result.id} with ${result.accepted_edges} accepted edges`);
```

---

### 6. `get_edge_proposals`
Get edge proposals (suggested edges awaiting review).

**Parameters**:
- `limit: usize` - Maximum number of proposals to return

**Returns**: `EdgeProposal[]`
```typescript
{
  edge_id: string,
  source_id: string,
  source_title: string,
  target_id: string,
  target_title: string,
  score: number
}
```

**Example**:
```typescript
const proposals = await invoke<EdgeProposal[]>('get_edge_proposals', {
  limit: 20
});
```

---

### 7. `accept_edge`
Accept an edge proposal (change status from suggested to accepted).

**Parameters**:
- `source_id: string` - Source node ID
- `target_id: string` - Target node ID

**Returns**: `void`

**Example**:
```typescript
await invoke('accept_edge', {
  sourceId: 'abc123',
  targetId: 'def456'
});
```

---

### 8. `reject_edge`
Reject an edge proposal (delete it).

**Parameters**:
- `source_id: string` - Source node ID
- `target_id: string` - Target node ID

**Returns**: `void`

**Example**:
```typescript
await invoke('reject_edge', {
  sourceId: 'abc123',
  targetId: 'def456'
});
```

---

## Type-Safe Wrapper

Use the type-safe wrapper from `src/lib/tauri-commands.ts`:

```typescript
import {
  getStats,
  searchNodes,
  getNode,
  getNodeConnections,
  createNode,
  getEdgeProposals,
  acceptEdge,
  rejectEdge
} from '@/lib/tauri-commands';

// Type-safe invocations
const stats = await getStats();
const results = await searchNodes('Rust', 10);
const node = await getNode('abc123');
```

---

## Error Handling

All commands return `Result<T, String>` where errors are converted to strings. Always wrap in try-catch:

```typescript
try {
  const node = await getNode(nodeId);
  // Use node data
} catch (error) {
  console.error('Failed to fetch node:', error);
  // Show error to user
}
```

---

## Implementation Notes

- **Database**: All commands use SQLite via sqlx
- **Embeddings**: Node creation uses the global `EMBEDDING_SERVICE` (provider controlled by `FOREST_EMBED_PROVIDER` env var)
- **Auto-linking**: Uses hybrid scoring (0.25×token + 0.55×embedding + 0.15×tag + 0.05×title)
- **Edge normalization**: Edges are undirected; `source_id < target_id` is enforced
- **Short IDs**: Commands support progressive UUID prefixes (4-8 chars)

---

## Registration

Commands are registered in `src-tauri/src/main.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    commands::get_stats,
    commands::search_nodes,
    commands::get_node,
    commands::get_node_connections,
    commands::create_node,
    commands::get_edge_proposals,
    commands::accept_edge,
    commands::reject_edge,
])
```
