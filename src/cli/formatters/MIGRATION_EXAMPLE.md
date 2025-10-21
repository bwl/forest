# Migration Example: Refactoring `runEdgesPropose`

This document shows the before/after for migrating `edges propose` to use the new formatter architecture.

## Before (Current - 146 lines in edges.ts)

```typescript
async function runEdgesPropose(flags: EdgesProposeFlags) {
  const limit =
    typeof flags.limit === 'number' && !Number.isNaN(flags.limit) && flags.limit > 0 ? flags.limit : 10;
  const edges = (await listEdges('suggested')).sort((a, b) => b.score - a.score).slice(0, limit);

  if (edges.length === 0) {
    console.log('No suggestions ready.');
    return;
  }

  const nodeMap = new Map((await listNodes()).map((node) => [node.id, node]));
  const longIds = Boolean(flags.longIds);
  const allEdges = await listEdges('all');

  if (flags.json) {
    console.log(
      JSON.stringify(
        edges.map((edge, index) => {
          const desc = describeSuggestion(edge, nodeMap, { longIds, allEdges });
          return {
            index: index + 1,
            id: edge.id,
            shortId: desc.shortId,
            code: desc.code,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            sourceTitle: desc.sourceTitle,
            targetTitle: desc.targetTitle,
            score: edge.score,
            metadata: edge.metadata,
          };
        }),
        null,
        2,
      ),
    );
    return;
  }

  // New header format
  console.log('Top identified links sorted by aggregate score.');
  console.log('/forest edges accept/reject [ref]');
  console.log('');

  // Helper to convert HSL to RGB (used for headers)
  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  };

  // Header styling
  const makeHeaderColor = (hue: number) => {
    const [r, g, b] = hslToRgb(hue + 10, 45, 40);
    return chalk.rgb(r, g, b);
  };

  const headerLine =
    '◌ ' +
    chalk.grey('ref') + ' ' +
    makeHeaderColor(35)('ag') + ' ' +
    makeHeaderColor(120)('em') + ' ' +
    makeHeaderColor(100)('tk') + ' ' +
    makeHeaderColor(45)('ti') + ' ' +
    makeHeaderColor(10)('tg') + '                                   ' +
    chalk.hex('#A8C5DD')('nodeA') +
    chalk.grey('::') +
    chalk.hex('#A8DDB5')('nodeB');

  console.log(headerLine);

  const MAX_DISPLAY_WIDTH = 100;
  const terminalWidth = Math.min(process.stdout.columns || 120, MAX_DISPLAY_WIDTH);

  const TITLE_A_WIDTH = 29;
  const TITLE_B_WIDTH = 29;

  // Helper to colorize score value based on magnitude (gradient heat map)
  const colorizeScore = (value: number, hue: number): string => {
    const formattedValue = formatScoreComponent(value);
    const t = Math.max(0, Math.min(1, value));
    const lightness = 20 + t * 50;
    const saturation = 25 + t * 45;
    const [r, g, b] = hslToRgb(hue, saturation, lightness);
    return chalk.rgb(r, g, b)(formattedValue);
  };

  // Helper to color node IDs with subtle per-character hue variation
  const colorNodeId = (id: string): string => {
    return id
      .split('')
      .map((char, i) => {
        const hueOffset = (i * 13) % 30;
        const [r, g, b] = hslToRgb(200 + hueOffset, 10, 65);
        return chalk.rgb(r, g, b)(char);
      })
      .join('');
  };

  edges.forEach((edge) => {
    const nodeA = nodeMap.get(edge.sourceId);
    const nodeB = nodeMap.get(edge.targetId);
    if (!nodeA || !nodeB) return;

    const components = (edge.metadata as any)?.components ?? computeScore(nodeA, nodeB).components;

    const ag = colorizeScore(edge.score, 35);
    const em = colorizeScore(components.embeddingSimilarity, 120);
    const tk = colorizeScore(components.tokenSimilarity, 100);
    const ti = colorizeScore(components.titleSimilarity, 45);
    const tg = colorizeScore(components.tagOverlap, 10);

    const code = getEdgePrefix(edge.sourceId, edge.targetId, allEdges).padEnd(5, ' ');
    const coloredCode = chalk.hex('#FF8C00')(code);

    const truncA = nodeA.title.length > TITLE_A_WIDTH
      ? nodeA.title.slice(0, TITLE_A_WIDTH - 1) + '…'
      : nodeA.title;
    const truncB = nodeB.title.length > TITLE_B_WIDTH
      ? nodeB.title.slice(0, TITLE_B_WIDTH - 1) + '…'
      : nodeB.title;

    const titleAPadded = truncA.padEnd(TITLE_A_WIDTH, ' ');

    const idA = colorNodeId(formatId(edge.sourceId));
    const idB = colorNodeId(formatId(edge.targetId));

    console.log(`${coloredCode} ${ag} ${em} ${tk} ${ti} ${tg}  ${titleAPadded} ${idA}${chalk.grey('::')}${idB} ${truncB}`);
  });
}
```

## After (Using New Formatters - ~40 lines)

```typescript
// Import the new formatters
import { formatEdgeSuggestionsTable, formatEdgeSuggestionsJSON } from '../formatters/edges';
import { getTopSuggestionsCore } from '../../core/edges';

async function runEdgesPropose(flags: EdgesProposeFlags) {
  const limit =
    typeof flags.limit === 'number' && !Number.isNaN(flags.limit) && flags.limit > 0 ? flags.limit : 10;

  // Get data from core layer
  const suggestions = await getTopSuggestionsCore(limit);

  if (suggestions.length === 0) {
    console.log('No suggestions ready.');
    return;
  }

  // Get all edges for progressive ID context
  const allEdges = await listEdges('all');
  const longIds = Boolean(flags.longIds);

  // Format and display
  if (flags.json) {
    console.log(formatEdgeSuggestionsJSON(suggestions));
  } else {
    console.log(formatEdgeSuggestionsTable(suggestions, {
      longIds,
      allEdges,
      showHeader: true,
    }));
  }
}
```

## New Core Function (src/core/edges.ts)

```typescript
import { listEdges, listNodes, EdgeRecord, NodeRecord } from '../lib/db';
import { computeScore } from '../lib/scoring';
import type { EdgeSuggestion } from '../cli/formatters/edges';

/**
 * Get top edge suggestions with enriched node data
 *
 * Pure business logic - fetches data, sorts by score, enriches with node details
 *
 * @param limit Maximum number of suggestions to return
 * @returns Array of edge suggestions with source/target nodes and score components
 */
export async function getTopSuggestionsCore(limit: number): Promise<EdgeSuggestion[]> {
  const edges = await listEdges('suggested');
  const nodeMap = new Map((await listNodes()).map(n => [n.id, n]));

  return edges
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(edge => {
      const sourceNode = nodeMap.get(edge.sourceId);
      const targetNode = nodeMap.get(edge.targetId);

      if (!sourceNode || !targetNode) {
        throw new Error(`Edge references missing nodes: ${edge.sourceId}, ${edge.targetId}`);
      }

      // Get or compute score components
      const components = (edge.metadata as any)?.components ??
                        computeScore(sourceNode, targetNode).components;

      return {
        edge,
        sourceNode,
        targetNode,
        components,
      };
    });
}
```

## Benefits of Refactoring

### 1. Separation of Concerns
- **Command layer**: Thin orchestration (parsing, error handling)
- **Core layer**: Business logic (data fetching, sorting)
- **Formatter layer**: Presentation (colors, tables)

### 2. Reusability
```typescript
// Can now use the same color system in other commands!
import { colorize } from '../formatters/colors';

// In stats.ts
console.log(`Score: ${colorize.embeddingScore(0.85)}`);

// In search.ts
console.log(`Match: ${colorize.nodeId(nodeId)}`);
```

### 3. Testability
```typescript
// Pure functions are easy to test
import { formatEdgeSuggestionsTable } from '../formatters/edges';

test('formats edge suggestions correctly', () => {
  const mockSuggestions = [/* ... */];
  const output = formatEdgeSuggestionsTable(mockSuggestions);
  expect(output).toContain('nodeA::nodeB');
});
```

### 4. Maintainability
- Change color scheme? Edit `formatters/colors.ts` once
- All commands get the update automatically
- No duplicated formatting logic

### 5. Discoverability
```
src/cli/formatters/
├── colors.ts      ← "Where are color utilities?"
├── edges.ts       ← "How to format edges?"
└── table.ts       ← "How to format tables?"
```

## Migration Checklist

To migrate a command to the new architecture:

- [ ] Extract data fetching to `src/core/*.ts`
- [ ] Create formatter in `src/cli/formatters/*.ts`
- [ ] Update command to call core + formatter
- [ ] Test both `--json` and text output
- [ ] Verify colors/formatting unchanged
- [ ] Update tests to use core functions

## Phase 1 Complete: Color Utilities Extracted ✅

The color utilities from `edges propose` are now available in:
- `src/cli/formatters/colors.ts` (utilities)
- `src/cli/formatters/edges.ts` (edge-specific formatters)

Other commands can now import and use these utilities!

## Next Steps

1. **Phase 2**: Create core function `getTopSuggestionsCore()` in `src/core/edges.ts`
2. **Phase 3**: Refactor `runEdgesPropose()` to use new formatter
3. **Phase 4**: Apply pattern to other edge commands (accept, reject, explain)
4. **Phase 5**: Apply pattern to stats, search, explore commands
5. **Phase 6**: Create generic table utilities for common patterns
