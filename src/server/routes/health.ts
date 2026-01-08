import { Elysia, t } from 'elysia';
import { getHealthReport, isHealthy } from '../../core/health.js';

export const healthRoutes = new Elysia({ prefix: '/api/v1' })
  .get(
    '/health',
    async () => {
      const report = await getHealthReport();
      const healthy = isHealthy(report);

      return {
        success: true,
        data: {
          status: healthy ? 'healthy' : 'degraded',
          database: {
            connected: report.database.status === 'ok',
            path: report.database.path,
            size: report.database.sizeBytes,
          },
          embeddings: {
            provider: report.embeddingProvider.provider ?? 'unknown',
            available: report.embeddingProvider.status === 'ok',
          },
          uptime: process.uptime(),
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
        summary: 'Health check',
        description: 'Check server health and readiness',
      },
    },
  );
