# Forest Ecosystem - System Overview

**Version**: 1.0
**Last Updated**: 2025-10-23

## One-Page Architecture

### System Purpose
A natural language-driven task coordination system built on a graph-native knowledge base. Enables users to manage work items, execute tasks, and build institutional knowledge through a unified semantic graph.

---

## Core Modules

### 📊 **forest-graph** (Knowledge Graph Database)
**Location**: `src/lib/db.ts`, `src/core/`
**Purpose**: Single source of truth for all data
**Responsibilities**:
- Node storage (issues, tasks, logs, documents)
- Edge management (relationships, dependencies, executions)
- Semantic search via embeddings
- Auto-linking and similarity detection

**Data Model**: Everything is a node. Relationships are edges.
- Issues → `tags: ["issue", "state:ready", "p2"]`
- Tasks → `tags: ["task", "state:running", "template:deploy"]`
- Logs → `tags: ["log", "action:assign", "session:sess-123"]`

---

### 🎯 **intent-parser** (Natural Language Router)
**Location**: `src/agents/IntentParser.ts`
**Purpose**: Convert natural language to structured operations
**Model**: Small/Fast (Claude Haiku, GPT-4o-mini)
**Input**: `"What deployments failed this week?"`
**Output**:
```json
{
  "action": "search",
  "entity": "task",
  "filters": {
    "tags": ["deploy", "state:failed"],
    "timeframe": { "start": "2025-10-17" }
  }
}
```

**Key**: Fast intent recognition, no reasoning about domain logic.

---

### 🔍 **forest-query-engine** (Graph Query Executor)
**Location**: `src/agents/ForestQueryEngine.ts`
**Purpose**: Execute structured queries against forest-graph
**Model**: Large context (Claude Sonnet, GPT-4)
**Responsibilities**:
- Translate intent → Forest operations
- Execute graph traversals
- Aggregate related context
- Return structured results

**Interface**: Never exposes Forest CLI commands externally.

```typescript
interface IForestQueryEngine {
  executeQuery(intent: Intent): Promise<QueryResult>;
  getContext(nodeId: string, depth: number): Promise<ContextGraph>;
  findSimilar(nodeId: string): Promise<SimilarNode[]>;
}
```

---

### 🎭 **workflow-orchestrator** (Coordination Engine)
**Location**: `src/agents/WorkflowOrchestrator.ts`
**Purpose**: Enforce business rules and coordinate execution
**Responsibilities**:
- Validate preconditions
- Enforce state machines
- Coordinate between modules
- Presentation layer (format responses)

**Flow**:
```
User Input → intent-parser → workflow-orchestrator
  ↓
  ├─ Read-only query → forest-query-engine → format response
  └─ Execution request → session-ledger → task-dispatcher → runner
```

---

### 📝 **session-ledger** (Audit & Event Journal)
**Location**: `src/agents/SessionLedger.ts`
**Purpose**: Maintain coherence and audit trail
**Pattern**: Event sourcing with session-based logging

**Core Concepts**:
- **Session**: Logical unit of work (e.g., "deploy service-x")
- **Events**: State transitions, actions, outcomes
- **Sequence**: Monotonically increasing per session
- **Coherence**: Replay capability, conflict detection

**API**:
```typescript
interface ISessionLedger {
  openSession(intent: Intent, actor: string): Promise<SessionId>;
  logEvent(sessionId: SessionId, event: Event): Promise<void>;
  commitSession(sessionId: SessionId): Promise<void>;
  abortSession(sessionId: SessionId, reason: string): Promise<void>;
  replaySession(sessionId: SessionId): Promise<Event[]>;
}
```

**Storage**: Events stored as Forest nodes with `session:sess-xxx` tags.

---

### 📡 **event-bus** (Pub/Sub Messaging)
**Location**: `src/lib/events.ts`
**Purpose**: Decouple modules via events
**Pattern**: Publisher/Subscriber

**Topics**:
- `session.opened`, `session.committed`
- `task.started`, `task.progress`, `task.completed`
- `node.created`, `edge.created`
- `alert.raised` (from health-monitor)

**Subscribers**: UI updates, notifications, metrics collection

---

### 🚀 **task-dispatcher** (Execution Router)
**Location**: `src/agents/TaskDispatcher.ts`
**Purpose**: Select and invoke task executors
**Responsibilities**:
- Runner selection (capability, availability, cost)
- Load balancing
- Retry logic

**API**:
```typescript
interface ITaskDispatcher {
  selectRunner(intent: Intent): Promise<IRunner>;
  dispatch(taskId: string, runner: IRunner, vars: object): Promise<Result>;
}
```

---

### ⚙️ **task-executor** (Worker Implementation)
**Location**: `src/agents/runners/`
**Purpose**: Execute actual work (deploy, build, test, etc.)
**Examples**:
- `DeployRunner` - Deploys services
- `BuildRunner` - Runs builds
- `TestRunner` - Executes tests

**Interface**:
```typescript
interface IRunner {
  id: string;
  capabilities: string[];  // ["deploy", "kubernetes", "aws"]
  execute(taskId: string, vars: object): Promise<ExecutionResult>;
}
```

**Progress Reporting**: Emits events to event-bus during execution.

---

### 🔐 **secret-manager** (Credential Provider)
**Location**: `src/agents/SecretManager.ts`
**Purpose**: Inject secrets safely
**Responsibilities**:
- Fetch secrets from vault (AWS Secrets Manager, Vault, etc.)
- Scope secrets to runners
- Never log secret values

**API**:
```typescript
interface ISecretManager {
  getSecrets(runner: string, scope: string[]): Promise<Record<string, string>>;
}
```

---

### 🏥 **health-monitor** (System Watchdog)
**Location**: `src/agents/HealthMonitor.ts`
**Purpose**: Monitor system health and raise alerts
**Responsibilities**:
- Task timeout detection
- Runner health checks
- SLA breach detection
- Resource monitoring

**Alerts**: Published via event-bus as `alert.raised` events.

---

### 🧠 **task-planner** (Strategy Advisor)
**Location**: `src/agents/TaskPlanner.ts` (optional/future)
**Purpose**: Analyze and suggest execution strategies
**Model**: Large reasoning model (Claude Opus, GPT-4)
**Capabilities**:
- Query forest-graph for historical patterns
- Suggest decomposition strategies
- Estimate costs, risks, timelines
- Recommend prerequisites

---

## Data Flow

### Read Query (Simple)

```
User: "What deployments failed this week?"
  ↓
intent-parser: { action: search, entity: task, filters: {...} }
  ↓
workflow-orchestrator: validate intent
  ↓
forest-query-engine: forest.search("#task #deploy #state:failed")
  ↓
workflow-orchestrator: format results
  ↓
User: [Formatted table of failed deployments]
```

### Execution Flow (Complex)

```
User: "Deploy service-x v1.2.3 to staging"
  ↓
intent-parser: { action: execute, template: deploy, vars: {...} }
  ↓
workflow-orchestrator: validate preconditions
  ↓
session-ledger: openSession() → sess-7f2a
  ↓
forest-graph: create issue node ISS-1234
  ↓
forest-graph: create task node TSK-987
  ↓
forest-graph: create edge TSK-987 --executes--> ISS-1234
  ↓
session-ledger: logEvent(node_created, ISS-1234)
session-ledger: logEvent(node_created, TSK-987)
  ↓
task-dispatcher: selectRunner() → runner.deploy-01
  ↓
session-ledger: logEvent(runner_selected)
  ↓
secret-manager: getSecrets(runner.deploy-01, ["aws", "deploy"])
  ↓
session-ledger: logEvent(secrets_injected)
  ↓
task-executor: runner.deploy-01.execute(TSK-987, vars)
  ├─ event-bus: emit(task.started)
  ├─ event-bus: emit(task.progress, 10%)
  ├─ event-bus: emit(task.progress, 40%)
  ├─ event-bus: emit(task.progress, 70%)
  └─ event-bus: emit(task.completed, success)
  ↓
forest-graph: update TSK-987 state → succeeded
  ↓
forest-graph: attach artifacts to TSK-987
  ↓
forest-graph: create summary node → auto-links to related nodes
  ↓
session-ledger: commitSession(sess-7f2a)
  ↓
User: "✅ Deploy completed successfully"
```

---

## Module Dependency Graph

```
┌─────────────────────────────────────────────────┐
│  CLI / API (Presentation Layer)                 │
└────────────────────┬────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────┐
│  workflow-orchestrator                          │
│  (Business rules, coordination)                 │
└─────┬──────────┬──────────┬─────────────────────┘
      │          │          │
      ↓          ↓          ↓
┌──────────┐ ┌────────┐ ┌──────────────┐
│ intent-  │ │ forest-│ │ session-     │
│ parser   │ │ query- │ │ ledger       │
│          │ │ engine │ │              │
└──────────┘ └───┬────┘ └──────┬───────┘
                 │              │
                 ↓              ↓
┌─────────────────────────────────────────────────┐
│  forest-graph (Data Layer)                      │
│  • Nodes, edges, embeddings                     │
│  • Single source of truth                       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Infrastructure (Parallel)                      │
├──────────────┬──────────────┬───────────────────┤
│ event-bus    │ task-        │ secret-manager    │
│              │ dispatcher   │                   │
└──────────────┴──────┬───────┴───────────────────┘
                      │
                      ↓
               ┌──────────────┐
               │ task-executor│
               │ (runners)    │
               └──────────────┘
```

**Dependency Rules**:
1. ✅ Upper layers depend on lower layers
2. ✅ forest-graph is the foundation (lowest layer)
3. ✅ No circular dependencies
4. ✅ Infrastructure modules don't depend on business logic

---

## Environment Modes

### Local Mode (Default)
```bash
# All operations use local SQLite
forest-graph → local forest.db
```

### Thin Client Mode
```bash
export FOREST_MODE=client
export FOREST_API_URL=https://forest-server.corp

# forest-graph operations → HTTP API
workflow-orchestrator → (same)
session-ledger → (same, stores in remote graph)
```

**Key**: Module interfaces unchanged. Only forest-graph swaps local vs. remote provider.

---

## Key Architectural Principles

### 1. **Graph-Native Everything**
- Issues are nodes
- Tasks are nodes
- Logs are nodes
- Relationships are edges
- **No separate databases**

### 2. **Event Sourcing**
- State derived from event log
- Full audit trail
- Replay capability
- Time travel debugging

### 3. **Session-Based Coherence**
- Logical units of work
- Atomic commits
- Conflict detection
- Causality preservation

### 4. **Agent Specialization**
- Small models for fast tasks (parsing)
- Large models for complex tasks (query execution)
- Clear separation of concerns
- Composable architecture

### 5. **Thin Client Ready**
- HTTP API for all operations
- Stateless orchestration
- Centralized knowledge
- Multi-user collaboration

---

## Example Usage

```bash
# Natural language interface
crown "What deployments failed this week?"
crown "Deploy service-x v1.2.3 to staging"
crown "Show me issues blocking ISS-1234"
crown "Create a high-priority deploy task for service-y"

# Direct Forest operations (power users)
forest search "#task #deploy #state:failed"
forest node read ISS-1234
forest edges --source-id TSK-987 --edge-type logs

# Session audit
forest search "#session #status:committed" --limit 20
forest node read sess-7f2a  # Full session timeline

# Replay for debugging
scribe replay sess-7f2a  # Show all events in order
```

---

## Performance Characteristics

| Operation | Latency | Notes |
|-----------|---------|-------|
| Intent parsing | 100-300ms | Small model, cached prompts |
| Forest search | 50-500ms | Depends on graph size, embeddings |
| Session log | 10-50ms | Buffered, batched writes |
| Task execution | Seconds-hours | Depends on task type |
| Event emission | <10ms | In-memory pub/sub |

---

## Scaling Strategy

### Horizontal
- **forest-graph**: Replicate for read-heavy workloads
- **task-executor**: Add runners dynamically
- **event-bus**: Distributed message queue (Redis, NATS)

### Vertical
- **forest-query-engine**: Cache frequent queries
- **session-ledger**: Batch event writes
- **workflow-orchestrator**: Stateless, add instances

---

## Security Model

### Authentication
- API key per user/system
- Runner identity via certificates
- Session ownership tracking

### Authorization
- Role-based access (reader, executor, admin)
- Node-level permissions (future)
- Secret scoping per runner

### Audit
- All actions logged via session-ledger
- Immutable event log
- Cryptographic signatures (future)

---

## Module Summary Table

| Module | Formal Name | Purpose | Model/Tech | Lines of Code (est.) |
|--------|-------------|---------|------------|---------------------|
| Crown | workflow-orchestrator | Coordination | Logic/Small LLM | 500 |
| King's Translator | intent-parser | NL parsing | Haiku/4o-mini | 200 |
| Forest Expert | forest-query-engine | Graph queries | Sonnet/GPT-4 | 400 |
| Scribe | session-ledger | Audit log | Event sourcing | 600 |
| Herald | event-bus | Pub/Sub | In-memory/Redis | 150 (exists) |
| Marshal | task-dispatcher | Runner selection | Logic | 300 |
| Runner | task-executor | Execution | Varies | 200/runner |
| Chamberlain | secret-manager | Secrets | Vault client | 150 |
| Sentinel | health-monitor | Monitoring | Logic | 250 |
| Advisor | task-planner | Planning (future) | Opus/o1 | 400 |
| Forest | forest-graph | Data layer | SQLite/WASM | 2000 (exists) |

**Total**: ~5,000 new lines + existing 8,000 = **13,000 LOC** for full system

---

## Next Steps

1. **Phase 1**: Implement core modules (intent-parser, forest-query-engine, workflow-orchestrator)
2. **Phase 2**: Add execution support (session-ledger, task-dispatcher, task-executor)
3. **Phase 3**: Infrastructure (secret-manager, health-monitor)
4. **Phase 4**: Advanced features (task-planner, distributed event-bus)

---

## References

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed architecture diagrams
- [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md) - Implementation guide
- [THIN_CLIENT_EXPLORATION.md](./THIN_CLIENT_EXPLORATION.md) - Thin client proof-of-concept

---

**Key Insight**: By storing everything in forest-graph as nodes and edges, we eliminate data silos and enable powerful semantic queries across the entire system. The graph is both the database AND the knowledge base.
