import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';

import { healthRoutes } from './routes/health';
import { statsRoutes } from './routes/stats';
import { nodesRoutes } from './routes/nodes';
import { tagsRoutes } from './routes/tags';
import { edgesRoutes } from './routes/edges';
import { searchRoutes } from './routes/search';
import { websocketRoute } from './routes/websocket';

const DEFAULT_PORT = 3000;
const DEFAULT_HOSTNAME = '::'; // Dual-stack: listens on both IPv4 and IPv6

export function createServer(options: { port?: number; hostname?: string } = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const hostname = options.hostname ?? DEFAULT_HOSTNAME;

  const app = new Elysia()
    .use(cors())
    .use(
      swagger({
        documentation: {
          info: {
            title: 'Forest API',
            version: '0.3.0',
            description: 'Graph-native knowledge base server',
          },
          tags: [
            { name: 'System', description: 'Health and statistics endpoints' },
            { name: 'Nodes', description: 'Node CRUD operations' },
            { name: 'Edges', description: 'Edge management' },
            { name: 'Tags', description: 'Tag operations' },
            { name: 'Search', description: 'Semantic search operations' },
          ],
        },
      }),
    )
    .get('/', () => ({
      name: 'Forest API',
      version: '0.3.0',
      documentation: '/swagger',
    }))
    .use(healthRoutes)
    .use(statsRoutes)
    .use(nodesRoutes)
    .use(edgesRoutes)
    .use(tagsRoutes)
    .use(searchRoutes)
    .use(websocketRoute);

  return { app, port, hostname };
}

export async function startServer(options: { port?: number; hostname?: string } = {}) {
  const { app, port, hostname } = createServer(options);

  app.listen({ hostname, port });

  // Display user-friendly URL
  const displayHost = hostname === '::' || hostname === '0.0.0.0' ? 'localhost' : hostname;
  console.log(`🌲 Forest server running at http://${displayHost}:${port}`);
  console.log(`📚 API docs available at http://${displayHost}:${port}/swagger`);
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
