# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Forest is a graph-native knowledge base CLI that captures unstructured ideas and automatically links them using a **dual-score edge model**:
- **Semantic score**: embedding cosine similarity (optional, provider-dependent)
- **Tag score**: IDF-weighted Jaccard similarity over tags

All data is stored in a single SQLite database (`forest.db`).

**Database Location:**
- **macOS**: `~/Library/Application Support/com.ettio.forest.desktop/forest.db`
- **Linux**: `~/.local/share/com.ettio.forest.desktop/forest.db`
- **Windows**: `%APPDATA%\com.ettio.forest.desktop\forest.db`
- **Override**: Set `FOREST_DB_PATH` environment variable to use a custom location

## Version Management

**IMPORTANT**: The `VERSION` file is the single source of truth for version numbers.

- **To bump version**: Edit the `VERSION` file only
- **Do NOT manually edit** `package.json` version field directly

## Agent-First TLDR Standard

Forest implements the **TLDR Standard (v0.2)** for agent ingestion - NDJSON command metadata designed for fast discovery and reliable parsing.

### Quick Start for Agents

```bash
# Discover all commands
forest --tldr

# Get detailed command metadata (ASCII format)
forest capture --tldr
forest edges --tldr

# Get JSON format for programmatic parsing
forest --tldr=json
forest search --tldr=json

# Get everything at once (NDJSON stream)
forest --tldr=all
```

### TLDR Format

Output is NDJSON with a small metadata header (see `src/cli/tldr.ts`).

### Benefits for Agents

1. **Zero-shot discovery**: Learn entire CLI surface in one round-trip
2. **Minimal tokens**: Compact format optimized for context windows
3. **Predictable parsing**: Fixed schema, no free-form text
4. **Self-documenting**: FLAGS includes types, defaults, and descriptions

## Development Workflow

### Development Script

The `./dev.sh` script provides a unified interface:

**Development:**
```bash
./dev.sh dev cli              # Run CLI in dev mode
./dev.sh dev server           # Run API server
```

**Building:**
```bash
./dev.sh build cli            # Build CLI TypeScript
```

**Testing:**
```bash
./dev.sh test cli             # Run CLI tests
```

**Type Checking:**
```bash
./dev.sh lint cli             # Type-check CLI
```

### Direct Commands

```bash
bun install          # Install dependencies
bun run build        # Compile TypeScript to dist/
bun run lint         # Type-check without emitting files
bun run dev          # Run from source

# Testing the CLI during development
bun run dev -- capture --stdin < test.txt
bun run dev -- admin health
bun run dev -- stats

# Running the API server
bun run dev:server                    # Start on default port 3000
FOREST_PORT=8080 bun run dev:server   # Custom port
forest serve --port 3000              # Via CLI

# After building
forest <command>     # Uses the compiled dist/index.js
```

## Architecture

### CLI Framework (Clerc)

The CLI uses **Clerc** for command parsing and help generation. Entry point is `src/index.ts` which normalizes args before forwarding to `src/cli/index.ts`.

**Command Structure:**
```
forest capture                  # Capture new notes
forest explore                  # Explore the graph
forest search ["query"]         # Semantic search using embeddings
forest link [ref1] [ref2]       # Create bridge tags (#link/...)
forest node read [id]           # Read a note
forest node edit [id]           # Edit a note
forest node update [id]         # Update note fields (and rescore)
forest node delete [id]         # Delete a note
forest node connect [id] [id2]  # Manually create an edge
forest edges                    # Show recent edges
forest edges explain [ref]      # Explain scoring
forest edges threshold          # View edge threshold
forest tags add [ref] [tags]    # Add tag(s) to a note
forest tags remove [ref] [tags] # Remove tag(s) from a note
forest tags list                # List tags
forest tags rename [old] [new]  # Rename a tag
forest tags stats               # Tag statistics
forest documents list           # List documents
forest documents show [id]      # Show document
forest export graphviz          # Export as DOT
forest export json              # Export as JSON
forest stats                    # Graph statistics
forest admin health             # System health check
forest admin migrate-v2         # Backfill scoring v2 columns/tables
forest admin embeddings         # Recompute embeddings
forest admin tags               # Regenerate tags
forest admin doctor             # Guided troubleshooting
forest config                   # Configure settings
forest serve                    # Start API server
```

Commands are modular:
- **Individual commands**: `src/cli/commands/{capture,explore,search,stats,...}.ts`
- **Subcommand groups**: `node`, `edges`, `tags`, `documents`, `export`, `admin` use `register*Commands()` pattern

### Git-Style Node References

Forest uses **Git-inspired progressive abbreviation** for node and edge IDs.

**What Forest accepts** (any unique prefix):
```bash
forest node read 7fa7          # 4 chars
forest node read 7fa7acb2      # 8 chars
forest node read 7fa7acb2-ed4a-4f3b-9c1e-8a2b3c4d5e6f  # full UUID
```

**Reference Types** (unified resolution in `src/cli/shared/utils.ts:resolveNodeReference()`):

1. **UUID Prefixes** (case-insensitive)
2. **Recency References**: `@` (last), `@1` (second last), etc.
3. **Tag Search**: `#typescript`
4. **Title Search**: `"UUID short"`

### 3-Layer Architecture: CLI/API Feature Parity

```
┌─────────────────────────────────────────────────────┐
│  CLI Layer (src/cli/commands/)                      │
│  • Parses command-line arguments                    │
│  • Formats human-readable output                    │
│  └──> Calls Core Layer                              │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  Core Layer (src/core/) ⭐ SINGLE SOURCE OF TRUTH   │
│  • Pure business logic functions                    │
│  • No I/O dependencies                              │
│  • Examples: semanticSearchCore(), createNodeCore() │
└─────────────────────────────────────────────────────┘
                         ↑
┌─────────────────────────────────────────────────────┐
│  API Layer (src/server/routes/)                     │
│  • Handles HTTP requests and validation             │
│  • Formats JSON responses                           │
│  └──> Calls Core Layer                              │
└─────────────────────────────────────────────────────┘
```

**Key Principle**: Both CLI and API call the **same core functions**.

### Database Layer (src/lib/db.ts)

Uses **sql.js** (SQLite compiled to WASM) with in-memory database persisted to disk on mutation.

**Core types:**
- `NodeRecord`: Nodes with id, title, body, tags, tokenCounts, optional embedding, and `approximateScored` plus chunk metadata
- `EdgeRecord`: Edges with `score` plus `semanticScore`, `tagScore`, `sharedTags`, status ('accepted'), edgeType
- `DocumentRecord`: Canonical documents with id, title, body, metadata, version, rootNodeId
- `DocumentChunkRecord`: Segment mappings for chunked documents

**Database Schema:**
```sql
nodes: id, title, body, tags, token_counts, embedding, created_at, updated_at,
       approximate_scored, is_chunk, parent_document_id, chunk_order, accepted_degree

edges: id, source_id, target_id, score, semantic_score, tag_score, shared_tags,
       status, edge_type, metadata, created_at, updated_at

node_tags: node_id, tag  (PK: node_id+tag, indexed by tag)

tag_idf: tag, doc_freq, idf

documents: id, title, body, metadata, version, root_node_id, created_at, updated_at

document_chunks: document_id, segment_id, node_id, offset, length, chunk_order, checksum

edge_events: id, edge_id, source_id, target_id, prev_status, next_status, payload, created_at, undone

metadata: key, value
```

### Scoring Algorithm (src/lib/scoring.ts)

Forest uses a **dual-score edge model**:

- `semantic_score = cosine(embedding_a, embedding_b)` (nullable when embeddings are disabled/unavailable)
- `tag_score = jaccard(tags_a, tags_b) × (avg_idf(shared_tags) / max_idf)` (nullable when no shared tags)

Edge creation rule:
- Keep an edge if `semantic_score >= FOREST_SEMANTIC_THRESHOLD` OR `tag_score >= FOREST_TAG_THRESHOLD`

`score` is retained as a compatibility field and is currently computed as `max(semantic_score, tag_score)` for new/updated edges.

### Embeddings

**Providers via `FOREST_EMBED_PROVIDER`:**
1. **openrouter** (default): Calls OpenRouter embeddings API (requires `FOREST_OR_KEY`)
2. **openai**: Calls OpenAI embeddings API (requires `OPENAI_API_KEY`)
3. **mock**: Deterministic hash-based vectors for offline testing
4. **none**: Disables embeddings (tags-only linking)

### Text Processing (src/lib/text.ts)

**Tag extraction** combines:
- Explicit `#tags` in text (if present, these take precedence)
- Auto-extraction: Ranks tokens by frequency × weight, picks top N unigrams + up to 50% bigrams

**Stemming** normalizes plurals, verb forms (e.g., -ing, -ed), and handles common endings.

## Key Invariants

1. **Edge normalization**: Edges are undirected; `sourceId < targetId` is enforced via `normalizeEdgePair()`.
2. **Short IDs**: First 8 hex chars of UUIDs used for display; must be unique to resolve.
3. **Auto-linking**: When a node is captured or updated, it's scored against existing nodes and edges are created/removed based on the dual thresholds.
4. **Embedding backfill**: Use `forest admin embeddings --rescore` to recompute embeddings and rescore edges.
5. **Bridge tags**: Use `forest link` to add `#link/...` tags to both nodes (high-IDF explicit connections).

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
Edit `src/lib/scoring.ts`. After changing, run `forest admin embeddings --rescore` to update existing edges.

**Testing with different embedding providers:**
```bash
FOREST_EMBED_PROVIDER=none forest capture --stdin < test.txt   # Tags-only (no embeddings)
FOREST_EMBED_PROVIDER=mock forest capture --stdin < test.txt   # Deterministic offline embeddings
FOREST_EMBED_PROVIDER=openrouter FOREST_OR_KEY=... forest capture --stdin < test.txt
FOREST_EMBED_PROVIDER=openai OPENAI_API_KEY=... forest capture --stdin < test.txt
```

**Server configuration:**
- `FOREST_PORT` - Server port (default: 3000)
- `FOREST_HOST` - Server hostname (default: `::` for dual-stack IPv4/IPv6)
- `FOREST_DB_PATH` - Database file path
- `FOREST_EMBED_PROVIDER` - Embedding provider (default: `openrouter`)
- `FOREST_SEMANTIC_THRESHOLD` - Minimum semantic_score to keep an edge (default: 0.5)
- `FOREST_TAG_THRESHOLD` - Minimum tag_score to keep an edge (default: 0.3)
