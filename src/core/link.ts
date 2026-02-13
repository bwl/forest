/**
 * Core link logic — create bridge tags between two nodes.
 * Extracted from src/cli/commands/link.ts for 3-layer architecture.
 */

import { createHash } from 'crypto';

import {
  insertOrUpdateEdge,
  listNodes,
  rebuildTagIdf,
  updateNode,
  getNodeById,
} from '../lib/db';
import {
  buildTagIdfContext,
  computeEdgeScore,
  normalizeEdgePair,
} from '../lib/scoring';
import { edgeIdentifier, formatId } from '../cli/shared/utils';

export type LinkNodesInput = {
  sourceId: string;
  targetId: string;
  name?: string;
};

export type LinkNodesResult = {
  tag: string;
  nodes: Array<{ id: string; shortId: string; title: string }>;
  edge: {
    sourceId: string;
    targetId: string;
    status: string;
    score: number;
    semanticScore: number | null;
    tagScore: number | null;
    sharedTags: string[];
  };
};

export async function linkNodesCore(input: LinkNodesInput): Promise<LinkNodesResult> {
  if (input.sourceId === input.targetId) {
    throw new Error('Cannot link a node to itself.');
  }

  const a = await getNodeById(input.sourceId);
  const b = await getNodeById(input.targetId);
  if (!a || !b) {
    throw new Error('Both endpoints must resolve to existing notes.');
  }

  const [sourceId, targetId] = normalizeEdgePair(a.id, b.id);
  const name = input.name ? sanitizeBridgeName(input.name) : makeBridgeHash(sourceId, targetId);
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
  const status = 'accepted';

  await insertOrUpdateEdge({
    id: edgeIdentifier(sourceId, targetId),
    sourceId,
    targetId,
    score: computed.score,
    semanticScore: computed.semanticScore,
    tagScore: computed.tagScore,
    sharedTags: computed.sharedTags,
    status,
    edgeType: 'manual',
    metadata: {
      components: computed.components,
      manualOverride: true,
      linkedVia: `#${bridgeTag}`,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return {
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
  };
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
