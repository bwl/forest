import { formatId, handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { getBackend } from '../shared/remote';

import type { HandlerContext } from '@clerc/core';

type ClercModule = typeof import('clerc');
type ClercInstance = ReturnType<ClercModule['Clerc']['create']>;

type EdgesListFlags = {
  limit?: number;
  longIds?: boolean;
  json?: boolean;
  tldr?: string;
};

type EdgesExplainFlags = {
  json?: boolean;
  tldr?: string;
};

type EdgesThresholdFlags = {
  tldr?: string;
};

export function registerEdgesCommands(cli: ClercInstance, clerc: ClercModule) {
  const explainCommand = clerc.defineCommand(
    {
      name: 'edges explain',
      description: 'Explain how a link was scored by id or short pair',
      parameters: ['<ref>'],
      flags: {
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
    async ({ parameters, flags }: { parameters: { ref?: string }; flags: EdgesExplainFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['edges.explain'], getVersion(), jsonMode);
        }
        await runEdgesExplain(parameters.ref, flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(explainCommand);

  const thresholdCommand = clerc.defineCommand(
    {
      name: 'edges threshold',
      description: 'View the current edge acceptance threshold',
      flags: {
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: EdgesThresholdFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['edges.threshold'], getVersion(), jsonMode);
        }
        await runEdgesThreshold();
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(thresholdCommand);

  const baseCommand = clerc.defineCommand(
    {
      name: 'edges',
      description: 'View edges between nodes',
      flags: {
        limit: {
          type: Number,
          description: 'Limit number of edges returned',
          default: 10,
        },
        longIds: {
          type: Boolean,
          description: 'Display full identifiers in output',
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
      help: {
        notes: [
          'Shows edges in the graph, sorted by recency.',
          '',
          'Subcommands:',
          '  explain    Explain scoring components for a link',
          '  threshold  View the current edge threshold',
          '',
          'Use `forest edges <subcommand> --help` for flag details.',
        ],
        examples: [
          ['$ forest edges', 'Show most recent edges'],
          ['$ forest edges --limit 20', 'Show 20 most recent edges'],
          ['$ forest edges explain 0L5a7Knm', 'Explain scoring for an edge'],
        ],
      },
    },
    async ({ flags }: { flags: EdgesListFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.edges, getVersion(), jsonMode);
        }
        await runEdgesList(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(baseCommand);
}

async function runEdgesList(flags: EdgesListFlags) {
  const backend = getBackend();
  const limit = typeof flags.limit === 'number' && !Number.isNaN(flags.limit) && flags.limit > 0 ? flags.limit : 10;
  const result = await backend.listEdges({ limit });

  if (result.edges.length === 0) {
    console.log('No edges found.');
    return;
  }

  if (flags.json) {
    console.log(JSON.stringify(result.edges, null, 2));
    return;
  }

  for (const edge of result.edges) {
    const src = edge.sourceNode ? `${edge.sourceNode.shortId} ${edge.sourceNode.title}` : formatId(edge.sourceId);
    const tgt = edge.targetNode ? `${edge.targetNode.shortId} ${edge.targetNode.title}` : formatId(edge.targetId);
    console.log(`[${edge.ref}] ${edge.score.toFixed(3)}  ${src} ↔ ${tgt}`);
  }
}

async function runEdgesExplain(ref: string | undefined, flags: EdgesExplainFlags) {
  if (!ref) {
    console.error('✖ Missing required parameter "ref".');
    process.exitCode = 1;
    return;
  }

  const backend = getBackend();
  const result = await backend.explainEdge(ref.trim());

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const e = result.edge;
  console.log(
    `${formatId(e.sourceId)}::${formatId(e.targetId)}  score=${e.score.toFixed(3)}  ` +
      `S=${e.semanticScore === null ? '--' : e.semanticScore.toFixed(3)}  ` +
      `T=${e.tagScore === null ? '--' : e.tagScore.toFixed(3)}`,
  );
  const c = result.classification;
  console.log(`thresholds: semantic>=${c.semanticThreshold.toFixed(3)} OR tags>=${c.tagThreshold.toFixed(3)}`);
  console.log(`shared tags: ${e.sharedTags.length > 0 ? e.sharedTags.join(', ') : 'none'}`);
  console.log('tag components:');
  for (const [key, value] of Object.entries(result.breakdown.tagComponents)) {
    if (typeof value === 'number') console.log(`  ${key}: ${value.toFixed(3)}`);
    else console.log(`  ${key}: ${String(value)}`);
  }
}

async function runEdgesThreshold() {
  const backend = getBackend();
  const result = await backend.getEdgeThresholds();
  console.log(`Semantic threshold: ${result.semanticThreshold}`);
  console.log(`Tag threshold: ${result.tagThreshold}`);
  console.log('');
  console.log('Edges are created when semantic_score or tag_score exceeds its threshold.');
  if (backend.isRemote) {
    console.log('(Thresholds configured on the remote server.)');
  } else {
    console.log('Set via FOREST_SEMANTIC_THRESHOLD / FOREST_TAG_THRESHOLD environment variables.');
  }
}
