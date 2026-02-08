import { describe, expect, it } from 'bun:test';

import type { DocumentRecord, DocumentChunkRecord, NodeRecord } from '../../../lib/db';
import type { LoadedDocumentSession } from '../document-session';
import { buildDocumentEditorBuffer, parseDocumentEditorBuffer } from '../document-session';

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
    metadata: null,
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

  it('parses editor buffer with segment markers without requiring node_id on end marker', () => {
    const session = buildSession();
    const buffer = buildDocumentEditorBuffer(session);

    const parsed = parseDocumentEditorBuffer(session, buffer);

    expect(parsed.segments).toHaveLength(2);
    expect(parsed.segments[0]).toMatchObject({
      segmentId: 'seg-1',
      nodeId: 'seg-1',
      content: 'Section 1 Body',
    });
    expect(parsed.canonicalBody).toBe('Section 1 Body\n\nSection 2 Body');
  });

  it('round-trips document edits without data loss', () => {
    const session = buildSession();
    const buffer = buildDocumentEditorBuffer(session);
    const parsed = parseDocumentEditorBuffer(session, buffer);

    // Rebuild buffer from parsed data
    const rebuiltSession: LoadedDocumentSession = {
      ...session,
      segments: session.segments.map((seg, i) => ({
        ...seg,
        node: {
          ...seg.node,
          body: parsed.segments[i]!.content,
        },
      })),
    };
    const rebuiltBuffer = buildDocumentEditorBuffer(rebuiltSession);
    const reparsed = parseDocumentEditorBuffer(rebuiltSession, rebuiltBuffer);

    expect(reparsed.segments).toHaveLength(parsed.segments.length);
    expect(reparsed.canonicalBody).toBe(parsed.canonicalBody);
  });

  it('handles multi-segment content edits correctly', () => {
    const session = buildSession();
    const buffer = buildDocumentEditorBuffer(session);

    // Edit both segments
    const editedBuffer = buffer
      .replace('Section 1 Body', 'Updated Section 1 Content')
      .replace('Section 2 Body', 'Updated Section 2 Content');

    const parsed = parseDocumentEditorBuffer(session, editedBuffer);

    expect(parsed.segments[0]!.content).toBe('Updated Section 1 Content');
    expect(parsed.segments[1]!.content).toBe('Updated Section 2 Content');
    expect(parsed.canonicalBody).toBe('Updated Section 1 Content\n\nUpdated Section 2 Content');
  });

  it('preserves whitespace and newlines in segment content', () => {
    const nodeA = makeNode('seg-1', 'Section 1', 'Line 1\n\nLine 2\n  Indented');
    const session: LoadedDocumentSession = {
      document: baseDocument,
      rootNode: null,
      segments: [{ mapping: makeChunk(nodeA, 0), node: nodeA }],
    };

    const buffer = buildDocumentEditorBuffer(session);
    const parsed = parseDocumentEditorBuffer(session, buffer);

    expect(parsed.segments[0]!.content).toBe('Line 1\n\nLine 2\n  Indented');
  });

  it('rejects edited buffer with missing segment marker', () => {
    const session = buildSession();
    const buffer = buildDocumentEditorBuffer(session);

    // Remove the second segment's markers
    const lines = buffer.split('\n');
    const filtered = lines.filter(line => !line.includes('seg-2'));
    const brokenBuffer = filtered.join('\n');

    expect(() => parseDocumentEditorBuffer(session, brokenBuffer)).toThrow(/segment/i);
  });

  it('rejects segment ID mismatch between start and end markers', () => {
    const session = buildSession();
    const buffer = buildDocumentEditorBuffer(session);

    // Change end marker to wrong segment ID
    const brokenBuffer = buffer.replace(
      '<!-- forest:segment end segment_id=seg-1 -->',
      '<!-- forest:segment end segment_id=seg-wrong -->'
    );

    expect(() => parseDocumentEditorBuffer(session, brokenBuffer)).toThrow(/does not match/i);
  });

  it('rejects buffer with missing start marker', () => {
    const session = buildSession();
    const buffer = buildDocumentEditorBuffer(session);

    // Remove first segment's start marker
    const brokenBuffer = buffer.replace(/<!-- forest:segment start segment_id=seg-1[^>]*-->/, '');

    expect(() => parseDocumentEditorBuffer(session, brokenBuffer)).toThrow();
  });

  it('rejects buffer with unclosed segment', () => {
    const session = buildSession();
    const buffer = buildDocumentEditorBuffer(session);

    // Remove the first segment's end marker
    const brokenBuffer = buffer.replace('<!-- forest:segment end segment_id=seg-1 -->', '');

    expect(() => parseDocumentEditorBuffer(session, brokenBuffer)).toThrow();
  });

  it('handles segment reordering correctly', () => {
    const session = buildSession();
    const buffer = buildDocumentEditorBuffer(session);

    // Manually swap segments in the buffer
    const lines = buffer.split('\n');
    const seg1Start = lines.findIndex(l => l.includes('segment_id=seg-1') && l.includes('start'));
    const seg1End = lines.findIndex(l => l.includes('segment_id=seg-1') && l.includes('end'));
    const seg2Start = lines.findIndex(l => l.includes('segment_id=seg-2') && l.includes('start'));
    const seg2End = lines.findIndex(l => l.includes('segment_id=seg-2') && l.includes('end'));

    // Extract segments
    const seg1Lines = lines.slice(seg1Start, seg1End + 1);
    const seg2Lines = lines.slice(seg2Start, seg2End + 1);
    const header = lines.slice(0, seg1Start);
    const between = lines.slice(seg1End + 1, seg2Start);

    // Reorder: put seg2 first
    const reordered = [...header, ...seg2Lines, ...between, ...seg1Lines].join('\n');

    const parsed = parseDocumentEditorBuffer(session, reordered);

    // First segment in parsed output should be seg-2 now
    expect(parsed.segments[0]!.segmentId).toBe('seg-2');
    expect(parsed.segments[1]!.segmentId).toBe('seg-1');
    expect(parsed.canonicalBody).toBe('Section 2 Body\n\nSection 1 Body');
  });

  it('validates all expected segments are present', () => {
    const session = buildSession();
    const buffer = buildDocumentEditorBuffer(session);

    // Create buffer with only one segment
    const lines = buffer.split('\n');
    const seg2Start = lines.findIndex(l => l.includes('segment_id=seg-2'));
    const partialBuffer = lines.slice(0, seg2Start).join('\n');

    expect(() => parseDocumentEditorBuffer(session, partialBuffer)).toThrow(/segment count mismatch/i);
  });

  it('normalizes Windows line endings', () => {
    const session = buildSession();
    const buffer = buildDocumentEditorBuffer(session);

    // Convert to Windows line endings
    const windowsBuffer = buffer.replace(/\n/g, '\r\n');

    const parsed = parseDocumentEditorBuffer(session, windowsBuffer);

    expect(parsed.segments[0]!.content).toBe('Section 1 Body');
    expect(parsed.canonicalBody).not.toContain('\r');
  });

  it('handles empty segment content', () => {
    const nodeA = makeNode('seg-1', 'Section 1', '');
    const session: LoadedDocumentSession = {
      document: { ...baseDocument, body: '' },
      rootNode: null,
      segments: [{ mapping: makeChunk(nodeA, 0), node: nodeA }],
    };

    const buffer = buildDocumentEditorBuffer(session);
    const parsed = parseDocumentEditorBuffer(session, buffer);

    expect(parsed.segments[0]!.content).toBe('');
    expect(parsed.canonicalBody).toBe('');
  });

  it('escapes special characters in title attributes', () => {
    const nodeA = makeNode('seg-1', 'Title with "quotes" & ampersand', 'Body content');
    const session: LoadedDocumentSession = {
      document: baseDocument,
      rootNode: null,
      segments: [{ mapping: makeChunk(nodeA, 0), node: nodeA }],
    };

    const buffer = buildDocumentEditorBuffer(session);

    expect(buffer).toContain('&quot;');
    expect(buffer).toContain('&amp;');

    // Should still parse correctly
    const parsed = parseDocumentEditorBuffer(session, buffer);
    expect(parsed.segments[0]!.content).toBe('Body content');
  });
});
