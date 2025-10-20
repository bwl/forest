# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Forest is a graph-native knowledge base CLI that captures unstructured ideas and automatically links them using a hybrid scoring algorithm combining semantic embeddings and lexical similarity. All data is stored in a single SQLite database (`forest.db`).

## Agent-First TLDR Standard

Forest implements the **TLDR Standard (v0.1)** for agent ingestion - a minimal, parseable command metadata format designed for AI agents.

### Quick Start for Agents

```bash
# Discover all commands
forest --tldr

# Get detailed command metadata (ASCII format)
forest capture --tldr
forest edges propose --tldr

# Get JSON format for programmatic parsing
forest --tldr=json
forest search --tldr=json
```

### TLDR Format

**ASCII mode** (default): Single-pass parseable KEY: value pairs
```
CMD: capture
PURPOSE: Create a new note and optionally auto-link into the graph
INPUTS: ARGS(title,body,tags),STDIN,FILE
OUTPUTS: node record,edges summary,optional preview
SIDE_EFFECTS: writes to SQLite DB,computes embeddings,creates/updates edges
FLAGS: --title=STR|note title;--body=STR|note body;--stdin=BOOL=false|read entire stdin as body
EXAMPLES: forest capture --stdin < note.md|forest capture --title "Idea" --body "Text"
RELATED: explore,edges.propose,node.read
```

**JSON mode** (`--tldr=json`): Same data, structured format
```json
{
  "CMD": "capture",
  "PURPOSE": "Create a new note and optionally auto-link into the graph",
  "INPUTS": ["ARGS(title,body,tags)", "STDIN", "FILE"],
  "FLAGS": [{"name": "title", "type": "STR", "default": null, "desc": "note title"}],
  ...
}
```

### Implementation Details

- **Location**: `src/cli/tldr.ts` - Central registry of all command metadata
- **Discovery**: Every command accepts `--tldr` or `--tldr=json`
- **Global index**: `forest --tldr` lists all available commands
- **Per-command**: `forest <command> --tldr` shows detailed metadata

### Benefits for Agents

1. **Zero-shot discovery**: Learn entire CLI surface in one round-trip
2. **Minimal tokens**: Compact format optimized for context windows
3. **Predictable parsing**: Fixed schema, no free-form text
4. **Self-documenting**: FLAGS includes types, defaults, and descriptions
5. **Cross-reference**: RELATED field enables command discovery

### TLDR Generators & Full Spec

Forest implements TLDR v0.1 as a reference. Full spec and universal documentation generators available at:

**`tldr-agent-spec/`** - Standalone repository with:
- Complete specification (`docs/spec-v0.1.md`)
- Three universal generators (bash, node, python)
- Validation tools
- Forest reference implementation

**Quick validation**:
```bash
cd tldr-agent-spec
./scripts/tldr-doc-gen.sh forest --validate
```

**For full TLDR documentation**: See `tldr-agent-spec/README.md`

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

# Running the API server
bun run dev:server                    # Start on default port 3000 (dual-stack IPv4/IPv6)
FOREST_PORT=8080 bun run dev:server   # Custom port
FOREST_HOST=0.0.0.0 bun run dev:server # IPv4 only
forest serve --port 3000 --host ::    # Via CLI (requires Bun)

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
forest search ["query"]         # Semantic search using embeddings
forest stats                    # Graph statistics and health
forest health                   # System health check
forest admin:recompute-embeddings  # Recompute embeddings
```

Commands are modular:
- **Individual commands**: `src/cli/commands/{capture,explore,search,stats,health,admin-recompute-embeddings}.ts`
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

### 3-Layer Architecture: CLI/API Feature Parity

Forest uses a **3-layer architecture** to maintain feature parity between the CLI and REST API:

```
┌─────────────────────────────────────────────────────┐
│  CLI Layer (src/cli/commands/)                      │
│  • Parses command-line arguments                    │
│  • Formats human-readable output                    │
│  • Handles --json flag for machine output           │
│  └──> Calls Core Layer                              │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  Core Layer (src/core/) ⭐ SINGLE SOURCE OF TRUTH   │
│  • Pure business logic functions                    │
│  • No I/O dependencies (no HTTP, no CLI formatting) │
│  • Returns typed data structures                    │
│  • Examples: semanticSearchCore(), createNodeCore() │
└─────────────────────────────────────────────────────┘
                         ↑
┌─────────────────────────────────────────────────────┐
│  API Layer (src/server/routes/)                     │
│  • Handles HTTP requests and validation             │
│  • Parses query params and request bodies           │
│  • Formats JSON responses with envelope pattern     │
│  └──> Calls Core Layer                              │
└─────────────────────────────────────────────────────┘
```

**Key Principle**: Both CLI and API call the **same core functions**. This ensures:
1. Features are available in both interfaces
2. Business logic is never duplicated
3. Bug fixes apply universally
4. Testing can focus on core logic

**Example - Semantic Search**:
- ✅ `src/core/search.ts` - `semanticSearchCore(query, options)` - business logic
- ✅ `src/cli/commands/search.ts` - Calls `semanticSearchCore()`, formats table output
- ✅ `src/server/routes/search.ts` - Calls `semanticSearchCore()`, returns JSON

**Example - Node Capture**:
- ✅ `src/core/nodes.ts` - `createNodeCore(data)` - business logic
- ⚠️  `src/cli/commands/capture.ts` - Currently reimplements logic (needs refactoring)
- ✅ `src/server/routes/nodes.ts` - Calls `createNodeCore()`

**Adding a New Feature - Checklist**:
When implementing a new feature that should be available in both CLI and API:

1. ✅ **Core logic first**: Implement in `src/core/*.ts` as a pure function
2. ✅ **API route**: Create/update route in `src/server/routes/*.ts` that calls core function
3. ✅ **CLI command**: Create/update command in `src/cli/commands/*.ts` that calls core function
4. ✅ **Register routes**: Add to `src/server/index.ts` and `src/cli/index.ts`
5. ✅ **Test both interfaces**: Verify identical behavior in CLI and API
6. ✅ **Update docs**: Add command to CLAUDE.md command list

**Anti-Pattern to Avoid**:
❌ Implementing business logic directly in CLI commands or API routes
❌ Copy-pasting logic between CLI and API
❌ Having different behavior/validation in CLI vs API

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

**Server configuration via environment variables:**
- `FOREST_PORT` - Server port (default: 3000)
- `FOREST_HOST` - Server hostname (default: `::` for dual-stack IPv4/IPv6)
  - `::` - Dual-stack mode, listens on both IPv4 and IPv6
  - `0.0.0.0` - IPv4 only
  - `localhost` - Localhost only (may prefer IPv4 or IPv6 depending on OS)
- `FOREST_DB_PATH` - Database file path (default: `forest.db` in cwd)
- `FOREST_EMBED_PROVIDER` - Embedding provider (default: `local`)

**Network connectivity:**
The server defaults to dual-stack mode (`::`) which accepts connections on both:
- IPv4: `http://localhost:3000`, `http://127.0.0.1:3000`
- IPv6: `http://[::1]:3000`

This prevents connection delays when clients (like Bun's fetch) try IPv6 first.

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
