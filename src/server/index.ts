import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';

import { healthRoutes } from './routes/health';
import { statsRoutes } from './routes/stats';

const DEFAULT_PORT = 3000;

export function createServer(options: { port?: number } = {}) {
  const port = options.port ?? DEFAULT_PORT;

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
    .use(statsRoutes);

  return { app, port };
}

export async function startServer(options: { port?: number } = {}) {
  const { app, port } = createServer(options);

  app.listen(port);

  console.log(`🌲 Forest server running at http://localhost:${port}`);
  console.log(`📚 API docs available at http://localhost:${port}/swagger`);

  return app;
}

// Start server if this file is run directly with Bun
if (import.meta.main) {
  const port = process.env.FOREST_PORT
    ? parseInt(process.env.FOREST_PORT, 10)
    : DEFAULT_PORT;

  startServer({ port });
}
