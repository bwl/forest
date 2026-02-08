import { Elysia } from 'elysia';
import { suggestCore } from '../../core/suggest';
import { createSuccessResponse, parseQueryInt } from '../utils/helpers';
import { ForestError, createErrorResponse } from '../utils/errors';

export const suggestRoutes = new Elysia({ prefix: '/api/v1' })
  .get(
    '/suggest',
    async ({ query, set }) => {
      try {
        const project = query.project as string | undefined;
        const limit = parseQueryInt(query.limit as string | undefined, 10, 1, 100);

        const result = await suggestCore({
          project: project || undefined,
          limit,
        });

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
        tags: ['Search'],
        summary: 'Suggest relevant nodes',
        description: 'Suggest nodes relevant to a project by tag and semantic matching',
      },
    },
  );
