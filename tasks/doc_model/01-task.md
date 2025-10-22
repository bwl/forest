# Task 01: Model Current State & Requirements

**Status:** ✅ Completed

---

## Current Architecture Snapshot

- **Nodes Table**
  - Stores both standalone notes and chunk nodes.
  - Chunk metadata: `is_chunk` flag, `parent_document_id` (root node UUID), `chunk_order`.
  - No canonical document record; imported documents rely on root node + child chunks.
- **Edges Table**
  - Semantic edges (`semantic`), structural parent-child (`parent-child`), sequential (`sequential`), manual links.
  - Parent-child edges link root node ↔ chunk node; sequential edges connect adjacent chunks.
- **Import Flow (`importDocumentCore`)**
  - Generates root node (optional) and chunk nodes via `chunkDocument`.
  - Inserts nodes directly; chunk nodes set `isChunk=true`, `parentDocumentId=rootId`, `chunkOrder`.
  - Creates structural edges; runs semantic auto-linking against existing nodes.
- **Read Flow (`node read`, `reconstructDocument`)**
  - Detects chunks via `isChunk/parentDocumentId`.
  - Reassembles full document by concatenating chunk bodies in order.
  - Presents `[Document with N chunks - automatically reconstructed]` message.
- **Edit/Refresh Flow**
  - `node refresh` updates a single node (title/body/tags) and rescoring.
  - `node edit` currently edits individual node or full doc reconstruction but writes back to the single node; chunks edited individually.

### Pain Points

- Editing a chunk in isolation loses context of the original document.
- Re-chunking after edits would allocate new node IDs, breaking edges and history.
- No canonical store of document text; reconstruction relies on child nodes, leading to drift if chunks diverge.
- Embedding/rescoring runs individually without awareness of document versioning or chunk lineage.

---

## Required Invariants & Constraints

- **Node Identity Preservation:** Existing chunk node IDs (and their edges/events) must remain stable where possible.
- **Round-Trip Fidelity:** Concatenating chunk bodies should always regenerate canonical document content.
- **Structural Edge Integrity:** Parent-child and sequential edges stay valid after edits or re-chunking.
- **Selective Re-Embedding:** Only changed segments trigger embedding/scoring refresh to avoid unnecessary churn.
- **Backward Compatibility:** Standalone notes and existing commands (read/search/explore) continue to function without change.

---

## Proposed Canonical Schema Sketch

```
documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,              -- canonical full document (markdown)
  metadata TEXT,                   -- JSON blob for chunking options, source info
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

document_chunks (
  document_id TEXT NOT NULL REFERENCES documents(id),
  segment_id TEXT NOT NULL,        -- stable logical key (uuid or deterministic hash)
  node_id TEXT NOT NULL REFERENCES nodes(id),
  offset INTEGER NOT NULL,         -- start index in canonical body
  length INTEGER NOT NULL,
  checksum TEXT NOT NULL,          -- content hash for change detection
  chunk_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(document_id, segment_id)
)
```

### Supporting Requirements

- Maintain unique constraint on `segment_id` within a document; allow referencing same logical segment across versions.
- Store chunking metadata (strategy, overlap, token budget) in `documents.metadata`.
- Provide migration utilities to backfill canonical documents from existing root/chunk nodes.
- Expose helper API to retrieve document + segment map in a single query for editing workflows.

---

## Next Steps

- Use this analysis to drive schema/migration design (Task 02).
- Draft `DocumentSession` abstraction building on the canonical schema (Task 03).
- Plan change detection using `checksum` / `version` fields for synchronization (Task 04).
