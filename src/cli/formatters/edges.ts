import { EdgeRecord, NodeRecord } from '../../lib/db';
import { formatId, getEdgePrefix } from '../shared/utils';
import { colorize } from './colors';

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
    const dualScore = colorize.edgeDualScore(edge.semanticScore, edge.tagScore);
    const typeLabel = edge.edgeType && edge.edgeType !== 'semantic' ? `  type=${edge.edgeType}` : '';

    lines.push(
      `${indexLabel}. [${code}] ${edgeId}  ${dualScore}${typeLabel}  ${sourceLabel} ↔ ${targetLabel}`
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
