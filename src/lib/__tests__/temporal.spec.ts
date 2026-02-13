import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

import {
  closeDb,
  insertNode,
  updateNode,
  deleteNode,
  insertOrUpdateEdge,
  createGraphSnapshot,
  type NodeRecord,
  type EdgeRecord,
} from '../db';
import { getGraphDiffCore, getGraphGrowthCore } from '../../core/temporal';

let dbPath = '';
let originalDbPathEnv: string | undefined;

function makeNode(partial: Partial<NodeRecord> = {}): NodeRecord {
  const now = new Date().toISOString();
  const title = partial.title ?? `Node ${randomUUID().slice(0, 6)}`;
  const body = partial.body ?? `${title} body`;
  return {
    id: partial.id ?? randomUUID(),
    title,
    body,
    tags: partial.tags ?? ['project:forest'],
    tokenCounts: partial.tokenCounts ?? { node: 1 },
    embedding: partial.embedding,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    isChunk: partial.isChunk ?? false,
    parentDocumentId: partial.parentDocumentId ?? null,
    chunkOrder: partial.chunkOrder ?? null,
    metadata: partial.metadata ?? null,
  };
}

function makeEdge(
  sourceId: string,
  targetId: string,
  score: number,
  partial: Partial<EdgeRecord> = {},
): EdgeRecord {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? `${sourceId}::${targetId}`,
    sourceId,
    targetId,
    score,
    semanticScore: partial.semanticScore ?? score,
    tagScore: partial.tagScore ?? null,
    sharedTags: partial.sharedTags ?? [],
    status: partial.status ?? 'accepted',
    edgeType: partial.edgeType ?? 'semantic',
    metadata: partial.metadata ?? null,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

describe('temporal graph analysis', () => {
  beforeEach(async () => {
    originalDbPathEnv = process.env.FOREST_DB_PATH;
    dbPath = path.join(os.tmpdir(), `forest-temporal-${randomUUID()}.db`);
    process.env.FOREST_DB_PATH = dbPath;
    await closeDb();
    await fs.rm(dbPath, { force: true });
  });

  afterEach(async () => {
    await closeDb();
    await fs.rm(dbPath, { force: true });
    if (originalDbPathEnv === undefined) {
      delete process.env.FOREST_DB_PATH;
    } else {
      process.env.FOREST_DB_PATH = originalDbPathEnv;
    }
  });

  test('diff reports added/removed/updated nodes and added/removed/changed edges', async () => {
    const nodeA = makeNode({ title: 'Alpha', tags: ['project:forest', 'alpha'] });
    const nodeB = makeNode({ title: 'Beta', tags: ['project:forest', 'beta'] });
    const nodeC = makeNode({ title: 'Gamma', tags: ['project:forest', 'gamma'] });

    await insertNode(nodeA);
    await insertNode(nodeB);
    await insertNode(nodeC);

    await insertOrUpdateEdge(makeEdge(nodeA.id, nodeB.id, 0.4));
    await insertOrUpdateEdge(makeEdge(nodeB.id, nodeC.id, 0.5));

    const baseline = await createGraphSnapshot('manual');

    await new Promise((resolve) => setTimeout(resolve, 5));

    await updateNode(nodeA.id, {
      body: 'Alpha body v2',
      tokenCounts: { alpha: 1, v2: 1 },
    });

    const nodeD = makeNode({ title: 'Delta', tags: ['project:forest', 'delta'] });
    await insertNode(nodeD);

    await insertOrUpdateEdge(makeEdge(nodeA.id, nodeD.id, 0.8));
    await insertOrUpdateEdge(makeEdge(nodeA.id, nodeB.id, 0.9));
    await deleteNode(nodeC.id);

    const diff = await getGraphDiffCore({
      since: new Date(baseline.takenAt),
      limit: 50,
    });

    expect(diff.summary.nodesAdded).toBe(1);
    expect(diff.summary.nodesRemoved).toBe(1);
    expect(diff.summary.nodesUpdated).toBe(1);
    expect(diff.summary.edgesAdded).toBe(1);
    expect(diff.summary.edgesRemoved).toBe(1);
    expect(diff.summary.edgesChanged).toBe(1);

    expect(diff.nodes.added.items.some((node) => node.id === nodeD.id)).toBe(true);
    expect(diff.nodes.removed.items.some((node) => node.id === nodeC.id)).toBe(true);
    expect(diff.nodes.updated.items.some((node) => node.id === nodeA.id)).toBe(true);
  });

  test('growth returns timeline points and positive deltas after changes', async () => {
    const nodeA = makeNode({ title: 'A' });
    const nodeB = makeNode({ title: 'B' });

    await insertNode(nodeA);
    const first = await createGraphSnapshot('manual');

    await new Promise((resolve) => setTimeout(resolve, 5));

    await insertNode(nodeB);
    await insertOrUpdateEdge(makeEdge(nodeA.id, nodeB.id, 0.7));
    await createGraphSnapshot('manual');

    const growth = await getGraphGrowthCore({
      since: new Date(new Date(first.takenAt).getTime() - 60_000),
      limit: 20,
    });

    expect(growth.points.length).toBeGreaterThanOrEqual(2);
    expect(growth.summary.nodeDelta).toBeGreaterThanOrEqual(1);
    expect(growth.summary.edgeDelta).toBeGreaterThanOrEqual(1);
  });
});
