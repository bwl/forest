## Canonical Document Model

Forest now treats every multi-chunk import as a canonical document with derived segment nodes.

### Schema

- **documents**
  - `id`: canonical document identifier (root node id when present)
  - `title`, `body`: authoritative markdown
  - `metadata`: JSON blob (`chunkStrategy`, `overlap`, `autoLink`, etc.)
  - `version`: increments with each edit
  - `root_node_id`: optional pointer to the document summary node
  - `created_at`, `updated_at`
- **document_chunks**
  - `document_id`, `segment_id`, `node_id`
  - `offset`, `length`: byte offsets into canonical body (joined with `\n\n`)
  - `chunk_order`: rendering order
  - `checksum`: sha256 of the chunk body for change detection
  - timestamps mirror the underlying chunk node

### Lifecycle

1. **Import** (`importDocumentCore`)
   - Generates root and chunk nodes.
   - Seeds `documents` + `document_chunks` with metadata, offsets, and checksums.
   - Structural edges (parent-child, sequential) are built on top of the same nodes to keep progressive IDs stable.
2. **Edit via `forest node edit`**
   - Loads a document session, renders the full document, and lets the user edit each segment between `<!-- forest:segment ... -->` markers.
   - Only segments with actual textual deltas are re-embedded and rescored; the document version and chunk records are rewritten atomically.
3. **Refresh via flags (`forest node refresh`)**
   - Keeps the legacy flag/file workflow but detects chunk membership.
   - After updating the chunk node, the canonical document is rebuilt (version bump, checksums + offsets updated) and a concise log is emitted.
4. **Existing standalone notes**
   - Continue to bypass the document session; they remain untouched by the canonical pipeline.

### Rescoring and Edge Integrity

- `rescoreNode` deletes edges whose new score drops below the suggestion threshold and updates accepted edges in place.
- Only chunks with edited content trigger rescoring; unchanged segments retain their embeddings and edges.
- The canonical update carries over `lastEditedAt` / `lastEditedNodeId` metadata to aid observability.

### Migration / Backfill

- On boot, `backfillCanonicalDocuments` scans for chunk nodes lacking canonical entries and populates `documents` + `document_chunks`.
- Run `bun run dev -- node recent --json` after upgrade to confirm documents now show versioned metadata.
- If backfill fails (e.g., due to malformed chunks), rerun the CLI once the data is corrected—the migration is idempotent.

### Error Recovery

- `forest node edit` preserves the temp file path when parsing fails so the user can inspect/repair the document.
- `forest node refresh` prints a document-update summary; if segments remain unchanged the tool logs “document unchanged (no structural delta).”
- Re-run `forest node refresh <chunk> --no-auto-link` to rebuild canonical data without rescoring if needed.

### Rollout Checklist

1. **Backup existing database.** `cp forest.db forest.db.backup-$(date +%Y%m%d)`
2. **Upgrade CLI** and launch once—automatic backfill populates canonical tables.
3. **Verify schema:**
   - `bunx tsx -e "const { listDocuments } = require('./src/lib/db'); listDocuments().then(console.log);"`
   - Spot-check a document via `forest node read <doc-root>`; confirm the footer shows chunk IDs.
4. **Smoke test editing:** edit a chunk with `forest node edit <chunk-id> --no-auto-link` and confirm the console emits the document version bump.
5. **Monitor logs:** watch for `document updated:` output in CI or production logs; unexpected `document unchanged` messages may indicate user edits were reverted by tooling.
6. **Re-run lint/tests:** `bun run lint` and `bun test`.
