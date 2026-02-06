import { Elysia, t } from 'elysia';
import {
  listTagsCore,
  getNodesByTagCore,
  renameTagCore,
  getTagStatsCore,
} from '../../core/tags';
import {
  createSuccessResponse,
  parseQueryInt,
  formatNodeForList,
  createPaginationInfo,
  validatePaginationParams,
  parseQueryBoolean,
} from '../utils/helpers';
import { ForestError, ValidationError, TagNotFoundError, createErrorResponse } from '../utils/errors';

export const tagsRoutes = new Elysia({ prefix: '/api/v1' })
  // GET /tags - List all tags
  .get(
    '/tags',
    async ({ query, set }) => {
      try {
        const sort = (query.sort as 'name' | 'count') ?? 'count';
        const order = (query.order as 'asc' | 'desc') ?? 'desc';

        const result = await listTagsCore({ sort, order });

        return createSuccessResponse({
          tags: result.tags,
          total: result.total,
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
        tags: ['Tags'],
        summary: 'List tags',
        description: 'List all tags with usage counts',
      },
    },
  )

  // GET /tags/:name/nodes - Get nodes with tag
  .get(
    '/tags/:name/nodes',
    async ({ params, query, set }) => {
      try {
        const tagName = decodeURIComponent(params.name);
        const limit = parseQueryInt(query.limit as string | undefined, 20, 1, 100);
        const offset = parseQueryInt(query.offset as string | undefined, 0, 0);

        validatePaginationParams(limit, offset);

        const result = await getNodesByTagCore(tagName, {
          limit,
          offset,
        });

        if (result.total === 0) {
          // Check if tag exists at all
          const allTags = await listTagsCore({});
          const tagExists = allTags.tags.some((t) => t.name === tagName);
          if (!tagExists) {
            throw new TagNotFoundError(tagName);
          }
        }

        return createSuccessResponse({
          tag: result.tag,
          nodes: result.nodes.map(formatNodeForList),
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
        tags: ['Tags'],
        summary: 'Get nodes by tag',
        description: 'Get all nodes with a specific tag',
      },
    },
  )

  // PUT /tags/:oldName - Rename tag
  .put(
    '/tags/:oldName',
    async ({ params, body, set }) => {
      try {
        const oldName = decodeURIComponent(params.oldName);
        const data = body as any;

        if (!data.newName || typeof data.newName !== 'string') {
          throw new ValidationError('newName is required and must be a string');
        }

        const newName = data.newName.trim();
        if (newName.length === 0) {
          throw new ValidationError('newName cannot be empty');
        }

        // Check if old tag exists
        const allTags = await listTagsCore({});
        const oldTagExists = allTags.tags.some((t) => t.name === oldName);
        if (!oldTagExists) {
          throw new TagNotFoundError(oldName);
        }

        const result = await renameTagCore(oldName, newName);

        return createSuccessResponse({
          renamed: result,
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
        tags: ['Tags'],
        summary: 'Rename tag',
        description: 'Rename a tag across all nodes',
      },
    },
  )

  // GET /tags/stats - Tag statistics
  .get(
    '/tags/stats',
    async ({ query, set }) => {
      try {
        const focusTag = query.focusTag as string | undefined;
        const minCount = query.minCount ? parseInt(query.minCount as string, 10) : undefined;
        const top = query.top ? parseInt(query.top as string, 10) : undefined;

        const result = await getTagStatsCore({
          focusTag,
          minCount,
          top,
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
        tags: ['Tags'],
        summary: 'Tag statistics',
        description: 'Get tag statistics including co-occurrence data',
      },
    },
  );
