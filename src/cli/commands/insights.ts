import {
  EdgeRecord,
  deleteSuggestion,
  getLastEdgeEventForPair,
  insertOrUpdateEdge,
  listEdges,
  listNodes,
  logEdgeEvent,
  markEdgeEventUndone,
  promoteSuggestions,
} from '../../lib/db';
import { computeScore, getAutoAcceptThreshold } from '../../lib/scoring';

import {
  describeSuggestion,
  resolveEdgePairFromRef,
  resolveEdgeReference,
  resolveSuggestionReference,
} from '../shared/edges';
import { formatId, handleError, getEdgePrefix } from '../shared/utils';

import type { HandlerContext } from '@clerc/core';

type ClercModule = typeof import('clerc');
type ClercInstance = ReturnType<ClercModule['Clerc']['create']>;

type InsightsListFlags = {
  limit?: number;
  longIds?: boolean;
  json?: boolean;
};

type InsightsPromoteFlags = {
  minScore?: number;
};

type InsightsSweepFlags = {
  range?: string;
  maxScore?: number;
};

type InsightsExplainFlags = {
  json?: boolean;
};

export function registerInsightsCommands(cli: ClercInstance, clerc: ClercModule) {
  const listCommand = clerc.defineCommand(
      {
        name: 'insights list',
        description: 'List suggested links ordered by score',
        flags: {
          limit: {
            type: Number,
            description: 'Limit number of suggestions returned',
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
        },
      },
      async ({ flags }: { flags: InsightsListFlags }) => {
        try {
          await runInsightsList(flags);
        } catch (error) {
          handleError(error);
        }
      },
    );
  cli.command(listCommand);

  const promoteCommand = clerc.defineCommand(
      {
        name: 'insights promote',
        description: 'Promote suggestions above a score threshold to accepted edges',
        flags: {
          minScore: {
            type: Number,
            description: 'Minimum score to accept',
            default: getAutoAcceptThreshold(),
          },
        },
      },
      async ({ flags }: { flags: InsightsPromoteFlags }) => {
        try {
          await runInsightsPromote(flags);
        } catch (error) {
          handleError(error);
        }
      },
    );
  cli.command(promoteCommand);

  const acceptCommand = clerc.defineCommand(
      {
        name: 'insights accept',
        description: 'Promote a single suggestion by progressive ID, short pair, or edge id',
        parameters: ['<ref>'],
      },
      async ({ parameters }: { parameters: { ref?: string } }) => {
        try {
          await runInsightsAccept(parameters.ref);
        } catch (error) {
          handleError(error);
        }
      },
    );
  cli.command(acceptCommand);

  const rejectCommand = clerc.defineCommand(
      {
        name: 'insights reject',
        description: 'Reject and remove a suggestion by progressive ID, short pair, or edge id',
        parameters: ['<ref>'],
      },
      async ({ parameters }: { parameters: { ref?: string } }) => {
        try {
          await runInsightsReject(parameters.ref);
        } catch (error) {
          handleError(error);
        }
      },
    );
  cli.command(rejectCommand);

  const sweepCommand = clerc.defineCommand(
      {
        name: 'insights sweep',
        description: 'Bulk-reject suggestions by index range or score',
        flags: {
          range: {
            type: String,
            description: 'Comma-separated indexes or ranges (e.g., 1-10,15)',
          },
          maxScore: {
            type: Number,
            description: 'Reject suggestions at or below this score',
          },
        },
      },
      async ({ flags }: { flags: InsightsSweepFlags }) => {
        try {
          await runInsightsSweep(flags);
        } catch (error) {
          handleError(error);
        }
      },
    );
  cli.command(sweepCommand);

  const explainCommand = clerc.defineCommand(
    {
      name: 'insights explain',
      description: 'Explain how a link was scored by id or short pair',
      parameters: ['<ref>'],
      flags: {
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
      },
    },
    async ({ parameters, flags }: { parameters: { ref?: string }; flags: InsightsExplainFlags }) => {
      try {
        await runInsightsExplain(parameters.ref, flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(explainCommand);

  const undoCommand = clerc.defineCommand(
    {
      name: 'insights undo',
      description: 'Undo the last accept/reject action for a link',
      parameters: ['<ref>'],
    },
    async ({ parameters }: { parameters: { ref?: string } }) => {
      try {
        await runInsightsUndo(parameters.ref);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(undoCommand);

  const baseCommand = clerc.defineCommand(
    {
      name: 'insights',
      description: 'Manage suggested edges',
      help: {
        notes: [
          'Subcommands:',
          '  list      List suggested links ordered by score',
          '  promote   Promote suggestions above a score threshold',
          '  accept    Accept a single suggestion by reference',
          '  reject    Remove a single suggestion by reference',
          '  sweep     Bulk-reject suggestions by range or score',
          '  explain   Explain scoring components for a link',
          '  undo      Undo the last accept/reject action',
          '',
          'Use `forest insights <subcommand> --help` for flag details.',
        ],
        examples: [
          ['$ forest insights list', 'Show top pending suggestions'],
          ['$ forest insights accept 0L5a', 'Accept suggestion by progressive ID'],
        ],
      },
    },
    async (ctx: HandlerContext) => {
      try {
        await ctx.cli.parse({ argv: ['help', 'insights'], run: true });
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(baseCommand);
}

async function runInsightsList(flags: InsightsListFlags) {
  const limit =
    typeof flags.limit === 'number' && !Number.isNaN(flags.limit) && flags.limit > 0 ? flags.limit : 10;
  const edges = (await listEdges('suggested')).sort((a, b) => b.score - a.score).slice(0, limit);

  if (edges.length === 0) {
    console.log('No suggestions ready.');
    return;
  }

  const nodeMap = new Map((await listNodes()).map((node) => [node.id, node]));
  const longIds = Boolean(flags.longIds);

  // Fetch all edges for progressive ID calculation
  const allEdges = await listEdges('all');

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
            metadata: edge.metadata,
          };
        }),
        null,
        2,
      ),
    );
    return;
  }

  edges.forEach((edge, index) => {
    const desc = describeSuggestion(edge, nodeMap, { longIds, allEdges });
    const indexLabel = String(index + 1).padStart(2, ' ');
    console.log(
      `${indexLabel}. [${desc.code}] ${desc.edgeId}  score=${edge.score.toFixed(3)}  ${desc.sourceLabel} ↔ ${desc.targetLabel}`,
    );
  });
}

async function runInsightsPromote(flags: InsightsPromoteFlags) {
  const minScore =
    typeof flags.minScore === 'number' && !Number.isNaN(flags.minScore)
      ? flags.minScore
      : getAutoAcceptThreshold();
  const changes = await promoteSuggestions(minScore);
  console.log(`✔ Promoted ${changes} suggestions with score ≥ ${minScore.toFixed(3)}`);
}

async function runInsightsAccept(ref: string | undefined) {
  if (!ref) {
    console.error('✖ Missing required parameter "ref".');
    process.exitCode = 1;
    return;
  }

  const suggestions = (await listEdges('suggested')).sort((a, b) => b.score - a.score);
  if (suggestions.length === 0) {
    console.error('✖ No suggestions available.');
    process.exitCode = 1;
    return;
  }

  const edge = resolveSuggestionReference(ref, suggestions);
  if (!edge) {
    console.error('✖ No suggestion matched that reference. Use progressive ID from `forest insights list`.');
    process.exitCode = 1;
    return;
  }

  const accepted: EdgeRecord = {
    ...edge,
    status: 'accepted',
    updatedAt: new Date().toISOString(),
  };

  await logEdgeEvent({
    edgeId: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    prevStatus: edge.status,
    nextStatus: 'accepted',
    payload: { score: edge.score, metadata: edge.metadata },
  });
  await insertOrUpdateEdge(accepted);
  console.log(`✔ Accepted suggestion ${formatId(edge.sourceId)}::${formatId(edge.targetId)}`);
}

async function runInsightsReject(ref: string | undefined) {
  if (!ref) {
    console.error('✖ Missing required parameter "ref".');
    process.exitCode = 1;
    return;
  }

  const suggestions = (await listEdges('suggested')).sort((a, b) => b.score - a.score);
  if (suggestions.length === 0) {
    console.error('✖ No suggestions available.');
    process.exitCode = 1;
    return;
  }

  const edge = resolveSuggestionReference(ref, suggestions);
  if (!edge) {
    console.error('✖ No suggestion matched that reference. Use progressive ID from `forest insights list`.');
    process.exitCode = 1;
    return;
  }

  await logEdgeEvent({
    edgeId: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    prevStatus: edge.status,
    nextStatus: 'deleted',
    payload: { score: edge.score, metadata: edge.metadata },
  });
  const removed = await deleteSuggestion(edge.id);
  if (removed === 0) {
    console.error('✖ Suggestion could not be removed.');
    process.exitCode = 1;
    return;
  }
  console.log(`✔ Removed suggestion ${formatId(edge.sourceId)}::${formatId(edge.targetId)}`);
}

async function runInsightsSweep(flags: InsightsSweepFlags) {
  const suggestions = (await listEdges('suggested')).sort((a, b) => b.score - a.score);
  if (suggestions.length === 0) {
    console.log('No suggestions ready.');
    return;
  }

  const targets = new Set<number>();

  if (typeof flags.range === 'string' && flags.range.trim().length > 0) {
    for (const part of flags.range.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const range = trimmed.match(/^(\d+)-(\d+)$/);
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
          for (let i = start; i <= end; i += 1) targets.add(i);
        }
      } else if (/^\d+$/.test(trimmed)) {
        targets.add(Number(trimmed));
      }
    }
  }

  if (typeof flags.maxScore === 'number' && Number.isFinite(flags.maxScore)) {
    const threshold = flags.maxScore;
    const eps = 1e-9;
    suggestions.forEach((edge, idx) => {
      if (edge.score <= threshold + eps) targets.add(idx + 1);
    });
  }

  const toDelete = [...targets]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= suggestions.length)
    .sort((a, b) => a - b);

  if (toDelete.length === 0) {
    console.log('No matches to remove.');
    return;
  }

  let removed = 0;
  for (const index of toDelete) {
    const edge = suggestions[index - 1];
    const changes = await deleteSuggestion(edge.id);
    if (changes > 0) removed += 1;
  }

  console.log(`✔ Removed ${removed} suggestions`);
}

async function runInsightsExplain(ref: string | undefined, flags: InsightsExplainFlags) {
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

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          id: match.id,
          sourceId: match.sourceId,
          targetId: match.targetId,
          code,
          score: match.score,
          status: match.status,
          components,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    `${formatId(match.sourceId)}::${formatId(match.targetId)} [${code}]  status=${match.status}  score=${match.score.toFixed(
      3,
    )}`,
  );
  console.log('components:');
  for (const [key, value] of Object.entries(components)) {
    if (typeof value === 'number') console.log(`  ${key}: ${value.toFixed(3)}`);
    else console.log(`  ${key}: ${String(value)}`);
  }
}

async function runInsightsUndo(ref: string | undefined) {
  if (!ref) {
    console.error('✖ Missing required parameter "ref".');
    process.exitCode = 1;
    return;
  }

  const pair = await resolveEdgePairFromRef(ref);
  if (!pair) {
    console.error('✖ Could not resolve edge reference.');
    process.exitCode = 1;
    return;
  }
  const [sourceId, targetId] = pair;
  const event = await getLastEdgeEventForPair(sourceId, targetId);
  if (!event) {
    console.error('✖ No prior action found to undo.');
    process.exitCode = 1;
    return;
  }

  if (event.nextStatus === 'accepted') {
    const edge: EdgeRecord = {
      id: `${sourceId}::${targetId}`,
      sourceId,
      targetId,
      score: (event.payload?.score as number) ?? 0,
      status: 'suggested',
      metadata: event.payload?.metadata ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await insertOrUpdateEdge(edge);
    await markEdgeEventUndone(event.id);
    console.log(`✔ Undid accept: restored suggestion ${formatId(sourceId)}::${formatId(targetId)}`);
    return;
  }

  if (event.nextStatus === 'deleted') {
    const edge: EdgeRecord = {
      id: `${sourceId}::${targetId}`,
      sourceId,
      targetId,
      score: (event.payload?.score as number) ?? 0,
      status: 'suggested',
      metadata: event.payload?.metadata ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await insertOrUpdateEdge(edge);
    await markEdgeEventUndone(event.id);
    console.log(`✔ Undid reject: restored suggestion ${formatId(sourceId)}::${formatId(targetId)}`);
    return;
  }

  console.error('✖ Nothing to undo for this edge.');
  process.exitCode = 1;
}
