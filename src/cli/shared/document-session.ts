import type { NodeRecord, DocumentRecord, DocumentChunkRecord } from '../../lib/db';

type DbModule = typeof import('../../lib/db');

let dbModulePromise: Promise<DbModule> | null = null;

async function getDbModule(): Promise<DbModule> {
  if (!dbModulePromise) {
    dbModulePromise = import('../../lib/db');
  }
  return dbModulePromise;
}

export type LoadedDocumentSession = {
  document: DocumentRecord;
  rootNode: NodeRecord | null;
  segments: DocumentSegment[];
};

export type DocumentSegment = {
  mapping: DocumentChunkRecord;
  node: NodeRecord;
};

export type ParsedDocumentEdit = {
  canonicalBody: string;
  segments: Array<{
    segmentId: string;
    nodeId: string;
    content: string;
  }>;
};

type SegmentAttributes = {
  segmentId: string;
  nodeId?: string;
  title?: string;
  [key: string]: string | undefined;
};

const START_REGEX = /^<!--\s*forest:segment start\s+(.+?)\s*-->$/i;
const END_REGEX = /^<!--\s*forest:segment end\s+(.+?)\s*-->$/i;

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function parseAttributeMap(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z0-9_-]+)=("([^"]*?)"|([^\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const key = match[1];
    const value = match[3] ?? match[4] ?? '';
    attrs[key] = value;
  }
  return attrs;
}

function parseSegmentStartAttributes(raw: string, lineNumber: number): SegmentAttributes & { nodeId: string } {
  const attrs = parseAttributeMap(raw);
  if (!attrs.segment_id) {
    throw new Error(`Missing segment_id on segment start marker (line ${lineNumber})`);
  }
  if (!attrs.node_id) {
    throw new Error(`Missing node_id on segment start marker (line ${lineNumber})`);
  }
  return {
    segmentId: attrs.segment_id,
    nodeId: attrs.node_id,
    title: attrs.title,
    ...attrs,
  };
}

function parseSegmentEndAttributes(raw: string, lineNumber: number): SegmentAttributes {
  const attrs = parseAttributeMap(raw);
  if (!attrs.segment_id) {
    throw new Error(`Missing segment_id on segment end marker (line ${lineNumber})`);
  }
  return {
    segmentId: attrs.segment_id,
    ...attrs,
  };
}

export async function loadDocumentSessionForNode(node: NodeRecord): Promise<LoadedDocumentSession | null> {
  const { getDocumentForNode, getDocumentByRootNode, getNodeById, getDocumentChunks } = await getDbModule();

  const direct = await getDocumentForNode(node.id);
  let document: DocumentRecord | null = null;
  let rootNode: NodeRecord | null = null;

  if (direct) {
    document = direct.document;
  } else {
    document = await getDocumentByRootNode(node.id);
    if (document) {
      rootNode = node;
    }
  }

  if (!document) return null;
  if (!rootNode && document.rootNodeId) {
    rootNode = await getNodeById(document.rootNodeId);
  }

  const chunkRecords = await getDocumentChunks(document.id);
  if (chunkRecords.length === 0) return null;

  const segments: DocumentSegment[] = [];
  for (const record of chunkRecords) {
    const segmentNode = await getNodeById(record.nodeId);
    if (!segmentNode) continue;
    segments.push({
      mapping: record,
      node: segmentNode,
    });
  }

  if (segments.length === 0) return null;

  segments.sort((a, b) => a.mapping.chunkOrder - b.mapping.chunkOrder);

  return {
    document,
    rootNode,
    segments,
  };
}

export function buildDocumentEditorBuffer(
  session: LoadedDocumentSession,
  options: { focusSegmentId?: string } = {}
): string {
  const focusSegmentId = options.focusSegmentId;
  const header: string[] = [
    '# Forest Document Editor',
    '# Editing node within document',
    `# Document: ${session.document.title} (${session.document.id.slice(0, 8)})`,
    session.rootNode ? `# Root Node: ${session.rootNode.title} (${session.rootNode.id.slice(0, 8)})` : '# Root Node: (none)',
    '#',
    '# Instructions:',
    '#   • Edit content between the HTML comment markers.',
    '#   • Do not delete the comment lines that begin with "<!-- forest:segment".',
    '#   • You may edit multiple segments before saving.',
    '#   • Lines starting with "#" are informational and ignored on save.',
    '#',
    `# Total segments: ${session.segments.length}`,
    '',
  ];

  const parts: string[] = [header.join('\n')];

  session.segments.forEach((segment, index) => {
    const node = segment.node;
    const mapping = segment.mapping;
    const startAttributes = [
      `segment_id=${mapping.segmentId}`,
      `node_id=${node.id}`,
      `order=${mapping.chunkOrder}`,
      `title="${escapeAttribute(node.title)}"`,
    ];
    if (focusSegmentId && focusSegmentId === mapping.segmentId) {
      startAttributes.push('focus=true');
    }

    parts.push(
      `<!-- forest:segment start ${startAttributes.join(' ')} -->`,
      normalizeNewlines(node.body),
      `<!-- forest:segment end segment_id=${mapping.segmentId} -->`
    );

    if (index < session.segments.length - 1) {
      parts.push('');
    }
  });

  return parts.join('\n');
}

export function parseDocumentEditorBuffer(session: LoadedDocumentSession, rawBuffer: string): ParsedDocumentEdit {
  const buffer = normalizeNewlines(rawBuffer);
  const lines = buffer.split('\n');

  const segments: ParsedDocumentEdit['segments'] = [];
  let index = 0;

  // Skip header lines beginning with '#' or empty lines until we hit the first segment start
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.startsWith('<!--')) break;
    if (line.trim() === '' || line.trim().startsWith('#')) {
      index += 1;
      continue;
    }
    throw new Error(`Unexpected content before first segment marker on line ${index + 1}. Remove extra text above the first segment.`);
  }

  while (index < lines.length) {
    const line = lines[index]!;
    const startMatch = line.match(START_REGEX);
    if (!startMatch) {
      if (line.trim() === '') {
        index += 1;
        continue;
      }
      throw new Error(`Expected segment start marker on line ${index + 1}.`);
    }

    const attrs = parseSegmentStartAttributes(startMatch[1]!, index + 1);
    index += 1;

    const segmentLines: string[] = [];
    let foundEnd = false;
    while (index < lines.length) {
      const innerLine = lines[index]!;
      const endMatch = innerLine.match(END_REGEX);
      if (endMatch) {
        const endAttrs = parseSegmentEndAttributes(endMatch[1]!, index + 1);
        if (endAttrs.segmentId !== attrs.segmentId) {
          throw new Error(
            `Segment end marker for segment_id=${endAttrs.segmentId} does not match start (expected ${attrs.segmentId}) on line ${index + 1}.`
          );
        }
        foundEnd = true;
        index += 1;
        break;
      }
      segmentLines.push(innerLine);
      index += 1;
    }

    if (!foundEnd) {
      throw new Error(`Missing closing segment marker for segment_id=${attrs.segmentId}.`);
    }

    const segmentContent = segmentLines.join('\n');
    segments.push({
      segmentId: attrs.segmentId,
      nodeId: attrs.nodeId,
      content: segmentContent,
    });

    // Skip blank lines between segments
    while (index < lines.length && lines[index]!.trim() === '') {
      index += 1;
    }
  }

  if (segments.length === 0) {
    throw new Error('No segments parsed. Ensure the segment markers were not removed.');
  }

  const expectedSegmentIds = new Set(session.segments.map((seg) => seg.mapping.segmentId));
  const parsedIds = new Set(segments.map((seg) => seg.segmentId));

  if (expectedSegmentIds.size !== parsedIds.size) {
    throw new Error(
      `Segment count mismatch. Expected ${expectedSegmentIds.size} segments but parsed ${parsedIds.size}. Ensure all segment markers are present.`
    );
  }

  for (const segmentId of expectedSegmentIds) {
    if (!parsedIds.has(segmentId)) {
      throw new Error(`Missing segment ${segmentId} in edited content.`);
    }
  }

  const canonicalBody = segments.map((segment) => segment.content).join('\n\n');

  return {
    canonicalBody,
    segments,
  };
}
