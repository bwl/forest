# Module Separation: Forest vs. Kingdom

**Core Principle**: Forest is the graph. Kingdom is the kingdom that uses the graph.

---

## The Problem (Current State)

Forest has accumulated features that aren't "graph operations":
- ❌ `forest synthesize` - LLM content generation
- ❌ `forest write` - LLM document writing
- ❌ LLM-based auto-tagging
- ❌ Complex exploration workflows
- ❌ Multi-step orchestration

**These should NOT be in Forest.** They're applications built ON the graph.

---

## The Solution: Clean Separation

```
┌─────────────────────────────────────────────────────┐
│                   KINGDOM                           │
│  Workflow orchestration & intelligent operations    │
│                                                      │
│  • workflow-orchestrator                            │
│  • intent-parser                                    │
│  • forest-query-engine                              │
│  • session-ledger                                   │
│  • task-dispatcher                                  │
│  • content-synthesizer (moved from Forest)          │
│  • document-writer (moved from Forest)              │
│  • llm-tagger (moved from Forest)                   │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ Uses Forest API
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│                   FOREST                            │
│  Pure graph database operations                     │
│                                                      │
│  • Nodes: CRUD                                      │
│  • Edges: CRUD                                      │
│  • Tags: list, rename, stats                        │
│  • Search: semantic (via embeddings)                │
│  • Import: document chunking & ingestion            │
│  • Export: graph serialization                      │
│  • Embeddings: compute & store vectors             │
│  • Database: persistence & queries                  │
└─────────────────────────────────────────────────────┘
```

---

## Forest: Pure Graph Operations

### What Stays in Forest

**Core Graph CRUD**:
```bash
# Nodes
forest node create --title "..." --body "..." --tags a,b,c
forest node read <id>
forest node update <id> --title "..." --tags a,b,c
forest node delete <id>

# Edges
forest edge create <source> <target> --type semantic --score 0.85
forest edge list --source-id <id>
forest edge delete <edge-id>

# Tags
forest tags list
forest tags rename <old> <new>
forest tags stats

# Search (read-only graph query)
forest search "query text" --limit 10 --min-score 0.7
forest search "#tag #another-tag"
forest node neighbors <id> --depth 2
```

**Import/Export** (graph I/O):
```bash
forest import document.md --chunk-strategy headers
forest export json --output graph.json
forest export graphviz --output graph.dot
```

**Embeddings** (vector computation):
```bash
forest embed recompute <id>  # Recompute embedding for node
forest embed recompute-all    # Batch recompute
```

**Stats & Health**:
```bash
forest stats       # Graph statistics
forest health      # Database health
```

**Server**:
```bash
forest serve --port 3000  # API server for graph operations
```

### What Forest API Provides

```typescript
// Pure graph operations - no LLM, no workflow
interface IForestGraph {
  // Nodes
  createNode(data: NodeInput): Promise<NodeRecord>;
  getNode(id: string): Promise<NodeRecord>;
  updateNode(id: string, data: Partial<NodeInput>): Promise<NodeRecord>;
  deleteNode(id: string): Promise<void>;
  listNodes(query: NodeQuery): Promise<NodeRecord[]>;

  // Edges
  createEdge(source: string, target: string, type: EdgeType, score: number): Promise<EdgeRecord>;
  getEdge(id: string): Promise<EdgeRecord>;
  deleteEdge(id: string): Promise<void>;
  listEdges(query: EdgeQuery): Promise<EdgeRecord[]>;

  // Search
  searchNodes(query: string, options: SearchOptions): Promise<SearchResult[]>;
  getNeighbors(nodeId: string, depth: number): Promise<NeighborGraph>;

  // Tags
  listTags(): Promise<Tag[]>;
  renameTag(old: string, new: string): Promise<void>;

  // Embeddings
  computeEmbedding(text: string): Promise<number[]>;

  // Import/Export
  importDocument(content: string, options: ImportOptions): Promise<ImportResult>;
  exportGraph(format: 'json' | 'graphviz'): Promise<string>;

  // Stats
  getStats(): Promise<GraphStats>;
  getHealth(): Promise<HealthStatus>;
}
```

**Key**: Forest has NO concept of:
- Workflows
- Sessions
- Tasks
- Issues
- LLM synthesis
- Content generation
- Complex orchestration

---

## Kingdom: Intelligent Operations

### What Moves to Kingdom

**Content Operations** (currently in Forest):
```bash
# MOVE these to Kingdom
kingdom synthesize <node-a> <node-b>  # LLM synthesis
kingdom write <topic> --style academic  # LLM writing
kingdom tag <node-id> --method llm     # LLM-based tagging
```

**Workflow Operations** (new in Kingdom):
```bash
# Natural language interface
kingdom "What deployments failed this week?"
kingdom "Deploy service-x v1.2.3 to staging"
kingdom "Prepare proposal for John Smith in Wantagh"

# Task management
kingdom task create --template deploy --vars env=staging
kingdom task list --status running
kingdom task show <task-id>

# Session management
kingdom session list
kingdom session show <session-id>
kingdom session replay <session-id>

# Issue tracking
kingdom issue create "Deploy service X"
kingdom issue list --state ready
kingdom issue assign <id> --to runner.deploy
```

**Analysis Operations** (new in Kingdom):
```bash
# Pattern detection
kingdom analyze patterns --entity task --filter deploy
kingdom analyze correlations --between failures,time-of-day

# Reporting
kingdom report generate --template weekly-summary
kingdom report anomalies --last 7-days
```

### Kingdom Architecture

```
kingdom/
├── src/
│   ├── agents/
│   │   ├── WorkflowOrchestrator.ts
│   │   ├── IntentParser.ts
│   │   ├── ForestQueryEngine.ts
│   │   ├── SessionLedger.ts
│   │   ├── TaskDispatcher.ts
│   │   ├── ContentSynthesizer.ts    # ← moved from Forest
│   │   ├── DocumentWriter.ts         # ← moved from Forest
│   │   └── LLMTagger.ts              # ← moved from Forest
│   │
│   ├── runners/
│   │   ├── DeployRunner.ts
│   │   ├── BuildRunner.ts
│   │   └── TestRunner.ts
│   │
│   ├── cli/
│   │   ├── index.ts                  # kingdom CLI entry
│   │   └── commands/
│   │       ├── synthesize.ts
│   │       ├── write.ts
│   │       ├── task.ts
│   │       ├── issue.ts
│   │       └── session.ts
│   │
│   └── lib/
│       ├── forest-client.ts          # HTTP client to Forest API
│       ├── events.ts
│       └── utils.ts
│
├── package.json
└── README.md
```

---

## Command Migration

### Before (Everything in Forest)

```bash
# Graph operations mixed with LLM operations
forest capture --stdin < note.md
forest node read @
forest node synthesize <a> <b>        # ❌ LLM operation
forest write --topic "guide"          # ❌ LLM operation
forest search "deployment"
forest edges propose
```

### After (Clean Separation)

**Forest** (pure graph):
```bash
forest node create --title "..." --body "..." --tags deploy
forest node read <id>
forest node update <id> --tags deploy,completed
forest search "deployment #failed"
forest edge list --source-id <id>
forest import document.md
forest serve --port 3000
```

**Kingdom** (intelligent operations):
```bash
kingdom synthesize <a> <b>            # ✅ LLM synthesis
kingdom write --topic "deployment guide"  # ✅ LLM writing
kingdom tag <id> --method llm         # ✅ LLM tagging

kingdom "Deploy service-x v1.2.3"     # ✅ NL workflow
kingdom task create --template deploy # ✅ Task management
kingdom session replay sess-123       # ✅ Session audit
```

---

## Data Flow

### Simple: Forest Operations

```
User: forest search "deployment"
  ↓
forest-graph: query nodes by embedding similarity
  ↓
User: [Results displayed]
```

### Complex: Kingdom Operations

```
User: kingdom "Deploy service-x v1.2.3"
  ↓
kingdom/intent-parser: NL → structured intent
  ↓
kingdom/workflow-orchestrator: validate, plan
  ↓
kingdom/session-ledger: open session
  ↓
kingdom/forest-client: create issue node (HTTP → forest API)
kingdom/forest-client: create task node (HTTP → forest API)
kingdom/forest-client: create edge (HTTP → forest API)
  ↓
kingdom/task-dispatcher: select runner
  ↓
kingdom/runner: execute deployment
  ↓
kingdom/forest-client: update task state (HTTP → forest API)
  ↓
kingdom/session-ledger: commit session
  ↓
User: [Results displayed]
```

**Key**: Kingdom uses Forest's HTTP API. Kingdom never touches SQLite directly.

---

## Thin Client Mode

### Forest Deployment

```
Production Server:
┌──────────────────────┐
│  forest serve        │
│  Port: 3000          │
│  DB: forest.db       │
│  Embeddings: local   │
└──────────────────────┘
```

### Kingdom Deployment

```
Multiple Deployment Options:

Option 1: Local Kingdom + Remote Forest
┌──────────────────────┐
│  kingdom (local)     │
│  FOREST_API_URL=...  │
└──────────────────────┘
         ↓ HTTPS
┌──────────────────────┐
│  forest serve        │
│  (remote server)     │
└──────────────────────┘

Option 2: Remote Kingdom + Remote Forest
┌──────────────────────┐
│  kingdom serve       │
│  Port: 4000          │
│  FOREST_API_URL=...  │
└──────────────────────┘
         ↓ HTTP
┌──────────────────────┐
│  forest serve        │
│  Port: 3000          │
└──────────────────────┘

Option 3: All-in-One (Development)
┌──────────────────────┐
│  kingdom (embedded)  │
│  forest (local mode) │
│  DB: ./forest.db     │
└──────────────────────┘
```

---

## API Boundaries

### Forest API (Port 3000)

```
GET    /api/v1/health
GET    /api/v1/stats
GET    /api/v1/nodes
POST   /api/v1/nodes
GET    /api/v1/nodes/:id
PUT    /api/v1/nodes/:id
DELETE /api/v1/nodes/:id
GET    /api/v1/edges
POST   /api/v1/edges
DELETE /api/v1/edges/:id
GET    /api/v1/search?query=...
GET    /api/v1/tags
POST   /api/v1/import
GET    /api/v1/export?format=json
```

**No**:
- ❌ Task endpoints
- ❌ Issue endpoints
- ❌ Session endpoints
- ❌ Synthesis endpoints
- ❌ Workflow endpoints

### Kingdom API (Port 4000)

```
POST   /api/v1/intent           # Parse natural language
POST   /api/v1/tasks
GET    /api/v1/tasks/:id
PUT    /api/v1/tasks/:id
GET    /api/v1/issues
POST   /api/v1/issues
GET    /api/v1/sessions
GET    /api/v1/sessions/:id
POST   /api/v1/synthesize        # LLM synthesis
POST   /api/v1/write             # LLM writing
POST   /api/v1/tag               # LLM tagging
```

**Kingdom uses Forest API internally** - never touches DB directly.

---

## File Structure

### Forest Repository

```
forest/
├── src/
│   ├── lib/
│   │   ├── db.ts                 # SQLite operations
│   │   ├── embeddings.ts         # Vector computation
│   │   ├── text.ts               # Text processing
│   │   ├── scoring.ts            # Edge scoring
│   │   └── chunking.ts           # Document chunking
│   │
│   ├── core/
│   │   ├── nodes.ts              # Node CRUD
│   │   ├── edges.ts              # Edge CRUD
│   │   ├── search.ts             # Semantic search
│   │   ├── tags.ts               # Tag operations
│   │   ├── import.ts             # Document import
│   │   └── stats.ts              # Graph statistics
│   │
│   ├── server/
│   │   ├── index.ts              # API server
│   │   └── routes/
│   │       ├── nodes.ts
│   │       ├── edges.ts
│   │       ├── search.ts
│   │       └── tags.ts
│   │
│   ├── cli/
│   │   ├── index.ts
│   │   └── commands/
│   │       ├── node.ts
│   │       ├── edge.ts
│   │       ├── search.ts
│   │       ├── import.ts
│   │       └── serve.ts
│   │
│   └── data/
│       ├── IDataProvider.ts      # Local vs Remote abstraction
│       └── providers/
│           ├── LocalProvider.ts
│           └── RemoteProvider.ts
│
├── package.json
└── README.md                      # "Forest: Graph Database for Knowledge"
```

### Kingdom Repository (New)

```
kingdom/
├── src/
│   ├── agents/
│   │   ├── WorkflowOrchestrator.ts
│   │   ├── IntentParser.ts
│   │   ├── ForestQueryEngine.ts
│   │   ├── SessionLedger.ts
│   │   ├── TaskDispatcher.ts
│   │   ├── ContentSynthesizer.ts    # ← from Forest
│   │   ├── DocumentWriter.ts         # ← from Forest
│   │   └── LLMTagger.ts              # ← from Forest
│   │
│   ├── runners/
│   │   ├── IRunner.ts
│   │   ├── DeployRunner.ts
│   │   └── BuildRunner.ts
│   │
│   ├── server/
│   │   ├── index.ts                  # Kingdom API server
│   │   └── routes/
│   │       ├── intent.ts
│   │       ├── tasks.ts
│   │       ├── issues.ts
│   │       ├── sessions.ts
│   │       └── synthesize.ts
│   │
│   ├── cli/
│   │   ├── index.ts
│   │   └── commands/
│   │       ├── synthesize.ts
│   │       ├── write.ts
│   │       ├── task.ts
│   │       ├── issue.ts
│   │       └── session.ts
│   │
│   └── lib/
│       ├── forest-client.ts          # HTTP client for Forest API
│       └── events.ts
│
├── package.json
└── README.md                          # "Kingdom: Workflow Orchestration on Forest"
```

---

## Dependencies

```
kingdom → forest (via HTTP API)
kingdom → LLM providers (Anthropic, OpenAI)
kingdom → secret-manager
kingdom → task runners

forest → SQLite
forest → embeddings provider
forest → (nothing else)
```

**Forest is a library/service. Kingdom is an application.**

---

## Migration Path

### Phase 1: Extract LLM Operations from Forest

**Move these files**:
```
forest/src/cli/commands/write.ts → kingdom/src/cli/commands/write.ts
forest/src/cli/commands/synthesize.ts → kingdom/src/cli/commands/synthesize.ts
forest/src/lib/llm-tagger.ts → kingdom/src/agents/LLMTagger.ts
forest/src/core/write.ts → kingdom/src/agents/DocumentWriter.ts
forest/src/core/synthesize.ts → kingdom/src/agents/ContentSynthesizer.ts
```

**Update imports**:
- Kingdom imports Forest via HTTP client
- Remove LLM dependencies from Forest's package.json
- Add LLM dependencies to Kingdom's package.json

### Phase 2: Build Kingdom CLI

```bash
# Install kingdom globally
npm install -g @forest/kingdom

# Configure
export FOREST_API_URL=http://localhost:3000

# Use kingdom commands
kingdom synthesize <a> <b>
kingdom write --topic "deployment guide"
kingdom "Deploy service-x"
```

### Phase 3: Deprecate Old Commands

```bash
# Old (deprecated)
forest node synthesize <a> <b>
→ "⚠️  Deprecated. Use: kingdom synthesize <a> <b>"

forest write --topic "..."
→ "⚠️  Deprecated. Use: kingdom write --topic '...'"
```

### Phase 4: Remove from Forest

After 1-2 major versions, remove:
- LLM operations
- Synthesis commands
- Write commands
- LLM dependencies

---

## Example: Synthesis Operation

### Before (Monolithic Forest)

```bash
forest node synthesize 3f76746e e5e48215
```

**What happens** (all in Forest):
1. Load node 3f76746e from DB
2. Load node e5e48215 from DB
3. Call LLM API to synthesize
4. Create new node in DB
5. Create edges
6. Return result

### After (Kingdom + Forest)

```bash
kingdom synthesize 3f76746e e5e48215
```

**What happens** (separated):

**Kingdom**:
1. HTTP GET forest-api/nodes/3f76746e
2. HTTP GET forest-api/nodes/e5e48215
3. Call LLM API to synthesize
4. HTTP POST forest-api/nodes (create synthesis node)
5. HTTP POST forest-api/edges (create edges)
6. Return result

**Forest**:
- Just serves nodes via API
- No LLM knowledge
- Pure graph operations

---

## Benefits of Separation

### 1. **Single Responsibility**
- Forest = graph storage & retrieval
- Kingdom = intelligent operations & workflows

### 2. **Independent Scaling**
- Scale Forest for read-heavy workloads (cache, replicas)
- Scale Kingdom for LLM rate limits (queue, batching)

### 3. **Technology Independence**
- Forest: SQLite, embeddings, graph algorithms
- Kingdom: LLMs, workflow engines, task runners
- Can swap either without affecting the other

### 4. **Clear API Boundaries**
- Forest API: graph operations
- Kingdom API: workflows & synthesis

### 5. **Deployment Flexibility**
- Run Forest standalone (just graph DB)
- Run Kingdom without Forest (use different graph DB)
- Run both together (development)
- Run distributed (production)

### 6. **Testing Simplicity**
- Forest tests: pure graph operations (fast, deterministic)
- Kingdom tests: can mock Forest API (no DB needed)

---

## Mental Model

**Forest**:
> "I store nodes, edges, embeddings. I can search. I'm a database."

**Kingdom**:
> "I orchestrate workflows, synthesize content, manage tasks. I use Forest to remember things."

---

## Naming Analogy

```
Forest  = PostgreSQL (the database)
Kingdom = Rails app (uses PostgreSQL)
```

You wouldn't put business logic in PostgreSQL.
You shouldn't put LLM synthesis in Forest.

---

## Summary Table

| Feature | Forest | Kingdom |
|---------|--------|---------|
| Node CRUD | ✅ | ❌ (via API) |
| Edge CRUD | ✅ | ❌ (via API) |
| Semantic Search | ✅ | ❌ (via API) |
| Embeddings | ✅ | ❌ |
| LLM Synthesis | ❌ | ✅ |
| LLM Writing | ❌ | ✅ |
| LLM Tagging | ❌ | ✅ |
| Workflows | ❌ | ✅ |
| Task Management | ❌ | ✅ |
| Issue Tracking | ❌ | ✅ |
| Session Logging | ❌ | ✅ |
| Intent Parsing | ❌ | ✅ |
| Task Dispatch | ❌ | ✅ |
| API Server | ✅ | ✅ |

---

## Next Steps

1. **Create Kingdom repository**
2. **Extract LLM operations from Forest**
3. **Implement forest-client in Kingdom**
4. **Build Kingdom CLI**
5. **Deprecate old Forest commands**
6. **Update documentation**

---

**The Core Insight**:

> Forest is the library. Kingdom is the application.
> Forest is PostgreSQL. Kingdom is your app.
> Forest is the graph. Kingdom is what you do with the graph.

This separation makes both simpler, more focused, and more powerful.
