import { Elysia, t } from 'elysia';
import { getStats } from '../../core/stats';

export const statsRoutes = new Elysia({ prefix: '/api/v1' })
  .get(
    '/stats',
    async () => {
      const stats = await getStats({ top: 10 });

      return {
        success: true,
        data: {
          nodes: {
            total: stats.counts.nodes,
            recentCount: stats.recent.length,
            recent: stats.recent.map((node) => ({
              id: node.id,
              title: node.title,
              createdAt: node.updatedAt, // Using updatedAt as it's sorted by that
            })),
          },
          edges: {
            accepted: stats.counts.edges,
            suggested: stats.counts.suggested,
            total: stats.counts.edges + stats.counts.suggested,
          },
          tags: {
            total: stats.tags.reduce((sum, tag) => sum + tag.count, 0),
            topTags: stats.tags.map((tag) => ({
              name: tag.tag,
              count: tag.count,
            })),
          },
          suggestions: {
            highScoreCount: stats.topSuggestions.length,
            topSuggestions: stats.topSuggestions.map((suggestion) => ({
              ref: suggestion.code,
              sourceId: suggestion.sourceId,
              targetId: suggestion.targetId,
              score: suggestion.score,
            })),
          },
          highDegreeNodes: stats.highDegree.map((node) => ({
            id: node.id,
            title: node.title,
            edgeCount: node.degree,
          })),
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '0.3.0',
        },
      };
    },
    {
      detail: {
        tags: ['System'],
        summary: 'Graph statistics',
        description: 'Get graph statistics and health metrics',
      },
    },
  );
