# Forest Architecture - Quick Reference

> **TL;DR**: Refactor Forest to support thin client mode by fixing circular dependencies, creating a data access layer, and maintaining clean architecture.

## Current Problems 🔴

```
❌ Core → CLI imports (src/core/nodes.ts imports cli/shared/linking)
❌ Core → Server imports (src/core/nodes.ts imports server/events)
❌ No data abstraction (can't swap local DB for remote API)
❌ Business logic scattered between CLI and Core
```

## Target Architecture ✅

```
┌─────────────────────────────────────┐
│  CLI Commands                       │
│  (Presentation - formatting only)   │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  Data Access Layer (DAL)            │
│  - LocalProvider (SQLite)           │
│  - RemoteProvider (HTTP API)        │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  Core Business Logic                │
│  (Pure functions - no I/O)          │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  Library Layer                      │
│  (DB, embeddings, scoring, etc.)    │
└─────────────────────────────────────┘
```

## Key Changes

### 1. Move Business Logic to Core

| Current Location | Target Location | Type |
|-----------------|----------------|------|
| `cli/shared/linking.ts` | `core/linking.ts` | Graph algorithms |
| `cli/shared/explore.ts` | `core/explore.ts` | Graph traversal |
| `server/events/eventBus.ts` | `lib/events.ts` | Event system |
| `cli/shared/utils.ts` | `lib/utils.ts` | Pure utilities |

### 2. Create Data Access Layer

**New Files**:
```
src/data/
├── IDataProvider.ts              # Interface definition
├── DataProviderFactory.ts        # Mode selection factory
├── providers/
│   ├── LocalProvider.ts          # Direct DB access
│   └── RemoteProvider.ts         # HTTP API client
└── types.ts                      # Shared types
```

### 3. Update CLI Commands

**Pattern**:
```typescript
// OLD
import { statsCore } from '../../core/stats';
const stats = await statsCore();

// NEW
import { getDataProvider } from '../../data/DataProviderFactory';
const provider = getDataProvider();
const stats = await provider.getStats();
```

## Environment Variables

### Local Mode (Default)
```bash
# No configuration needed - uses local forest.db
forest stats
```

### Thin Client Mode
```bash
export FOREST_MODE=client
export FOREST_API_URL=https://your-forest-server.com
export FOREST_API_KEY=sk_xxx...  # optional

forest stats  # Now makes HTTP call to remote server
```

## Directory Structure (After Refactoring)

```
src/
├── cli/              # ✅ Presentation only (no business logic)
├── server/           # ✅ HTTP routes (calls core directly)
├── data/             # 🆕 Data access abstraction
│   ├── IDataProvider.ts
│   ├── DataProviderFactory.ts
│   └── providers/
├── core/             # ✅ Pure business logic (no CLI/Server imports)
│   ├── linking.ts    # ← moved from cli/shared
│   └── explore.ts    # ← moved from cli/shared
├── lib/              # ✅ Infrastructure
│   ├── events.ts     # ← moved from server/events
│   └── utils.ts      # ← moved from cli/shared
└── types/
```

## Migration Phases

### Phase 1: Fix Dependencies (Week 1) 🔴
- Move `linking.ts`, `explore.ts` to core
- Abstract event system
- Move pure utilities to lib
- **Goal**: No Core → CLI/Server imports

### Phase 2: Create DAL (Week 2) 🟡
- Define `IDataProvider` interface
- Implement `LocalProvider` (wraps core)
- Create `DataProviderFactory`
- **Goal**: Data abstraction ready

### Phase 3: Remote Provider (Week 3) 🟢
- Implement `RemoteProvider` (HTTP client)
- Add auth, retries, errors
- **Goal**: Thin client works

### Phase 4: Update CLI (Week 4) 🔵
- Update all commands to use DAL
- **Goal**: CLI uses abstraction

### Phase 5: Polish (Week 5) 🎨
- Caching, monitoring, docs
- **Goal**: Production ready

## Testing Strategy

```bash
# 1. Local mode (existing behavior)
forest stats
forest search "test"

# 2. Thin client mode
export FOREST_MODE=client
export FOREST_API_URL=http://localhost:3000
forest stats
forest search "test"

# 3. Start server in background
forest serve --port 3000 &

# 4. Use thin client
FOREST_MODE=client FOREST_API_URL=http://localhost:3000 forest stats
```

## Validation Commands

```bash
# Check for circular dependencies
npm install -g madge
madge --circular src/

# Should show ZERO core → cli or core → server imports

# Type check
bun run lint

# Run tests
bun test

# Integration test
./scripts/test-thin-client.sh
```

## Quick Decision Tree

```
Need to add a feature?
│
├─ Is it business logic?
│  └─ YES → Add to src/core/*.ts
│
├─ Is it data access?
│  └─ YES → Add to IDataProvider interface
│            Implement in LocalProvider
│            Implement in RemoteProvider
│
├─ Is it CLI formatting?
│  └─ YES → Add to src/cli/formatters/ or src/cli/commands/
│
├─ Is it API route?
│  └─ YES → Add to src/server/routes/*.ts
│            Call core function
│
└─ Is it infrastructure?
   └─ YES → Add to src/lib/*.ts
```

## Common Pitfalls

### ❌ DON'T
```typescript
// In src/core/nodes.ts
import { formatNodeForDisplay } from '../cli/shared/utils';  // ❌
```

### ✅ DO
```typescript
// In src/core/nodes.ts
import { normalizeId } from '../lib/utils';  // ✅
```

---

### ❌ DON'T
```typescript
// In src/cli/commands/stats.ts
import { listNodes } from '../../lib/db';  // ❌ Bypass abstraction
```

### ✅ DO
```typescript
// In src/cli/commands/stats.ts
import { getDataProvider } from '../../data/DataProviderFactory';  // ✅
const provider = getDataProvider();
const nodes = await provider.listNodes();
```

---

### ❌ DON'T
```typescript
// In src/core/search.ts
if (process.env.FOREST_MODE === 'client') {  // ❌ Mode awareness
  // Core should NOT know about modes
}
```

### ✅ DO
```typescript
// Core is mode-agnostic
// Mode selection happens in DataProviderFactory
```

## Critical Success Factors

1. ✅ **No circular deps** - Core is innermost layer
2. ✅ **Single abstraction** - All data through IDataProvider
3. ✅ **Pure business logic** - Core has no I/O dependencies
4. ✅ **Testability** - Easy to mock providers
5. ✅ **Backward compat** - Existing CLI works unchanged

## Resources

- 📘 [ARCHITECTURE.md](./ARCHITECTURE.md) - Full architecture diagrams
- 🔧 [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md) - Step-by-step code changes
- 🌲 [THIN_CLIENT_EXPLORATION.md](./THIN_CLIENT_EXPLORATION.md) - Proof of concept results

## Priority Order

**DO FIRST** (Blocks everything else):
1. Fix circular dependencies (Phase 1)
2. Create DAL interface (Phase 2)

**DO NEXT** (Enables thin client):
3. Implement RemoteProvider (Phase 3)

**DO AFTER** (Polish):
4. Update CLI commands (Phase 4)
5. Add caching, monitoring (Phase 5)

---

## One-Liner Summary

> **Move business logic to core, abstract data access, enable thin client mode - all without breaking existing CLI behavior.**
