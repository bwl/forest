export const COLOR_ROLES = [
  'main',
  'accent',
  'highlight',
  'emphasis',
  'neutral',
  'muted',
  'success',
  'warning',
  'info',
] as const;

export type ColorRole = (typeof COLOR_ROLES)[number];

export type ColorSchemeName =
  | 'forest'
  | 'catppuccin-mocha'
  | 'dracula'
  | 'nord'
  | 'gruvbox-dark'
  | 'solarized-dark';

export interface ColorEntry {
  hex: string;
  name: string;
}

export interface ColorSchemeDefinition {
  label: string;
  description: string;
  colors: Record<ColorRole, ColorEntry>;
}

export const COLOR_SCHEME_PRESETS: Record<ColorSchemeName, ColorSchemeDefinition> = {
  forest: {
    label: 'Forest',
    description: 'Original Forest CLI palette inspired by autumn woods',
    colors: {
      main: { hex: '#d3893b', name: 'amber-bark' },
      accent: { hex: '#4a7856', name: 'forest-pine' },
      highlight: { hex: '#a8ddb5', name: 'sage-moss' },
      emphasis: { hex: '#e3a652', name: 'autumn-gold' },
      neutral: { hex: '#a8c5dd', name: 'misty-sky' },
      muted: { hex: '#4b5a62', name: 'shadow-fir' },
      success: { hex: '#7fb069', name: 'spruce-tip' },
      warning: { hex: '#c75f3c', name: 'clay-rust' },
      info: { hex: '#ff8c00', name: 'ember-glow' },
    },
  },
  'catppuccin-mocha': {
    label: 'Catppuccin (Mocha)',
    description: 'Dreamy pastels with cozy contrast',
    colors: {
      main: { hex: '#b4befe', name: 'lavender' },
      accent: { hex: '#f5c2e7', name: 'pink' },
      highlight: { hex: '#94e2d5', name: 'teal' },
      emphasis: { hex: '#f38ba8', name: 'rosewater' },
      neutral: { hex: '#cdd6f4', name: 'text' },
      muted: { hex: '#9399b2', name: 'subtext' },
      success: { hex: '#a6e3a1', name: 'green' },
      warning: { hex: '#f9e2af', name: 'peach' },
      info: { hex: '#89dceb', name: 'sky' },
    },
  },
  dracula: {
    label: 'Dracula',
    description: 'Bold neon lights on midnight base',
    colors: {
      main: { hex: '#bd93f9', name: 'purple' },
      accent: { hex: '#ff79c6', name: 'pink' },
      highlight: { hex: '#50fa7b', name: 'green' },
      emphasis: { hex: '#ffb86c', name: 'orange' },
      neutral: { hex: '#f8f8f2', name: 'text' },
      muted: { hex: '#6272a4', name: 'comment' },
      success: { hex: '#50fa7b', name: 'green' },
      warning: { hex: '#ffb86c', name: 'orange' },
      info: { hex: '#8be9fd', name: 'cyan' },
    },
  },
  nord: {
    label: 'Nord',
    description: 'Arctic blues with warm aurora accents',
    colors: {
      main: { hex: '#88c0d0', name: 'frost' },
      accent: { hex: '#a3be8c', name: 'aurora-green' },
      highlight: { hex: '#b48ead', name: 'aurora-purple' },
      emphasis: { hex: '#ebcb8b', name: 'aurora-gold' },
      neutral: { hex: '#eceff4', name: 'snow' },
      muted: { hex: '#4c566a', name: 'frost-muted' },
      success: { hex: '#a3be8c', name: 'aurora-green' },
      warning: { hex: '#d08770', name: 'aurora-orange' },
      info: { hex: '#81a1c1', name: 'frost-blue' },
    },
  },
  'gruvbox-dark': {
    label: 'Gruvbox (Dark)',
    description: 'Rustic warmth with vintage vibes',
    colors: {
      main: { hex: '#d3869b', name: 'purple' },
      accent: { hex: '#83a598', name: 'aqua' },
      highlight: { hex: '#b8bb26', name: 'green' },
      emphasis: { hex: '#fabd2f', name: 'yellow' },
      neutral: { hex: '#ebdbb2', name: 'light-text' },
      muted: { hex: '#928374', name: 'muted' },
      success: { hex: '#b8bb26', name: 'green' },
      warning: { hex: '#fe8019', name: 'orange' },
      info: { hex: '#83a598', name: 'aqua' },
    },
  },
  'solarized-dark': {
    label: 'Solarized (Dark)',
    description: 'Classic solar spectrum for balanced contrast',
    colors: {
      main: { hex: '#268bd2', name: 'blue' },
      accent: { hex: '#6c71c4', name: 'violet' },
      highlight: { hex: '#2aa198', name: 'cyan' },
      emphasis: { hex: '#b58900', name: 'yellow' },
      neutral: { hex: '#eee8d5', name: 'base2' },
      muted: { hex: '#839496', name: 'base0' },
      success: { hex: '#859900', name: 'green' },
      warning: { hex: '#cb4b16', name: 'orange' },
      info: { hex: '#268bd2', name: 'blue' },
    },
  },
};

export const DEFAULT_COLOR_SCHEME: ColorSchemeName = 'forest';

export function isColorSchemeName(value: unknown): value is ColorSchemeName {
  return typeof value === 'string' && value in COLOR_SCHEME_PRESETS;
}

export function listColorSchemes(): Array<{ value: ColorSchemeName; label: string; description: string }> {
  return Object.entries(COLOR_SCHEME_PRESETS).map(([value, scheme]) => ({
    value: value as ColorSchemeName,
    label: scheme.label,
    description: scheme.description,
  }));
}
