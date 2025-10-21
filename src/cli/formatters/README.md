# Forest CLI Formatters

**Status**: ✅ Phase 1 Complete - Color utilities extracted and ready to use

This directory contains the modular formatting system for Forest CLI, extracted from the excellent design work in `forest edges propose`.

## What's Here

- **`colors.ts`** - Reusable color system (HSL gradients, themes, utilities)
- **`edges.ts`** - Edge-specific table formatters
- **`index.ts`** - Clean public API for imports
- **`MIGRATION_EXAMPLE.md`** - Before/after refactoring examples

## Quick Start

```typescript
// Use colors in any command
import { colorize } from '../formatters';

console.log(colorize.embeddingScore(0.85));  // Green gradient
console.log(colorize.nodeId("7fa7acb2"));    // Subtle grey with variation
console.log(colorize.edgeCode("0L5a"));      // Dark orange
```

## Available Utilities

### Color Presets (`colorize.*`)

- `colorize.aggregateScore(value)` - Amber/bark brown gradient
- `colorize.embeddingScore(value)` - Forest green gradient
- `colorize.tokenScore(value)` - Moss/lime green gradient
- `colorize.titleScore(value)` - Autumn gold/yellow gradient
- `colorize.tagScore(value)` - Clay red/rust gradient
- `colorize.edgeCode(code)` - Dark orange for edge refs
- `colorize.nodeId(id)` - Subtle grey with per-char variation
- `colorize.nodeA(text)` - Sky blue
- `colorize.nodeB(text)` - Sage green
- `colorize.grey(text)` - Grey for delimiters

### Low-Level Utilities

- `hslToRgb(h, s, l)` - Convert HSL to RGB for chalk
- `colorizeScore(value, hue)` - Custom gradient heat map
- `colorNodeId(id, baseHue)` - Custom node ID coloring
- `makeHeaderColor(hue)` - Header styling

### Edge Formatters

- `formatEdgeSuggestionsTable(suggestions, options)` - Beautiful table with scores
- `formatEdgeSuggestionsJSON(suggestions)` - JSON output
- `formatAcceptedEdgesTable(edges, nodeMap, options)` - Accepted edges list
- `formatEdgeExplanation(edge, components, code, options)` - Score breakdown

## Design Principles

1. **Reusability** - Extract once, use everywhere
2. **Purity** - Functions return strings (no side effects)
3. **Consistency** - All commands use same color palette
4. **Composability** - Build complex output from simple panels

## Example Usage

### Adding Color to Search Results

```typescript
// src/cli/commands/search.ts
import { colorize } from '../formatters';

for (const item of result.nodes) {
  const score = colorize.embeddingScore(item.similarity);
  const id = colorize.nodeId(formatNodeId(item.node.id));
  console.log(`${score} ${id} ${item.node.title}`);
}
```

### Using Edge Formatters

```typescript
// src/cli/commands/edges.ts
import { formatEdgeSuggestionsTable } from '../formatters';

const suggestions = await getTopSuggestionsCore(limit);
console.log(formatEdgeSuggestionsTable(suggestions, {
  longIds: flags.longIds,
  showHeader: true,
}));
```

## Next Steps

See the root-level documentation for full migration guide:

1. **`MODULAR_COMMANDS_GUIDE.md`** - How to move forward (phased approach)
2. **`FORMATTING_ARCHITECTURE.md`** - Full architectural specification
3. **`MIGRATION_EXAMPLE.md`** - Concrete before/after examples

## Color Theme

Forest uses a natural color palette inspired by forests:

- **Aggregate (amber/bark)**: hue 35 - Overall score
- **Embedding (forest green)**: hue 120 - Semantic similarity
- **Token (moss/lime)**: hue 100 - Lexical similarity
- **Title (autumn gold)**: hue 45 - Title matching
- **Tag (clay/rust)**: hue 10 - Tag overlap
- **Node A (sky blue)**: #A8C5DD
- **Node B (sage green)**: #A8DDB5
- **Edge code (dark orange)**: #FF8C00

All colors use gradient heat maps: darker = lower values, brighter = higher values.

## Installation Note

⚠️ **Dependencies Required**: This module uses `chalk` for terminal colors.

Add to `package.json`:
```json
{
  "dependencies": {
    "chalk": "^4.1.2",
    "@clack/prompts": "^0.7.0"
  }
}
```

Then run: `npm install`

## Status

- ✅ Phase 1: Color utilities extracted
- ⏳ Phase 2: Create core functions (next step)
- ⏳ Phase 3: Migrate edge commands
- ⏳ Phase 4: Apply to other commands
- ⏳ Phase 5: Generic table utilities

Ready to use immediately! See guides for systematic migration.
