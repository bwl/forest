# Forest CLI Styling Techniques

This document captures the styling patterns and techniques used in Forest's command-line interface, particularly the visual scoring matrix introduced in `forest edges propose`.

## Core Principles

1. **Forest-Inspired Palette**: Use earth tones and natural hues (amber, moss, bark, rust, clay)
2. **Information Density**: Pack meaningful data into compact displays without overwhelming
3. **Progressive Enhancement**: Graceful degradation for non-color terminals
4. **Consistent Alignment**: Fixed-width columns for predictable layout
5. **Semantic Color**: Color conveys meaning (gradients show magnitude, distinct hues show categories)

## Color System

### Chalk Integration

Forest uses `chalk` for terminal styling. Key patterns:

```typescript
import chalk from 'chalk';

// Direct hex colors for precise control
chalk.hex('#FF8C00')('text');

// RGB for programmatic generation
chalk.rgb(r, g, b)('text');

// Predefined colors for common elements
chalk.grey('separator');
```

### HSL Color Generation

For gradient effects and programmatic color generation, convert HSL to RGB:

```typescript
const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
};
```

**Usage**: `hslToRgb(hue, saturation, lightness)` returns `[r, g, b]` suitable for `chalk.rgb()`.

### Forest Hue Palette

Scoring components use distinct hues for visual differentiation:

| Component | Hue | Color Family | Semantic Meaning |
|-----------|-----|--------------|------------------|
| Aggregate | 35° | Amber/bark brown | Overall/summary |
| Embedding | 120° | Forest green | Semantic similarity |
| Token | 100° | Moss/lime green | Lexical similarity |
| Title | 45° | Autumn gold/yellow | Structural similarity |
| Tag | 10° | Clay red/rust | Categorical overlap |

## Gradient Heat Maps

The visual scoring matrix uses gradients to show value magnitude:

```typescript
const colorizeScore = (value: number, hue: number): string => {
  const formattedValue = formatScoreComponent(value);

  // Normalize to [0, 1]
  const t = Math.max(0, Math.min(1, value));

  // Interpolate lightness (20% dark → 70% bright)
  const lightness = 20 + t * 50;

  // Interpolate saturation (25% muted → 70% vibrant)
  const saturation = 25 + t * 45;

  const [r, g, b] = hslToRgb(hue, saturation, lightness);
  return chalk.rgb(r, g, b)(formattedValue);
};
```

**Effect**: Low values appear dark and muted, high values appear bright and vibrant, creating an intuitive visual hierarchy.

## Layout Techniques

### Fixed-Width Columns

Prevent alignment issues by using fixed widths:

```typescript
const TITLE_A_WIDTH = 29;
const TITLE_B_WIDTH = 29;

// Pad to fixed width
const titleAPadded = truncA.padEnd(TITLE_A_WIDTH, ' ');
```

**Benefit**: Perfect alignment under headers regardless of content length.

### Terminal Width Management

Cap maximum width to prevent excessive gaps on ultra-wide displays:

```typescript
const MAX_DISPLAY_WIDTH = 100;
const terminalWidth = Math.min(process.stdout.columns || 120, MAX_DISPLAY_WIDTH);
```

### Truncation Strategy

Simple end truncation with ellipsis:

```typescript
const truncA = nodeA.title.length > TITLE_A_WIDTH
  ? nodeA.title.slice(0, TITLE_A_WIDTH - 1) + '…'
  : nodeA.title;
```

**Alternative considered**: Balanced truncation (split available space proportionally), but added complexity without clear UX benefit.

## Subtle Color Variations

### Per-Character Hue Variation

Add visual texture to repetitive elements (like node IDs) without overwhelming:

```typescript
const colorNodeId = (id: string): string => {
  return id
    .split('')
    .map((char, i) => {
      const hueOffset = (i * 13) % 30;  // Subtle variation
      const [r, g, b] = hslToRgb(200 + hueOffset, 10, 65);  // Low saturation
      return chalk.rgb(r, g, b)(char);
    })
    .join('');
};
```

**Effect**: IDs feel less monolithic, easier to visually scan, but remain readable.

## Header Styling

Headers use muted versions of component colors for visual hierarchy:

```typescript
const makeHeaderColor = (hue: number) => {
  const [r, g, b] = hslToRgb(hue + 10, 45, 40);  // Muted: 40% brightness
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
```

**Techniques**:
- **Hue twist** (+10°): Prevents exact color match between header and data
- **Reduced brightness** (40%): Headers recede, data pops
- **Grey separators**: Neutral connectors (`::`, `ref`)
- **Distinct node colors**: Light blue and light green for A/B distinction

## Score Formatting

Convert floating-point scores (0.0–1.0) to 2-digit integers (0–99) for compactness:

```typescript
function formatScoreComponent(value: number): string {
  const scaled = Math.floor(value * 100);
  const clamped = Math.max(0, Math.min(99, scaled));
  return clamped.toString().padStart(2, '0');
}
```

**Rationale**:
- Saves space (2 chars vs 5+ for "0.857")
- Intuitive "percentage" mental model
- Fixed width simplifies alignment

## Example Output

```
Top identified links sorted by aggregate score.
/forest edges accept/reject [ref]

◌ ref ag em tk ti tg                                   nodeA::nodeB
0L5a  87 92 78 45 23  Understanding graph traversal  8f3a2b1c::a4d9e7f2 Pathfinding algorithms
3M9k  82 88 71 52 19  Neural network basics         2c5e8f3d::9a1b4c7e Deep learning overview
...
```

Colors (not visible in markdown):
- **ref**: Orange (`#FF8C00`)
- **ag/em/tk/ti/tg**: Gradient heat maps in forest hues
- **Node IDs**: Subtle per-char hue variation (grey-blue)
- **Separator** (`::`): Grey
- **Titles**: White (default terminal text)

## Accessibility Considerations

1. **No color-only information**: Score values are always displayed as numbers, color is enhancement
2. **High contrast gradients**: 20%–70% lightness range ensures readability
3. **Monospace assumption**: Fixed-width layout assumes terminal monospace font
4. **Graceful degradation**: Output remains usable without color support

## Future Enhancements

Potential improvements for future consideration:

1. **Terminal color detection**: Check `$TERM` or `chalk.supportsColor` to disable colors in limited environments
2. **Theme support**: Allow users to customize hue palette via env vars or config
3. **Compact mode**: Flag to disable colors for parsing/scripting (e.g., `--no-color`, `--plain`)
4. **Progress indicators**: Animated spinners or progress bars for long operations
5. **Interactive selection**: Use `inquirer` or similar for TUI-style navigation

## Related Files

- `src/cli/commands/edges.ts` - Primary implementation of visual scoring matrix
- `src/lib/scoring.ts` - Score computation (provides components to display)
- `package.json` - Dependencies: `chalk` for terminal styling

## References

- [Chalk documentation](https://github.com/chalk/chalk)
- [ANSI color codes](https://en.wikipedia.org/wiki/ANSI_escape_code#Colors)
- [HSL color model](https://en.wikipedia.org/wiki/HSL_and_HSV)
- [Terminal color capabilities](https://github.com/termstandard/colors)
