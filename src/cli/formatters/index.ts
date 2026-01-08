/**
 * Forest CLI Formatters
 *
 * Modular presentation layer for CLI commands
 *
 * This module provides reusable formatting utilities extracted from the
 * excellent design work in `forest edges propose`. All commands should
 * import formatters from this module for consistent theming.
 *
 * @example
 * import { colorize, formatEdgeSuggestionsTable } from '../formatters/index.js';
 *
 * // Use preset color functions
 * console.log(colorize.embeddingScore(0.85));
 * console.log(colorize.nodeId("7fa7acb2"));
 *
 * // Format complex tables
 * const output = formatEdgeSuggestionsTable(suggestions, { longIds: false });
 */

// Re-export color utilities
export {
  ACTIVE_SCHEME,
  COLOR_SCHEMES,
  hslToRgb,
  formatScoreComponent,
  colorizeScore,
  colorNodeId,
  makeHeaderColor,
  useColors,
  colorize,
} from './colors.js';

export type { ColorRole, ColorSchemeName } from './colors.js';

// Re-export edge formatters
export {
  formatEdgeSuggestionsTable,
  formatEdgeSuggestionsJSON,
  formatAcceptedEdgesTable,
  formatEdgeExplanation,
} from './edges.js';

// Re-export types
export type { EdgeSuggestion, EdgeSuggestionsTableOptions } from './edges.js';

// Markdown utilities
export { renderMarkdownToTerminal } from './markdown.js';
export type { MarkdownRenderOptions } from './markdown.js';
