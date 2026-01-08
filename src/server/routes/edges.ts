import { Elysia, t } from 'elysia';
import { EdgeRecord, listEdges, getNodeById } from '../../lib/db.js';
import {
  listEdgesCore,
  createEdgeCore,
  acceptEdgeCore,
  rejectEdgeCore,
  deleteEdgeCore,
  explainEdgeCore,
  promoteEdgesCore,
  sweepEdgesCore,
  undoEdgeActionCore,
} from '../../core/edges.js';
import {
  createSuccessResponse,
  parseQueryInt,
  resolveNodeId,
  formatEdgeForResponse,
  createPaginationInfo,
  validatePaginationParams,
} from '../utils/helpers.js';
import { ForestError, EdgeNotFoundError, ValidationError, createErrorResponse } from '../utils/errors.js';
import { formatId } from '../../cli/shared/utils.js';
import { resolveEdgeReference } from '../../cli/shared/edges.js';

// Helper to resolve edge by reference (short pair, full ID, or progressive code)
async function resolveEdgeByRef(ref: string, status?: 'accepted' | 'suggested' | 'all'): Promise<EdgeRecord> {
  const edges = await listEdges(status ?? 'all');
  const edge = resolveEdgeReference(ref, edges);

  if (!edge) {
    throw new EdgeNotFoundError(ref);
  }

  return edge;
}

export const edgesRoutes = new Elysia({ prefix: '/api/v1' })
  // GET /edges - List edges
  .get(
    '/edges',
    async ({ query, set }) => {
      try {
        const status = (query.status as 'accepted' | 'suggested' | 'all') ?? 'accepted';
        const nodeId = query.nodeId as string | undefined;
        const minScore = query.minScore ? parseFloat(query.minScore as string) : undefined;
        const maxScore = query.maxScore ? parseFloat(query.maxScore as string) : undefined;
        const limit = parseQueryInt(query.limit as string | undefined, 50, 1, 200);
        const offset = parseQueryInt(query.offset as string | undefined, 0, 0);

        validatePaginationParams(limit, offset);

        const result = await listEdgesCore({
          status,
          nodeId,
          minScore,
          maxScore,
          limit,
          offset,
        });

        // Format edges with connected nodes
        const formattedEdges = await Promise.all(
          result.edges.map(async (edge) => {
            const sourceNode = await getNodeById(edge.sourceId);
            const targetNode = await getNodeById(edge.targetId);

            return {
              id: edge.id,
              ref: `${formatId(edge.sourceId).slice(0, 4)}${formatId(edge.targetId).slice(0, 4)}`.toUpperCase(),
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              sourceNode: sourceNode ? {
                id: sourceNode.id,
                shortId: formatId(sourceNode.id),
                title: sourceNode.title,
              } : null,
              targetNode: targetNode ? {
                id: targetNode.id,
                shortId: formatId(targetNode.id),
                title: targetNode.title,
              } : null,
              score: edge.score,
              status: edge.status,
              createdAt: edge.createdAt,
              updatedAt: edge.updatedAt,
            };
          }),
        );

        return createSuccessResponse({
          edges: formattedEdges,
          pagination: createPaginationInfo(result.total, limit, offset),
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Edges'],
        summary: 'List edges',
        description: 'List edges with filtering and pagination',
      },
    },
  )

  // POST /edges - Create manual edge
  .post(
    '/edges',
    async ({ body, set }) => {
      try {
        const data = body as any;

        if (!data.sourceId || !data.targetId) {
          throw new ValidationError('sourceId and targetId are required');
        }

        const sourceNode = await resolveNodeId(data.sourceId);
        const targetNode = await resolveNodeId(data.targetId);

        const result = await createEdgeCore({
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          score: data.score,
        });

        set.status = 201;
        return createSuccessResponse({
          edge: {
            id: result.edge.id,
            ref: `${formatId(result.edge.sourceId).slice(0, 4)}${formatId(result.edge.targetId).slice(0, 4)}`.toUpperCase(),
            sourceId: result.edge.sourceId,
            targetId: result.edge.targetId,
            score: result.edge.score,
            status: result.edge.status,
            createdAt: result.edge.createdAt,
          },
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Edges'],
        summary: 'Create edge',
        description: 'Create a manual edge between two nodes',
      },
    },
  )

  // PUT /edges/:ref/accept - Accept suggested edge
  .put(
    '/edges/:ref/accept',
    async ({ params, set }) => {
      try {
        const edge = await resolveEdgeByRef(params.ref, 'suggested');
        const result = await acceptEdgeCore(edge);

        return createSuccessResponse({
          edge: {
            id: result.edge.id,
            ref: `${formatId(result.edge.sourceId).slice(0, 4)}${formatId(result.edge.targetId).slice(0, 4)}`.toUpperCase(),
            sourceId: result.edge.sourceId,
            targetId: result.edge.targetId,
            score: result.edge.score,
            status: result.edge.status,
            updatedAt: result.edge.updatedAt,
          },
          event: result.event,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Edges'],
        summary: 'Accept edge',
        description: 'Accept a suggested edge',
      },
    },
  )

  // PUT /edges/:ref/reject - Reject suggested edge
  .put(
    '/edges/:ref/reject',
    async ({ params, set }) => {
      try {
        const edge = await resolveEdgeByRef(params.ref, 'suggested');
        const result = await rejectEdgeCore(edge);

        return createSuccessResponse({
          edge: {
            id: result.edge.id,
            ref: `${formatId(result.edge.sourceId).slice(0, 4)}${formatId(result.edge.targetId).slice(0, 4)}`.toUpperCase(),
            sourceId: result.edge.sourceId,
            targetId: result.edge.targetId,
            score: result.edge.score,
            status: 'rejected',
            updatedAt: result.edge.updatedAt,
          },
          event: result.event,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Edges'],
        summary: 'Reject edge',
        description: 'Reject a suggested edge',
      },
    },
  )

  // DELETE /edges/:ref - Delete edge
  .delete(
    '/edges/:ref',
    async ({ params, set }) => {
      try {
        const edge = await resolveEdgeByRef(params.ref);
        const result = await deleteEdgeCore(edge);

        return createSuccessResponse({
          deleted: {
            edgeId: result.deleted.edgeId,
            ref: `${formatId(result.deleted.sourceId).slice(0, 4)}${formatId(result.deleted.targetId).slice(0, 4)}`.toUpperCase(),
          },
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Edges'],
        summary: 'Delete edge',
        description: 'Delete an edge',
      },
    },
  )

  // GET /edges/:ref/explain - Get scoring breakdown
  .get(
    '/edges/:ref/explain',
    async ({ params, set }) => {
      try {
        const edge = await resolveEdgeByRef(params.ref);
        const result = await explainEdgeCore(edge);

        return createSuccessResponse(result);
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Edges'],
        summary: 'Explain edge',
        description: 'Get detailed scoring breakdown for an edge',
      },
    },
  )

  // POST /edges/promote - Bulk accept edges
  .post(
    '/edges/promote',
    async ({ body, set }) => {
      try {
        const data = body as any;

        if (typeof data.minScore !== 'number') {
          throw new ValidationError('minScore is required and must be a number');
        }

        const result = await promoteEdgesCore({
          minScore: data.minScore,
          limit: data.limit,
        });

        return createSuccessResponse({
          promoted: result.promoted,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Edges'],
        summary: 'Promote edges',
        description: 'Bulk accept edges above a score threshold',
      },
    },
  )

  // POST /edges/sweep - Bulk reject edges
  .post(
    '/edges/sweep',
    async ({ body, set }) => {
      try {
        const data = body as any;

        const result = await sweepEdgesCore({
          minScore: data.minScore,
          maxScore: data.maxScore,
          limit: data.limit,
        });

        return createSuccessResponse({
          swept: result.swept,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Edges'],
        summary: 'Sweep edges',
        description: 'Bulk reject edges within a score range',
      },
    },
  )

  // POST /edges/:ref/undo - Undo accept/reject
  .post(
    '/edges/:ref/undo',
    async ({ params, set }) => {
      try {
        // For undo, we need to find the edge even if it was deleted
        // So we search in edge_events instead
        const edge = await resolveEdgeByRef(params.ref);
        const result = await undoEdgeActionCore(edge);

        return createSuccessResponse({
          edge: result.edge,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Edges'],
        summary: 'Undo edge action',
        description: 'Undo the last accept/reject action on an edge',
      },
    },
  );
