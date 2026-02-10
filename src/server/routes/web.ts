import { Elysia } from 'elysia';
import { resolve } from 'path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function getWebDir(): string {
  // __dirname works in both Bun's CommonJS and ESM modes
  return resolve(__dirname, '../../web');
}

function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

async function serveFile(filePath: string, set: any) {
  // @ts-ignore - Bun.file is Bun-specific
  const file = (globalThis as any).Bun.file(filePath);
  if (await file.exists()) {
    set.headers['content-type'] = getMimeType(filePath);
    return file;
  }
  set.status = 404;
  return 'Not found';
}

export const webRoutes = new Elysia()
  .get('/web', async ({ set }) => {
    return serveFile(resolve(getWebDir(), 'index.html'), set);
  })
  .get('/web/*', async ({ params, set }) => {
    const requested = (params as any)['*'];
    // Prevent directory traversal
    if (requested.includes('..')) {
      set.status = 400;
      return 'Invalid path';
    }
    return serveFile(resolve(getWebDir(), requested), set);
  });
