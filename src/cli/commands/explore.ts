import { DEFAULT_NEIGHBORHOOD_LIMIT, handleError } from '../shared/utils';
import { printExplore, selectNode } from '../shared/explore';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';

type ClercModule = typeof import('clerc');

export function createExploreCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'explore',
      description: 'Inspect a node\'s graph neighborhood',
      parameters: ['[id]'],
      flags: {
        id: {
          type: String,
          description: 'Node id or short id to focus on (can also be positional)',
        },
        title: {
          type: String,
          description: 'Exact node title to focus on',
        },
        depth: {
          type: Number,
          alias: 'd',
          description: 'Neighborhood depth',
          default: 1,
        },
        by: {
          type: String,
          description: 'Filter edges by score layer: semantic or tags',
        },
        minSemantic: {
          type: Number,
          description: 'Only include edges with semantic_score >= this value',
        },
        minTags: {
          type: Number,
          description: 'Only include edges with tag_score >= this value',
        },
        limit: {
          type: Number,
          alias: 'l',
          description: 'Maximum number of nodes in neighborhood',
        },
        longIds: {
          type: Boolean,
          description: 'Display full ids in human-readable output',
        },
        json: {
          type: Boolean,
          description: 'Emit JSON instead of text output',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags, parameters }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.explore, getVersion(), jsonMode);
        }

        const limitFlag =
          typeof flags.limit === 'number' && !Number.isNaN(flags.limit) ? flags.limit : undefined;
        const neighborhoodLimit = limitFlag ?? DEFAULT_NEIGHBORHOOD_LIMIT;

        const positionalId = parameters.id as string | undefined;
        const id = flags.id ?? positionalId;
        const title = flags.title;

        if (!id && !title) {
          console.error('✖ Provide a node id (or short id) or an exact title to explore.');
          process.exitCode = 1;
          return;
        }

        const selection = await selectNode({
          id: id,
          title: title,
          limit: 1,
        });

        await printExplore({
          selection,
          limit: neighborhoodLimit,
          matchLimit: selection.limit,
          depth: typeof flags.depth === 'number' && !Number.isNaN(flags.depth) ? flags.depth : 1,
          longIds: Boolean(flags.longIds),
          json: Boolean(flags.json),
          showMatches: !Boolean(flags.json),
          focusSelected: true,
          by: flags.by === 'semantic' || flags.by === 'tags' ? flags.by : undefined,
          minSemantic:
            typeof flags.minSemantic === 'number' && Number.isFinite(flags.minSemantic) ? flags.minSemantic : undefined,
          minTags: typeof flags.minTags === 'number' && Number.isFinite(flags.minTags) ? flags.minTags : undefined,
        });
      } catch (error) {
        handleError(error);
      }
    },
  );
}
