import { EdgeRecord, NodeRecord, getNodeById, listEdgeEvents, listEdges } from '../../lib/db';
import { normalizeEdgePair } from '../../lib/scoring';
import { edgeShortCode, formatId, isShortId, resolveByIdPrefix } from './utils';

export type SuggestionDescription = {
  edgeId: string;
  shortId: string;
  code: string;
  sourceLabel: string;
  targetLabel: string;
  sourceTitle: string | null;
  targetTitle: string | null;
};

export function describeSuggestion(
  edge: EdgeRecord,
  nodeMap: Map<string, NodeRecord>,
  options: { longIds?: boolean },
): SuggestionDescription {
  const longIds = Boolean(options.longIds);
  const sourceNode = nodeMap.get(edge.sourceId) ?? null;
  const targetNode = nodeMap.get(edge.targetId) ?? null;
  const shortSource = formatId(edge.sourceId);
  const shortTarget = formatId(edge.targetId);
  const sourceIdDisplay = formatId(edge.sourceId, { long: longIds });
  const targetIdDisplay = formatId(edge.targetId, { long: longIds });
  const edgeId = longIds ? edge.id : `${shortSource}::${shortTarget}`;
  const sourceLabel = sourceNode?.title ?? (longIds ? edge.sourceId : sourceIdDisplay);
  const targetLabel = targetNode?.title ?? (longIds ? edge.targetId : targetIdDisplay);
  const code = edgeShortCode(edge.sourceId, edge.targetId);
  return {
    edgeId,
    shortId: `${shortSource}::${shortTarget}`,
    code,
    sourceLabel,
    targetLabel,
    sourceTitle: sourceNode?.title ?? null,
    targetTitle: targetNode?.title ?? null,
  };
}

export function resolveSuggestionReference(
  ref: string,
  suggestions: EdgeRecord[],
): EdgeRecord | undefined {
  const normalized = ref.trim();
  if (normalized.length === 0) return undefined;

  if (/^\d+$/.test(normalized)) {
    const index = Number.parseInt(normalized, 10);
    if (index >= 1 && index <= suggestions.length) {
      return suggestions[index - 1];
    }
    return undefined;
  }

  const lowered = normalized.toLowerCase();
  return suggestions.find((edge) => {
    if (edge.id === normalized) return true;
    const shortId = `${formatId(edge.sourceId)}::${formatId(edge.targetId)}`.toLowerCase();
    if (shortId === lowered) return true;
    const code = edgeShortCode(edge.sourceId, edge.targetId).toLowerCase();
    return code === lowered && /[a-z]/.test(lowered);
  });
}

export function resolveEdgeReference(ref: string, edges: EdgeRecord[]): EdgeRecord | undefined {
  const normalized = ref.trim();
  if (normalized.length === 0) return undefined;
  const lowered = normalized.toLowerCase();
  return edges.find((edge) => {
    if (edge.id === normalized) return true;
    const shortId = `${formatId(edge.sourceId)}::${formatId(edge.targetId)}`.toLowerCase();
    if (shortId === lowered) return true;
    const code = edgeShortCode(edge.sourceId, edge.targetId).toLowerCase();
    return code === lowered && /[a-z]/.test(lowered);
  });
}

export async function resolveEdgePairFromRef(ref: string): Promise<[string, string] | null> {
  const normalized = ref.trim();
  if (!normalized) return null;
  // Try existing edges first
  const allEdges = await listEdges('all');
  const viaEdges = resolveEdgeReference(normalized, allEdges);
  if (viaEdges) return normalizeEdgePair(viaEdges.sourceId, viaEdges.targetId);

  // Try short pair form abcd::efgh
  if (normalized.includes('::')) {
    const [a, b] = normalized.split('::', 2);
    if (a && b) {
      const aNode = (isShortId(a) ? await resolveByIdPrefix(a) : await getNodeById(a)) ?? null;
      const bNode = (isShortId(b) ? await resolveByIdPrefix(b) : await getNodeById(b)) ?? null;
      if (aNode && bNode) return normalizeEdgePair(aNode.id, bNode.id);
    }
  }

  // Try 4-char code over edges and recent events
  if (/^[a-z0-9]{1,4}$/i.test(normalized) && /[a-z]/i.test(normalized)) {
    const codeLower = normalized.toLowerCase();
    for (const e of allEdges) {
      const code = edgeShortCode(e.sourceId, e.targetId).toLowerCase();
      if (code === codeLower) return normalizeEdgePair(e.sourceId, e.targetId);
    }
    const events = await listEdgeEvents(1000);
    for (const ev of events) {
      const code = edgeShortCode(ev.sourceId, ev.targetId).toLowerCase();
      if (code === codeLower) return normalizeEdgePair(ev.sourceId, ev.targetId);
    }
  }
  return null;
}
