import {
  EdgeRecord,
  EdgeStatus,
  deleteEdgeBetween,
  insertOrUpdateEdge,
  listNodes,
  updateNode,
} from '../../lib/db';
import { computeEmbeddingForNode, embeddingsEnabled } from '../../lib/embeddings';
import { classifyScore, computeScore, normalizeEdgePair } from '../../lib/scoring';

import { edgeIdentifier, handleError } from '../shared/utils';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';

type ClercModule = typeof import('clerc');

type AdminRecomputeEmbeddingsFlags = {
  rescore?: boolean;
  tldr?: string;
};

export function createAdminRecomputeEmbeddingsCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'admin:recompute-embeddings',
      description: 'Compute embeddings for all notes; optionally rescore links',
      flags: {
        rescore: {
          type: Boolean,
          description: 'Rescore all edges after computing embeddings',
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
          emitTldrAndExit(COMMAND_TLDR['admin.recompute-embeddings'], jsonMode);
        }
        await runAdminRecomputeEmbeddings(flags as AdminRecomputeEmbeddingsFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runAdminRecomputeEmbeddings(flags: AdminRecomputeEmbeddingsFlags) {
  if (!embeddingsEnabled()) {
    console.log('Embeddings are disabled (FOREST_EMBED_PROVIDER=none). Nothing to do.');
    return;
  }

  const nodes = await listNodes();
  let updated = 0;
  for (const node of nodes) {
    const embedding = await computeEmbeddingForNode({ title: node.title, body: node.body });
    if (!embedding) continue;
    await updateNode(node.id, { embedding });
    updated += 1;
  }
  console.log(`✔ Recomputed embeddings for ${updated} notes`);

  if (!flags.rescore) return;

  let accepted = 0;
  let suggested = 0;
  const refreshed = await listNodes();
  for (let i = 0; i < refreshed.length; i += 1) {
    const a = refreshed[i];
    for (let j = i + 1; j < refreshed.length; j += 1) {
      const b = refreshed[j];
      const { score, components } = computeScore(a, b);
      const status = classifyScore(score);
      const [sourceId, targetId] = normalizeEdgePair(a.id, b.id);

      if (status === 'discard') {
        await deleteEdgeBetween(sourceId, targetId);
        continue;
      }

      const edge: EdgeRecord = {
        id: edgeIdentifier(sourceId, targetId),
        sourceId,
        targetId,
        score,
        status: status as EdgeStatus,
        metadata: { components },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await insertOrUpdateEdge(edge);
      if (status === 'accepted') accepted += 1;
      if (status === 'suggested') suggested += 1;
    }
  }
  console.log(`✔ Rescored graph: ${accepted} accepted, ${suggested} suggested`);
}
