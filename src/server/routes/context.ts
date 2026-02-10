import { Elysia } from 'elysia';
import { contextCore } from '../../core/context';
import { createSuccessResponse, parseQueryInt } from '../utils/helpers';
import { ForestError, createErrorResponse } from '../utils/errors';

export const contextRoutes = new Elysia({ prefix: '/api/v1' })
  .get(
    '/context',
    async ({ query, set }) => {
      try {
        const tag = (query.tag as string | undefined) || undefined;
        const q = (query.query as string | undefined) || undefined;
        const budget = parseQueryInt(query.budget as string | undefined, 8000, 100, 100000);

        if (!tag && !q) {
          set.status = 400;
          return createErrorResponse(new Error('At least one of tag or query is required'));
        }

        const result = await contextCore({ tag, query: q, budget });
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
        summary: 'Get cluster topology',
        description: 'Returns cluster topology (hubs, bridges, periphery) around a tag or query seed',
      },
    },
  );
