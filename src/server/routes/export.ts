import { Elysia } from 'elysia';
import { listNodes, listEdges } from '../../lib/db';
import {
  createSuccessResponse,
  parseQueryBoolean,
} from '../utils/helpers';
import { ForestError, createErrorResponse } from '../utils/errors';

export const exportRoutes = new Elysia({ prefix: '/api/v1' })
  // GET /export/json - Export full database as JSON
  .get(
    '/export/json',
    async ({ query, set }) => {
      try {
        const includeBody = parseQueryBoolean(query.body as string | undefined, true);
        const includeEdges = parseQueryBoolean(query.edges as string | undefined, true);

        const nodes = await listNodes();
        const edges = includeEdges ? await listEdges('all') : [];

        const payload = {
          nodes: nodes.map((node) => ({
            id: node.id,
            title: node.title,
            tags: node.tags,
            body: includeBody ? node.body : undefined,
            tokenCounts: node.tokenCounts,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
          })),
          edges: edges.map((edge) => ({
            id: edge.id,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            status: edge.status,
            score: edge.score,
            metadata: edge.metadata,
            createdAt: edge.createdAt,
            updatedAt: edge.updatedAt,
          })),
        };

        return createSuccessResponse(payload);
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
        tags: ['Export'],
        summary: 'Export as JSON',
        description: 'Export the full database as JSON',
      },
    },
  );
