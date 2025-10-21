import { EdgeRecord, NodeRecord } from '../../lib/db';
import { formatId, getEdgePrefix } from '../shared/utils';
import { colorize, makeHeaderColor, useColors } from './colors';

/**
 * Edge suggestion with enriched node data
 */
export type EdgeSuggestion = {
  edge: EdgeRecord;
  sourceNode: NodeRecord;
  targetNode: NodeRecord;
  components: {
    embeddingSimilarity: number;
    tokenSimilarity: number;
    titleSimilarity: number;
    tagOverlap: number;
  };
};

/**
 * Options for formatting edge suggestions table
 */
export type EdgeSuggestionsTableOptions = {
  longIds?: boolean;
  allEdges?: EdgeRecord[];
  showHeader?: boolean;
  maxTitleWidth?: number;
};

/**
 * Format edge suggestions as a colorful table
 *
 * Uses the active color scheme for score components:
 * - ag (aggregate): main role
 * - em (embedding): accent role
 * - tk (token): highlight role
 * - ti (title): emphasis role
 * - tg (tag): warning role
 *
 * @param suggestions Array of edge suggestions with node data
 * @param options Formatting options
 * @returns Formatted table string ready for console output
 */
export function formatEdgeSuggestionsTable(
  suggestions: EdgeSuggestion[],
  options: EdgeSuggestionsTableOptions = {}
): string {
  const {
    longIds = false,
    allEdges = [],
    showHeader = true,
    maxTitleWidth = 29,
  } = options;

  const sections: string[] = [];

  // 1. Header section
  if (showHeader) {
    sections.push(formatEdgeSuggestionsHeader());
    sections.push('');
  }

  // 2. Table rows
  const rows = suggestions.map(suggestion =>
    formatEdgeSuggestionRow(suggestion, { longIds, allEdges, maxTitleWidth })
  );
  sections.push(...rows);

  return sections.join('\n');
}

/**
 * Format header section with instructions and column labels
 */
function formatEdgeSuggestionsHeader(): string {
  const lines = [
    'Top identified links sorted by aggregate score.',
    '/forest edges accept/reject [ref]',
    '',
    formatEdgeSuggestionsColumnHeader(),
  ];
  return lines.join('\n');
}

/**
 * Format column header with color-coded score components
 */
function formatEdgeSuggestionsColumnHeader(): string {
  return (
    '◌ ' +
    colorize.label('ref') + ' ' +
    makeHeaderColor('main')('ag') + ' ' +
    makeHeaderColor('accent')('em') + ' ' +
    makeHeaderColor('highlight')('tk') + ' ' +
    makeHeaderColor('emphasis')('ti') + ' ' +
    makeHeaderColor('warning')('tg') + '                                   ' +
    colorize.nodeA('nodeA') +
    colorize.grey('::') +
    colorize.nodeB('nodeB')
  );
}

/**
 * Format a single edge suggestion row with colored scores and truncated titles
 */
function formatEdgeSuggestionRow(
  suggestion: EdgeSuggestion,
  options: { longIds: boolean; allEdges: EdgeRecord[]; maxTitleWidth: number }
): string {
  const { edge, sourceNode, targetNode, components } = suggestion;
  const { longIds, allEdges, maxTitleWidth } = options;

  // Format score columns with distinct forest hues
  const ag = colorize.aggregateScore(edge.score);
  const em = colorize.embeddingScore(components.embeddingSimilarity);
  const tk = colorize.tokenScore(components.tokenSimilarity);
  const ti = colorize.titleScore(components.titleSimilarity);
  const tg = colorize.tagScore(components.tagOverlap);

  // Get edge code and pad to 5 chars
  const code = getEdgePrefix(edge.sourceId, edge.targetId, allEdges).padEnd(5, ' ');
  const coloredCode = colorize.edgeCode(code);

  // Truncate titles to fixed width
  const truncA = truncateTitle(sourceNode.title, maxTitleWidth);
  const truncB = truncateTitle(targetNode.title, maxTitleWidth);

  // Pad titleA for perfect :: alignment
  const titleAPadded = truncA.padEnd(maxTitleWidth, ' ');

  // Format node IDs
  const idA = colorize.nodeId(formatId(edge.sourceId, { long: longIds }));
  const idB = colorize.nodeId(formatId(edge.targetId, { long: longIds }));

  return `${coloredCode} ${ag} ${em} ${tk} ${ti} ${tg}  ${titleAPadded} ${idA}${colorize.grey('::')}${idB} ${truncB}`;
}

/**
 * Truncate title to max width with ellipsis
 */
function truncateTitle(title: string, maxWidth: number): string {
  if (title.length > maxWidth) {
    return title.slice(0, maxWidth - 1) + '…';
  }
  return title;
}

/**
 * Format edge suggestions as JSON
 */
export function formatEdgeSuggestionsJSON(suggestions: EdgeSuggestion[]): string {
  return JSON.stringify(
    suggestions.map((suggestion, index) => ({
      index: index + 1,
      id: suggestion.edge.id,
      shortId: formatId(suggestion.edge.sourceId) + '::' + formatId(suggestion.edge.targetId),
      code: getEdgePrefix(suggestion.edge.sourceId, suggestion.edge.targetId, []),
      sourceId: suggestion.edge.sourceId,
      targetId: suggestion.edge.targetId,
      sourceTitle: suggestion.sourceNode.title,
      targetTitle: suggestion.targetNode.title,
      score: suggestion.edge.score,
      metadata: suggestion.edge.metadata,
    })),
    null,
    2
  );
}

/**
 * Format a list of accepted edges (for `forest edges` command)
 */
export function formatAcceptedEdgesTable(
  edges: EdgeRecord[],
  nodeMap: Map<string, NodeRecord>,
  options: { longIds?: boolean; allEdges?: EdgeRecord[] } = {}
): string {
  const { longIds = false, allEdges = [] } = options;

  if (edges.length === 0) {
    return 'No accepted edges found.';
  }

  const lines = [`Recent accepted edges (${edges.length}):`];

  edges.forEach((edge, index) => {
    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);
    if (!sourceNode || !targetNode) return;

    const indexLabel = String(index + 1).padStart(2, ' ');
    const code = getEdgePrefix(edge.sourceId, edge.targetId, allEdges);
    const edgeId = formatId(edge.sourceId, { long: longIds }) + '::' + formatId(edge.targetId, { long: longIds });
    const sourceLabel = sourceNode.title;
    const targetLabel = targetNode.title;

    lines.push(
      `${indexLabel}. [${code}] ${edgeId}  score=${edge.score.toFixed(3)}  ${sourceLabel} ↔ ${targetLabel}`
    );
  });

  return lines.join('\n');
}

/**
 * Format edge explanation (for `forest edges explain` command)
 */
export function formatEdgeExplanation(
  edge: EdgeRecord,
  components: {
    embeddingSimilarity: number;
    tokenSimilarity: number;
    titleSimilarity: number;
    tagOverlap: number;
  },
  code: string,
  options: { longIds?: boolean } = {}
): string {
  const { longIds = false } = options;

  const lines = [
    `${formatId(edge.sourceId, { long: longIds })}::${formatId(edge.targetId, { long: longIds })} [${code}]  status=${edge.status}  score=${edge.score.toFixed(3)}`,
    'components:',
  ];

  for (const [key, value] of Object.entries(components)) {
    if (typeof value === 'number') {
      lines.push(`  ${key}: ${value.toFixed(3)}`);
    } else {
      lines.push(`  ${key}: ${String(value)}`);
    }
  }

  return lines.join('\n');
}
