import { Elysia, t } from 'elysia';
import { EdgeRecord, listEdges, getNodeById } from '../../lib/db';
import {
  listEdgesCore,
  createEdgeCore,
  deleteEdgeCore,
  explainEdgeCore,
} from '../../core/edges';
import {
  createSuccessResponse,
  parseQueryInt,
  resolveNodeId,
  formatEdgeForResponse,
  createPaginationInfo,
  validatePaginationParams,
} from '../utils/helpers';
import { ForestError, EdgeNotFoundError, ValidationError, createErrorResponse } from '../utils/errors';
import { formatId } from '../../cli/shared/utils';
import { resolveEdgeReference } from '../../cli/shared/edges';

// Helper to resolve edge by reference (short pair, full ID, or progressive code)
async function resolveEdgeByRef(ref: string): Promise<EdgeRecord> {
  const edges = await listEdges('accepted');
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
        const nodeId = query.nodeId as string | undefined;
        const minScore = query.minScore ? parseFloat(query.minScore as string) : undefined;
        const maxScore = query.maxScore ? parseFloat(query.maxScore as string) : undefined;
        const limit = parseQueryInt(query.limit as string | undefined, 50, 1, 200);
        const offset = parseQueryInt(query.offset as string | undefined, 0, 0);

        validatePaginationParams(limit, offset);

        const result = await listEdgesCore({
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
  );
