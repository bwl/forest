import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

import {
  closeDb,
  insertNode,
  insertNodeBulk,
  updateNode,
  getNodeById,
  listNodesForScoring,
  restoreNodeFromHistory,
  listNodeHistory,
  type NodeRecord,
} from '../db';

let dbPath = '';
let originalDbPathEnv: string | undefined;

/** Deterministic 384-dim embedding seeded from an index */
function fakeEmbedding(seed: number): number[] {
  const arr = new Array(384);
  for (let i = 0; i < 384; i++) {
    arr[i] = Math.sin(seed * 1000 + i) * 0.5;
  }
  return arr;
}

function makeNode(partial: Partial<NodeRecord> = {}): NodeRecord {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? randomUUID(),
    title: partial.title ?? 'Blob Test',
    body: partial.body ?? 'test body',
    tags: partial.tags ?? ['test'],
    tokenCounts: partial.tokenCounts ?? { test: 1 },
    embedding: partial.embedding,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    isChunk: partial.isChunk ?? false,
    parentDocumentId: partial.parentDocumentId ?? null,
    chunkOrder: partial.chunkOrder ?? null,
    metadata: partial.metadata ?? null,
  };
}

describe('embedding BLOB storage', () => {
  beforeEach(async () => {
    originalDbPathEnv = process.env.FOREST_DB_PATH;
    dbPath = path.join(os.tmpdir(), `forest-blob-${randomUUID()}.db`);
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

  test('insertNode stores and retrieves embedding via BLOB', async () => {
    const emb = fakeEmbedding(1);
    const node = makeNode({ embedding: emb });
    await insertNode(node);

    const fetched = await getNodeById(node.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.embedding).toBeDefined();
    expect(fetched!.embedding!.length).toBe(384);
    // Float32 roundtrip loses some precision — check within tolerance
    for (let i = 0; i < 384; i++) {
      expect(fetched!.embedding![i]).toBeCloseTo(emb[i], 5);
    }
  });

  test('insertNode without embedding stores null', async () => {
    const node = makeNode({ embedding: undefined });
    await insertNode(node);

    const fetched = await getNodeById(node.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.embedding).toBeUndefined();
  });

  test('insertNodeBulk stores and retrieves embeddings via BLOB', async () => {
    const nodes = [
      makeNode({ embedding: fakeEmbedding(10) }),
      makeNode({ embedding: fakeEmbedding(20) }),
      makeNode({ embedding: undefined }),
    ];
    await insertNodeBulk(nodes);

    for (const orig of nodes) {
      const fetched = await getNodeById(orig.id);
      expect(fetched).not.toBeNull();
      if (orig.embedding) {
        expect(fetched!.embedding).toBeDefined();
        expect(fetched!.embedding!.length).toBe(384);
        for (let i = 0; i < 384; i++) {
          expect(fetched!.embedding![i]).toBeCloseTo(orig.embedding[i], 5);
        }
      } else {
        expect(fetched!.embedding).toBeUndefined();
      }
    }
  });

  test('updateNode writes embedding BLOB', async () => {
    const node = makeNode({ embedding: fakeEmbedding(1) });
    await insertNode(node);

    const newEmb = fakeEmbedding(99);
    await updateNode(node.id, { embedding: newEmb });

    const fetched = await getNodeById(node.id);
    expect(fetched!.embedding).toBeDefined();
    expect(fetched!.embedding!.length).toBe(384);
    for (let i = 0; i < 384; i++) {
      expect(fetched!.embedding![i]).toBeCloseTo(newEmb[i], 5);
    }
  });

  test('listNodesForScoring reads embedding from BLOB', async () => {
    const emb = fakeEmbedding(42);
    const node = makeNode({ embedding: emb });
    await insertNode(node);

    const scoring = await listNodesForScoring();
    const found = scoring.find((n) => n.id === node.id);
    expect(found).toBeDefined();
    expect(found!.embedding).toBeDefined();
    expect(found!.embedding!.length).toBe(384);
    for (let i = 0; i < 384; i++) {
      expect(found!.embedding![i]).toBeCloseTo(emb[i], 5);
    }
  });

  test('restoreNodeFromHistory preserves embedding BLOB', async () => {
    const emb1 = fakeEmbedding(1);
    const node = makeNode({ embedding: emb1 });
    await insertNode(node);

    const emb2 = fakeEmbedding(2);
    await updateNode(node.id, { embedding: emb2, body: 'updated body' });

    // Restore to version 1
    const result = await restoreNodeFromHistory(node.id, 1);
    expect(result.restoredFromVersion).toBe(1);

    const fetched = await getNodeById(node.id);
    expect(fetched!.embedding).toBeDefined();
    expect(fetched!.embedding!.length).toBe(384);
    for (let i = 0; i < 384; i++) {
      expect(fetched!.embedding![i]).toBeCloseTo(emb1[i], 5);
    }
  });

  test('Float32 roundtrip is lossless for Float32-representable values', async () => {
    // Pre-quantize to Float32 so we can assert exact equality
    const raw = fakeEmbedding(7);
    const f32 = new Float32Array(raw);
    const emb = Array.from(f32);

    const node = makeNode({ embedding: emb });
    await insertNode(node);

    const fetched = await getNodeById(node.id);
    expect(fetched!.embedding).toEqual(emb);
  });
});
