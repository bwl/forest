# Forest

A graph-native knowledge base that captures ideas and automatically links them using semantic embeddings and lexical analysis. Everything lives in a single SQLite database.

## Quick Start

```bash
npm install
npm run build

# Capture ideas from different sources
forest capture --stdin < idea.txt
forest capture --title "Project idea" --body "Build a graph database for notes"

# Search and explore connections
forest explore "machine learning"
forest search "neural networks" --limit 20

# Generate long-form content
forest write "Explain knowledge graphs and their applications"

# Review and manage connections
forest edges propose
forest edges accept 1
```

## Core Features

### Capture and Storage

**Capture notes** from multiple input methods with automatic linking:
```bash
forest capture --stdin < note.md
forest capture --file document.md
forest capture --title "Idea" --body "Text with #tags"
```

Notes are automatically:
- Analyzed for semantic content via embeddings
- Tagged using GPT-5-nano or lexical extraction
- Linked to related notes based on hybrid scoring
- Chunked transparently if they exceed length limits

**Configuration** is interactive and persistent:
```bash
forest config  # Interactive setup wizard
forest config --show
```

### Search and Discovery

**Semantic search** finds notes by meaning, not just keywords:
```bash
forest search "distributed systems"
forest search --min-score 0.3 "async patterns"
```

**Graph exploration** shows neighborhoods and connections:
```bash
forest explore "context"
forest explore --id abc12345 --depth 2 --limit 50
forest explore --tag research,priority --since 2025-10-01
```

**Activity timeline** tracks recent changes:
```bash
forest node recent
forest node recent --limit 20 --since 24h
forest node recent --created  # Only show created, not updated
```

### Node Operations

**Read** notes with multiple output modes:
```bash
forest node read abc12345
forest node read abc12345 --raw | glow  # Pipe to markdown viewer
forest node read abc12345 --json
```

**Edit** existing notes:
```bash
forest node edit abc12345 --title "New title"
forest node edit abc12345 --stdin < updated.md
```

**Synthesize** combines multiple notes into new perspectives:
```bash
forest node synthesize abc12345 def67890
forest node synthesize abc12345 def67890 --reasoning high
```

**Link** notes manually when needed:
```bash
forest node link abc12345 def67890
forest node link abc12345 def67890 --score 0.8
```

### Edge Management

**Propose** shows suggested connections ranked by confidence:
```bash
forest edges propose
forest edges propose --limit 30
```

**Accept or reject** suggestions individually:
```bash
forest edges accept 1
forest edges accept qpfs  # Using 4-char reference code
forest edges reject 2
forest edges undo qpfs
```

**Promote** auto-accepts high-confidence suggestions in bulk:
```bash
forest edges promote --min-score 0.6
```

**Sweep** bulk-rejects low-confidence suggestions:
```bash
forest edges sweep --max-score 0.2
forest edges sweep --range 1-10,15
```

**Explain** shows detailed scoring breakdown:
```bash
forest edges explain abc12345::def67890
forest edges explain 1 --json
```

### Content Generation

**Write** produces long-form articles on any topic:
```bash
forest write "Knowledge graphs and their applications"
forest write "Explain neural networks" --max-tokens 5000
forest write "Systems thinking" --model claude-opus-4
```

Generated content is automatically:
- Captured as a node in your graph
- Tagged appropriately
- Linked to related existing notes

### Tags and Organization

**List** all tags with usage counts:
```bash
forest tags list
forest tags list --top 20
```

**Rename** tags across the entire graph:
```bash
forest tags rename old-tag new-tag
```

**Tag statistics** show co-occurrence patterns:
```bash
forest tags stats
forest tags stats --tag graphs --top 10
forest tags stats --min-count 5
```

### Data Management

**Stats** provides graph-level metrics:
```bash
forest stats
forest stats --json
```

Includes node/edge counts, degree distribution, top tags, and tag pair co-occurrence.

**Health** checks system integrity:
```bash
forest health
forest health --json
```

Validates embeddings coverage, database state, and configuration.

**Export** for backup or analysis:
```bash
forest export json --file backup.json
forest export graphviz --id abc12345 --file graph.dot
dot -Tpng graph.dot -o visualization.png
```

### API Server

**Serve** the REST API with WebSocket event stream:
```bash
forest serve
forest serve --port 8080 --host 0.0.0.0
```

Provides full CLI feature parity through HTTP endpoints.

## Scoring and Linking

Forest uses hybrid scoring that combines:
- **Semantic similarity** (55%): Embedding cosine distance
- **Lexical overlap** (25%): Token frequency comparison
- **Tag overlap** (15%): Shared tags
- **Title similarity** (5%): Title text matching

Scores are classified into:
- **≥ 0.50**: Auto-accepted as edges
- **0.25-0.50**: Suggested for review
- **< 0.25**: Discarded

Thresholds are configurable:
```bash
export FOREST_AUTO_ACCEPT=0.6
export FOREST_SUGGESTION_THRESHOLD=0.25
```

## Embedding Providers

Forest supports multiple embedding providers via `FOREST_EMBED_PROVIDER`:

**Local** (default): Uses `@xenova/transformers` with offline model
```bash
export FOREST_EMBED_PROVIDER=local
export FOREST_EMBED_LOCAL_MODEL="Xenova/all-MiniLM-L6-v2"
```

**OpenAI**: Requires API key
```bash
export FOREST_EMBED_PROVIDER=openai
export OPENAI_API_KEY=sk-...
export FOREST_EMBED_MODEL=text-embedding-3-small
```

**Mock**: Deterministic hash-based vectors for testing
```bash
export FOREST_EMBED_PROVIDER=mock
```

**None**: Disables embeddings (pure lexical scoring)
```bash
export FOREST_EMBED_PROVIDER=none
```

Recompute embeddings for all nodes:
```bash
forest admin:recompute-embeddings --rescore
```

## LLM-Powered Tagging

Forest can use GPT-5-nano to generate contextual tags:

```bash
export FOREST_TAGGING_METHOD=llm  # or: lexical (default)
export FOREST_TAGGING_MODEL=gpt-5-nano
export OPENAI_API_KEY=sk-...

# Regenerate tags for all nodes
forest admin:retag-all
forest admin:retag-all --dry-run
forest admin:retag-all --limit 10
```

## Document Chunking

Large documents are automatically chunked for embedding while remaining seamless to users. Chunks are:
- Created transparently during capture
- Reassembled automatically during read operations
- Treated as a single logical document

This happens invisibly when documents exceed the embedding model's token limit.

## Common Workflows

### Daily capture and review
```bash
# Morning: capture overnight thoughts
cat thoughts.md | forest capture --stdin

# Review connections
forest edges propose --limit 10
forest edges accept 1
forest edges accept 3
```

### Research and synthesis
```bash
# Find related notes
forest search "distributed consensus" --limit 15

# Explore neighborhood
forest explore "consensus" --depth 2

# Synthesize insights
forest node synthesize abc12345 def67890 ghi78901
```

### Content creation
```bash
# Generate article
forest write "The evolution of database systems"

# Read and refine
forest node read <newly-created-id> --raw | vim -

# Link to related work
forest node link <new-id> <related-id>
```

### Bulk operations
```bash
# Accept high-confidence suggestions
forest edges propose --json \
  | jq -r '.[] | select(.score >= 0.4) | .code' \
  | xargs -n1 forest edges accept

# Clean up low-confidence suggestions
forest edges sweep --max-score 0.15

# Retag everything with LLM
FOREST_TAGGING_METHOD=llm forest admin:retag-all
```

### Export and backup
```bash
# Full backup
forest export json --file "backup-$(date +%Y%m%d).json"

# Visualize a subgraph
forest export graphviz --id abc12345 --depth 2 --file graph.dot
dot -Tpng graph.dot -o graph.png
```

## Configuration

All settings are managed through environment variables or the interactive config command:

```bash
forest config  # Interactive wizard
```

Key variables:
- `FOREST_DB_PATH`: Database location (default: `forest.db`)
- `FOREST_PORT`: API server port (default: 3000)
- `FOREST_HOST`: API server host (default: `::` for dual-stack)
- `FOREST_EMBED_PROVIDER`: Embedding provider (`local`, `openai`, `mock`, `none`)
- `FOREST_TAGGING_METHOD`: Tag generation (`lexical`, `llm`)
- `FOREST_AUTO_ACCEPT`: Auto-link threshold (default: 0.50)
- `FOREST_SUGGESTION_THRESHOLD`: Suggestion threshold (default: 0.25)

## Data Model

Three main tables in SQLite:

**nodes**: Ideas with metadata
- id, title, body, tags (JSON)
- tokenCounts (JSON), embedding (JSON)
- isChunk, parentDocumentId, chunkOrder
- createdAt, updatedAt

**edges**: Connections between nodes
- id, source_id, target_id
- score, status (accepted/suggested)
- metadata (JSON)
- createdAt, updatedAt

**edge_events**: Audit trail for edge changes
- Tracks accept/reject actions
- Enables undo functionality

## For AI Agents

Forest implements the TLDR standard for agent discovery:

```bash
# Discover all commands
forest --tldr

# Get detailed metadata (ASCII)
forest capture --tldr
forest edges propose --tldr

# Get JSON for parsing
forest --tldr=json
forest search --tldr=json

# Get everything at once
forest --tldr=all
```

TLDR v0.2 provides condensed command metadata optimized for LLM consumption (60% token reduction vs standard format).

## Development

```bash
# Build from source
npm run build

# Type checking
npm run lint

# Run from source
npm run dev -- capture --stdin

# Start API server (requires Bun)
bun run dev:server
```

## License

MIT
