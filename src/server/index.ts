import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { getVersion } from '../cli/commands/version';

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
const DEFAULT_HOSTNAME = '127.0.0.1';
const ALLOW_UNAUTHENTICATED_PUBLIC_ENV = 'FOREST_ALLOW_UNAUTHENTICATED_PUBLIC';

/** Routes that do not require authentication */
const PUBLIC_PATHS = new Set(['/', '/api/v1/health']);

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) return true;
  if (path.startsWith('/swagger')) return true;
  if (path === '/web' || path.startsWith('/web/')) return true;
  return false;
}

function isPublicHostname(hostname: string): boolean {
  return hostname === '::' || hostname === '0.0.0.0';
}

function assertSafeServerConfig(hostname: string, apiKey: string | undefined) {
  if (!isPublicHostname(hostname)) return;
  if (apiKey) return;
  if (process.env[ALLOW_UNAUTHENTICATED_PUBLIC_ENV] === '1') return;

  throw new Error(
    `Refusing to serve unauthenticated Forest API on ${hostname}. ` +
      'Set FOREST_API_KEY or bind to 127.0.0.1. ' +
      `To override for a trusted network, set ${ALLOW_UNAUTHENTICATED_PUBLIC_ENV}=1.`,
  );
}

export function createServer(options: { port?: number; hostname?: string } = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const hostname = options.hostname ?? DEFAULT_HOSTNAME;
  const apiKey = process.env.FOREST_API_KEY;
  const version = getVersion();

  assertSafeServerConfig(hostname, apiKey);

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
          meta: { timestamp: new Date().toISOString(), version },
        };
      }

      const token = authHeader.slice(7);
      if (token !== apiKey) {
        set.status = 401;
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid API key', details: {} },
          meta: { timestamp: new Date().toISOString(), version },
        };
      }
    })
    .use(
      swagger({
        documentation: {
          info: {
            title: 'Forest API',
            version,
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
      version,
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
  } else if (isPublicHostname(hostname)) {
    console.warn(`⚠️  Bearer token auth disabled on public bind`);
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
