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
bun install          # Install dependencies
bun run build        # Compile TypeScript to dist/
bun run lint         # Type-check without emitting files
bun run dev          # Run from source with ts-node

# Testing the CLI during development
bun run dev -- capture --stdin < test.txt
bun run dev -- health
bun run dev -- stats

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

### Git-Style Node References

Forest uses **Git-inspired progressive abbreviation** for node and edge IDs, optimizing for both brevity and backward compatibility.

#### Display vs. Acceptance

**What Forest displays** (optimized for current graph size):
```bash
$ forest explore
  ID      TITLE              EDGES
  7fa7    Optimize UUIDs     12      # Shows 4-7 chars (enough for uniqueness)
  ef3a    Progressive IDs    8
```

**What Forest accepts** (any unique prefix):
```bash
$ forest node read 7fa7          # 4 chars ✅
$ forest node read 7fa7acb2      # 8 chars ✅ (backward compatible!)
$ forest node read 7fa7acb2-ed4a-4f3b-9c1e-8a2b3c4d5e6f  # full UUID ✅
```

All lengths work! Forest accepts **any unique prefix**, even if display shows shorter.

#### Reference Types

Forest supports multiple reference patterns (unified resolution in `src/cli/shared/utils.ts:resolveNodeReference()`):

**1. UUID Prefixes** (case-insensitive, works with/without dashes):
```bash
forest node read 7fa7           # Short prefix
forest node read 7fa7acb2       # 8-char prefix
forest node read 7fa7acb2-ed4a  # Longer prefix
```

**2. Recency References** (Git-style `HEAD~N`):
```bash
forest node read @              # Last updated node (@ or @0)
forest node read @1             # Second most recently updated
forest node read @2             # Third most recently updated
forest node link @ @1           # Link two recent nodes
```

**3. Tag Search** (exact match, finds unique node):
```bash
forest node read #typescript    # Node tagged with 'typescript'
forest node read #api-design    # Node tagged with 'api-design'
```

**4. Title Search** (substring match, must be unique):
```bash
forest node read "UUID short"   # Finds node with "UUID short" in title
forest node read "api"          # Finds node with "api" in title (if unique)
```

#### Disambiguation

When a reference matches multiple nodes, Forest shows **Git-style disambiguation**:

```bash
$ forest node read 7fa
✖ Ambiguous ID '7fa' matches 3 nodes:
  7fa7acb2  "Optimize UUID shortcodes" (2025-10-21)
  7fa2103e  "Add progressive IDs" (2025-10-20)
  7fa8ef29  "Update scoring algorithm" (2025-10-19)

Use a longer prefix to disambiguate.
```

Similar disambiguation for tag and title searches shows matching nodes with IDs for easy selection.

#### Progressive Display

**Node IDs**: Use `formatNodeIdProgressive()` in `src/cli/shared/utils.ts`
- Minimum 4 chars, grows as needed to maintain uniqueness
- Implementation: `src/lib/progressive-id.ts` with `buildNodePrefixMap()`

**Edge IDs**: Already use progressive abbreviation (4+ chars)
- Stable hash generation via FNV-1a
- Minimal prefix display in `forest edges` output

#### Backward Compatibility

**Zero breaking changes**: All existing 8-char references continue to work!

- External docs with `7fa7acb2` keep resolving correctly
- Scripts using full UUIDs remain valid
- API responses can return any length (recommended: 8 chars or full UUID)
- `--long` flag available for full UUIDs when needed

#### Tab Completion

Shell completion scripts available in `completions/`:
- `forest.bash` - Bash completion
- `forest.zsh` - Zsh completion
- Supports command, flag, and recency reference completion

**Installation**:
```bash
# Bash
source completions/forest.bash

# Zsh (add to ~/.zshrc)
fpath=(path/to/forest/completions $fpath)
autoload -Uz compinit && compinit
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
- `NodeRecord`: Nodes with id, title, body, tags, tokenCounts, optional embedding, isChunk, parentDocumentId, chunkOrder
- `EdgeRecord`: Edges with sourceId, targetId, score, status ('accepted' | 'suggested'), edgeType
- `DocumentRecord`: Canonical documents with id, title, body, metadata, version, rootNodeId, timestamps
- `DocumentChunkRecord`: Segment mappings with documentId, segmentId, nodeId, offset, length, chunkOrder, checksum, timestamps

**Key pattern**: Database is lazily initialized on first access. All mutations set `dirty = true` and persist to disk.

Database path controlled by `FOREST_DB_PATH` env var (default: `forest.db` in cwd).

**Database Schema:**
```sql
-- Core node storage
nodes: id, title, body, tags, token_counts, embedding, created_at, updated_at,
       is_chunk, parent_document_id, chunk_order

-- Edge relationships
edges: id, source_id, target_id, score, status, edge_type, metadata, created_at, updated_at

-- Canonical document storage
documents: id, title, body, metadata, version, root_node_id, created_at, updated_at

-- Document-to-node mappings
document_chunks: document_id, segment_id, node_id, offset, length, chunk_order, checksum,
                 created_at, updated_at

-- Edge event history (for undo)
edge_events: id, edge_id, source_id, target_id, prev_status, next_status, payload,
             created_at, undone

-- Metadata key-value store
metadata: key, value
```

### Canonical Document Model (src/lib/db.ts, src/core/import.ts)

Forest treats multi-chunk imports as first-class documents with versioned canonical storage.

**Architecture:**
- **Canonical body**: Stored in `documents.body` as the authoritative source, reconstructed from `\n\n`-joined segment bodies
- **Chunk mappings**: `document_chunks` table tracks byte offsets, lengths, and SHA-256 checksums for each segment
- **Version tracking**: `documents.version` increments on every edit; metadata stores `lastEditedAt` and `lastEditedNodeId`
- **Automatic backfill**: On startup, `backfillCanonicalDocuments()` scans for chunk nodes without canonical entries (idempotent)

**Lifecycle:**

1. **Import** (`importDocumentCore` in `src/core/import.ts`)
   - Chunks document via `chunkDocument()` using headers/size/hybrid strategy
   - Creates root node (optional summary) and chunk nodes with `isChunk=true`, `parentDocumentId` set
   - Inserts canonical document record with metadata (chunkStrategy, maxTokens, overlap, etc.)
   - Creates `document_chunks` mappings with offsets and checksums
   - Builds structural edges: parent-child (root→chunks) and sequential (chunk[i]→chunk[i+1])
   - Optionally auto-links against existing graph

2. **Edit** (`forest node edit <chunk-id>`)
   - Detects chunk membership via `loadDocumentSessionForNode()`
   - Renders full document with `<!-- forest:segment -->` markers (HTML comments)
   - User edits in their preferred editor
   - Parser validates all segments present, IDs match, no orphans
   - Only modified segments get re-embedded and rescored (selective performance optimization)
   - Canonical body, version, and chunk records updated atomically
   - Console shows: "document updated: <title> (version 1 → 2, segments touched: 2)"

3. **Refresh** (`forest node refresh <chunk-id>`)
   - Updates chunk node via flags/files/stdin
   - Detects chunk membership and rebuilds canonical document
   - Version bumps, checksums and offsets recalculated
   - Logs: "document updated" or "document unchanged (no structural delta)"

4. **Standalone notes**
   - Nodes with `isChunk=false` bypass document session entirely
   - Edited as independent entities with no canonical storage

**Key behaviors:**
- **Selective re-embedding**: Unchanged segments retain embeddings and edges (avoids expensive recomputation)
- **Checksum-based change detection**: SHA-256 of normalized content enables efficient diffing
- **Temp file preservation**: Parse failures save edited content to `/tmp/forest-edit-*` for debugging
- **Segment reordering**: Parser detects order changes; `chunkOrder` updated accordingly
- **Error recovery**: Validation errors show line numbers; user can fix and retry

**Editor buffer format example:**
```markdown
# Forest Document Editor
# Document: My Research Paper (7fa7acb2)
# Total segments: 3

<!-- forest:segment start segment_id=seg-1 node_id=abc123 order=0 title="Introduction" -->
This is the introduction content...
<!-- forest:segment end segment_id=seg-1 -->

<!-- forest:segment start segment_id=seg-2 node_id=def456 order=1 title="Methods" focus=true -->
This is the methods section...
<!-- forest:segment end segment_id=seg-2 -->
```

**Metadata schema** (DocumentRecord.metadata):
```typescript
{
  // Import settings
  chunkStrategy: 'headers' | 'size' | 'hybrid',
  maxTokens: number,
  overlap: number,
  chunkCount: number,
  source: 'import' | 'backfill',

  // Edit tracking
  lastEditedAt: ISO8601 timestamp,
  lastEditedNodeId: UUID,

  // Backfill flags
  backfill: boolean,
  chunkOrdersProvided: boolean
}
```

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
