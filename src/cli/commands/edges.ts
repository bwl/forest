import chalk from 'chalk';

import {
  EdgeRecord,
  getNodesByIds,
  listEdges,
  listNodes,
} from '../../lib/db';
import { computeScore, getEdgeThreshold } from '../../lib/scoring';

import {
  describeSuggestion,
  resolveEdgeReference,
} from '../shared/edges';
import { formatId, handleError, getEdgePrefix } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { formatAcceptedEdgesTable } from '../formatters';

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
          emitTldrAndExit(COMMAND_TLDR['edges.explain'], getVersion());
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
          emitTldrAndExit(COMMAND_TLDR['edges.threshold'], getVersion());
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
          emitTldrAndExit(COMMAND_TLDR.edges, getVersion());
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
  const limit =
    typeof flags.limit === 'number' && !Number.isNaN(flags.limit) && flags.limit > 0 ? flags.limit : 10;
  const edges = await listEdges({ status: 'accepted', orderBy: 'updated_at', orderDirection: 'DESC', limit });

  if (edges.length === 0) {
    console.log('No edges found.');
    return;
  }

  // Extract unique node IDs from the limited edge set
  const nodeIds = [...new Set(edges.flatMap(e => [e.sourceId, e.targetId]))];
  const nodes = await getNodesByIds(nodeIds);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const longIds = Boolean(flags.longIds);
  const allEdges = edges;

  if (flags.json) {
    console.log(
      JSON.stringify(
        edges.map((edge, index) => {
          const desc = describeSuggestion(edge, nodeMap, { longIds, allEdges });
          return {
            index: index + 1,
            id: edge.id,
            shortId: desc.shortId,
            code: desc.code,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            sourceTitle: desc.sourceTitle,
            targetTitle: desc.targetTitle,
            score: edge.score,
            edgeType: edge.edgeType,
            metadata: edge.metadata,
            updatedAt: edge.updatedAt,
          };
        }),
        null,
        2,
      ),
    );
    return;
  }

  // Use modular formatter
  console.log(formatAcceptedEdgesTable(edges, nodeMap, { longIds, allEdges }));
}

async function runEdgesExplain(ref: string | undefined, flags: EdgesExplainFlags) {
  if (!ref) {
    console.error('✖ Missing required parameter "ref".');
    process.exitCode = 1;
    return;
  }

  const edges = await listEdges('all');
  const match = resolveEdgeReference(ref, edges);
  if (!match) {
    console.error('✖ No edge matched that reference.');
    process.exitCode = 1;
    return;
  }

  const nodes = await listNodes();
  const a = nodes.find((node) => node.id === match.sourceId);
  const b = nodes.find((node) => node.id === match.targetId);
  if (!a || !b) {
    console.error('✖ Edge endpoints no longer exist.');
    process.exitCode = 1;
    return;
  }

  const components = (match.metadata as any)?.components ?? computeScore(a, b).components;
  const code = getEdgePrefix(match.sourceId, match.targetId, edges);
  const threshold = getEdgeThreshold();

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          id: match.id,
          sourceId: match.sourceId,
          targetId: match.targetId,
          code,
          score: match.score,
          threshold,
          components,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    `${formatId(match.sourceId)}::${formatId(match.targetId)} [${code}]  score=${match.score.toFixed(3)}  threshold=${threshold}`,
  );
  console.log('components:');
  for (const [key, value] of Object.entries(components)) {
    if (typeof value === 'number') console.log(`  ${key}: ${value.toFixed(3)}`);
    else console.log(`  ${key}: ${String(value)}`);
  }
}

async function runEdgesThreshold() {
  const threshold = getEdgeThreshold();
  console.log(`Current edge threshold: ${threshold}`);
  console.log('');
  console.log('Edges are created when the similarity score >= threshold.');
  console.log('Set via FOREST_EDGE_THRESHOLD environment variable.');
}
