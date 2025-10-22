import { describe, expect, it } from 'bun:test';

import type { DocumentRecord, DocumentChunkRecord, NodeRecord } from '../../../lib/db';
import {
  buildDocumentEditorBuffer,
  type LoadedDocumentSession,
} from '../document-session';

function makeNode(id: string, title: string, body: string): NodeRecord {
  return {
    id,
    title,
    body,
    tags: [],
    tokenCounts: {},
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    embedding: undefined,
    isChunk: true,
    parentDocumentId: 'doc-1',
    chunkOrder: null,
  };
}

function makeChunk(node: NodeRecord, order: number): DocumentChunkRecord {
  return {
    documentId: 'doc-1',
    segmentId: node.id,
    nodeId: node.id,
    offset: 0,
    length: node.body.length,
    chunkOrder: order,
    checksum: 'stub',
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

const baseDocument: DocumentRecord = {
  id: 'doc-1',
  title: 'Test Document',
  body: 'Section 1 Body\n\nSection 2 Body',
  metadata: { chunkCount: 2 },
  version: 1,
  rootNodeId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function buildSession(): LoadedDocumentSession {
  const nodeA = makeNode('seg-1', 'Section 1', 'Section 1 Body');
  const nodeB = makeNode('seg-2', 'Section 2', 'Section 2 Body');

  return {
    document: baseDocument,
    rootNode: null,
    segments: [
      { mapping: makeChunk(nodeA, 0), node: nodeA },
      { mapping: makeChunk(nodeB, 1), node: nodeB },
    ],
  };
}

describe('document session editor buffer', () => {
  it('renders editor buffer with segment markers and focus attribute', () => {
    const session = buildSession();
    const buffer = buildDocumentEditorBuffer(session, { focusSegmentId: 'seg-2' });

    expect(buffer).toContain('Forest Document Editor');
    expect(buffer).toContain('<!-- forest:segment start segment_id=seg-1');
    expect(buffer).toContain('<!-- forest:segment start segment_id=seg-2');
    expect(buffer).toContain('focus=true -->');
    expect(buffer).toContain('Section 1 Body');
    expect(buffer).toContain('Section 2 Body');
  });
});
