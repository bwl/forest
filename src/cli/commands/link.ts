import { createHash } from 'crypto';

import { deleteEdgeBetween, insertOrUpdateEdge, listNodes, rebuildTagIdf, updateNode } from '../../lib/db';
import { buildTagIdfContext, classifyEdgeScores, computeEdgeScore, normalizeEdgePair } from '../../lib/scoring';

import { edgeIdentifier, formatId, handleError, resolveNodeReference } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { colorize } from '../formatters';

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
          emitTldrAndExit(COMMAND_TLDR.link, getVersion());
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

  const a = await resolveNodeReference(String(aRef));
  const b = await resolveNodeReference(String(bRef));
  if (!a || !b) {
    console.error('✖ Both endpoints must resolve to existing notes.');
    process.exitCode = 1;
    return;
  }

  const [sourceId, targetId] = normalizeEdgePair(a.id, b.id);
  const name = flags.name ? sanitizeBridgeName(flags.name) : makeBridgeHash(sourceId, targetId);
  const bridgeTag = `link/${name}`;

  const nextTagsA = addTag(a.tags, bridgeTag);
  const nextTagsB = addTag(b.tags, bridgeTag);

  await updateNode(a.id, { tags: nextTagsA });
  await updateNode(b.id, { tags: nextTagsB });

  // Keep tag_idf cache fresh since link tags rely on rare IDF.
  await rebuildTagIdf();

  // Recompute only the pair edge (bridge tags are meant to be local).
  const allNodes = await listNodes();
  const nodeMap = new Map(allNodes.map((node) => [node.id, node]));
  const updatedA = nodeMap.get(a.id);
  const updatedB = nodeMap.get(b.id);
  if (!updatedA || !updatedB) {
    throw new Error('Failed to reload updated nodes after linking.');
  }

  const context = buildTagIdfContext(allNodes);
  const computed = computeEdgeScore(updatedA, updatedB, context);
  const status = classifyEdgeScores(computed.semanticScore, computed.tagScore);

  if (status === 'discard') {
    await deleteEdgeBetween(sourceId, targetId);
  } else {
    await insertOrUpdateEdge({
      id: edgeIdentifier(sourceId, targetId),
      sourceId,
      targetId,
      score: computed.score,
      semanticScore: computed.semanticScore,
      tagScore: computed.tagScore,
      sharedTags: computed.sharedTags,
      status: 'accepted',
      edgeType: 'semantic',
      metadata: { components: computed.components },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          tag: `#${bridgeTag}`,
          nodes: [
            { id: a.id, shortId: formatId(a.id), title: a.title },
            { id: b.id, shortId: formatId(b.id), title: b.title },
          ],
          edge: {
            sourceId,
            targetId,
            status,
            score: computed.score,
            semanticScore: computed.semanticScore,
            tagScore: computed.tagScore,
            sharedTags: computed.sharedTags,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`${colorize.success('✔')} Added bridge tag ${colorize.tag(`#${bridgeTag}`)}`);
  console.log(`   ${colorize.label('A:')} ${formatId(a.id)}  ${a.title}`);
  console.log(`   ${colorize.label('B:')} ${formatId(b.id)}  ${b.title}`);
  console.log(
    `   ${colorize.label('edge:')} ${status}  ` +
      `S=${computed.semanticScore === null ? '--' : computed.semanticScore.toFixed(3)}  ` +
      `T=${computed.tagScore === null ? '--' : computed.tagScore.toFixed(3)}`,
  );
}

function addTag(tags: string[], next: string): string[] {
  const normalized = next.trim().toLowerCase();
  const set = new Set(tags.map((tag) => tag.toLowerCase()));
  set.add(normalized);
  return [...set].sort((a, b) => a.localeCompare(b));
}

function sanitizeBridgeName(raw: string): string {
  let value = raw.trim();
  if (value.startsWith('#')) value = value.slice(1);
  if (value.toLowerCase().startsWith('link/')) value = value.slice('link/'.length);

  value = value.toLowerCase();
  value = value.replace(/\s+/g, '-');
  value = value.replace(/[^a-z0-9_/-]+/g, '-');
  value = value.replace(/-+/g, '-');
  value = value.replace(/^[-/]+/, '').replace(/[-/]+$/, '');

  if (!value) {
    throw new Error('Invalid bridge name. Use characters matching [a-zA-Z0-9_/-]+.');
  }

  return value;
}

function makeBridgeHash(sourceId: string, targetId: string): string {
  const raw = `${sourceId}::${targetId}`;
  return createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 8);
}

