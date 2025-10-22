# Making Command Returns Modular - Implementation Guide

## TL;DR - Your Question Answered

**"How do we make command returns more modular?"**

Answer: **3-layer architecture** with **panel-based formatters**

```
Command (thin) → Core (data) → Formatter (presentation)
```

**"Do we do each panel separately?"**

Yes! Each visual section (header, table, footer) is a separate function/class that can be composed.

**"How do we structure to move forward?"**

Follow the **phased migration** below, starting with Phase 1 (already done!).

---

## What I've Built For You

### ✅ Phase 1 Complete: Extracted Color System

I've extracted the excellent color/formatting design from `forest edges propose` into reusable modules:

```
src/cli/formatters/
├── colors.ts              ← HSL gradients, theming, color utilities
├── edges.ts               ← Edge-specific table formatters
├── index.ts               ← Clean public API
├── MIGRATION_EXAMPLE.md   ← Before/after refactoring guide
```

### Key Files Created

1. **`src/cli/formatters/colors.ts`** - Reusable color system
   - `hslToRgb()` - HSL to RGB conversion
   - `colorizeScore()` - Gradient heat maps
   - `colorNodeId()` - Subtle ID coloring
   - `makeHeaderColor()` - Header styling
   - `FOREST_THEMES` - Central color palette
   - `colorize.*` - Preset functions for common use cases

2. **`src/cli/formatters/edges.ts`** - Edge formatters
   - `formatEdgeSuggestionsTable()` - Beautiful table with scores
   - `formatEdgeSuggestionsJSON()` - JSON output
   - `formatAcceptedEdgesTable()` - Accepted edges list
   - `formatEdgeExplanation()` - Score explanation

3. **`src/cli/formatters/index.ts`** - Public API
   - Single import point for all formatters
   - `import { colorize, formatEdgeSuggestionsTable } from '../formatters'`

4. **Documentation**
   - `FORMATTING_ARCHITECTURE.md` - Full architecture spec
   - `MIGRATION_EXAMPLE.md` - Concrete before/after examples

---

## The 3-Layer Architecture

### Layer 1: Commands (Orchestration)
**Location**: `src/cli/commands/*.ts`

**Responsibilities**:
- Parse flags
- Call core for data
- Select formatter based on `--json` flag
- Handle errors

**Example**:
```typescript
async function runEdgesPropose(flags: EdgesProposeFlags) {
  const suggestions = await getTopSuggestionsCore(flags.limit ?? 10);

  if (flags.json) {
    console.log(formatEdgeSuggestionsJSON(suggestions));
  } else {
    console.log(formatEdgeSuggestionsTable(suggestions, {
      longIds: flags.longIds,
      showHeader: true,
    }));
  }
}
```

### Layer 2: Core (Business Logic)
**Location**: `src/core/*.ts`

**Responsibilities**:
- Pure data operations
- Database queries
- Scoring/computation
- Returns typed data structures

**Example**:
```typescript
// src/core/edges.ts
export async function getTopSuggestionsCore(limit: number) {
  const edges = await listEdges('suggested');
  const nodeMap = new Map((await listNodes()).map(n => [n.id, n]));

  return edges
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(edge => ({
      edge,
      sourceNode: nodeMap.get(edge.sourceId)!,
      targetNode: nodeMap.get(edge.targetId)!,
      components: computeScore(...).components
    }));
}
```

### Layer 3: Formatters (Presentation)
**Location**: `src/cli/formatters/*.ts`

**Responsibilities**:
- Transform data → string output
- Color theming
- Table/column layout
- Panel composition

**Example**:
```typescript
export function formatEdgeSuggestionsTable(
  suggestions: EdgeSuggestion[],
  options: { longIds?: boolean; showHeader?: boolean }
): string {
  const sections = [];

  if (options.showHeader) {
    sections.push(formatHeader());
  }

  sections.push(...suggestions.map(s => formatRow(s)));

  return sections.join('\n');
}
```

---

## Panel-Based Design

Commands often have multiple visual sections. Each is a **separate function** that can be composed:

```typescript
// Header panel
function formatHeader(): string {
  return [
    'Top identified links sorted by aggregate score.',
    '/forest edges accept/reject [ref]',
    '',
    formatColumnHeaders()
  ].join('\n');
}

// Column headers panel
function formatColumnHeaders(): string {
  return '◌ ref ag em tk ti tg ... nodeA::nodeB';
}

// Row panel (repeated)
function formatRow(suggestion: EdgeSuggestion): string {
  const ag = colorize.aggregateScore(suggestion.edge.score);
  const em = colorize.embeddingScore(suggestion.components.embeddingSimilarity);
  // ... format the row
  return `${code} ${ag} ${em} ...`;
}

// Footer panel (optional)
function formatFooter(count: number): string {
  return `\n${count} suggestions shown`;
}

// Compose them
export function formatEdgeSuggestionsTable(suggestions, options) {
  const panels = [
    formatHeader(),
    ...suggestions.map(formatRow),
  ];

  if (options.showFooter) {
    panels.push(formatFooter(suggestions.length));
  }

  return panels.join('\n');
}
```

**Benefits**:
- ✅ Each panel is independently testable
- ✅ Panels can be reused across commands
- ✅ Easy to add/remove/reorder sections
- ✅ Clear separation of concerns

---

## How To Move Forward - Phased Migration

### ✅ Phase 1: Extract Colors (DONE!)
**Status**: Complete
**Files**: `src/cli/formatters/colors.ts`, `edges.ts`, `index.ts`

You can now use these colors in ANY command:
```typescript
import { colorize } from '../formatters';

console.log(colorize.embeddingScore(0.85));  // Green gradient
console.log(colorize.nodeId("7fa7acb2"));    // Subtle grey
```

### Phase 2: Create Core Functions
**Effort**: 2-3 hours per command group
**Goal**: Move business logic out of commands

**Checklist**:
1. Create `src/core/edges.ts`
2. Implement `getTopSuggestionsCore()`
3. Implement `getAcceptedEdgesCore()`
4. Update tests to use core functions

**Example PR structure**:
```
src/core/edges.ts                  (new - business logic)
src/cli/commands/edges.ts          (modified - use core)
src/core/__tests__/edges.test.ts   (new - test core logic)
```

### Phase 3: Migrate Edge Commands
**Effort**: 1-2 hours per command
**Goal**: Refactor edge commands to use formatters

**Commands to migrate**:
- `forest edges propose` - Use `formatEdgeSuggestionsTable()`
- `forest edges` - Use `formatAcceptedEdgesTable()`
- `forest edges explain` - Use `formatEdgeExplanation()`

**Per-command checklist**:
- [ ] Replace inline formatting with formatter call
- [ ] Verify output unchanged (visual regression test)
- [ ] Test both `--json` and text modes
- [ ] Update any tests

### Phase 4: Apply to Other Commands
**Effort**: 3-5 hours total
**Goal**: Standardize across all commands

**Commands to refactor**:
1. `forest stats` - Already uses core! Just needs formatter
2. `forest search` - Already uses core! Just needs formatter
3. `forest explore` - Already delegates to shared! Minor cleanup

**Create new formatters**:
- `src/cli/formatters/stats.ts`
- `src/cli/formatters/search.ts`
- `src/cli/formatters/nodes.ts`

### Phase 5: Create Generic Table Utilities (Optional)
**Effort**: 2-3 hours
**Goal**: Reusable table building blocks

```typescript
// src/cli/formatters/table.ts

export type Column = {
  header: string;
  width: number;
  align: 'left' | 'right';
  color?: (value: string) => string;
};

export function formatTable(
  rows: Record<string, string>[],
  columns: Column[]
): string {
  // Generic table formatter
}
```

---

## Quick Start - Use Formatters Today

### Example 1: Add Color to Stats Command

```typescript
// src/cli/commands/stats.ts
import { colorize } from '../formatters';

console.log('High-degree nodes:');
for (const entry of stats.highDegree) {
  console.log(
    `  ${colorize.nodeId(formatId(entry.id))}  ${entry.title}  ` +
    `(degree ${colorize.embeddingScore(entry.degree / maxDegree)})`
  );
}
```

### Example 2: Add Color to Search Results

```typescript
// src/cli/commands/search.ts
import { colorize } from '../formatters';

for (const item of result.nodes) {
  const score = colorize.embeddingScore(item.similarity);
  const id = colorize.nodeId(formatNodeId(item.node.id));
  console.log(`${score} ${id} ${item.node.title}`);
}
```

### Example 3: Use Edge Formatters

```typescript
// src/cli/commands/edges.ts
import { formatEdgeSuggestionsTable } from '../formatters';

// Instead of 146 lines of inline formatting:
const suggestions = await getTopSuggestionsCore(limit);
console.log(formatEdgeSuggestionsTable(suggestions, {
  longIds: flags.longIds,
  showHeader: true,
}));
```

---

## Benefits of This Architecture

### 1. Reusability
**Before**: Color logic trapped in one function
**After**: Use `colorize.*` anywhere

```typescript
// Any command can now use Forest colors!
import { colorize } from '../formatters';
console.log(colorize.embeddingScore(0.75));
```

### 2. Testability
**Before**: Hard to test 146-line formatting function
**After**: Pure functions, easy to test

```typescript
test('formats edge table correctly', () => {
  const output = formatEdgeSuggestionsTable(mockData);
  expect(output).toContain('nodeA::nodeB');
});
```

### 3. Consistency
**Before**: Each command invents its own colors
**After**: All commands use `FOREST_THEMES`

```typescript
// Consistent palette across all commands
colorize.embeddingScore()  // Always forest green
colorize.tokenScore()      // Always moss/lime
```

### 4. Maintainability
**Before**: Change colors = edit 5 files
**After**: Change colors = edit `colors.ts`

```typescript
// Update theme once, affects all commands
export const FOREST_THEMES = {
  embedding: { hue: 130 }, // Adjust green hue
  // ...
};
```

### 5. Discoverability
**Before**: "Where's the color logic?"
**After**: `src/cli/formatters/` - obvious location

---

## Decision Guide - Where Does Code Go?

### "I need to fetch nodes from database"
→ **Core layer** (`src/core/*.ts`)

### "I need to colorize a score"
→ **Formatter layer** (`src/cli/formatters/colors.ts`)

### "I need to build a table"
→ **Formatter layer** (`src/cli/formatters/*.ts`)

### "I need to parse command flags"
→ **Command layer** (`src/cli/commands/*.ts`)

### "I need to compute edge scores"
→ **Core layer** (`src/core/*.ts` or `src/lib/scoring.ts`)

### "I need to format JSON output"
→ **Formatter layer** (`src/cli/formatters/*.ts`)

### "I need to resolve progressive IDs"
→ **Shared utilities** (`src/cli/shared/utils.ts`)

---

## Next Steps - Recommended Order

1. ✅ **Read this guide** (you are here!)

2. **Try formatters in one command** (15 min)
   - Pick `stats` or `search`
   - Add `import { colorize } from '../formatters'`
   - Colorize one score or ID
   - Verify it looks good

3. **Create first core function** (1 hour)
   - Create `src/core/edges.ts`
   - Implement `getTopSuggestionsCore()`
   - Test it manually with `forest edges propose`

4. **Refactor `runEdgesPropose`** (1 hour)
   - Update to use `formatEdgeSuggestionsTable()`
   - Verify output unchanged
   - Commit

5. **Apply pattern to 2-3 more commands** (3-4 hours)
   - `edges explain`, `stats`, `search`
   - Gain confidence in the pattern

6. **Standardize across all commands** (1-2 days)
   - Systematic refactoring
   - Update tests
   - Document patterns

---

## Open Questions / Feedback Needed

Before proceeding with full migration, consider:

1. **API preferences**
   - Do you prefer functions or classes for formatters?
   - Current: Functions (simpler)
   - Alternative: Classes with state (more complex but flexible)

2. **JSON standardization**
   - Should we define JSON schemas in `src/types/output.ts`?
   - Would help with API/CLI consistency

3. **Color themes**
   - Should themes be configurable via config file?
   - Or keep hardcoded in `FOREST_THEMES`?

4. **Testing strategy**
   - Snapshot tests for formatters?
   - Visual regression tests?

---

## Files You Should Read Next

1. **`FORMATTING_ARCHITECTURE.md`** - Full architectural spec
2. **`src/cli/formatters/MIGRATION_EXAMPLE.md`** - Before/after examples
3. **`src/cli/formatters/colors.ts`** - Color utilities (well-documented)
4. **`src/cli/formatters/edges.ts`** - Example formatter implementation

---

## Summary

**You asked**: "How do we make command returns more modular?"

**The answer**:
- ✅ **3-layer architecture** (Command → Core → Formatter)
- ✅ **Panel-based composition** (Header + Table + Footer)
- ✅ **Reusable color system** (Extract once, use everywhere)
- ✅ **Phased migration** (5 phases, Phase 1 complete!)

**What's ready now**:
- `src/cli/formatters/colors.ts` - Use in any command today!
- `src/cli/formatters/edges.ts` - Example formatter
- Full documentation and migration guides

**What to do next**:
1. Try adding colors to one command (15 min proof-of-concept)
2. Create your first core function (`getTopSuggestionsCore`)
3. Refactor `runEdgesPropose` to use the new formatters
4. Apply pattern to remaining commands

The foundation is built. Now it's just systematic application! 🚀

---

**Questions? Start with these files:**
- This guide (overview)
- `FORMATTING_ARCHITECTURE.md` (detailed spec)
- `MIGRATION_EXAMPLE.md` (concrete examples)
- `src/cli/formatters/colors.ts` (implementation)
