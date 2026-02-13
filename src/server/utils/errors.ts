export type ErrorCode =
  | 'NODE_NOT_FOUND'
  | 'EDGE_NOT_FOUND'
  | 'TAG_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'AMBIGUOUS_ID'
  | 'DATABASE_ERROR'
  | 'EMBEDDING_ERROR';

export class ForestError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ForestError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }

  getStatusCode(): number {
    switch (this.code) {
      case 'NODE_NOT_FOUND':
      case 'EDGE_NOT_FOUND':
      case 'TAG_NOT_FOUND':
        return 404;
      case 'INVALID_INPUT':
      case 'AMBIGUOUS_ID':
        return 400;
      case 'DATABASE_ERROR':
      case 'EMBEDDING_ERROR':
        return 500;
      default:
        return 500;
    }
  }
}

export class NodeNotFoundError extends ForestError {
  constructor(nodeId: string) {
    super('NODE_NOT_FOUND', `Node with ID '${nodeId}' not found`, { nodeId });
    this.name = 'NodeNotFoundError';
  }
}

export class EdgeNotFoundError extends ForestError {
  constructor(edgeRef: string) {
    super('EDGE_NOT_FOUND', `Edge '${edgeRef}' not found`, { edgeRef });
    this.name = 'EdgeNotFoundError';
  }
}

export class TagNotFoundError extends ForestError {
  constructor(tagName: string) {
    super('TAG_NOT_FOUND', `Tag '${tagName}' not found`, { tagName });
    this.name = 'TagNotFoundError';
  }
}

export class AmbiguousIdError extends ForestError {
  constructor(prefix: string, matches: string[]) {
    super('AMBIGUOUS_ID', `ID prefix '${prefix}' matches multiple nodes`, {
      prefix,
      matches,
    });
    this.name = 'AmbiguousIdError';
  }
}

export class ValidationError extends ForestError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('INVALID_INPUT', message, details);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends ForestError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('DATABASE_ERROR', message, details);
    this.name = 'DatabaseError';
  }
}

export class EmbeddingError extends ForestError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('EMBEDDING_ERROR', message, details);
    this.name = 'EmbeddingError';
  }
}

export function createErrorResponse(error: unknown) {
  if (error instanceof ForestError) {
    return {
      success: false,
      error: error.toJSON(),
      meta: {
        timestamp: new Date().toISOString(),
        version: '0.6.0',
      },
    };
  }

  // Unknown error - return generic 500
  return {
    success: false,
    error: {
      code: 'DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'An unknown error occurred',
      details: {},
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '0.6.0',
    },
  };
}
