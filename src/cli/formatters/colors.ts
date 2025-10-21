import chalk from 'chalk';

/**
 * Color themes for Forest CLI - inspired by natural forest hues
 */
export const FOREST_THEMES = {
  aggregate: { hue: 35, name: 'amber-bark' },
  embedding: { hue: 120, name: 'forest-green' },
  token: { hue: 100, name: 'moss-lime' },
  title: { hue: 45, name: 'autumn-gold' },
  tag: { hue: 10, name: 'clay-rust' },
  nodeA: { hex: '#A8C5DD', name: 'sky-blue' },
  nodeB: { hex: '#A8DDB5', name: 'sage-green' },
  edgeCode: { hex: '#FF8C00', name: 'dark-orange' },
} as const;

/**
 * Convert HSL to RGB for use with chalk.rgb()
 *
 * Extracted from edges.ts - enables gradient heat maps and theme variations
 *
 * @param h Hue (0-360)
 * @param s Saturation (0-100)
 * @param l Lightness (0-100)
 * @returns RGB tuple [r, g, b] where each value is 0-255
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

/**
 * Format score component as 2-digit integer (0-99 scale)
 *
 * Used for compact display of score components in tables
 */
export function formatScoreComponent(value: number): string {
  const scaled = Math.floor(value * 100);
  const clamped = Math.max(0, Math.min(99, scaled));
  return clamped.toString().padStart(2, '0');
}

/**
 * Colorize a score value using gradient heat map
 *
 * Maps score (0.0 to 1.0) to color gradient:
 * - Low scores (0.0): Dark, muted colors (low lightness/saturation)
 * - High scores (1.0): Bright, vibrant colors (high lightness/saturation)
 *
 * @param value Score value (0.0 to 1.0)
 * @param hue Base hue for the color (0-360)
 * @returns Colored string with formatted score (00-99)
 *
 * @example
 * colorizeScore(0.85, FOREST_THEMES.embedding.hue) // bright green "85"
 * colorizeScore(0.23, FOREST_THEMES.token.hue)     // dark moss "23"
 */
export function colorizeScore(value: number, hue: number): string {
  const formattedValue = formatScoreComponent(value);

  // Gradient from dark (low) to bright (high)
  // HSL interpolation: consistent hue, varying lightness & saturation
  const t = Math.max(0, Math.min(1, value)); // Clamp to [0, 1]

  // Dark muted -> bright vibrant
  const lightness = 20 + t * 50;  // 20% to 70%
  const saturation = 25 + t * 45; // 25% to 70%

  const [r, g, b] = hslToRgb(hue, saturation, lightness);
  return chalk.rgb(r, g, b)(formattedValue);
}

/**
 * Color node IDs with subtle per-character hue variation
 *
 * Creates visual interest while maintaining readability by applying
 * slight hue shifts to each character
 *
 * @param id Node ID string (e.g., "7fa7acb2")
 * @param baseHue Base hue for the color palette (default: 200 = light grey-blue)
 * @returns Colored string with subtle per-character variation
 *
 * @example
 * colorNodeId("7fa7acb2") // Light grey with subtle hue shifts
 */
export function colorNodeId(id: string, baseHue = 200): string {
  return id
    .split('')
    .map((char, i) => {
      const hueOffset = (i * 13) % 30;  // Subtle variation
      const [r, g, b] = hslToRgb(baseHue + hueOffset, 10, 65);  // Light grey with slight hue shift
      return chalk.rgb(r, g, b)(char);
    })
    .join('');
}

/**
 * Create colored text for table headers
 *
 * Applies slight hue twist (+10°) and fixed lightness/saturation
 * for consistent header styling
 *
 * @param hue Base hue for the header (0-360)
 * @returns Chalk color function
 *
 * @example
 * const headerColor = makeHeaderColor(FOREST_THEMES.embedding.hue);
 * console.log(headerColor('em')); // Forest green "em" header
 */
export function makeHeaderColor(hue: number) {
  const [r, g, b] = hslToRgb(hue + 10, 45, 40);  // 40% brightness, hue twist +10°
  return chalk.rgb(r, g, b);
}

/**
 * Convenience object providing all color utilities
 *
 * Use this for easy access to all color functions and themes:
 *
 * @example
 * const { colorizeScore, themes } = useColors();
 * const scoreText = colorizeScore(0.85, themes.embedding.hue);
 */
export function useColors() {
  return {
    hslToRgb,
    formatScoreComponent,
    colorizeScore,
    colorNodeId,
    makeHeaderColor,
    themes: FOREST_THEMES,
  };
}

/**
 * Preset color functions for common use cases
 */
export const colorize = {
  /**
   * Color an aggregate score with amber/bark brown gradient
   */
  aggregateScore: (value: number) => colorizeScore(value, FOREST_THEMES.aggregate.hue),

  /**
   * Color an embedding similarity score with forest green gradient
   */
  embeddingScore: (value: number) => colorizeScore(value, FOREST_THEMES.embedding.hue),

  /**
   * Color a token similarity score with moss/lime green gradient
   */
  tokenScore: (value: number) => colorizeScore(value, FOREST_THEMES.token.hue),

  /**
   * Color a title similarity score with autumn gold/yellow gradient
   */
  titleScore: (value: number) => colorizeScore(value, FOREST_THEMES.title.hue),

  /**
   * Color a tag overlap score with clay red/rust gradient
   */
  tagScore: (value: number) => colorizeScore(value, FOREST_THEMES.tag.hue),

  /**
   * Color an edge reference code (progressive ID) in dark orange
   */
  edgeCode: (code: string) => chalk.hex(FOREST_THEMES.edgeCode.hex)(code),

  /**
   * Color nodeA identifier in sky blue
   */
  nodeA: (text: string) => chalk.hex(FOREST_THEMES.nodeA.hex)(text),

  /**
   * Color nodeB identifier in sage green
   */
  nodeB: (text: string) => chalk.hex(FOREST_THEMES.nodeB.hex)(text),

  /**
   * Color a node ID with default grey-blue subtle variation
   */
  nodeId: (id: string) => colorNodeId(id),

  /**
   * Color grey text (for delimiters, secondary info)
   */
  grey: (text: string) => chalk.grey(text),

  /**
   * Color tag names with forest green
   */
  tag: (tagName: string) => chalk.hex('#4A7856')(tagName),

  /**
   * Color counts/numbers with amber gradient based on ratio to max
   */
  count: (value: number, max: number) => {
    const ratio = max > 0 ? value / max : 0;
    return colorizeScore(ratio, FOREST_THEMES.aggregate.hue);
  },

  /**
   * Color success messages/checkmarks in forest green
   */
  success: (text: string) => chalk.hex('#2D5F3F')(text),

  /**
   * Color metadata labels in muted grey
   */
  label: (text: string) => chalk.hex('#6B7280')(text),

  /**
   * Color checkmarks and bullets in forest green
   */
  bullet: (symbol: string) => chalk.hex('#4A7856')(symbol),
};
