# Task 04: Synchronization & Graph Updates

**Status:** ✅ Completed

---

## What Changed

- **Canonical updates on import & refresh**
  - `importDocumentCore` now seeds the `documents` and `document_chunks` tables (checksums, offsets, metadata) immediately after chunk creation.
  - `node refresh` detects when the target note is a chunk, reloads the document session, rebuilds canonical text, rewrites chunk mappings, and bumps the document version.

- **Selective recomputation**
  - Both `node edit` (Task 03) and the new refresh path only re-embed/rescore segments whose content changed; others keep their embeddings/edges intact.
  - Rescoring leverages existing `rescoreNode`, which already demotes accepted edges that fall below thresholds and deletes discarded ones.

- **Shared utilities**
  - Introduced `applyDocumentChunkUpdates` to consolidate canonical-body regeneration, checksum updates, and metadata stamping (`lastEditedAt`, `lastEditedNodeId`).
  - Added log output so users see when document versions advance or when no structural delta is detected.

## Verification

- Type checks: `bun run lint`.
- Manual inspection of generated document buffers and post-refresh console output.
- Existing doc edit smoke harness exercised the new logging/error paths.

## Follow-up Considerations

- Segment deletion/creation is still disallowed by the editor parser; enabling that will require node lifecycle management and edge cleanup.
- Longer term we may want background workers for bulk re-embedding instead of synchronous rescoring.
