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
 * import { colorize, formatEdgeSuggestionsTable } from '../formatters';
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
} from './colors';

export type { ColorRole, ColorSchemeName } from './colors';

// Re-export edge formatters
export {
  formatEdgeSuggestionsTable,
  formatEdgeSuggestionsJSON,
  formatAcceptedEdgesTable,
  formatEdgeExplanation,
} from './edges';

// Re-export types
export type { EdgeSuggestion, EdgeSuggestionsTableOptions } from './edges';
