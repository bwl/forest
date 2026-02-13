import {
  EdgeRecord,
  NodeRecord,
  beginBatch,
  deleteEdgeBetween,
  endBatch,
  insertOrUpdateEdge,
  listEdges,
  listNodes,
} from '../../lib/db';
import {
  buildTagIdfContext,
  classifyEdgeScores,
  computeEdgeScore,
  extractProjectTags,
  getProjectEdgeLimit,
  normalizeEdgePair,
} from '../../lib/scoring';

import { edgeIdentifier } from './utils';

type RescoreOptions = {
  allNodes?: NodeRecord[];
  manageBatch?: boolean;
};

export async function linkAgainstExisting(newNode: NodeRecord, existing: NodeRecord[]) {
  const context = buildTagIdfContext([newNode, ...existing]);
  let accepted = 0;
  const candidates = buildEdgeCandidates(newNode, existing, context);
  const { projectSelections, projectEdgeLimit } = resolveProjectSelections(candidates);

  for (const candidate of candidates) {
    if (!shouldPersistCandidate(candidate, projectSelections)) continue;

    const { sourceId, targetId, score, semanticScore, tagScore, sharedTags, components } = candidate;
    const edge: EdgeRecord = {
      id: edgeIdentifier(sourceId, targetId),
      sourceId,
      targetId,
      score,
      semanticScore,
      tagScore,
      sharedTags,
      status: 'accepted',
      edgeType: 'semantic',
      metadata: {
        components,
        autoLink: {
          sharedProjectTags: candidate.sharedProjectTags,
          keptByProjectFallback: candidate.sharedProjectTags.length > 0 && candidate.status === 'discard',
          projectEdgeLimit,
        },
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
  const manageBatch = options.manageBatch !== false;

  const all = options.allNodes ?? (await listNodes());
  const others = all.filter((other) => other.id !== node.id);
  const context = buildTagIdfContext(all);
  const candidates = buildEdgeCandidates(node, others, context);
  const { projectSelections, projectEdgeLimit } = resolveProjectSelections(candidates);

  const existingEdges = await listEdges('accepted');
  const manualEdgesByPair = new Map<string, EdgeRecord>();
  for (const edge of existingEdges) {
    if (edge.edgeType !== 'manual') continue;
    if (edge.sourceId !== node.id && edge.targetId !== node.id) continue;
    manualEdgesByPair.set(pairKey(edge.sourceId, edge.targetId), edge);
  }

  if (manageBatch) {
    await beginBatch();
  }
  try {
    for (const candidate of candidates) {
      const { sourceId, targetId, score, semanticScore, tagScore, sharedTags, components } = candidate;
      const key = pairKey(sourceId, targetId);
      const manualEdge = manualEdgesByPair.get(key);

      if (manualEdge) {
        await insertOrUpdateEdge({
          ...manualEdge,
          score,
          semanticScore,
          tagScore,
          sharedTags,
          status: 'accepted',
          edgeType: 'manual',
          metadata: {
            ...(manualEdge.metadata ?? {}),
            components,
            manualOverride: true,
          },
          updatedAt: new Date().toISOString(),
        });
        accepted += 1;
        continue;
      }

      if (!shouldPersistCandidate(candidate, projectSelections)) {
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
        status: 'accepted',
        edgeType: 'semantic',
        metadata: {
          components,
          autoLink: {
            sharedProjectTags: candidate.sharedProjectTags,
            keptByProjectFallback: candidate.sharedProjectTags.length > 0 && candidate.status === 'discard',
            projectEdgeLimit,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await insertOrUpdateEdge(edge);
      accepted += 1;
    }
  } finally {
    if (manageBatch) {
      await endBatch();
    }
  }

  return { accepted };
}

type EdgeCandidate = {
  other: NodeRecord;
  sourceId: string;
  targetId: string;
  score: number;
  semanticScore: number | null;
  tagScore: number | null;
  sharedTags: string[];
  components: ReturnType<typeof computeEdgeScore>['components'];
  status: 'accepted' | 'discard';
  sharedProjectTags: string[];
};

function buildEdgeCandidates(node: NodeRecord, others: NodeRecord[], context: ReturnType<typeof buildTagIdfContext>): EdgeCandidate[] {
  return others.map((other) => {
    const computed = computeEdgeScore(node, other, context);
    const status = classifyEdgeScores(computed.semanticScore, computed.tagScore, computed.sharedTags);
    const [sourceId, targetId] = normalizeEdgePair(node.id, other.id);
    return {
      other,
      sourceId,
      targetId,
      score: computed.score,
      semanticScore: computed.semanticScore,
      tagScore: computed.tagScore,
      sharedTags: computed.sharedTags,
      components: computed.components,
      status,
      sharedProjectTags: extractProjectTags(computed.sharedTags),
    };
  });
}

function shouldPersistCandidate(candidate: EdgeCandidate, projectSelections: Set<string>): boolean {
  if (candidate.sharedProjectTags.length === 0) {
    return candidate.status === 'accepted';
  }
  return projectSelections.has(candidate.other.id);
}

function resolveProjectSelections(candidates: EdgeCandidate[]): { projectSelections: Set<string>; projectEdgeLimit: number } {
  const projectEdgeLimit = getProjectEdgeLimit();
  const projectSelections = new Set<string>();
  const projectCandidates = candidates
    .filter((candidate) => candidate.sharedProjectTags.length > 0)
    .sort(compareCandidatesByStrengthDesc);

  for (const candidate of projectCandidates) {
    if (candidate.status !== 'accepted') continue;
    if (projectSelections.size >= projectEdgeLimit) break;
    projectSelections.add(candidate.other.id);
  }

  // Fallback guarantee: if we have project peers but nothing cleared acceptance,
  // keep the strongest one so project-tagged notes stay connected.
  if (projectSelections.size === 0 && projectCandidates.length > 0) {
    projectSelections.add(projectCandidates[0].other.id);
  }

  return { projectSelections, projectEdgeLimit };
}

function compareCandidatesByStrengthDesc(a: EdgeCandidate, b: EdgeCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  const bSemantic = b.semanticScore ?? 0;
  const aSemantic = a.semanticScore ?? 0;
  if (bSemantic !== aSemantic) return bSemantic - aSemantic;
  const bTag = b.tagScore ?? 0;
  const aTag = a.tagScore ?? 0;
  if (bTag !== aTag) return bTag - aTag;
  return a.other.id.localeCompare(b.other.id);
}

function pairKey(sourceId: string, targetId: string): string {
  return `${sourceId}::${targetId}`;
}
