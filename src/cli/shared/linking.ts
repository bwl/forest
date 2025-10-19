import {
  EdgeRecord,
  NodeRecord,
  deleteEdgeBetween,
  insertOrUpdateEdge,
  listNodes,
} from '../../lib/db';
import { classifyScore, computeScore, normalizeEdgePair } from '../../lib/scoring';

import { edgeIdentifier } from './utils';

type RescoreOptions = {
  allNodes?: NodeRecord[];
};

export async function linkAgainstExisting(newNode: NodeRecord, existing: NodeRecord[]) {
  let accepted = 0;
  let suggested = 0;
  for (const other of existing) {
    const { score, components } = computeScore(newNode, other);
    const status = classifyScore(score);
    if (status === 'discard') continue;
    const [sourceId, targetId] = normalizeEdgePair(newNode.id, other.id);
    const edge: EdgeRecord = {
      id: edgeIdentifier(sourceId, targetId),
      sourceId,
      targetId,
      score,
      status,
      metadata: {
        components,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await insertOrUpdateEdge(edge);
    if (status === 'accepted') accepted += 1;
    if (status === 'suggested') suggested += 1;
  }
  return { accepted, suggested };
}

export async function rescoreNode(node: NodeRecord, options: RescoreOptions = {}) {
  let accepted = 0;
  let suggested = 0;

  const all = options.allNodes ?? (await listNodes());
  for (const other of all) {
    if (other.id === node.id) continue;
    const { score, components } = computeScore(node, other);
    const status = classifyScore(score);
    const [sourceId, targetId] = normalizeEdgePair(node.id, other.id);
    if (status === 'discard') {
      await deleteEdgeBetween(sourceId, targetId);
      continue;
    }
    const edge: EdgeRecord = {
      id: edgeIdentifier(sourceId, targetId),
      sourceId,
      targetId,
      score,
      status,
      metadata: { components },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await insertOrUpdateEdge(edge);
    if (status === 'accepted') accepted += 1;
    if (status === 'suggested') suggested += 1;
  }

  return { accepted, suggested };
}
