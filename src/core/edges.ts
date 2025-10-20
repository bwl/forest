import {
  EdgeRecord,
  EdgeStatus,
  listEdges as dbListEdges,
  insertOrUpdateEdge,
  deleteEdgeBetween,
  logEdgeEvent,
  getLastEdgeEventForPair,
  markEdgeEventUndone,
  promoteSuggestions,
  deleteSuggestion,
  getNodeById,
} from '../lib/db';
import { computeScore, normalizeEdgePair } from '../lib/scoring';
import { edgeIdentifier, formatId } from '../cli/shared/utils';
import { eventBus } from '../server/events/eventBus';

export type ListEdgesOptions = {
  status?: 'accepted' | 'suggested' | 'all';
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
  const status = options.status ?? 'accepted';
  let edges = await dbListEdges(status === 'all' ? 'all' : (status as EdgeStatus));

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

export type AcceptEdgeResult = {
  edge: EdgeRecord;
  event: {
    id: number;
    prevStatus: string | null;
    nextStatus: string;
  };
};

export async function acceptEdgeCore(
  edge: EdgeRecord,
): Promise<AcceptEdgeResult> {
  if (edge.status === 'accepted') {
    throw new Error('Edge is already accepted');
  }

  const prevStatus = edge.status;
  const updatedEdge: EdgeRecord = {
    ...edge,
    status: 'accepted',
    updatedAt: new Date().toISOString(),
  };

  await insertOrUpdateEdge(updatedEdge);

  const eventId = await logEdgeEvent({
    edgeId: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    prevStatus,
    nextStatus: 'accepted',
  });

  // Emit event
  const ref = `${formatId(edge.sourceId).slice(0, 4)}${formatId(edge.targetId).slice(0, 4)}`.toUpperCase();
  eventBus.emitEdgeAccepted({
    id: updatedEdge.id,
    ref,
    sourceId: updatedEdge.sourceId,
    targetId: updatedEdge.targetId,
    score: updatedEdge.score,
    status: 'accepted',
  });

  return {
    edge: updatedEdge,
    event: {
      id: eventId,
      prevStatus,
      nextStatus: 'accepted',
    },
  };
}

export type RejectEdgeResult = {
  edge: EdgeRecord;
  event: {
    id: number;
    prevStatus: string | null;
    nextStatus: string;
  };
};

export async function rejectEdgeCore(
  edge: EdgeRecord,
): Promise<RejectEdgeResult> {
  if (edge.status !== 'suggested') {
    throw new Error('Only suggested edges can be rejected');
  }

  const prevStatus = edge.status;

  // Delete the edge
  await deleteEdgeBetween(edge.sourceId, edge.targetId);

  // Log event (without edge ID since it's deleted)
  const eventId = await logEdgeEvent({
    edgeId: null,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    prevStatus,
    nextStatus: 'rejected',
  });

  // Emit event
  const ref = `${formatId(edge.sourceId).slice(0, 4)}${formatId(edge.targetId).slice(0, 4)}`.toUpperCase();
  eventBus.emitEdgeRejected({
    id: edge.id,
    ref,
    status: 'rejected',
  });

  return {
    edge: {
      ...edge,
      status: 'suggested', // Still show as suggested in response
      updatedAt: new Date().toISOString(),
    },
    event: {
      id: eventId,
      prevStatus,
      nextStatus: 'rejected',
    },
  };
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
    threshold: 'accepted' | 'suggested' | 'discarded';
    autoAcceptThreshold: number;
    suggestionThreshold: number;
  };
};

export async function explainEdgeCore(edge: EdgeRecord): Promise<ExplainEdgeResult> {
  const sourceNode = await getNodeById(edge.sourceId);
  const targetNode = await getNodeById(edge.targetId);

  if (!sourceNode || !targetNode) {
    throw new Error('Cannot explain edge: one or both nodes not found');
  }

  const { score, components } = computeScore(sourceNode, targetNode);

  // Determine classification
  let threshold: 'accepted' | 'suggested' | 'discarded';
  if (score >= 0.5) {
    threshold = 'accepted';
  } else if (score >= 0.25) {
    threshold = 'suggested';
  } else {
    threshold = 'discarded';
  }

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
      threshold,
      autoAcceptThreshold: 0.5,
      suggestionThreshold: 0.25,
    },
  };
}

export type PromoteEdgesOptions = {
  minScore: number;
  limit?: number;
};

export type PromoteEdgesResult = {
  promoted: {
    count: number;
    edges: string[];
  };
};

export async function promoteEdgesCore(
  options: PromoteEdgesOptions,
): Promise<PromoteEdgesResult> {
  // Get suggestions above threshold
  const suggestions = await dbListEdges('suggested');
  const toPromote = suggestions
    .filter((edge) => edge.score >= options.minScore)
    .sort((a, b) => b.score - a.score);

  // Apply limit if specified
  const limit = options.limit ?? toPromote.length;
  const limited = toPromote.slice(0, limit);

  // Promote each edge
  for (const edge of limited) {
    await insertOrUpdateEdge({
      ...edge,
      status: 'accepted',
      updatedAt: new Date().toISOString(),
    });

    await logEdgeEvent({
      edgeId: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      prevStatus: 'suggested',
      nextStatus: 'accepted',
      payload: { bulk: true, minScore: options.minScore },
    });

    // Emit event
    const ref = `${formatId(edge.sourceId).slice(0, 4)}${formatId(edge.targetId).slice(0, 4)}`.toUpperCase();
    eventBus.emitEdgeAccepted({
      id: edge.id,
      ref,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      score: edge.score,
      status: 'accepted',
    });
  }

  return {
    promoted: {
      count: limited.length,
      edges: limited.map((edge) => edge.id),
    },
  };
}

export type SweepEdgesOptions = {
  minScore?: number;
  maxScore?: number;
  limit?: number;
};

export type SweepEdgesResult = {
  swept: {
    count: number;
    edges: string[];
  };
};

export async function sweepEdgesCore(
  options: SweepEdgesOptions,
): Promise<SweepEdgesResult> {
  // Get suggestions in range
  const suggestions = await dbListEdges('suggested');
  let toSweep = suggestions;

  if (options.minScore !== undefined) {
    toSweep = toSweep.filter((edge) => edge.score >= options.minScore!);
  }

  if (options.maxScore !== undefined) {
    toSweep = toSweep.filter((edge) => edge.score <= options.maxScore!);
  }

  // Sort by score ascending (lowest first)
  toSweep.sort((a, b) => a.score - b.score);

  // Apply limit if specified
  const limit = options.limit ?? toSweep.length;
  const limited = toSweep.slice(0, limit);

  // Reject each edge
  for (const edge of limited) {
    await deleteEdgeBetween(edge.sourceId, edge.targetId);

    await logEdgeEvent({
      edgeId: null,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      prevStatus: 'suggested',
      nextStatus: 'rejected',
      payload: { bulk: true, scoreRange: { min: options.minScore, max: options.maxScore } },
    });

    // Emit event
    const ref = `${formatId(edge.sourceId).slice(0, 4)}${formatId(edge.targetId).slice(0, 4)}`.toUpperCase();
    eventBus.emitEdgeRejected({
      id: edge.id,
      ref,
      status: 'rejected',
    });
  }

  return {
    swept: {
      count: limited.length,
      edges: limited.map((edge) => edge.id),
    },
  };
}

export type UndoEdgeActionResult = {
  edge: {
    id: string;
    sourceId: string;
    targetId: string;
    status: string;
    undoneEvent: {
      id: number;
      prevStatus: string | null;
      nextStatus: string;
      undoneAt: string;
    };
  };
};

export async function undoEdgeActionCore(edge: EdgeRecord): Promise<UndoEdgeActionResult> {
  // Get the last event for this edge pair
  const lastEvent = await getLastEdgeEventForPair(edge.sourceId, edge.targetId);

  if (!lastEvent) {
    throw new Error('No events found for this edge');
  }

  // Mark event as undone
  await markEdgeEventUndone(lastEvent.id);

  // Revert the edge to its previous state
  if (lastEvent.prevStatus === null) {
    // Edge was created, delete it
    await deleteEdgeBetween(edge.sourceId, edge.targetId);
  } else if (lastEvent.nextStatus === 'rejected') {
    // Edge was rejected, restore it as suggested
    const restoredEdge: EdgeRecord = {
      ...edge,
      status: 'suggested',
      updatedAt: new Date().toISOString(),
    };
    await insertOrUpdateEdge(restoredEdge);
  } else if (lastEvent.nextStatus === 'accepted' && lastEvent.prevStatus === 'suggested') {
    // Edge was accepted, revert to suggested
    const revertedEdge: EdgeRecord = {
      ...edge,
      status: 'suggested',
      updatedAt: new Date().toISOString(),
    };
    await insertOrUpdateEdge(revertedEdge);
  }

  return {
    edge: {
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      status: lastEvent.prevStatus ?? 'deleted',
      undoneEvent: {
        id: lastEvent.id,
        prevStatus: lastEvent.prevStatus,
        nextStatus: lastEvent.nextStatus,
        undoneAt: new Date().toISOString(),
      },
    },
  };
}
