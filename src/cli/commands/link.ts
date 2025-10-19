import { EdgeRecord, EdgeStatus, insertOrUpdateEdge } from '../../lib/db';
import { computeScore, normalizeEdgePair } from '../../lib/scoring';

import { handleError, resolveNodeReference, edgeIdentifier, formatId } from '../shared/utils';

type ClercModule = typeof import('clerc');

type LinkFlags = {
  score?: number;
  suggest?: boolean;
  explain?: boolean;
};

export function createLinkCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'link',
      description: 'Manually create an edge between two notes',
      parameters: ['<a>', '<b>'],
      flags: {
        score: {
          type: Number,
          description: 'Override score value',
        },
        suggest: {
          type: Boolean,
          description: 'Create as a suggestion instead of accepted',
        },
        explain: {
          type: Boolean,
          description: 'Print scoring components',
        },
      },
    },
    async ({ parameters, flags }) => {
      try {
        await runLink(parameters.a, parameters.b, flags as LinkFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runLink(aRef: string | undefined, bRef: string | undefined, flags: LinkFlags) {
  if (!aRef || !bRef) {
    console.error('✖ Missing required parameters "<a>" and "<b>".');
    process.exitCode = 1;
    return;
  }

  const a = await resolveNodeReference(String(aRef));
  const b = await resolveNodeReference(String(bRef));
  if (!a || !b) {
    console.error('✖ Both endpoints must resolve to existing notes.');
    process.exitCode = 1;
    return;
  }

  const { score: computedScore, components } = computeScore(a, b);
  const scoreOverride =
    typeof flags.score === 'number' && !Number.isNaN(flags.score) ? flags.score : undefined;
  const usedScore = scoreOverride ?? computedScore;

  const status: EdgeStatus = flags.suggest ? 'suggested' : 'accepted';
  const [sourceId, targetId] = normalizeEdgePair(a.id, b.id);

  const edge: EdgeRecord = {
    id: edgeIdentifier(sourceId, targetId),
    sourceId,
    targetId,
    score: usedScore,
    status,
    metadata: { components },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await insertOrUpdateEdge(edge);
  console.log(
    `✔ Linked ${formatId(sourceId)}::${formatId(targetId)}  status=${status}  score=${usedScore.toFixed(
      3,
    )}`,
  );

  if (flags.explain) {
    console.log('components:');
    for (const [key, value] of Object.entries(components)) {
      if (typeof value === 'number') {
        console.log(`  ${key}: ${value.toFixed(3)}`);
      } else {
        console.log(`  ${key}: ${String(value)}`);
      }
    }
  }
}
