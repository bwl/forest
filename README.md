# Forest

Forest is a local-first, graph-native knowledge base CLI for people who think in notes, projects, and relationships. Instead of treating notes as isolated files, Forest stores each note as a node in SQLite and continuously maintains links between related ideas.

Forest is built for two complementary workflows:
- fast capture and retrieval from the terminal (`capture`, `search`, `read`)
- graph discovery and reflection over time (`explore`, `diff`, `growth`, `snapshot`)

Under the hood, Forest maintains one accepted edge per normalized node pair with two independent scoring channels:
- `semantic_score`: embedding cosine similarity (optional, based on embed provider)
- `tag_score`: IDF-weighted Jaccard over shared tags

## Quick Start

```bash
bun install
bun run build

# Project-local DB
export FOREST_DB_PATH=./forest.db

# Optional offline mode (no embedding API calls)
export FOREST_EMBED_PROVIDER=none

# Capture notes
forest capture --title "Project overview" --body "What this repo does. #docs #project/forest"
forest capture --stdin < docs/architecture.md

# Explore links
forest explore --title "Project overview"
forest edges
forest edges explain <ref>

# Explicit bridge link
forest link <ref1> <ref2> --name chapter-1-arc

# Temporal analysis
forest snapshot
forest diff --since "1 week ago"
forest growth --since "30 days ago"
```

## Scoring and Linking

Forest stores dual scores on each edge:
- `semantic_score` (nullable)
- `tag_score` (nullable)
- `shared_tags` (for explainability)

`score` is a fused compatibility value (not `max`):

```text
score = clamp01(
  0.7 * max(semantic, tag)
  + 0.2 * min(semantic, tag)
  + 0.1 * sqrt(semantic * tag)
  - 0.1 * abs(semantic - tag)
)
```

Base acceptance rule:
- accept when `semantic_score >= FOREST_SEMANTIC_THRESHOLD` (default `0.5`), or
- accept when `tag_score >= FOREST_TAG_THRESHOLD` (default `0.3`)

Project-tag behavior (`project:*` shared tags):
- candidates can also pass via `FOREST_PROJECT_EDGE_FLOOR` (default `0.3`) on fused score
- per-node project links are capped by `FOREST_PROJECT_EDGE_LIMIT` (default `10`)
- if a node has project peers but none pass, Forest still keeps the strongest project peer so project-tagged notes remain connected

## Bridge Tags (`forest link`)

`forest link <a> <b> [--name ...]` adds a `link/...` tag to both notes. Because `link/*` tags are usually rare, they tend to produce a strong tag signal.

Hashtags in note text support `/` (example: `#link/chapter-1-arc`).

## Temporal Analysis

Forest persists graph snapshots and can diff graph state over time.

```bash
forest snapshot                      # create manual snapshot
forest snapshot --list               # list snapshots
forest diff --since "2026-01-01"     # changed nodes/edges since baseline snapshot
forest growth --since "90 days ago"  # timeline of nodes/edges/tags
```

## Note Lifecycle

```bash
forest read @0
forest history @0
forest restore @0 3
forest edit @0
forest update @0 --tags project/forest,status/in-progress
forest delete @0
```

## Tags

Tags are stored as plain lowercase strings (without leading `#`). Hashtags in note text are extracted automatically.

```bash
forest tags
forest tags list --top 20
forest tags stats --tag project/forest
forest tags add @0 to-review
forest tags remove @0 to-review
forest tags rename old-tag new-tag
```

Suggested tag patterns:
- workflow: `to-review`, `status/done`, `status/blocked`
- scope: `project/<name>`, `area/<subsystem>`
- decisions: `decision/<topic>`
- people: `person/<name>`
- explicit links: `link/<name>` (created by `forest link`)

## Embedding Providers

Provider selection:
- `openrouter` (default): key from `FOREST_OR_KEY` or `openrouterApiKey` in `~/.forestrc`
- `openai`: key from `OPENAI_API_KEY` or `openaiApiKey` in `~/.forestrc`
- `mock`: deterministic embeddings for tests
- `none`: disable embeddings

Override model with `FOREST_EMBED_MODEL`.

```bash
forest admin embeddings --rescore
forest admin rescore
forest admin rebuild-degrees --clean-self-loops
```

## Configuration

Forest stores config in `~/.forestrc` and supports environment overrides.

```bash
forest config
forest config --show
```

Useful environment variables:
- `FOREST_DB_PATH`: database file path
- `FOREST_EMBED_PROVIDER`: `openrouter|openai|mock|none`
- `FOREST_OR_KEY`: OpenRouter API key
- `OPENAI_API_KEY`: OpenAI API key
- `FOREST_EMBED_MODEL`: embedding model override
- `FOREST_SEMANTIC_THRESHOLD`: semantic acceptance threshold
- `FOREST_TAG_THRESHOLD`: tag acceptance threshold
- `FOREST_PROJECT_EDGE_FLOOR`: project fallback floor
- `FOREST_PROJECT_EDGE_LIMIT`: max retained project links per node
- `FOREST_SERVER_URL`: use remote server mode for CLI calls
- `FOREST_API_KEY`: bearer token for remote CLI/server auth
- `FOREST_PORT`, `FOREST_HOST`: server bind settings (`forest serve`)

## Data Model

Key tables:
- `nodes`: note content, tags, embeddings, degree counters, chunk metadata
- `edges`: fused + channel scores, shared tags, edge type, metadata
- `node_tags`: normalized `(node_id, tag)` rows for tag search
- `tag_idf`: cached `(tag, doc_freq, idf)` values
- `documents`, `document_chunks`: canonical document/chunk mapping
- `node_history`: version history for restore
- `graph_snapshots`: temporal snapshots used by `diff` and `growth`

## For AI Agents

Forest implements TLDR v0.2 command metadata:

```bash
forest --tldr
forest --tldr=json
forest --tldr=all

forest capture --tldr=json
forest diff --tldr=json
forest growth --tldr=json
forest snapshot --tldr=json
```

## Development

```bash
bun run build
bun run dev -- capture --body "hello #forest"
bun run lint
bun test
```

## License

MIT
