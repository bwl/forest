/**
 * Forest document parser - extracts and validates segment markers
 */

export interface SegmentMarker {
  segmentId: string;
  nodeId: string;
  title?: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  contentStartLine: number;
  contentEndLine: number;
}

export interface ParsedDocument {
  segments: SegmentMarker[];
  errors: ParseError[];
}

export interface ParseError {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

const START_REGEX = /^<!--\s*forest:segment\s+start\s+(.+?)\s*-->$/i;
const END_REGEX = /^<!--\s*forest:segment\s+end\s+(.+?)\s*-->$/i;

function parseAttributes(raw: string): Record<string, string> {
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

export function parseForestDocument(content: string): ParsedDocument {
  const lines = content.split('\n');
  const segments: SegmentMarker[] = [];
  const errors: ParseError[] = [];
  const openSegments: Array<{
    segmentId: string;
    nodeId: string;
    title?: string;
    startLine: number;
    startOffset: number;
    contentStartLine: number;
  }> = [];

  let currentOffset = 0;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const lineLength = line.length + 1; // +1 for newline

    // Check for start marker
    const startMatch = line.match(START_REGEX);
    if (startMatch) {
      const attrs = parseAttributes(startMatch[1]);

      if (!attrs.segment_id) {
        errors.push({
          line: lineNum + 1,
          message: 'Missing segment_id attribute',
          severity: 'error',
        });
      } else if (!attrs.node_id) {
        errors.push({
          line: lineNum + 1,
          message: 'Missing node_id attribute',
          severity: 'error',
        });
      } else {
        openSegments.push({
          segmentId: attrs.segment_id,
          nodeId: attrs.node_id,
          title: attrs.title,
          startLine: lineNum + 1,
          startOffset: currentOffset,
          contentStartLine: lineNum + 2, // Content starts on next line
        });
      }

      currentOffset += lineLength;
      continue;
    }

    // Check for end marker
    const endMatch = line.match(END_REGEX);
    if (endMatch) {
      const attrs = parseAttributes(endMatch[1]);

      if (!attrs.segment_id) {
        errors.push({
          line: lineNum + 1,
          message: 'Missing segment_id attribute on end marker',
          severity: 'error',
        });
      } else {
        const openSegment = openSegments.pop();

        if (!openSegment) {
          errors.push({
            line: lineNum + 1,
            message: 'End marker without matching start marker',
            severity: 'error',
          });
        } else if (openSegment.segmentId !== attrs.segment_id) {
          errors.push({
            line: lineNum + 1,
            message: `Mismatched segment_id: expected ${openSegment.segmentId}, got ${attrs.segment_id}`,
            severity: 'error',
          });
        } else {
          segments.push({
            segmentId: openSegment.segmentId,
            nodeId: openSegment.nodeId,
            title: openSegment.title,
            startLine: openSegment.startLine,
            endLine: lineNum + 1,
            startOffset: openSegment.startOffset,
            endOffset: currentOffset + lineLength,
            contentStartLine: openSegment.contentStartLine,
            contentEndLine: lineNum, // Content ends before end marker
          });
        }
      }

      currentOffset += lineLength;
      continue;
    }

    currentOffset += lineLength;
  }

  // Check for unclosed segments
  for (const open of openSegments) {
    errors.push({
      line: open.startLine,
      message: `Unclosed segment: ${open.segmentId}`,
      severity: 'error',
    });
  }

  return { segments, errors };
}

export function getSegmentAtLine(segments: SegmentMarker[], line: number): SegmentMarker | null {
  return segments.find(
    (seg) => line >= seg.contentStartLine && line <= seg.contentEndLine
  ) || null;
}

export function getMarkerRanges(content: string): Array<{ start: number; end: number }> {
  const lines = content.split('\n');
  const ranges: Array<{ start: number; end: number }> = [];
  let currentOffset = 0;

  for (const line of lines) {
    const lineLength = line.length + 1;

    if (START_REGEX.test(line) || END_REGEX.test(line)) {
      ranges.push({
        start: currentOffset,
        end: currentOffset + lineLength - 1, // Don't include newline in range
      });
    }

    currentOffset += lineLength;
  }

  return ranges;
}
