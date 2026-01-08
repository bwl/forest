# ADR: Introduce TUI Document Editor with Hidden Segment Boundaries

- Status: Accepted
- Date: 2025-10-23
- Owners: Forest CLI maintainers
- Related: `node edit` flow, chunked documents, `document-session` utilities

## Context

Editing chunked documents via `forest node edit` currently opens a temp markdown file containing visible HTML comment markers per segment (node). While robust and editor-agnostic, the UX is noisy and error-prone:

- Users see implementation markers (`<!-- forest:segment ... -->`) that must not be deleted.
- Multi-segment editing and reordering is awkward.
- We need a richer API than plain text I/O: full-screen rendering, input events, scroll/cursor control, and programmatic save hooks.

The data model already models canonical documents and their chunk mappings:

- `documents` table stores canonical document body and metadata.
- `document_chunks` maps segments to nodes with `chunk_order`, offsets, and checksums.
- On read, we can reconstruct full documents from chunks.
- On write, we update node bodies, recompute embeddings/tags, bump document version, and replace chunk mappings.

Relevant code:

- Document session + editor buffer builder/parser: `src/cli/shared/document-session.ts`
- `node edit` flow, save pipelines: `src/cli/commands/node.ts`
  - External editor entrypoint: `src/cli/commands/node.ts:830`
  - Multi-segment save: `src/cli/commands/node.ts:1320`
  - Single-segment doc update helper: `src/cli/commands/node.ts:1128`

## Decision

Add an optional, full-screen TUI editor for `forest node edit` that:

- Hides segment markers and renders only user-visible text.
- Maintains a hidden segment tree in state (virtual buffer with segment spans).
- Supports cursor/scroll, key events, and programmatic save (no temp file editing).
- Serializes back to per-segment content and uses the existing save pipelines.
- Launches via `forest node edit <id> --tui` (opt-in). Falls back to current `$EDITOR` flow if TUI deps are missing or user opts out.

Primary framework: Ink (React renderer for terminal). Alternate: react-blessed if we need lower-level control.

No database schema changes.

## Rationale

- Preserve the robust existing persistence and rescoring logic; improve only the editing UX.
- Keep the CLI TypeScript stack consistent; React components enable incremental UI development.
- Provide a safe migration path (flag-gated, dynamic import, fallback to current behavior).

## Non-Goals (initial)

- Segment splitting/merging into new nodes (advanced).  
- Cross-document multi-edit.  
- Collaborative/concurrent editing.

## Architecture Concerns & Mitigations

1) Virtual buffer complexity (span tracking)
- Risk: maintaining per-segment spans as users insert/delete text (including multi-character edits) is error-prone.
- Mitigation: use a simple piece table or gap buffer per segment and keep a lightweight list of segment spans across the concatenated view.
  - Start with per-segment gap buffers; join segments with virtual separators ("\n\n").
  - Maintain an array of spans in character offsets; edits in a segment only shift subsequent spans by delta length.
  - Cross-boundary operations are disabled in Phase 2; Phase 3 adds explicit handling.
- Alternative: rope/piece-table across the whole document for very large inputs. Migrate if perf requires.

2) Cross-boundary edits and re-slicing
- Phase 2: disabled (prevent cursor crossing and reject edits across separators with a clear message).
- Phase 3: gated by toggle/flag. When an edit crosses a boundary, proportionally re-slice text into adjacent segments, update spans, mark both segments dirty; keep `chunk_order` stable.

3) Undo/redo
- Provide in-memory history (Ctrl-Z/Ctrl-Shift-Z) implemented as inverse ops over buffers.

## Framework Choice & Performance

- Primary: Ink + React (ergonomic, TS-friendly). Cons: bundle size (~500KB+) and reconciliation overhead per keystroke.
- Alternative: react-blessed (lower overhead, more control). Cons: rougher DX.

Perf tactics (regardless of framework):
- Windowed rendering (only viewport ± ~50 lines).
- Coalesce rapid inputs (16–32ms tick) to avoid per-keystroke full reconciliation.
- Update spans only on text mutations; avoid recomputation on render.
- Simplified rendering mode for very large docs (>20k lines).

## Detailed Design

### Virtual Buffer (Segment-Aware)

- State:
  - `segments: { segmentId, nodeId, title, content, chunkOrder }[]` (loaded via `loadDocumentSessionForNode`).
  - `visibleText: string` as a concatenation of segment bodies with a single `"\n\n"` between segments (no markers).
  - `spans: { start: number; end: number; segmentId: string }[]` over `visibleText` (character offsets) mapping each segment.
  - `cursor: { row, col }`, `viewport: { topRow, height }`.
- Initialization:
  - Build `visibleText` by joining `segment.content` with `\n\n`.
  - Compute spans by cumulative lengths, including 2-char separators between segments.
- Editing:
  - Apply insert/delete to `visibleText` and adjust spans incrementally.
  - For v1, restrict edits within a segment’s span (prevent cross-boundary edits).  
    Later, enable cross-boundary edits with re-slicing into adjacent segments.
- Serialization on save:
  - For each span, slice `visibleText[start:end]` → segment content.
  - Build a `ParsedDocumentEdit`-like payload: `segments: [{ segmentId, nodeId, content }]`, `canonicalBody = join(content, '\n\n')`.
  - Reuse the same save path as `applyDocumentEditSession` to update nodes, embeddings/tags, document version/metadata, and `document_chunks` (offsets, lengths, checksums).

### UI/Interaction

- Full-screen app with:
  - Text area (windowed rendering of lines in the viewport).
  - Status bar: document title, version, current segment title, line/col, modified flag, key hints.
  - Optional faint separators or dim headers between segments (no markers).
- Keybindings (initial):
  - Movement: arrows, PgUp/PgDn, Home/End, Ctrl-A/E.
  - Editing: standard typing, Backspace/Delete.
  - Save: Ctrl-S → triggers serialization and save pipeline.
  - Quit: Ctrl-Q (confirm if dirty).
  - Segment navigation: Alt-j / Alt-k (next/prev segment).  
  - Toggle separators: Ctrl-.
  - Cross-boundary toggle (Phase 3): Ctrl-B (enable/disable).
  - Undo/redo (Phase 2): Ctrl-Z / Ctrl-Shift-Z.
  - Search (Phase 2): Ctrl-F, then n/N (literal search, highlight matches in viewport).

### Integration Points

- Flag: add `--tui` to `node edit` (opt-in).  
  Location: `src/cli/commands/node.ts` (flags and `runNodeEdit`).
- Dynamic import of TUI module:
  - `try { const { runDocumentEditorTui } = await import('../tui/document-editor'); } catch { fallback }`.
- Document session loader: `loadDocumentSessionForNode` (`src/cli/shared/document-session.ts`).
- Save pipelines (reuse):
  - Multi-segment: see `applyDocumentEditSession` logic at `src/cli/commands/node.ts:1320`.
  - Single-segment in-place updates: `applyDocumentChunkUpdates` at `src/cli/commands/node.ts:1128` (used when exactly one segment changed).

### Config Precedence

- Precedence: CLI flag > env var > config file > default
  1. `--tui` flag (explicit opt-in)
  2. `FOREST_NODE_EDIT_TUI=true` environment variable
  3. Config file: `nodeEdit.useTui: true`
  4. Default: false (external editor)

Example helper (to extend `src/lib/config.ts`):

```
export function shouldUseTui(cliFlag: boolean | undefined): boolean {
  if (cliFlag !== undefined) return cliFlag;
  if (process.env.FOREST_NODE_EDIT_TUI === 'true') return true;
  return getConfigValue('nodeEdit.useTui', false);
}
```

## Alternatives Considered

- Keep external editor + hidden markers (invisible via editor folds).  
  - Pro: zero runtime deps. Con: inconsistent across editors, still fragile.
- blessed/react-blessed instead of Ink.  
  - Pro: lower-level control. Con: less ergonomic component composition.
- xterm/webview desktop UI.  
  - Pro: powerful UI. Con: non-CLI footprint, packaging complexity.

## Consequences

- Pros:
  - Cleaner editing experience; no markers; safer multi-segment updates.
  - Reuses mature save and rescoring logic; minimal DB impact.
  - Flag-gated; fallback preserves current workflows.
- Cons:
  - Implementing a performant multiline editor is non-trivial.
  - New runtime dependencies (Ink/React) increase startup size.
  - Need careful span maintenance for correctness and speed.

## Rollout Plan (Phases)

1) Flag + TUI Scaffold (read-only viewer)
   - Add `--tui` flag and dynamic import with graceful fallback.
   - Render reconstructed document (no editing), show hidden boundaries as faint separators, scrolling, and segment jump.

2) Basic Editing (single segment)
   - Enable in-place edits inside the focused segment only; prevent crossing boundaries.
   - Add undo/redo and dirty-state warnings.
   - Add search (Ctrl-F with n/N) and highlight matches.
   - Save via `applyDocumentChunkUpdates` when one segment changed.

3) Multi-Segment Editing
   - Allow edits in multiple segments per session.
   - Serialize and reuse `applyDocumentEditSession` logic (nodes, document version, chunk mapping, rescoring).
   - Add cross-boundary editing behind a toggle/flag (Ctrl-B, `--allow-cross-boundary`).

4) Reordering (optional)
   - Move segments up/down; update `chunk_order`.
   - Serialize ordering changes in the chunk mapping.

5) Advanced Structural Edits (optional)
   - Merge/split segments (create/remove nodes safely with updated mappings).

## Segment Separator Appearance

- Default: minimal faint line with two blank lines around it, no titles.

```
─────────────────────
```

- Verbose mode (Ctrl-.): show titled header with index/total.

```
╭─ {Title} (segment 2/5) ────────╮
│ Content here...                │
╰────────────────────────────────╯
```

Rationale: minimal by default to keep the “clean text” feel; titles help navigation but should not be the default.

## Testing & Validation

- Manual smoke tests using `forest.db`:
  - `bun run dev -- node edit <chunkId> --tui`: read-only viewer scroll/jump.
  - Single-segment edit → save → verify `documents show <id> --chunks` outputs updated offsets/checksums and version bump.
  - Multi-segment edit → save → verify chunk order preserved and canonical body recreated with `\n\n` joins.
  - Reorder (phase 4) → verify new `chunk_order` and consistent `document_chunks` mapping.
- Suggested targeted tests (follow-up): small TypeScript tests for span slicing given edit operations.

## Performance Budget

- Target: < 50 ms keystroke latency for ~10k visible lines.
- Implementation:
  - Windowed rendering with ±50 line overscan.
  - Throttled updates (16–32ms).
  - Incremental span updates; avoid full-buffer rescans.
- Fallback: show “Large document, simplified rendering” for >20k lines and disable expensive decorations.

## Testing Strategy

- Unit tests for virtual buffer/span integrity (insert/delete within a segment, boundary constraints, delta shifting of spans).
- Property tests for random edit sequences to detect drift between visible text and per-segment slices.
- Micro-benchmarks to validate latency targets with synthetic 10k–20k line buffers.
- Manual smoke tests as listed above; CLI e2e flows for save/rescore correctness.

Example unit test sketch:

```
describe('VirtualBuffer', () => {
  it('maintains spans after insert', () => {
    const buf = new VirtualBuffer([
      { segmentId: 's1', nodeId: 'n1', content: 'Hello' },
      { segmentId: 's2', nodeId: 'n2', content: 'World' },
    ]);
    buf.insert(5, ' there'); // Insert in s1
    expect(buf.getSegmentContent('s1')).toBe('Hello there');
    const s2 = buf.getSpan('s2');
    expect(s2.start).toBe(13); // shifted by 6 chars
  });
});
```

## Dependencies

- Primary: `ink`, `react`.
- Alternate: `react-blessed`, `blessed`.
- Dynamic import and error message if missing (fallback to $EDITOR flow).

## Performance Considerations

- Render windowed viewport only (avoid re-rendering entire buffer on keypress).
- Maintain spans incrementally; avoid O(n) rescans of entire text on each edit.
- Defer embeddings computation to save path (as today).

## Security & Privacy

- Local-only terminal UI. No network calls.  
- Temp files not used in TUI path; content stays in memory until persisted via existing DB layer.

## Open Questions

- Should we allow cross-boundary edits by default or require an explicit toggle?  
- How opinionated should segment separators look (title gutters vs faint lines)?  
- Config defaults: env var (`FOREST_NODE_EDIT_TUI=true`) or config file knob?

## Backwards Compatibility

- Default remains external editor path.  
- `--tui` is opt-in and can be made default later via config.

## Migration & Docs

- Update command help and TLDR for `node edit` to include `--tui`.  
- Add a brief user guide under `docs/` once the MVP lands (keybindings, tips, fallback).

## Risk Assessment

- Low risk:
  - Read-only viewer (Phase 1)
  - Single-segment editing (Phase 2)
  - Flag-gated rollout with fallback

- Medium risk:
  - Multi-segment editing span maintenance
  - Undo/redo implementation
  - Performance with large documents

- High risk:
  - Cross-boundary edits with re-slicing
  - Segment reordering and consistent `chunk_order` updates
  - Merge/split (new node creation/deletion) and mapping integrity

## Decision & Next Steps

- Decision: proceed with Phase 1 (read-only viewer) to validate framework choice and virtual buffer model before full editing.
- Next: implement `--tui` + dynamic import scaffold and the read-only viewer MVP, followed by Phase 2 features (single-segment editing, search, undo/redo).

