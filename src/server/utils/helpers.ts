import { NodeRecord, EdgeRecord, listNodes, getNodeById } from '../../lib/db';
import { formatId } from '../../cli/shared/utils';
import {
  NodeNotFoundError,
  AmbiguousIdError,
  ValidationError,
  ForestError,
} from './errors';

export type SuccessResponse<T> = {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    version: string;
  };
};

export type PaginationInfo = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '0.3.0',
    },
  };
}

export function parseQueryInt(
  value: string | undefined,
  defaultValue: number,
  min?: number,
  max?: number,
): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  let result = parsed;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;
  return result;
}

export function parseQueryDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date format. Use ISO 8601 format.', { value });
  }
  return date;
}

export function parseQueryTags(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function parseQueryBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === '1') return true;
  if (lower === 'false' || lower === '0') return false;
  return defaultValue;
}

export async function resolveNodeId(ref: string): Promise<NodeRecord> {
  if (!ref || ref.trim().length === 0) {
    throw new ValidationError('Node ID is required');
  }

  const normalized = ref.trim().toLowerCase();

  // Try exact UUID match first
  const direct = await getNodeById(ref);
  if (direct) return direct;

  // Try prefix match (min 4 chars for short IDs)
  if (normalized.length >= 4 && /^[0-9a-f]+$/i.test(normalized)) {
    const nodes = await listNodes();
    const matches = nodes.filter((node) => node.id.toLowerCase().startsWith(normalized));

    if (matches.length === 1) {
      return matches[0];
    }

    if (matches.length > 1) {
      throw new AmbiguousIdError(
        ref,
        matches.map((n) => n.id),
      );
    }
  }

  // Not found
  throw new NodeNotFoundError(ref);
}

export function formatNodeForList(node: NodeRecord) {
  const bodyPreview = node.body.slice(0, 100);
  return {
    id: node.id,
    shortId: formatId(node.id),
    title: node.title,
    bodyPreview,
    bodyLength: node.body.length,
    tags: node.tags,
    tokenCounts: node.tokenCounts,
    hasEmbedding: Boolean(node.embedding),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    metadata: node.metadata ?? null,
  };
}

export function formatNodeForContent(node: NodeRecord) {
  return {
    id: node.id,
    shortId: formatId(node.id),
    title: node.title,
    body: node.body,
    bodyLength: node.body.length,
    tags: node.tags,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

export function formatNodeForDetail(
  node: NodeRecord,
  options: { includeBody?: boolean } = {},
) {
  const base = {
    id: node.id,
    shortId: formatId(node.id),
    title: node.title,
    bodyLength: node.body.length,
    bodyPreview: node.body.slice(0, 100),
    tags: node.tags,
    tokenCounts: node.tokenCounts,
    hasEmbedding: Boolean(node.embedding),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    metadata: node.metadata ?? null,
  };

  if (options.includeBody !== false) {
    return {
      ...base,
      body: node.body,
    };
  }

  return base;
}

export function formatEdgeForResponse(
  edge: EdgeRecord,
  connectedNode: NodeRecord | null,
  options: { includeRef?: boolean } = {},
) {
  const base: any = {
    id: edge.id,
    connectedNodeId: edge.sourceId === connectedNode?.id ? edge.targetId : edge.sourceId,
    connectedNode: connectedNode
      ? {
          id: connectedNode.id,
          shortId: formatId(connectedNode.id),
          title: connectedNode.title,
          tags: connectedNode.tags,
        }
      : null,
    score: edge.score,
    status: edge.status,
    createdAt: edge.createdAt,
  };

  if (options.includeRef) {
    // Generate progressive ID ref if needed
    const shortSource = formatId(edge.sourceId);
    const shortTarget = formatId(edge.targetId);
    base.ref = `${shortSource.slice(0, 4)}${shortTarget.slice(0, 4)}`.toUpperCase();
  }

  return base;
}

export function createPaginationInfo(
  total: number,
  limit: number,
  offset: number,
): PaginationInfo {
  return {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

export function validatePaginationParams(limit: number, offset: number) {
  if (limit < 1) {
    throw new ValidationError('Limit must be at least 1');
  }
  if (limit > 100) {
    throw new ValidationError('Limit cannot exceed 100');
  }
  if (offset < 0) {
    throw new ValidationError('Offset must be non-negative');
  }
}
