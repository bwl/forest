import { Elysia } from 'elysia';
import { findPath } from '../../core/graph';
import {
  createSuccessResponse,
  resolveNodeId,
} from '../utils/helpers';
import { ForestError, ValidationError, createErrorResponse } from '../utils/errors';

export const graphRoutes = new Elysia({ prefix: '/api/v1' })
  // GET /graph/path - Find shortest path between two nodes
  .get(
    '/graph/path',
    async ({ query, set }) => {
      try {
        const from = query.from as string | undefined;
        const to = query.to as string | undefined;

        if (!from || !to) {
          throw new ValidationError('Both "from" and "to" query parameters are required');
        }

        const fromNode = await resolveNodeId(from);
        const toNode = await resolveNodeId(to);

        const result = await findPath(fromNode.id, toNode.id);

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
        tags: ['Graph'],
        summary: 'Find path',
        description: 'Find the shortest path between two nodes',
      },
    },
  );
