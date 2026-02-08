import { DEFAULT_NEIGHBORHOOD_LIMIT, formatId, handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { getBackend } from '../shared/remote';
import { colorize } from '../formatters';

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
          console.error('Provide a node id (or short id) or an exact title to explore.');
          process.exitCode = 1;
          return;
        }

        const depth = typeof flags.depth === 'number' && !Number.isNaN(flags.depth) ? flags.depth : 1;
        const longIds = Boolean(flags.longIds);
        const json = Boolean(flags.json);

        await runExplore({ id, title, depth, limit: neighborhoodLimit, longIds, json });
      } catch (error) {
        handleError(error);
      }
    },
  );
}

type ExploreOptions = {
  id?: string;
  title?: string;
  depth: number;
  limit: number;
  longIds: boolean;
  json: boolean;
};

async function runExplore(opts: ExploreOptions) {
  const backend = getBackend();

  // Step 1: Resolve the node via metadata search
  const searchResult = await backend.searchMetadata({
    id: opts.id,
    title: opts.title,
    limit: 1,
  });

  if (searchResult.matches.length === 0) {
    const term = opts.title ?? opts.id ?? '';
    throw new Error(`No node matching "${term}".`);
  }

  const node = searchResult.matches[0];

  // Step 2: Get neighborhood
  const neighborhood = await backend.getNeighborhood(node.id, {
    depth: opts.depth,
    limit: opts.limit,
  });

  if (opts.json) {
    console.log(JSON.stringify({
      selected: { id: node.id, title: node.title, tags: node.tags },
      neighborhood,
    }, null, 2));
    return;
  }

  // Display node overview
  const fmtId = opts.longIds ? node.id : formatId(node.id);
  console.log(`${colorize.nodeId(fmtId)} ${node.title}`);
  if (node.tags.length > 0) {
    const tagLabels = node.tags.map((tag: string) => colorize.tag(tag)).join(', ');
    console.log(`${colorize.label('tags:')} ${tagLabels}`);
  }
  console.log('');

  // Display edges
  const directEdges = neighborhood.edges.filter(
    (e) => e.source === node.id || e.target === node.id,
  );

  if (directEdges.length > 0) {
    console.log(`${colorize.label('accepted edges:')}`);
    const nodeMap = new Map(neighborhood.nodes.map((n) => [n.id, n]));
    for (const edge of directEdges) {
      const otherId = edge.source === node.id ? edge.target : edge.source;
      const otherNode = nodeMap.get(otherId);
      const otherTitle = otherNode ? otherNode.title : otherId;
      const otherFmtId = opts.longIds ? otherId : formatId(otherId);
      const coloredScore = colorize.embeddingScore(edge.score);
      console.log(`  ${coloredScore}  ${colorize.nodeId(otherFmtId)}  ${otherTitle}`);
    }
  } else {
    console.log(`${colorize.label('accepted edges:')} none`);
  }
}
