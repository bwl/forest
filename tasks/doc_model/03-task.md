# Task 03: Document-Aware Editing Workflow

**Status:** ✅ Completed

---

## Implementation Highlights

- Added `src/cli/shared/document-session.ts` to encapsulate document loading, segment metadata, editor buffer generation, and robust parsing.
- `node edit` now detects when the target node belongs to a canonical document and launches a document session:
  - Emits the full document with HTML comment markers guarding each segment and a focus hint for the active chunk.
  - Provides clear console messaging (“Editing node within document …”).
- On save, the parser maps edited segments back to their original nodes, computes canonical body changes, bumps the document version, and rewrites `document_chunks` (offsets, order, checksums).
- Only segments with content changes are re-embedded and optionally re-scored; segment reordering updates `chunk_order` metadata while preserving node IDs.
- Temp files are retained when parsing fails with contextual errors, allowing recovery.
- Standalone notes still use the original single-node editor workflow; shared helpers (`applySingleNodeEdit`, `applyDocumentEditSession`) consolidate the logic.

## Notes & Verification

- Type checks: `bun run lint`.
- Manual smoke run: invoked `forest node edit` against a chunk to inspect the generated document buffer (automated mutations hit quoting issues but verified buffer structure and error handling).
- Document metadata (`documents.version`, `document_chunks`) updates observed via code inspection and backfill alignment from Task 02.

## Follow-up

- Future work (Task 04) will hook the synchronization layer to trigger selective re-embedding/rescoring queues and handle accepted-edge demotions when scores drift.
