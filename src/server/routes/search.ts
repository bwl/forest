import { Elysia } from 'elysia';
import { semanticSearchCore, metadataSearchCore } from '../../core/search';
import {
  createSuccessResponse,
  parseQueryInt,
  parseQueryTags,
  parseQueryBoolean,
  formatNodeForList,
  createPaginationInfo,
  validatePaginationParams,
} from '../utils/helpers';
import { ForestError, ValidationError, createErrorResponse } from '../utils/errors';

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
  )

  // GET /search/metadata - Metadata search by filters
  .get(
    '/search/metadata',
    async ({ query, set }) => {
      try {
        const limit = parseQueryInt(query.limit as string | undefined, 20, 1, 100);
        const tags = parseQueryTags(query.tags as string | undefined);
        const anyTag = parseQueryTags(query.anyTag as string | undefined);
        const sort = normalizeSortParam(query.sort as string | undefined);
        const showChunks = parseQueryBoolean(query.showChunks as string | undefined, false);

        const result = await metadataSearchCore({
          id: query.id as string | undefined,
          title: query.title as string | undefined,
          term: query.term as string | undefined,
          limit,
          tagsAll: tags,
          tagsAny: anyTag,
          since: query.since as string | undefined,
          until: query.until as string | undefined,
          sort,
          showChunks,
          origin: query.origin as string | undefined,
          createdBy: query.createdBy as string | undefined,
        });

        const formattedMatches = result.matches.map((m) => ({
          ...formatNodeForList(m.node),
          score: m.score,
        }));

        return createSuccessResponse({
          matches: formattedMatches,
          total: result.total,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else if (error instanceof Error && error.message.includes('not found')) {
          set.status = 404;
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        tags: ['Search'],
        summary: 'Metadata search',
        description:
          'Search nodes by metadata filters: id, title, term, tags, date range, provenance (origin, createdBy), and sort order.',
      },
    },
  );

function normalizeSortParam(value?: string): 'score' | 'recent' | 'degree' | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.toLowerCase();
  if (v === 'recent' || v === 'score' || v === 'degree') return v as any;
  return undefined;
}
