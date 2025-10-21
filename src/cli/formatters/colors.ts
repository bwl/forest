import chalk from 'chalk';

import { loadConfig } from '../../lib/config';
import {
  COLOR_SCHEME_PRESETS,
  DEFAULT_COLOR_SCHEME,
  type ColorEntry,
  type ColorRole,
  type ColorSchemeDefinition,
  type ColorSchemeName,
} from '../../lib/color-schemes';

export type { ColorRole, ColorSchemeName } from '../../lib/color-schemes';

/**
 * HSL tuple representation used for derived palette values.
 */
type HslTuple = [number, number, number];

/**
 * Runtime-resolved color scheme with derived HSL metadata.
 */
interface ResolvedColorScheme {
  id: ColorSchemeName;
  label: string;
  description: string;
  colors: Record<ColorRole, ColorEntry>;
  hsl: Record<ColorRole, HslTuple>;
}

/**
 * Convert HSL to RGB for use with chalk.rgb().
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const length = normalized.length;
  if (Number.isNaN(bigint)) {
    return [255, 255, 255];
  }
  if (length === 6) {
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  }
  if (length === 3) {
    return [
      ((bigint >> 8) & 15) * 17,
      ((bigint >> 4) & 15) * 17,
      (bigint & 15) * 17,
    ];
  }
  return [255, 255, 255];
}

function rgbToHsl(r: number, g: number, b: number): HslTuple {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hexToHsl(hex: string): HslTuple {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function deriveHsl(definition: ColorSchemeDefinition): Record<ColorRole, HslTuple> {
  return Object.fromEntries(
    Object.entries(definition.colors).map(([role, entry]) => [role, hexToHsl(entry.hex)]),
  ) as Record<ColorRole, HslTuple>;
}

function resolveActiveColorScheme(): ResolvedColorScheme {
  const { colorScheme } = loadConfig();
  const schemeId = (colorScheme && colorScheme in COLOR_SCHEME_PRESETS
    ? colorScheme
    : DEFAULT_COLOR_SCHEME) as ColorSchemeName;
  const definition = COLOR_SCHEME_PRESETS[schemeId];
  return {
    id: schemeId,
    label: definition.label,
    description: definition.description,
    colors: definition.colors,
    hsl: deriveHsl(definition),
  };
}

const ACTIVE_COLOR_SCHEME = resolveActiveColorScheme();

function getRoleHue(role: ColorRole): number {
  return ACTIVE_COLOR_SCHEME.hsl[role][0];
}

function getRoleHsl(role: ColorRole): HslTuple {
  return ACTIVE_COLOR_SCHEME.hsl[role];
}

function getRoleHex(role: ColorRole): string {
  return ACTIVE_COLOR_SCHEME.colors[role].hex;
}

/**
 * Format score component as 2-digit integer (0-99 scale).
 */
export function formatScoreComponent(value: number): string {
  const scaled = Math.floor(value * 100);
  const clamped = clamp(scaled, 0, 99);
  return clamped.toString().padStart(2, '0');
}

/**
 * Colorize a score value using a gradient derived from the active scheme role.
 */
export function colorizeScore(value: number, role: ColorRole): string {
  const formattedValue = formatScoreComponent(value);
  const [, baseSaturation, baseLightness] = getRoleHsl(role);
  const hue = getRoleHue(role);

  const t = clamp(value, 0, 1);
  const saturation = clamp(baseSaturation * 0.4 + t * 45, 20, 90);
  const lightness = clamp(baseLightness * 0.4 + t * 45, 20, 80);

  const [r, g, b] = hslToRgb(hue, saturation, lightness);
  return chalk.rgb(r, g, b)(formattedValue);
}

/**
 * Color node IDs with subtle per-character hue variation.
 */
export function colorNodeId(id: string, role: ColorRole = 'neutral'): string {
  const hue = getRoleHue(role);
  const [, baseSaturation, baseLightness] = getRoleHsl(role);
  const saturation = clamp(baseSaturation * 0.35, 10, 35);
  const lightness = clamp(baseLightness + 10, 35, 75);

  return id
    .split('')
    .map((char, index) => {
      const hueOffset = (index * 13) % 30;
      const [r, g, b] = hslToRgb(hue + hueOffset, saturation, lightness);
      return chalk.rgb(r, g, b)(char);
    })
    .join('');
}

/**
 * Create colored text for table headers using a given role from the active scheme.
 */
export function makeHeaderColor(role: ColorRole) {
  const hue = getRoleHue(role);
  const [, baseSaturation, baseLightness] = getRoleHsl(role);
  const saturation = clamp(baseSaturation + 15, 25, 85);
  const lightness = clamp(baseLightness - 15, 25, 65);
  const [r, g, b] = hslToRgb(hue + 10, saturation, lightness);
  return chalk.rgb(r, g, b);
}

/**
 * Retrieve helper functions and the active scheme for consumers.
 */
export function useColors() {
  return {
    hslToRgb,
    formatScoreComponent,
    colorizeScore,
    colorNodeId,
    makeHeaderColor,
    scheme: ACTIVE_COLOR_SCHEME,
    themes: ACTIVE_COLOR_SCHEME,
    getColorHex: getRoleHex,
  };
}

/**
 * Export the resolved active color scheme for other modules.
 */
export const ACTIVE_SCHEME = ACTIVE_COLOR_SCHEME;

/**
 * Preset color functions for common use cases.
 */
export const colorize = {
  aggregateScore: (value: number) => colorizeScore(value, 'main'),
  embeddingScore: (value: number) => colorizeScore(value, 'accent'),
  tokenScore: (value: number) => colorizeScore(value, 'highlight'),
  titleScore: (value: number) => colorizeScore(value, 'emphasis'),
  tagScore: (value: number) => colorizeScore(value, 'warning'),
  edgeCode: (code: string) => chalk.hex(getRoleHex('info'))(code),
  nodeA: (text: string) => chalk.hex(getRoleHex('accent'))(text),
  nodeB: (text: string) => chalk.hex(getRoleHex('highlight'))(text),
  nodeId: (id: string) => colorNodeId(id, 'neutral'),
  grey: (text: string) => chalk.hex(getRoleHex('muted'))(text),
  tag: (tagName: string) => chalk.hex(getRoleHex('accent'))(tagName),
  count: (value: number, max: number) => {
    const ratio = max > 0 ? value / max : 0;
    return colorizeScore(ratio, 'main');
  },
  success: (text: string) => chalk.hex(getRoleHex('success'))(text),
  label: (text: string) => chalk.hex(getRoleHex('muted'))(text),
  bullet: (symbol: string) => chalk.hex(getRoleHex('success'))(symbol),
  info: (text: string) => chalk.hex(getRoleHex('info'))(text),
};

export const COLOR_SCHEMES = COLOR_SCHEME_PRESETS;
