# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Forest is a graph-native knowledge base CLI that captures unstructured ideas and automatically links them using a hybrid scoring algorithm combining semantic embeddings and lexical similarity. All data is stored in a single SQLite database (`forest.db`).

## Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run lint         # Type-check without emitting files
npm run dev          # Run from source with ts-node

# Testing the CLI during development
npm run dev -- capture --stdin < test.txt
npm run dev -- health
npm run dev -- stats

# After building
forest <command>     # Uses the compiled dist/index.js
```

## Architecture

### CLI Framework (Clerc)

The CLI uses **Clerc** (not Commander) for command parsing and help generation. Entry point is `src/index.ts` which normalizes args (e.g., `--no-auto-link` → `--auto-link=false`) before forwarding to `src/cli/index.ts`.

**Command Structure:**
```
forest capture                  # Capture new notes
forest explore                  # Explore the graph
forest node read [id]           # Read a note
forest node edit [id]           # Edit a note
forest node delete [id]         # Delete a note
forest node link [id] [id2]     # Link two notes
forest edges                    # Show recent edges
forest edges propose            # List suggested links
forest edges accept [ref]       # Accept a suggestion
forest edges reject [ref]       # Reject a suggestion
forest edges promote            # Bulk accept above threshold
forest edges sweep              # Bulk reject by range/score
forest edges explain [ref]      # Explain scoring
forest edges undo [ref]         # Undo accept/reject
forest tags list                # List tags
forest tags rename [old] [new]  # Rename a tag
forest tags stats               # Tag statistics
forest export graphviz          # Export as DOT
forest export json              # Export as JSON
forest stats                    # Graph statistics and health
forest health                   # System health check
forest admin:recompute-embeddings  # Recompute embeddings
```

Commands are modular:
- **Individual commands**: `src/cli/commands/{capture,explore,stats,health,admin-recompute-embeddings}.ts`
- **Subcommand groups**: `node`, `edges`, `tags`, `export` use `register*Commands()` pattern

Each command file exports a factory function:
```typescript
export function createCaptureCommand(clerc: ClercModule) {
  return clerc.defineCommand({ name: 'capture', ... }, handler);
}

// For subcommand groups
export function registerNodeCommands(cli: ClercInstance, clerc: ClercModule) {
  // Register read, edit, delete, link subcommands
}
```

### Database Layer (src/lib/db.ts)

Uses **sql.js** (SQLite compiled to WASM) with in-memory database persisted to disk on mutation.

**Core types:**
- `NodeRecord`: Nodes with id, title, body, tags, tokenCounts, optional embedding
- `EdgeRecord`: Edges with sourceId, targetId, score, status ('accepted' | 'suggested')

**Key pattern**: Database is lazily initialized on first access. All mutations set `dirty = true` and persist to disk.

Database path controlled by `FOREST_DB_PATH` env var (default: `forest.db` in cwd).

### Scoring Algorithm (src/lib/scoring.ts)

**Hybrid scoring** computes edge weights between node pairs:

```typescript
score = 0.25 * tokenSimilarity +
        0.55 * embeddingSimilarity +  // Dominant factor
        0.15 * tagOverlap +
        0.05 * titleSimilarity
```

Then applies a 0.9× penalty if both `tagOverlap` and `titleSimilarity` are zero (prevents weak semantic-only links).

**Classification thresholds** (configurable via env vars):
- `score >= 0.50` (FOREST_AUTO_ACCEPT): Auto-accepted edge
- `0.25 <= score < 0.50` (FOREST_SUGGESTION_THRESHOLD): Suggested for review
- `score < 0.25`: Discarded

**Token downweighting**: Generic technical terms (flow, stream, pipe, branch, terminal) are weighted at 0.4× in token similarity to reduce over-connection of unrelated domains.

### Embeddings (src/lib/embeddings.ts)

Three providers via `FOREST_EMBED_PROVIDER`:
1. **local** (default): Uses `@xenova/transformers` with model `Xenova/all-MiniLM-L6-v2` (384-dim)
2. **openai**: Calls OpenAI embeddings API (requires `OPENAI_API_KEY`)
3. **mock**: Deterministic hash-based vectors for offline testing
4. **none**: Disables embeddings (pure lexical scoring)

Embeddings are computed during capture/edit and stored as JSON arrays in the `embedding` column.

### Text Processing (src/lib/text.ts)

**Tag extraction** combines:
- Explicit `#tags` in text (if present, these take precedence)
- Auto-extraction: Ranks tokens by frequency × weight, picks top N unigrams + up to 50% bigrams

**Stemming** normalizes plurals, verb forms (e.g., -ing, -ed), and handles common endings.

**Stopwords**: 70+ common words filtered out before tokenization.

**Bigrams**: Extracted from body only (not title) to avoid title→body bridges that create spurious connections.

## Key Invariants

1. **Edge normalization**: Edges are undirected; `sourceId < targetId` is enforced via `normalizeEdgePair()`.
2. **Short IDs**: First 8 hex chars of UUIDs used for display; must be unique to resolve.
3. **Auto-linking**: When a node is captured or edited with `--auto-link` (default), it's scored against all existing nodes to create/update edges.
4. **Embedding backfill**: Use `forest admin:recompute-embeddings --rescore` to recompute embeddings for existing nodes and optionally rescore all edges.

## Shared Utilities (src/cli/shared/)

- `utils.ts`: ID formatting, body input resolution (`--file`, `--stdin`, `--body`), error handling
- `explore.ts`: Node selection, neighborhood building, search matching, output formatting
- `linking.ts`: Auto-linking logic (scores new node against existing nodes, creates edges)
- `edges.ts`: Edge reference resolution (by index, short pair, full ID, or 4-char code)

## Common Patterns

**Adding a new command:**
1. Create `src/cli/commands/yourcommand.ts`
2. Export `createYourCommand(clerc: ClercModule)` factory
3. Import and register in `src/cli/index.ts`

**Modifying scoring weights:**
Edit `src/lib/scoring.ts` line 33-37. After changing, run `admin:recompute-embeddings --rescore` to update existing edges.

**Testing with different embedding providers:**
```bash
FOREST_EMBED_PROVIDER=none forest capture --stdin < test.txt   # Lexical only
FOREST_EMBED_PROVIDER=local forest capture --stdin < test.txt  # Local embeddings
FOREST_EMBED_PROVIDER=openai OPENAI_API_KEY=... forest capture --stdin < test.txt
```

## Database Schema

```sql
nodes: id (PK), title, body, tags (JSON), token_counts (JSON), embedding (JSON), created_at, updated_at
edges: id (PK), source_id, target_id, score, status, metadata (JSON), created_at, updated_at
edge_events: id (PK), edge_id, source_id, target_id, prev_status, next_status, payload (JSON), created_at, undone
```

The `edge_events` table supports undo of accept/reject actions via `forest edges undo`.

## Command Migration Guide

The CLI was reorganized in a recent update for better discoverability and consistency:

**Node Operations (grouped under `forest node`)**
- `forest read [id]` → `forest node read [id]`
- `forest edit [id]` → `forest node edit [id]`
- `forest delete [id]` → `forest node delete [id]`
- `forest link [a] [b]` → `forest node link [a] [b]`

**Edge Management (renamed from `insights` to `edges`)**
- `forest insights list` → `forest edges propose`
- `forest insights promote` → `forest edges promote`
- `forest insights accept [ref]` → `forest edges accept [ref]`
- `forest insights reject [ref]` → `forest edges reject [ref]`
- `forest insights sweep` → `forest edges sweep`
- `forest insights explain [ref]` → `forest edges explain [ref]`
- `forest insights undo [ref]` → `forest edges undo [ref]`
- NEW: `forest edges` shows recent accepted edges

**System Commands**
- `forest doctor` → `forest health` (now focuses on system health diagnostics)
- `forest stats` enhanced with graph metrics (recent captures, high-degree nodes, top suggestions)
