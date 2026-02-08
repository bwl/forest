import { handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { colorize } from '../formatters';
import { getBackend } from '../shared/remote';

type ClercModule = typeof import('clerc');

type LinkFlags = {
  name?: string;
  json?: boolean;
  tldr?: string;
};

export function createLinkCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'link',
      description: 'Create a bridge tag linking two notes (#link/...)',
      parameters: ['<a>', '<b>'],
      flags: {
        name: {
          type: String,
          description: 'Optional human-readable bridge name (creates #link/<name>)',
        },
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ parameters, flags }: { parameters: { a?: string; b?: string }; flags: LinkFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.link, getVersion(), jsonMode);
        }

        await runLink(parameters.a, parameters.b, flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runLink(aRef: string | undefined, bRef: string | undefined, flags: LinkFlags) {
  if (!aRef || !bRef) {
    console.error('✖ Provide two node references to link.');
    console.error('');
    console.error('Usage:');
    console.error('  forest link <ref1> <ref2> [--name=chapter-1-arc]');
    process.exitCode = 1;
    return;
  }

  const backend = getBackend();
  const result = await backend.linkNodes({
    sourceId: String(aRef),
    targetId: String(bRef),
    name: flags.name,
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`${colorize.success('✔')} Added bridge tag ${colorize.tag(result.tag)}`);
  console.log(`   ${colorize.label('A:')} ${result.nodes[0].shortId}  ${result.nodes[0].title}`);
  console.log(`   ${colorize.label('B:')} ${result.nodes[1].shortId}  ${result.nodes[1].title}`);
  console.log(
    `   ${colorize.label('edge:')} ${result.edge.status}  ` +
      `S=${result.edge.semanticScore === null ? '--' : result.edge.semanticScore.toFixed(3)}  ` +
      `T=${result.edge.tagScore === null ? '--' : result.edge.tagScore.toFixed(3)}`,
  );
}
