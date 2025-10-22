# Task 02: Canonical Document Schema & Migration Plan

**Status:** ✅ Completed  
**Relevant code:** `src/lib/db.ts`

---

## Schema Decisions

- **`documents` table**
  - Columns: `id`, `title`, `body`, `metadata`, `version`, `root_node_id`, `created_at`, `updated_at`.
  - `metadata` stores JSON (chunking strategy, provenance flags, etc.).
  - `version` starts at `1`; future updates will bump per edit.
  - `root_node_id` links canonical doc to the pre-existing root node (if any).

- **`document_chunks` table**
  - Columns: `document_id`, `segment_id`, `node_id`, `offset`, `length`, `chunk_order`, `checksum`, `created_at`, `updated_at`.
  - Unique `(document_id, segment_id)` primary key plus unique index on `node_id`.
  - `segment_id` uses existing chunk node IDs for backfill, establishing stable logical identifiers from day one.
  - `offset`/`length` reference canonical body positions; `checksum` (`sha256`) enables change detection.

- New utility exports in `db.ts`:
  - `listDocuments`, `getDocumentById`, `getDocumentByRootNode`, `getDocumentForNode`.
  - `getDocumentChunks`, `upsertDocument`, `replaceDocumentChunks`, `deleteDocumentChunksForNodes`.

---

## Migration & Backfill

- Added table creation inside `runMigrations`.
- Implemented `backfillCanonicalDocuments()` executed during `ensureDatabase()` boot:
  - Scans for chunk groups lacking `documents` entries.
  - Reconstructs canonical text (`'\n\n'` between chunks).
  - Inserts `documents` rows with metadata `{ backfill: true, chunkCount, chunkOrdersProvided }`.
  - Inserts `document_chunks` rows preserving original chunk order, offsets, and checksums.
- Ensured backfill sets the dirty flag so the DB persists once new records are written.
- On node deletion, associated `document_chunks` mappings are removed automatically.

---

## Validation / Follow-up

- Lint/typecheck passes (`bun run lint`).
- Existing chunked documents now appear in canonical tables without manual intervention.
- Future tasks will:
  - Update import/edit flows to populate and maintain these tables.
  - Leverage `replaceDocumentChunks` when re-slicing documents.
  - Bump `documents.version` and trigger downstream refresh on edits.
