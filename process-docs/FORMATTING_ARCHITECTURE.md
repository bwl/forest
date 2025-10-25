# Forest CLI Formatting Architecture

## Overview

This document describes the modular formatting system for Forest CLI commands, extracting the excellent design work from `forest edges propose` into reusable components.

## Directory Structure

```
src/cli/
├── commands/          # Command definitions (thin orchestration layer)
├── core/              # Business logic (data operations)
├── shared/            # Shared utilities (ID resolution, etc.)
└── formatters/        # Presentation layer (NEW!)
    ├── colors.ts      # Color utilities (HSL gradients, theming)
    ├── table.ts       # Table/column formatting
    ├── panels.ts      # Panel abstraction for multi-section output
    └── edges.ts       # Edge-specific formatters
    └── nodes.ts       # Node-specific formatters
    └── index.ts       # Unified formatter interface
```

## Layer Responsibilities

### 1. Command Layer (`src/cli/commands/*.ts`)

**Responsibilities:**
- Parse command-line flags
- Call core layer for data
- Select formatter based on `--json` flag
- Handle errors
- Control flow (TLDR, validation)

**Anti-patterns:**
- ❌ Inline color/formatting logic
- ❌ Business logic (queries, scoring)
- ❌ Console.log calls with formatting

**Example:**
```typescript
async function runEdgesPropose(flags: EdgesProposeFlags) {
  const limit = flags.limit ?? 10;

  // 1. Get data from core
  const edges = await getTopSuggestionsCore(limit);

  // 2. Select formatter
  if (flags.json) {
    console.log(formatEdgeSuggestionsJSON(edges));
  } else {
    console.log(formatEdgeSuggestionsTable(edges, {
      longIds: flags.longIds,
      showComponents: true
    }));
  }
}
```

### 2. Core Layer (`src/core/*.ts`)

**Responsibilities:**
- Pure business logic
- Database queries
- Scoring computations
- Returns typed data structures

**Anti-patterns:**
- ❌ Any console.log
- ❌ Formatting (colors, tables)
- ❌ CLI flag parsing

**Example:**
```typescript
// src/core/edges.ts
export async function getTopSuggestionsCore(
  limit: number
): Promise<EdgeSuggestion[]> {
  const edges = await listEdges('suggested');
  const nodeMap = new Map((await listNodes()).map(n => [n.id, n]));

  return edges
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(edge => ({
      edge,
      sourceNode: nodeMap.get(edge.sourceId)!,
      targetNode: nodeMap.get(edge.targetId)!,
      components: (edge.metadata as any)?.components ??
                  computeScore(nodeMap.get(edge.sourceId)!, nodeMap.get(edge.targetId)!).components
    }));
}
```

### 3. Formatter Layer (`src/cli/formatters/*.ts`) **NEW!**

**Responsibilities:**
- Transform data into human-readable or JSON output
- Color theming and gradients
- Table/column layout
- Panel composition
- Progressive IDs, truncation

**Anti-patterns:**
- ❌ Database queries
- ❌ Business logic
- ❌ Direct console.log (return strings instead)

## Panel-Based Architecture

### Concept: Composable Output Sections

Commands often have multiple "panels" or sections:
- Header (title, instructions)
- Table (data rows)
- Footer (summary, stats)
- Metadata (filters, counts)

**Panel Pattern:**
```typescript
type Panel = {
  render(): string;
};

type PanelOptions = {
  showHeader?: boolean;
  colorScheme?: 'forest' | 'minimal';
  columnWidth?: number;
};
```

### Example: Edge Suggestions Panel

```typescript
// src/cli/formatters/panels.ts

export class EdgeSuggestionsPanel implements Panel {
  constructor(
    private suggestions: EdgeSuggestion[],
    private options: EdgeSuggestionsPanelOptions = {}
  ) {}

  render(): string {
    const sections = [];

    if (this.options.showHeader !== false) {
      sections.push(this.renderHeader());
    }

    sections.push(this.renderTable());

    if (this.options.showFooter) {
      sections.push(this.renderFooter());
    }

    return sections.filter(Boolean).join('\n');
  }

  private renderHeader(): string {
    return [
      'Top identified links sorted by aggregate score.',
      '/forest edges accept/reject [ref]',
      '',
      this.renderColumnHeaders()
    ].join('\n');
  }

  private renderColumnHeaders(): string {
    // Extract from current edges.ts:460-472
    const { makeHeaderColor } = useColors();
    return '◌ ' +
      chalk.grey('ref') + ' ' +
      makeHeaderColor(35)('ag') + ' ' +
      makeHeaderColor(120)('em') + ' ' +
      // ... etc
  }

  private renderTable(): string {
    return this.suggestions.map(s => this.renderRow(s)).join('\n');
  }

  private renderRow(suggestion: EdgeSuggestion): string {
    const { colorizeScore, colorNodeId } = useColors();
    // Extract from current edges.ts:510-545
    // ...
  }
}
```

## Color System

Extract the excellent HSL gradient system from `edges propose`:

```typescript
// src/cli/formatters/colors.ts

export type ColorTheme = {
  hue: number;        // Base hue (0-360)
  name: string;       // 'forest-green', 'amber', etc.
};

export const FOREST_THEMES = {
  aggregate: { hue: 35, name: 'amber-bark' },
  embedding: { hue: 120, name: 'forest-green' },
  token: { hue: 100, name: 'moss-lime' },
  title: { hue: 45, name: 'autumn-gold' },
  tag: { hue: 10, name: 'clay-rust' },
} as const;

/**
 * Convert HSL to RGB for chalk
 * (Extract from edges.ts:445-452)
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  // ... existing implementation
}

/**
 * Colorize score value with gradient heat map
 * (Extract from edges.ts:483-496)
 */
export function colorizeScore(value: number, hue: number): string {
  const formattedValue = formatScoreComponent(value);
  const t = Math.max(0, Math.min(1, value));

  const lightness = 20 + t * 50;
  const saturation = 25 + t * 45;

  const [r, g, b] = hslToRgb(hue, saturation, lightness);
  return chalk.rgb(r, g, b)(formattedValue);
}

/**
 * Color node IDs with subtle per-character variation
 * (Extract from edges.ts:499-508)
 */
export function colorNodeId(id: string, baseHue = 200): string {
  return id
    .split('')
    .map((char, i) => {
      const hueOffset = (i * 13) % 30;
      const [r, g, b] = hslToRgb(baseHue + hueOffset, 10, 65);
      return chalk.rgb(r, g, b)(char);
    })
    .join('');
}

/**
 * Make header color (slight hue twist)
 * (Extract from edges.ts:455-458)
 */
export function makeHeaderColor(hue: number) {
  const [r, g, b] = hslToRgb(hue + 10, 45, 40);
  return chalk.rgb(r, g, b);
}

// Convenience hook-style function
export function useColors() {
  return {
    hslToRgb,
    colorizeScore,
    colorNodeId,
    makeHeaderColor,
    themes: FOREST_THEMES,
  };
}
```

## Migration Strategy

### Phase 1: Extract Color Utilities (Do This First!)

1. Create `src/cli/formatters/colors.ts`
2. Extract all color functions from `edges.ts`
3. Update `edges.ts` to import from `colors.ts`
4. No behavior change - just code movement

**Files to change:**
- `src/cli/formatters/colors.ts` (new)
- `src/cli/commands/edges.ts` (import colors)

### Phase 2: Create Panel Abstraction

1. Create `src/cli/formatters/panels.ts` with base types
2. Extract `EdgeSuggestionsPanel` from `runEdgesPropose`
3. Update `runEdgesPropose` to use panel

**Files to change:**
- `src/cli/formatters/panels.ts` (new)
- `src/cli/formatters/edges.ts` (new - edge-specific panels)
- `src/cli/commands/edges.ts` (use panels)

### Phase 3: Core Layer Extraction

1. Create `src/core/edges.ts`
2. Move data-fetching logic from commands to core
3. Update commands to call core functions

**Files to change:**
- `src/core/edges.ts` (new)
- `src/cli/commands/edges.ts` (call core)

### Phase 4: Apply Pattern to Other Commands

1. Apply formatter pattern to `stats`, `search`, `explore`
2. Create shared table utilities if needed
3. Standardize JSON output format

## Benefits

1. **Reusability**: Color gradients can be used in `stats`, `search`, etc.
2. **Testability**: Format functions are pure (input → string)
3. **Consistency**: All commands use same theming
4. **Maintainability**: Change color scheme in one place
5. **Discoverability**: `formatters/` directory makes formatting obvious

## Guidelines for New Commands

When adding a new command:

1. **Core first**: Implement business logic in `src/core/`
2. **Format second**: Create formatter in `src/cli/formatters/`
3. **Command last**: Thin orchestration in `src/cli/commands/`
4. **Always support `--json`**: Use same data, different formatter

**Template:**
```typescript
// src/cli/commands/newcommand.ts
async function runNewCommand(flags: NewCommandFlags) {
  // 1. Get data
  const data = await getDataCore(flags);

  // 2. Format
  if (flags.json) {
    console.log(formatNewCommandJSON(data));
  } else {
    console.log(formatNewCommandTable(data, { longIds: flags.longIds }));
  }
}
```

## Open Questions

1. Should formatters return strings or directly console.log?
   - **Recommendation**: Return strings for testability

2. Should we use classes (Panel) or functions (formatEdgeTable)?
   - **Recommendation**: Functions for simple cases, classes for complex multi-panel output

3. How to handle progressive IDs in formatters?
   - **Recommendation**: Pass `allNodes` context to formatter, let it decide

4. JSON schema standardization?
   - **Recommendation**: Define types in `src/types/output.ts`

## Example: Before vs After

### Before (Current)
```typescript
// 146 lines of inline formatting in edges.ts:400-546
async function runEdgesPropose(flags: EdgesProposeFlags) {
  const edges = (await listEdges('suggested')).sort(...).slice(0, limit);
  // ... 100+ lines of color/formatting logic ...
  console.log(headerLine);
  edges.forEach(edge => {
    // ... complex inline formatting ...
    console.log(`${coloredCode} ${ag} ${em} ...`);
  });
}
```

### After (Proposed)
```typescript
// src/cli/commands/edges.ts (15 lines)
async function runEdgesPropose(flags: EdgesProposeFlags) {
  const suggestions = await getTopSuggestionsCore(flags.limit ?? 10);

  if (flags.json) {
    console.log(formatEdgeSuggestionsJSON(suggestions));
  } else {
    const panel = new EdgeSuggestionsPanel(suggestions, {
      longIds: flags.longIds,
      showHeader: true,
    });
    console.log(panel.render());
  }
}

// src/core/edges.ts (data logic)
export async function getTopSuggestionsCore(limit: number): Promise<EdgeSuggestion[]> {
  // Pure data fetching
}

// src/cli/formatters/edges.ts (presentation logic)
export class EdgeSuggestionsPanel {
  // 100+ lines of formatting, but now reusable!
}
```

## Next Steps

1. Start with Phase 1 (extract colors) - lowest risk, immediate reusability
2. Create one panel as proof-of-concept (EdgeSuggestionsPanel)
3. Gather feedback on API ergonomics
4. Apply pattern to 2-3 more commands
5. Standardize across all commands

---

**Status**: Proposed architecture (not yet implemented)
**Owner**: TBD
**Tracking**: Link to issue/PR when created
