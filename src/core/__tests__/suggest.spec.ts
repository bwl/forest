import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

import { closeDb, insertNode, type NodeRecord } from '../../lib/db';
import { suggestCore } from '../suggest';

let dbPath = '';
let originalDbPathEnv: string | undefined;
let originalEmbeddingProviderEnv: string | undefined;

function makeNode(partial: Partial<NodeRecord> = {}): NodeRecord {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? randomUUID(),
    title: partial.title ?? 'Suggest Test',
    body: partial.body ?? 'project context body',
    tags: partial.tags ?? [],
    tokenCounts: partial.tokenCounts ?? { project: 1, context: 1 },
    embedding: partial.embedding,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    isChunk: partial.isChunk ?? false,
    parentDocumentId: partial.parentDocumentId ?? null,
    chunkOrder: partial.chunkOrder ?? null,
    metadata: partial.metadata ?? null,
  };
}

describe('suggest project tags', () => {
  beforeEach(async () => {
    originalDbPathEnv = process.env.FOREST_DB_PATH;
    originalEmbeddingProviderEnv = process.env.FOREST_EMBEDDING_PROVIDER;
    dbPath = path.join(os.tmpdir(), `forest-suggest-${randomUUID()}.db`);
    process.env.FOREST_DB_PATH = dbPath;
    process.env.FOREST_EMBEDDING_PROVIDER = 'none';
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
    if (originalEmbeddingProviderEnv === undefined) {
      delete process.env.FOREST_EMBEDDING_PROVIDER;
    } else {
      process.env.FOREST_EMBEDDING_PROVIDER = originalEmbeddingProviderEnv;
    }
  });

  test('matches project slash tags from --project name', async () => {
    await insertNode(makeNode({ title: 'Forest Overview', tags: ['project/forest', 'docs'] }));

    const result = await suggestCore({ project: 'forest' });

    expect(result.project).toBe('forest');
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.title).toBe('Forest Overview');
    expect(result.suggestions[0]?.tags).toEqual(['docs']);
  });

  test('keeps legacy project colon tags readable', async () => {
    await insertNode(makeNode({ title: 'Legacy Forest Note', tags: ['project:forest', 'notes'] }));

    const result = await suggestCore({ project: 'project/forest' });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]?.title).toBe('Legacy Forest Note');
    expect(result.suggestions[0]?.tags).toEqual(['notes']);
  });
});
