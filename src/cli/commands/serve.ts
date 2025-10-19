import { handleError } from '../shared/utils';

type ClercModule = typeof import('clerc');

type ServeFlags = {
  port?: number;
  host?: string;
};

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = 'localhost';

export function createServeCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'serve',
      description: 'Start Forest API server (requires Bun runtime)',
      flags: {
        port: {
          type: Number,
          description: 'Port to listen on',
          default: DEFAULT_PORT,
        },
        host: {
          type: String,
          description: 'Host to bind to',
          default: DEFAULT_HOST,
        },
      },
    },
    async ({ flags }) => {
      try {
        await runServe(flags as ServeFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runServe(flags: ServeFlags) {
  // Check if running under Bun
  if (typeof Bun === 'undefined') {
    console.error('❌ Error: forest serve requires Bun runtime');
    console.error('');
    console.error('To start the Forest server:');
    console.error('  1. Install Bun: https://bun.sh');
    console.error('  2. Run: bun run src/server/index.ts');
    console.error('  Or use: npm run dev:server');
    process.exit(1);
  }

  const port = flags.port ?? DEFAULT_PORT;

  // Dynamically import the server (only works with Bun)
  const { startServer } = await import('../../server/index.js');
  await startServer({ port });
}
