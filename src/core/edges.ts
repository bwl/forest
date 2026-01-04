import {
  EdgeRecord,
  listEdges as dbListEdges,
  insertOrUpdateEdge,
  deleteEdgeBetween,
  logEdgeEvent,
  getNodeById,
} from '../lib/db';
import { computeScore, normalizeEdgePair, getEdgeThreshold } from '../lib/scoring';
import { edgeIdentifier, formatId } from '../cli/shared/utils';
import { eventBus } from '../server/events/eventBus';

export type ListEdgesOptions = {
  nodeId?: string;
  minScore?: number;
  maxScore?: number;
  limit?: number;
  offset?: number;
};

export type ListEdgesResult = {
  edges: EdgeRecord[];
  total: number;
};

export async function listEdgesCore(options: ListEdgesOptions = {}): Promise<ListEdgesResult> {
  let edges = await dbListEdges('accepted');

  // Filter by nodeId if specified
  if (options.nodeId) {
    edges = edges.filter(
      (edge) => edge.sourceId === options.nodeId || edge.targetId === options.nodeId,
    );
  }

  // Filter by score range
  if (options.minScore !== undefined) {
    edges = edges.filter((edge) => edge.score >= options.minScore!);
  }

  if (options.maxScore !== undefined) {
    edges = edges.filter((edge) => edge.score <= options.maxScore!);
  }

  // Sort by score descending
  edges.sort((a, b) => b.score - a.score);

  const total = edges.length;

  // Apply pagination
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const paginatedEdges = edges.slice(offset, offset + limit);

  return {
    edges: paginatedEdges,
    total,
  };
}

export type CreateEdgeData = {
  sourceId: string;
  targetId: string;
  score?: number;
};

export type CreateEdgeResult = {
  edge: EdgeRecord;
};

export async function createEdgeCore(data: CreateEdgeData): Promise<CreateEdgeResult> {
  // Verify nodes exist
  const sourceNode = await getNodeById(data.sourceId);
  const targetNode = await getNodeById(data.targetId);

  if (!sourceNode) {
    throw new Error(`Source node with ID '${data.sourceId}' not found`);
  }

  if (!targetNode) {
    throw new Error(`Target node with ID '${data.targetId}' not found`);
  }

  // Normalize edge pair
  const [sourceId, targetId] = normalizeEdgePair(data.sourceId, data.targetId);

  // Compute score if not provided
  let score = data.score;
  if (score === undefined) {
    const { score: computedScore } = computeScore(sourceNode, targetNode);
    score = computedScore;
  }

  // Create edge
  const now = new Date().toISOString();
  const edge: EdgeRecord = {
    id: edgeIdentifier(sourceId, targetId),
    sourceId,
    targetId,
    score,
    status: 'accepted',
    edgeType: 'manual',
    metadata: null,
    createdAt: now,
    updatedAt: now,
  };

  await insertOrUpdateEdge(edge);

  // Log event
  await logEdgeEvent({
    edgeId: edge.id,
    sourceId,
    targetId,
    prevStatus: null,
    nextStatus: 'accepted',
    payload: { manual: true },
  });

  // Emit event
  const ref = `${formatId(edge.sourceId).slice(0, 4)}${formatId(edge.targetId).slice(0, 4)}`.toUpperCase();
  eventBus.emitEdgeCreated({
    id: edge.id,
    ref,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    score: edge.score,
    status: 'accepted',
  });

  return { edge };
}

export type DeleteEdgeResult = {
  deleted: {
    edgeId: string;
    sourceId: string;
    targetId: string;
  };
};

export async function deleteEdgeCore(edge: EdgeRecord): Promise<DeleteEdgeResult> {
  const deleted = await deleteEdgeBetween(edge.sourceId, edge.targetId);

  if (!deleted) {
    throw new Error('Failed to delete edge');
  }

  // Emit event
  const ref = `${formatId(edge.sourceId).slice(0, 4)}${formatId(edge.targetId).slice(0, 4)}`.toUpperCase();
  eventBus.emitEdgeDeleted(edge.id, ref);

  return {
    deleted: {
      edgeId: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
    },
  };
}

export type ExplainEdgeResult = {
  edge: {
    id: string;
    sourceId: string;
    targetId: string;
    score: number;
  };
  breakdown: {
    tokenSimilarity: {
      raw: number;
      weight: number;
      weighted: number;
    };
    embeddingSimilarity: {
      raw: number;
      weight: number;
      weighted: number;
    };
    tagOverlap: {
      raw: number;
      weight: number;
      weighted: number;
    };
    titleSimilarity: {
      raw: number;
      weight: number;
      weighted: number;
    };
    penalty: {
      applied: boolean;
      factor: number;
      reason: string | null;
    };
    finalScore: number;
  };
  classification: {
    status: 'accepted' | 'discarded';
    threshold: number;
  };
};

export async function explainEdgeCore(edge: EdgeRecord): Promise<ExplainEdgeResult> {
  const sourceNode = await getNodeById(edge.sourceId);
  const targetNode = await getNodeById(edge.targetId);

  if (!sourceNode || !targetNode) {
    throw new Error('Cannot explain edge: one or both nodes not found');
  }

  const { score, components } = computeScore(sourceNode, targetNode);
  const threshold = getEdgeThreshold();

  return {
    edge: {
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      score: edge.score,
    },
    breakdown: {
      tokenSimilarity: {
        raw: components.tokenSimilarity,
        weight: 0.25,
        weighted: components.tokenSimilarity * 0.25,
      },
      embeddingSimilarity: {
        raw: components.embeddingSimilarity,
        weight: 0.55,
        weighted: components.embeddingSimilarity * 0.55,
      },
      tagOverlap: {
        raw: components.tagOverlap,
        weight: 0.15,
        weighted: components.tagOverlap * 0.15,
      },
      titleSimilarity: {
        raw: components.titleSimilarity,
        weight: 0.05,
        weighted: components.titleSimilarity * 0.05,
      },
      penalty: {
        applied: components.penalty !== 1.0,
        factor: components.penalty,
        reason: components.penalty !== 1.0
          ? 'Both tag overlap and title similarity are zero'
          : null,
      },
      finalScore: score,
    },
    classification: {
      status: score >= threshold ? 'accepted' : 'discarded',
      threshold,
    },
  };
}
