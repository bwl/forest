# Forest

Forest is a graph-native knowledge base CLI. It stores notes in a single SQLite database and creates one edge per node-pair with two independent scores:
- **Semantic score**: embedding cosine similarity (optional, depends on embedding provider)
- **Tag score**: IDF-weighted Jaccard similarity over tags

## Quick Start

```bash
bun install
bun run build

# Project-local DB (recommended for project docs)
export FOREST_DB_PATH=./forest.db

# Offline mode (no network calls)
export FOREST_EMBED_PROVIDER=none

# Capture notes
forest capture --title "Project overview" --body "What this repo does. #docs"
forest capture --stdin < docs/architecture.md

# Explore + inspect edges
forest explore --title "Project overview"
forest edges
forest edges explain <ref>

# Workflow tags
forest tags add <ref> to-review
forest tags remove <ref> to-review

# Explicit “bridge” link tag between two notes
forest link <ref1> <ref2> --name=chapter-1-arc
```

## Scoring & Linking (v2)

Forest stores **dual scores on a single edge**:
- `semantic_score` (nullable): cosine similarity between embeddings
- `tag_score` (nullable): IDF-weighted Jaccard over tags
- `shared_tags`: for explainability

Edges are kept if **either** layer meets its threshold:
- `semantic_score >= FOREST_SEMANTIC_THRESHOLD` (default `0.5`), OR
- `tag_score >= FOREST_TAG_THRESHOLD` (default `0.3`)

`score` is kept as a compatibility field and is currently `max(semantic_score, tag_score)` for new computations.

## Bridge Tags (`forest link`)

`forest link <a> <b> [--name=...]` adds a `#link/...` tag to both nodes. Because `link/*` tags are rare (usually 2 nodes), they produce a high `tag_score` and create a strong explicit edge.

Hashtags in text support `/` (e.g. `#link/chapter-1-arc`).

## Embedding Providers

Embedding provider selection:
- `openrouter` (default): `FOREST_OR_KEY` (or `openrouterApiKey` in `~/.forestrc`)
- `openai`: `OPENAI_API_KEY` (or `openaiApiKey` in `~/.forestrc`)
- `mock`: deterministic embeddings for offline testing
- `none`: disable embeddings entirely (tags-only + lexical search)

Override model with `FOREST_EMBED_MODEL`.

Recompute embeddings and rescore links:
```bash
forest admin embeddings --rescore
```

## Tags

Tags are stored as plain strings (no leading `#`). Hashtags in note text are extracted and normalized to lowercase.

Common commands:
```bash
forest tags                # dashboard
forest tags list --top 20  # counts
forest tags stats --tag docs
forest tags add @0 to-review
forest tags remove @0 to-review
forest tags rename old-tag new-tag
```

### Suggested Tag Patterns

Forest supports hierarchical tags via `/` (e.g. `#status/to-review`). A few useful conventions:
- Workflow/status: `to-review` (or `status/to-review`), `status/done`, `status/blocked`
- Scope: `project/<name>`, `area/<subsystem>`
- Decisions: `decision/<topic>`
- People/roles: `person/<name>`
- Explicit links: `link/<name>` (created by `forest link`)

## Migration

For existing databases created before scoring v2:
```bash
forest admin migrate-v2
```

Fresh databases run v2 migrations automatically.

## Configuration

Forest stores config in `~/.forestrc` (and supports env var overrides):
```bash
forest config
forest config --show
```

Useful env vars:
- `FOREST_DB_PATH`: database file path
- `FOREST_EMBED_PROVIDER`: `openrouter|openai|mock|none`
- `FOREST_OR_KEY`: OpenRouter API key
- `OPENAI_API_KEY`: OpenAI API key
- `FOREST_EMBED_MODEL`: embedding model override
- `FOREST_SEMANTIC_THRESHOLD`: semantic edge threshold
- `FOREST_TAG_THRESHOLD`: tag edge threshold
- `FOREST_PORT`, `FOREST_HOST`: API server bind settings

## Data Model (v2)

Key tables:
- `nodes`: note content + tags JSON + token_counts + embedding + `approximate_scored`
- `edges`: `score` + `semantic_score` + `tag_score` + `shared_tags` + `edge_type`
- `node_tags`: normalized `(node_id, tag)` rows for tag lookups
- `tag_idf`: cached `(tag, doc_freq, idf)` values (rebuilt on demand)

## For AI Agents

Forest implements TLDR v0.2 for agent discovery:
```bash
forest --tldr
forest --tldr=json
forest --tldr=all

forest capture --tldr=json
forest explore --tldr=json
forest link --tldr=json
forest admin migrate-v2 --tldr=json
```

## Development

```bash
bun run build
bun run dev -- capture --stdin
bun run lint
bun test
```

## License

MIT
