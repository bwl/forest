import { formatId, handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { colorize } from '../formatters';
import { getBackend } from '../shared/remote';

type ClercModule = typeof import('clerc');

type SuggestFlags = {
  project?: string;
  limit?: number;
  json?: boolean;
  tldr?: string;
};

export function createSuggestCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'suggest',
      description: 'Suggest relevant nodes for the current project',
      flags: {
        project: {
          type: String,
          alias: 'p',
          description: 'Override project name (default: auto-detect from cwd)',
        },
        limit: {
          type: Number,
          alias: 'l',
          description: 'Max suggestions to show',
          default: 10,
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
    async ({ flags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.suggest, getVersion(), jsonMode);
        }
        await runSuggest(flags as SuggestFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runSuggest(flags: SuggestFlags) {
  const limit =
    typeof flags.limit === 'number' && Number.isFinite(flags.limit) && flags.limit > 0
      ? Math.floor(flags.limit)
      : 10;

  const backend = getBackend();
  const result = await backend.suggest({ project: flags.project, limit });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.project) {
    console.log('Could not detect project from current directory.');
    return;
  }

  if (result.suggestions.length === 0) {
    console.log(`No nodes found for project:${result.project}. Capture some knowledge first.`);
    return;
  }

  // Header
  const header = colorize.label(`forest suggest`) +
    `  (project:${result.project}, ${result.total} node${result.total !== 1 ? 's' : ''} in scope)`;
  console.log(header);
  console.log('');

  // Breadcrumbs
  for (const suggestion of result.suggestions) {
    const id = colorize.nodeId(suggestion.shortId);
    const title = suggestion.title || '(untitled)';
    const tagStr = suggestion.tags.length > 0
      ? '  ' + colorize.grey(suggestion.tags.join(', '))
      : '';

    console.log(`  ${id}  ${title}${tagStr}`);

    if (suggestion.excerpt) {
      console.log(`            ${colorize.grey(suggestion.excerpt)}`);
    }
  }

  console.log('');
}
