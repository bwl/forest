import { Elysia } from 'elysia';
import { semanticSearchCore } from '../../core/search.js';
import {
  createSuccessResponse,
  parseQueryInt,
  parseQueryTags,
  formatNodeForList,
  createPaginationInfo,
  validatePaginationParams,
} from '../utils/helpers.js';
import { ForestError, ValidationError, createErrorResponse } from '../utils/errors.js';

export const searchRoutes = new Elysia({ prefix: '/api/v1' })
  // GET /search/semantic - Semantic search by query
  .get(
    '/search/semantic',
    async ({ query, set }) => {
      try {
        // Parse query parameters
        const q = query.q as string | undefined;

        if (!q || q.trim().length === 0) {
          throw new ValidationError('Query parameter "q" is required and must be non-empty');
        }

        const tags = parseQueryTags(query.tags as string | undefined);
        const limit = parseQueryInt(query.limit as string | undefined, 20, 1, 100);
        const offset = parseQueryInt(query.offset as string | undefined, 0, 0);
        const minScore = query.minScore
          ? parseFloat(query.minScore as string)
          : 0.0;

        // Validate minScore range
        if (isNaN(minScore) || minScore < 0 || minScore > 1) {
          throw new ValidationError('minScore must be a number between 0 and 1', { minScore });
        }

        validatePaginationParams(limit, offset);

        const result = await semanticSearchCore(q, {
          limit,
          offset,
          minScore,
          tags,
        });

        // Format nodes with similarity scores
        const formattedNodes = result.nodes.map((item) => ({
          ...formatNodeForList(item.node),
          similarity: item.similarity,
        }));

        return createSuccessResponse({
          query: q,
          nodes: formattedNodes,
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
        tags: ['Search'],
        summary: 'Semantic search',
        description:
          'Search nodes by semantic similarity using vector embeddings. Returns nodes ranked by similarity to the query.',
      },
    },
  );
