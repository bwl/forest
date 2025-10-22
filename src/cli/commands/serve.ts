import { handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';

type ClercModule = typeof import('clerc');

type ServeFlags = {
  port?: number;
  host?: string;
  tldr?: string;
};

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '::'; // Dual-stack: IPv4 and IPv6

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
          description: 'Host to bind to (:: for dual-stack IPv4/IPv6, 0.0.0.0 for IPv4 only)',
          default: DEFAULT_HOST,
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.serve, getVersion());
        }
        await runServe(flags as ServeFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runServe(flags: ServeFlags) {
  // Check if running under Bun
  if (typeof (globalThis as any).Bun === 'undefined') {
    console.error('❌ Error: forest serve requires Bun runtime');
    console.error('');
    console.error('To start the Forest server:');
    console.error('  1. Install Bun: https://bun.sh');
    console.error('  2. Run: bun run dev:server');
    process.exit(1);
  }

  const port = flags.port ?? DEFAULT_PORT;
  const hostname = flags.host ?? DEFAULT_HOST;

  // Dynamically import the server (only works with Bun)
  const { startServer } = await import('../../server/index.js');
  await startServer({ port, hostname });
}
