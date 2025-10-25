# Remote Database Collaboration: Forest as a Team Knowledge Base

## The Insight

Forest currently uses a local SQLite database (`forest.db`) for personal knowledge management. But with a remote database configuration, **Forest becomes a collaborative, graph-linked team documentation system** where multiple developers can capture, link, and explore shared knowledge.

## Vision

Imagine a development team where:

```bash
# Alice captures an architecture decision
alice$ forest capture --template adr --stdin < decision.md
✓ Created node 7fa7acb2: "Use PostgreSQL for analytics"
✓ Auto-linked to 3 existing nodes
  - ef3a1029: "Database selection criteria" (score: 0.72)
  - 9c2b4e15: "Performance requirements" (score: 0.68)
  - 1a8f3d42: "Bob's data model design" (score: 0.65)

# Bob discovers Alice's decision while exploring
bob$ forest explore
  Recent captures:
  7fa7acb2  "Use PostgreSQL for analytics" (Alice, 5m ago)  ← connects to his work!

bob$ forest node read 7fa7acb2
  [Alice's architecture decision...]

  Related:
  → 1a8f3d42  "Data model for analytics pipeline" (Bob)

# Charlie searches across team knowledge
charlie$ forest search "authentication" --chunk-type requirements
  Found 12 matches:
  - 3e4f5a6b: "API authentication requirements" (Alice)
  - 8d9c1b2a: "OAuth integration spec" (Bob)
  - 5f6g7h8i: "Security design review" (Diana)

# AI agent queries team documentation
agent$ curl http://forest-team.internal:3000/api/v1/search?q="deployment+strategy"
  {
    "results": [
      {"id": "a1b2c3d4", "title": "Kubernetes deployment plan", "author": "ops-team"},
      {"id": "e5f6g7h8", "title": "CI/CD pipeline design", "author": "alice"},
      ...
    ]
  }
```

## Core Use Cases

### 1. Living Architecture Documentation

**Problem**: Architecture Decision Records (ADRs) in Git repos get stale and disconnected.

**Forest Solution**:
```bash
# Capture ADRs with template
forest capture --template adr --stdin < adr-001-database.md

# Automatic linking surfaces related decisions
forest node read @
  Related decisions:
  → "ADR-003: Caching strategy" (score: 0.78)
  → "Database performance requirements" (score: 0.71)

# Search across all ADRs
forest search "microservices" --chunk-type context,decision
```

### 2. Meeting Notes That Link Automatically

**Problem**: Meeting notes scattered across Notion/Docs/Slack, hard to find related discussions.

**Forest Solution**:
```bash
# Weekly standup
forest capture --template meeting-notes --stdin < standup.md
✓ Auto-linked to:
  - "Sprint planning notes" (last week)
  - "Database migration ticket" (mentioned in discussion)
  - "Performance issues thread" (related topic)

# Find all meetings about a topic
forest search "API redesign" --chunk-type discussion,decisions
```

### 3. Onboarding New Team Members

**Problem**: New developers don't know where documentation lives or how systems relate.

**Forest Solution**:
```bash
# Explore the knowledge graph
forest explore --interactive
  > [Graph visualization showing key documents and connections]

# Find all onboarding materials
forest list --tags onboarding,getting-started

# See what experienced devs reference most
forest stats --top-nodes
  Most connected nodes:
  1. "System architecture overview" (42 edges)
  2. "Development setup guide" (38 edges)
  3. "API conventions" (35 edges)
```

### 4. Agent-Assisted Development

**Problem**: AI agents can't access team knowledge, give generic answers.

**Forest Solution**:
```bash
# Agent queries team's Forest instance
agent: "How does our authentication work?"

curl http://forest-team.internal:3000/api/v1/search?q="authentication+flow"
  → Returns team's actual auth documentation
  → Includes related design decisions
  → Shows who to ask for questions (node authors)

# TLDR standard makes Forest agent-friendly
curl http://forest-team.internal:3000/--tldr=json
  → Agent learns entire CLI surface in one request
  → Can help users capture/query documentation
```

### 5. Cross-Team Knowledge Sharing

**Problem**: Eng team doesn't know what Product decided, Product doesn't see Eng constraints.

**Forest Solution**:
```bash
# Product manager captures requirements
pm$ forest capture --template project-spec --stdin < requirements.md

# Engineer's design doc auto-links
eng$ forest capture --template technical-design --stdin < design.md
✓ Auto-linked to:
  - "Product requirements" (PM's doc)

# Everyone can explore connections
forest edges --between-tags product,engineering
  Cross-team connections:
  - "User story: Dashboard redesign" ↔ "Technical: React component architecture"
  - "Business goal: Reduce latency" ↔ "Engineering: Caching strategy"
```

## Why Forest is Perfect for This

### 1. Already Built for Collaboration

- **REST API**: `forest serve` provides HTTP endpoints for all operations
- **3-layer architecture**: Clean separation of CLI/Core/API
- **Database abstraction**: `src/lib/db.ts` can be adapted for remote DBs
- **Stateless operations**: No client-side state to sync

### 2. Semantic Graph = Natural Collaboration

- **Auto-linking**: Your docs automatically connect to teammates' relevant work
- **Discovery**: Explore graph to find related knowledge across team
- **Intelligent search**: Semantic embeddings find conceptually similar docs
- **Tag-based organization**: Shared taxonomy emerges organically

### 3. Agent-First Design

- **TLDR standard**: AI agents can learn Forest in one round-trip
- **JSON output**: `--json` flag on every command for programmatic use
- **REST API**: Agents can query/capture via HTTP
- **Structured data**: Templates provide predictable schemas for agents

### 4. Developer-Native UX

- **CLI-first**: Developers love terminal workflows
- **Git-style references**: `@0`, `7fa7`, familiar patterns
- **Markdown-native**: Write in the editor you already use
- **Lightweight**: No Confluence/SharePoint overhead

### 5. npm/Node.js Compatible

Forest works with npm (not just Bun), making it accessible to any Node.js environment:

```bash
npm install -g forest-cli
export FOREST_DB_URL=postgresql://forest:pass@db.company.internal:5432/forest_kb
forest capture --stdin < note.md
```

## Technical Architecture

### Current: Local SQLite

```
┌─────────────┐
│ forest CLI  │
└──────┬──────┘
       │
┌──────▼──────┐
│   Core      │
└──────┬──────┘
       │
┌──────▼──────┐
│ sql.js      │  ← SQLite in WASM
│ (local)     │
└──────┬──────┘
       │
   forest.db  (local file)
```

### Proposed: Remote Database Support

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Alice's CLI │  │ Bob's CLI   │  │Charlie's CLI│
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                 ┌──────▼──────┐
                 │   Core      │
                 └──────┬──────┘
                        │
            ┌───────────┴───────────┐
            │                       │
     ┌──────▼──────┐       ┌───────▼────────┐
     │ SQLite      │       │ PostgreSQL     │
     │ Adapter     │   OR  │ Adapter        │
     │ (local)     │       │ (remote/team)  │
     └──────┬──────┘       └───────┬────────┘
            │                      │
        forest.db          postgresql://...
        (dev/test)         (team/prod)
```

### Configuration

```bash
# Local mode (current behavior)
export FOREST_DB_TYPE=sqlite
export FOREST_DB_PATH=./forest.db
forest capture ...

# Remote mode (new capability)
export FOREST_DB_TYPE=postgres
export FOREST_DB_URL=postgresql://user:pass@host:5432/forest
forest capture ...

# Or via config file
cat > ~/.config/forest/config.json <<EOF
{
  "database": {
    "type": "postgres",
    "url": "postgresql://forest@db.company.internal/team_knowledge"
  }
}
EOF
```

## Implementation Strategy

See companion documents:
- `remote-database-implementation.md` - Technical implementation details
- `remote-database-use-cases.md` - Detailed collaboration scenarios

## Comparison to Existing Tools

| Feature | Forest (Remote) | Notion | Confluence | Git Wiki | Obsidian Sync |
|---------|----------------|--------|------------|----------|---------------|
| **CLI-native** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Auto-linking** | ✅ (semantic) | ⚠️ (manual) | ⚠️ (manual) | ❌ | ⚠️ (hashtags) |
| **Graph structure** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Agent-friendly** | ✅ (TLDR, API) | ⚠️ (API) | ⚠️ (API) | ❌ | ❌ |
| **Markdown-first** | ✅ | ⚠️ | ❌ | ✅ | ✅ |
| **Templates** | ✅ | ✅ | ✅ | ❌ | ⚠️ |
| **Semantic search** | ✅ (embeddings) | ⚠️ (keyword) | ⚠️ (keyword) | ❌ | ⚠️ (keyword) |
| **Open source** | ✅ | ❌ | ❌ | ✅ | ⚠️ (partial) |
| **Self-hosted** | ✅ | ❌ | ⚠️ (complex) | ✅ | ❌ |

## Key Advantages

1. **Automatic knowledge connections**: Semantic linking surfaces relationships without manual work
2. **Developer workflow**: CLI + API + Markdown = native dev experience
3. **Agent collaboration**: AI assistants can query and contribute to team knowledge
4. **Lightweight**: PostgreSQL backend, no complex infrastructure
5. **Progressive adoption**: Start local, move to remote when ready
6. **Open source**: Full control, no vendor lock-in

## Open Questions

1. **Conflict resolution**: How to handle simultaneous edits to same node?
2. **Permissions**: Start with read/write for all, or role-based access?
3. **Real-time sync**: Push notifications vs. poll-on-read?
4. **Author tracking**: Add `author` field to nodes/documents?
5. **Team management**: How to handle user accounts, teams, orgs?
6. **Migration path**: How to merge personal Forest DBs into team instance?
7. **Embedding costs**: Who pays for OpenAI embeddings in team mode?
8. **Backup/export**: Team-wide export formats?

## Success Metrics

- **Adoption**: 80% of team using Forest for documentation within 3 months
- **Discoverability**: 50% reduction in "where is X documented?" questions
- **Engagement**: Average 5+ captures per developer per week
- **Connectivity**: 70% of new documents auto-link to existing knowledge
- **Agent usage**: 30% of searches come from AI assistants
- **Onboarding**: New developers self-serve 80% of questions via Forest

## Next Steps

1. **Validate use cases**: Interview developers about documentation pain points
2. **Prototype adapter**: Implement PostgreSQL database adapter
3. **Add author tracking**: Extend schema with user/author metadata
4. **Build team demo**: Deploy shared Forest instance, test with 3-5 developers
5. **Document patterns**: Create guide for effective team Forest usage
6. **Launch beta**: Invite early adopter teams to test collaborative features

## Related Concepts

- **Digital gardens**: Personal knowledge evolving over time
- **Zettelkasten**: Atomic notes with bidirectional links
- **Team wikis**: Collaborative documentation
- **Knowledge graphs**: Entities and relationships
- **Second brain**: Externalized knowledge management
- **Living documentation**: Docs that evolve with code

---

**This could transform Forest from a personal tool into a collaborative platform that makes team knowledge discoverable, connected, and agent-accessible.**
