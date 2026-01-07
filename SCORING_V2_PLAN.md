# Scoring v2 Implementation Plan

See [SCORING_SPEC.md](./SCORING_SPEC.md) for full specification.

---

## Phase 1: Dual-Score Foundation

### 1.1 Schema Changes
- [x] Add `semantic_score`, `tag_score`, `shared_tags` columns to `edges` table
- [x] Create `node_tags` table with `(node_id, tag)` composite PK
- [x] Create `tag_idf` table with `(tag, doc_freq, idf)`
- [x] Add `approximate_scored` column to `nodes` table

### 1.2 Tag Infrastructure
- [x] Expand tag regex to `#[a-zA-Z0-9_/-]+` in `src/lib/text.ts:155`
- [x] Add `syncNodeTags(nodeId, tags[])` to populate `node_tags` on insert/update
- [x] Add `rebuildTagIdf()` to compute IDF values from `node_tags`

### 1.3 Scoring Logic
- [x] Split `computeScore()` into `computeSemanticScore()` and `computeTagScore()`
- [x] Implement tag score: `jaccard × (avg_idf / max_idf)`
- [x] Update `linkAgainstExisting()` for dual-threshold edge creation

### 1.4 Migration
- [x] `forest admin migrate-v2`: populate new columns, create tables
- [x] Backfill `node_tags` from existing `nodes.tags` JSON
- [x] Copy existing `score` → `semantic_score`
- [x] Compute `tag_score` for all existing edges

---

## Phase 2: Bridge Tags

- [x] Add `forest link <ref1> <ref2> [--name=X]` command
- [x] Auto-generate `#link/<hash>` when no name provided
- [x] Add both tags to both nodes via existing tag machinery

---

## Phase 3: Display & Filtering

- [x] Update edge display: `[S:0.72 T:0.45]` format
- [x] Add color coding (blue/green/purple/gray)
- [x] Add `--by=semantic|tags` filter to `forest explore`
- [x] Add `--min-semantic`, `--min-tags` threshold filters

---

## Phase 4: Performance (Deferred)

- [ ] HNSW index in separate `.idx` file
- [ ] Embedding BLOB migration (JSON → float32)
- [ ] Fast-path approximate linking on capture
- [ ] `forest admin rescore` with `--semantic`/`--tags` flags
