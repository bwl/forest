# Forest Scoring & Linking Specification v2

## Overview

Forest uses a **dual-score edge model** where semantic (embedding) and tag (IDF-weighted) scores are computed independently but stored together on a single edge per node pair. This replaces the previous single collapsed hybrid score.

## Implementation Status (in this repo)

Implemented:
- Dual scores on `edges` (`semantic_score`, `tag_score`, `shared_tags`) + v2 migration command (`forest admin migrate-v2`)
- Normalized `node_tags` + cached `tag_idf` for IDF-weighted tag scoring
- Bridge tags via `forest link` (`#link/...`) and tag-aware explore filtering

Deferred (see `SCORING_V2_PLAN.md` Phase 4):
- HNSW index (`.idx`) + fast approximate linking
- Embedding storage migration (JSON → float32 BLOB)

## Design Principles

1. **Dual scores, single edge** - One edge row per pair with `semantic_score` and `tag_score` fields
2. **Clean separation** - Semantic (AI) layer vs Tag (human/agent) layer scored independently
3. **Tiered performance** - Fast approximate on capture, full rescore on demand
4. **Bridge tags** - Unique tags (`#link/xyz`) for explicit human-controlled linking

---

## Edge Model

### Single Edge, Dual Scores

Each edge stores both layer scores:

```typescript
interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
  semanticScore: number | null;  // null if no embedding
  tagScore: number | null;       // null if no shared tags
  sharedTags: string[];          // for tag score explainability
  createdAt: string;
  updatedAt: string;
}
```

**Rationale**: Avoids graphology `multi: true` complexity. Simpler queries. One edge = one relationship with multiple facets.

### Edge Creation Rules

An edge is created if **either** score exceeds its threshold:
- `semantic_score >= FOREST_SEMANTIC_THRESHOLD` (default: 0.5), OR
- `tag_score >= FOREST_TAG_THRESHOLD` (default: 0.3)

Edges with both scores below threshold are deleted.

---

## Scoring Algorithms

### 1. Semantic Score

**Source**: Embedding cosine similarity

```
semantic_score = cosine(embedding_a, embedding_b)
```

**Range**: 0.0 to 1.0

**Index**: HNSW in separate `.idx` file (recommend hnswlib)

### 2. Tag Score

**Source**: IDF-weighted Jaccard similarity

```
jaccard = |tags_a ∩ tags_b| / |tags_a ∪ tags_b|

For each shared tag t:
  idf(t) = log(N / doc_freq(t))  where N = total nodes

avg_idf = mean(idf(t) for t in shared_tags)
max_idf = log(N / 1)  # theoretical max: tag on only 1 node

tag_score = jaccard × (avg_idf / max_idf)
```

**Range**: 0.0 to 1.0 (bounded by Jaccard × normalized IDF)

**Interpretation**:
- High Jaccard + rare shared tags → high score
- High Jaccard + common tags → medium score
- Low Jaccard → low score regardless of IDF

**Index**: `node_tags` join table (see schema)

---

## Bridge Tags

Bridge tags are special tags prefixed with `link/` that create strong bonds between specific nodes.

**Syntax**:
```bash
# Auto-generated bridge
forest link node-A node-B
# Creates #link/7fa3b2c1 on both nodes

# User-named bridge
forest link node-A node-B --name=chapter-1-arc
# Creates #link/chapter-1-arc on both nodes
```

**Parser Change Required**: Expand tag regex from `#[a-zA-Z0-9_-]+` to `#[a-zA-Z0-9_/-]+` to allow `/`.

**Behavior**:
- Bridge tags have doc_freq = number of nodes in the bridge (typically 2-5)
- IDF is very high → boosts tag_score significantly
- Visible in tag listings with `link/` prefix
- Remove with: `forest tags remove node-A #link/chapter-1-arc`

---

## Tiered Linking Strategy

### On Capture (Fast Path)

1. Compute embedding for new node
2. Query HNSW index for top-k approximate nearest neighbors (k=100)
3. Compute `semantic_score` against candidates only
4. Query `node_tags` table for nodes sharing any tag with new node
5. Compute `tag_score` against tag-sharing nodes
6. Union candidate sets, create/update edges exceeding thresholds
7. Mark node as `approximate_scored = true`

**Complexity**: O(log n) for HNSW + O(t×m) for tag lookup (t=tags, m=avg nodes per tag)

### Full Rescore (Accurate Path)

```bash
forest admin rescore [--semantic] [--tags] [--all]
```

1. Rebuild `tag_idf` cache from `node_tags`
2. For each node pair, recompute requested scores
3. Update edges, delete those below both thresholds
4. Set `approximate_scored = false` on affected nodes
5. Rebuild HNSW index if `--semantic`

**Complexity**: O(n²) - run manually when accuracy matters

---

## Database Schema (v2)

```sql
-- Nodes table (modified)
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  title TEXT,
  body TEXT,
  tags TEXT,  -- JSON array (kept for compatibility, denormalized)
  token_counts TEXT,  -- JSON object
  embedding BLOB,  -- float32[] little-endian (MIGRATION: currently JSON text)
  created_at TEXT,
  updated_at TEXT,
  approximate_scored INTEGER DEFAULT 1
);

-- NEW: Normalized tag storage for efficient lookups
CREATE TABLE node_tags (
  node_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (node_id, tag),
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);
CREATE INDEX idx_node_tags_tag ON node_tags(tag);

-- Tag IDF cache (rebuilt on rescore)
CREATE TABLE tag_idf (
  tag TEXT PRIMARY KEY,
  doc_freq INTEGER NOT NULL,
  idf REAL NOT NULL
);

-- Edges table (modified from v1)
CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  semantic_score REAL,  -- NULL if no embeddings available
  tag_score REAL,       -- NULL if no shared tags
  shared_tags TEXT,     -- JSON array of shared tag names
  status TEXT DEFAULT 'accepted',
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(source_id, target_id)
);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);

-- Keep edge_events for history (unchanged)
CREATE TABLE edge_events (
  id TEXT PRIMARY KEY,
  edge_id TEXT,
  source_id TEXT,
  target_id TEXT,
  prev_status TEXT,
  next_status TEXT,
  payload TEXT,
  created_at TEXT,
  undone INTEGER DEFAULT 0
);
```

### Migration Notes

1. **Embeddings**: Currently stored as JSON text arrays. Migration to BLOB (float32 little-endian) reduces storage ~4x and enables direct memory mapping.

2. **node_tags table**: Must be populated from existing `nodes.tags` JSON. Keep JSON column for backward compatibility but `node_tags` is source of truth for scoring.

3. **edges table**: Add `semantic_score`, `tag_score`, `shared_tags` columns. Populate `semantic_score` from existing `score` column initially.

---

## Index Storage

| Data | Location | Format |
|------|----------|--------|
| Nodes, edges, tags | `forest.db` | SQLite |
| Embeddings | `forest.db` (blob column) | float32 little-endian |
| HNSW index | `forest.idx` | hnswlib binary format |

---

## Display & Filtering

### Color Coding

When displaying edges (requires both scores non-null for comparison):
- **Blue**: Semantic-dominant (`semantic_score > tag_score × 1.2`)
- **Green**: Tag-dominant (`tag_score > semantic_score × 1.2`)
- **Purple**: Balanced (within 20% of each other)
- **Gray**: Single-layer only (one score is null)

### Score Display

```
→ related-node [S:0.72 T:0.45]  # Purple, balanced
→ another-node [S:0.81 T:--]    # Gray, semantic only
→ tagged-node  [S:-- T:0.67]    # Gray, tags only
```

### Filtering

```bash
forest explore node-id                    # All edges
forest explore node-id --by=semantic      # Only edges with semantic_score
forest explore node-id --by=tags          # Only edges with tag_score
forest explore node-id --min-semantic=0.6 # Semantic threshold filter
forest explore node-id --min-tags=0.4     # Tag threshold filter
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `FOREST_SEMANTIC_THRESHOLD` | 0.5 | Min semantic_score to contribute to edge |
| `FOREST_TAG_THRESHOLD` | 0.3 | Min tag_score to contribute to edge |
| `FOREST_HNSW_M` | 16 | HNSW connectivity parameter |
| `FOREST_HNSW_EF` | 200 | HNSW search depth |
| `FOREST_ANN_CANDIDATES` | 100 | Top-k candidates from approximate search |

---

## Migration Path

### From v1 (single `score` column)

```bash
forest admin migrate-v2
```

1. Add new columns to `edges` table
2. Create `node_tags` table, populate from `nodes.tags` JSON
3. Create `tag_idf` table, compute initial values
4. Copy existing `score` → `semantic_score`
5. Compute `tag_score` for all edges
6. Optionally convert embeddings JSON → BLOB (can be deferred)

### Rollback

Keep `score` column populated (write to both during transition period).

---

## Implementation Checklist

- [x] Expand tag regex to allow `/` in `src/lib/text.ts:155`
- [x] Add `node_tags` table and sync logic in `src/lib/db.ts`
- [x] Add `tag_idf` table and IDF computation
- [x] Modify `edges` schema: add `semantic_score`, `tag_score`, `shared_tags`
- [x] Update `computeScore()` to return both scores separately
- [x] Update `linkAgainstExisting()` to use dual-threshold logic
- [x] Add `forest link` command for bridge tag creation
- [x] Add `--by`, `--min-semantic`, `--min-tags` flags to explore
- [x] Color coding in edge display
- [ ] HNSW index integration (can be phase 2)
- [ ] Embedding BLOB migration (can be phase 2)

---

## Future Considerations

- **Temporal layer**: Session proximity, calendar clustering (third score dimension)
- **Explicit edge types**: User-defined relationship types beyond similarity
- **Daemon mode**: Background rescoring when system idle
- **Distributed index**: For multi-device sync scenarios
