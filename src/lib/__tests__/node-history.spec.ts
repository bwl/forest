import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

import {
  closeDb,
  insertNode,
  updateNode,
  getNodeById,
  listNodeHistory,
  restoreNodeFromHistory,
  type NodeRecord,
} from '../db';

let dbPath = '';
let originalDbPathEnv: string | undefined;

function makeNode(partial: Partial<NodeRecord> = {}): NodeRecord {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? randomUUID(),
    title: partial.title ?? 'History Test',
    body: partial.body ?? 'v1 body',
    tags: partial.tags ?? ['project:forest'],
    tokenCounts: partial.tokenCounts ?? { history: 1, test: 1 },
    embedding: partial.embedding,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    isChunk: partial.isChunk ?? false,
    parentDocumentId: partial.parentDocumentId ?? null,
    chunkOrder: partial.chunkOrder ?? null,
    metadata: partial.metadata ?? null,
  };
}

describe('node history', () => {
  beforeEach(async () => {
    originalDbPathEnv = process.env.FOREST_DB_PATH;
    dbPath = path.join(os.tmpdir(), `forest-node-history-${randomUUID()}.db`);
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

  test('creates initial history snapshot on insert', async () => {
    const node = makeNode();
    await insertNode(node);

    const history = await listNodeHistory(node.id);
    expect(history.total).toBe(1);
    expect(history.currentVersion).toBe(1);
    expect(history.entries[0]?.version).toBe(1);
    expect(history.entries[0]?.operation).toBe('create');
    expect(history.entries[0]?.title).toBe(node.title);
    expect(history.entries[0]?.body).toBe(node.body);
  });

  test('appends history snapshot on update', async () => {
    const node = makeNode();
    await insertNode(node);

    await updateNode(node.id, {
      body: 'v2 body',
      tokenCounts: { history: 1, test: 1, v2: 1 },
    });

    const history = await listNodeHistory(node.id);
    expect(history.total).toBe(2);
    expect(history.currentVersion).toBe(2);
    expect(history.entries[0]?.version).toBe(2);
    expect(history.entries[0]?.operation).toBe('update');
    expect(history.entries[0]?.body).toBe('v2 body');
    expect(history.entries[1]?.version).toBe(1);
    expect(history.entries[1]?.operation).toBe('create');
  });

  test('restores to a previous version and records restore snapshot', async () => {
    const node = makeNode();
    await insertNode(node);

    await updateNode(node.id, {
      body: 'v2 body',
      tokenCounts: { history: 1, test: 1, v2: 1 },
    });

    const restored = await restoreNodeFromHistory(node.id, 1);
    expect(restored.restoredFromVersion).toBe(1);
    expect(restored.restoredToVersion).toBe(3);
    expect(restored.node.body).toBe('v1 body');

    const currentNode = await getNodeById(node.id);
    expect(currentNode?.body).toBe('v1 body');

    const history = await listNodeHistory(node.id);
    expect(history.total).toBe(3);
    expect(history.currentVersion).toBe(3);
    expect(history.entries[0]?.operation).toBe('restore');
    expect(history.entries[0]?.restoredFromVersion).toBe(1);
  });
});
