import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';

import { healthRoutes } from './routes/health';
import { statsRoutes } from './routes/stats';
import { nodesRoutes } from './routes/nodes';
import { tagsRoutes } from './routes/tags';
import { edgesRoutes } from './routes/edges';
import { searchRoutes } from './routes/search';
import { documentsRoutes } from './routes/documents';
import { graphRoutes } from './routes/graph';
import { exportRoutes } from './routes/export';
import { suggestRoutes } from './routes/suggest';
import { contextRoutes } from './routes/context';
import { websocketRoute } from './routes/websocket';
import { webRoutes } from './routes/web';

const DEFAULT_PORT = 3000;
const DEFAULT_HOSTNAME = '::'; // Dual-stack: listens on both IPv4 and IPv6

/** Routes that do not require authentication */
const PUBLIC_PATHS = new Set(['/', '/api/v1/health']);

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) return true;
  if (path.startsWith('/swagger')) return true;
  if (path === '/web' || path.startsWith('/web/')) return true;
  return false;
}

export function createServer(options: { port?: number; hostname?: string } = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const hostname = options.hostname ?? DEFAULT_HOSTNAME;
  const apiKey = process.env.FOREST_API_KEY;

  const app = new Elysia()
    .use(cors())
    .onBeforeHandle(({ request, set }) => {
      if (!apiKey) return;
      const url = new URL(request.url);
      if (isPublicPath(url.pathname)) return;

      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        set.status = 401;
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header', details: {} },
          meta: { timestamp: new Date().toISOString(), version: '0.6.0' },
        };
      }

      const token = authHeader.slice(7);
      if (token !== apiKey) {
        set.status = 401;
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid API key', details: {} },
          meta: { timestamp: new Date().toISOString(), version: '0.6.0' },
        };
      }
    })
    .use(
      swagger({
        documentation: {
          info: {
            title: 'Forest API',
            version: '0.6.0',
            description: 'Graph-native knowledge base server',
          },
          tags: [
            { name: 'System', description: 'Health and statistics endpoints' },
            { name: 'Nodes', description: 'Node CRUD operations' },
            { name: 'Documents', description: 'Canonical document operations' },
            { name: 'Edges', description: 'Edge management' },
            { name: 'Tags', description: 'Tag operations' },
            { name: 'Search', description: 'Semantic search operations' },
            { name: 'Graph', description: 'Graph traversal operations' },
            { name: 'Export', description: 'Data export operations' },
          ],
        },
      }),
    )
    .get('/', () => ({
      name: 'Forest API',
      version: '0.6.0',
      documentation: '/swagger',
    }))
    .use(healthRoutes)
    .use(statsRoutes)
    .use(nodesRoutes)
    .use(documentsRoutes)
    .use(edgesRoutes)
    .use(tagsRoutes)
    .use(searchRoutes)
    .use(graphRoutes)
    .use(exportRoutes)
    .use(suggestRoutes)
    .use(contextRoutes)
    .use(websocketRoute)
    .use(webRoutes);

  return { app, port, hostname };
}

export async function startServer(options: { port?: number; hostname?: string } = {}) {
  const { app, port, hostname } = createServer(options);

  app.listen({ hostname, port });

  // Display user-friendly URL
  const displayHost = hostname === '::' || hostname === '0.0.0.0' ? 'localhost' : hostname;
  console.log(`🌲 Forest server running at http://${displayHost}:${port}`);
  console.log(`🌐 Web UI available at http://${displayHost}:${port}/web`);
  console.log(`📚 API docs available at http://${displayHost}:${port}/swagger`);
  if (process.env.FOREST_API_KEY) {
    console.log(`🔒 Bearer token auth enabled`);
  }
  if (hostname === '::') {
    console.log(`   (Dual-stack mode: IPv4 and IPv6 enabled)`);
  }

  return app;
}

// Start server if this file is run directly with Bun
// @ts-ignore - import.meta.main is Bun-specific
if (typeof (globalThis as any).Bun !== 'undefined' && import.meta.main) {
  const port = process.env.FOREST_PORT
    ? parseInt(process.env.FOREST_PORT, 10)
    : DEFAULT_PORT;
  const hostname = process.env.FOREST_HOST ?? DEFAULT_HOSTNAME;

  startServer({ port, hostname });
}
