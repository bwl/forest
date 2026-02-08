import { Elysia, t } from 'elysia';
import { getStats } from '../../core/stats';
import { createSuccessResponse } from '../utils/helpers';
import { parseQueryInt } from '../utils/helpers';

export const statsRoutes = new Elysia({ prefix: '/api/v1' })
  .get(
    '/stats',
    async ({ query }) => {
      const top = parseQueryInt(query.top as string | undefined, 10, 1, 100);
      const stats = await getStats({ top });

      return createSuccessResponse({
        nodes: {
          total: stats.counts.nodes,
          recentCount: stats.recent.length,
          recent: stats.recent.map((node) => ({
            id: node.id,
            title: node.title,
            createdAt: node.updatedAt,
          })),
        },
        edges: {
          total: stats.counts.edges,
        },
        degree: stats.degree,
        tags: {
          total: stats.tags.reduce((sum, tag) => sum + tag.count, 0),
          topTags: stats.tags.map((tag) => ({
            name: tag.tag,
            count: tag.count,
          })),
        },
        tagPairs: stats.tagPairs.map((pair) => ({
          pair: pair.pair,
          count: pair.count,
        })),
        highDegreeNodes: stats.highDegree.map((node) => ({
          id: node.id,
          title: node.title,
          edgeCount: node.degree,
        })),
      });
    },
    {
      detail: {
        tags: ['System'],
        summary: 'Graph statistics',
        description: 'Get graph statistics and health metrics',
      },
    },
  );
