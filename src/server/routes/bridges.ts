import { Elysia } from 'elysia';
import { findBridgesCore } from '../../core/graph';
import {
  createSuccessResponse,
  parseQueryInt,
} from '../utils/helpers';
import { ForestError, createErrorResponse } from '../utils/errors';

export const bridgesRoutes = new Elysia({ prefix: '/api/v1' }).get(
  '/bridges',
  async ({ query, set }) => {
    try {
      const limit = parseQueryInt(query.limit as string | undefined, 20, 1, 100);
      const minScoreRaw = query.minScore as string | undefined;
      const minScore = minScoreRaw ? parseFloat(minScoreRaw) : undefined;

      const result = await findBridgesCore({
        limit,
        minScore: minScore != null && !isNaN(minScore) ? minScore : undefined,
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
      tags: ['Graph'],
      summary: 'Bridge nodes',
      description: 'Find nodes that bridge across different documents',
    },
  },
);
