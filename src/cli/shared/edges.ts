import { EdgeRecord, NodeRecord, getNodeById, listEdgeEvents, listEdges } from '../../lib/db.js';
import { normalizeEdgePair } from '../../lib/scoring.js';
import { formatId, isShortId, resolveByIdPrefix, getEdgePrefix, isProgressiveEdgeId } from './utils.js';
import { generateEdgeHash, resolvePrefix } from '../../lib/progressive-id.js';

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
  options: { longIds?: boolean; allEdges: EdgeRecord[] },
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

  // Use progressive ID system (Git-style minimal unique prefix)
  const code = getEdgePrefix(edge.sourceId, edge.targetId, options.allEdges);

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

  const lowered = normalized.toLowerCase();

  // Try exact match on edge ID
  const exactMatch = suggestions.find(edge => edge.id === normalized);
  if (exactMatch) return exactMatch;

  // Try short ID pair (e.g., "abcd1234::efgh5678")
  const shortPairMatch = suggestions.find((edge) => {
    const shortId = `${formatId(edge.sourceId)}::${formatId(edge.targetId)}`.toLowerCase();
    return shortId === lowered;
  });
  if (shortPairMatch) return shortPairMatch;

  // Try progressive ID prefix matching (Git-style)
  if (isProgressiveEdgeId(normalized)) {
    const allHashes = suggestions.map(e => generateEdgeHash(e.sourceId, e.targetId));
    const resolvedHash = resolvePrefix(normalized, allHashes);
    if (resolvedHash) {
      return suggestions.find(e => generateEdgeHash(e.sourceId, e.targetId) === resolvedHash);
    }
  }

  return undefined;
}

export function resolveEdgeReference(ref: string, edges: EdgeRecord[]): EdgeRecord | undefined {
  const normalized = ref.trim();
  if (normalized.length === 0) return undefined;
  const lowered = normalized.toLowerCase();

  // Try exact match on edge ID
  const exactMatch = edges.find(edge => edge.id === normalized);
  if (exactMatch) return exactMatch;

  // Try short ID pair (e.g., "abcd1234::efgh5678")
  const shortPairMatch = edges.find((edge) => {
    const shortId = `${formatId(edge.sourceId)}::${formatId(edge.targetId)}`.toLowerCase();
    return shortId === lowered;
  });
  if (shortPairMatch) return shortPairMatch;

  // Try progressive ID prefix matching (Git-style)
  if (isProgressiveEdgeId(normalized)) {
    const allHashes = edges.map(e => generateEdgeHash(e.sourceId, e.targetId));
    const resolvedHash = resolvePrefix(normalized, allHashes);
    if (resolvedHash) {
      return edges.find(e => generateEdgeHash(e.sourceId, e.targetId) === resolvedHash);
    }
  }

  return undefined;
}

export async function resolveEdgePairFromRef(ref: string): Promise<[string, string] | null> {
  const normalized = ref.trim();
  if (!normalized) return null;

  // Try existing edges first (includes progressive ID matching)
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

  // Try progressive ID over edges and recent events
  if (isProgressiveEdgeId(normalized)) {
    const allHashes = allEdges.map(e => generateEdgeHash(e.sourceId, e.targetId));
    const resolvedHash = resolvePrefix(normalized, allHashes);
    if (resolvedHash) {
      const match = allEdges.find(e => generateEdgeHash(e.sourceId, e.targetId) === resolvedHash);
      if (match) return normalizeEdgePair(match.sourceId, match.targetId);
    }

    // Try events if not found in edges
    const events = await listEdgeEvents(1000);
    const eventHashes = events.map(ev => generateEdgeHash(ev.sourceId, ev.targetId));
    const resolvedEventHash = resolvePrefix(normalized, eventHashes);
    if (resolvedEventHash) {
      const match = events.find(ev => generateEdgeHash(ev.sourceId, ev.targetId) === resolvedEventHash);
      if (match) return normalizeEdgePair(match.sourceId, match.targetId);
    }
  }

  return null;
}
