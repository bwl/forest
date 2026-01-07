import {
  EdgeRecord,
  NodeRecord,
  deleteEdgeBetween,
  insertOrUpdateEdge,
  listNodes,
} from '../../lib/db';
import { buildTagIdfContext, classifyEdgeScores, computeEdgeScore, normalizeEdgePair } from '../../lib/scoring';

import { edgeIdentifier } from './utils';

type RescoreOptions = {
  allNodes?: NodeRecord[];
};

export async function linkAgainstExisting(newNode: NodeRecord, existing: NodeRecord[]) {
  const context = buildTagIdfContext([newNode, ...existing]);
  let accepted = 0;
  for (const other of existing) {
    const { score, semanticScore, tagScore, sharedTags, components } = computeEdgeScore(newNode, other, context);
    const status = classifyEdgeScores(semanticScore, tagScore);
    if (status === 'discard') continue;
    const [sourceId, targetId] = normalizeEdgePair(newNode.id, other.id);
    const edge: EdgeRecord = {
      id: edgeIdentifier(sourceId, targetId),
      sourceId,
      targetId,
      score,
      semanticScore,
      tagScore,
      sharedTags,
      status,
      edgeType: 'semantic',
      metadata: {
        components,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await insertOrUpdateEdge(edge);
    accepted += 1;
  }
  return { accepted };
}

export async function rescoreNode(node: NodeRecord, options: RescoreOptions = {}) {
  let accepted = 0;

  const all = options.allNodes ?? (await listNodes());
  const context = buildTagIdfContext(all);
  for (const other of all) {
    if (other.id === node.id) continue;
    const { score, semanticScore, tagScore, sharedTags, components } = computeEdgeScore(node, other, context);
    const status = classifyEdgeScores(semanticScore, tagScore);
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
      semanticScore,
      tagScore,
      sharedTags,
      status,
      edgeType: 'semantic',
      metadata: { components },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await insertOrUpdateEdge(edge);
    accepted += 1;
  }

  return { accepted };
}
