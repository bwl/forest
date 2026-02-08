import { Elysia, t } from 'elysia';
import {
  listDocuments,
  getDocumentById,
  getDocumentChunks,
  DocumentRecord,
  DocumentChunkRecord,
} from '../../lib/db';
import { importDocumentCore } from '../../core/import';
import { ForestError, ValidationError, NodeNotFoundError, createErrorResponse } from '../utils/errors';
import { createSuccessResponse } from '../utils/helpers';
import { formatId } from '../../cli/shared/utils';

export const documentsRoutes = new Elysia({ prefix: '/api/v1' })
  .get(
    '/documents',
    async ({ set }) => {
      try {
        const documents = await listDocuments();
        return createSuccessResponse({
          documents,
          count: documents.length,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        summary: 'List all documents',
        description: 'Returns all canonical documents in the knowledge base',
        tags: ['Documents'],
      },
    }
  )
  .get(
    '/documents/stats',
    async ({ set }) => {
      try {
        const documents = await listDocuments();

        let totalChunks = 0;
        let totalVersions = 0;
        const sources = new Map<string, number>();
        const strategies = new Map<string, number>();

        for (const doc of documents) {
          const metadata = doc.metadata as any;
          totalVersions += doc.version;

          if (metadata) {
            if (metadata.chunkCount) totalChunks += metadata.chunkCount;
            if (metadata.source) {
              sources.set(metadata.source, (sources.get(metadata.source) ?? 0) + 1);
            }
            if (metadata.chunkStrategy) {
              strategies.set(metadata.chunkStrategy, (strategies.get(metadata.chunkStrategy) ?? 0) + 1);
            }
          }
        }

        const avgVersion = documents.length > 0 ? totalVersions / documents.length : 0;
        const avgChunks = documents.length > 0 ? totalChunks / documents.length : 0;

        return createSuccessResponse({
          totalDocuments: documents.length,
          totalChunks,
          avgChunksPerDocument: Math.round(avgChunks * 10) / 10,
          avgVersion: Math.round(avgVersion * 10) / 10,
          bySource: Object.fromEntries(sources),
          byStrategy: Object.fromEntries(strategies),
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        summary: 'Document statistics',
        description: 'Returns aggregate statistics about documents',
        tags: ['Documents'],
      },
    }
  )
  .get(
    '/documents/:id',
    async ({ params, set }) => {
      try {
        const document = await getDocumentById(params.id);
        if (!document) {
          throw new NodeNotFoundError(params.id);
        }
        return createSuccessResponse({ document });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      params: t.Object({
        id: t.String({ description: 'Document ID' }),
      }),
      detail: {
        summary: 'Get document by ID',
        description: 'Returns a single canonical document with all metadata',
        tags: ['Documents'],
      },
    }
  )
  .get(
    '/documents/:id/chunks',
    async ({ params, set }) => {
      try {
        // Verify document exists
        const document = await getDocumentById(params.id);
        if (!document) {
          throw new NodeNotFoundError(params.id);
        }

        const chunks = await getDocumentChunks(params.id);
        return createSuccessResponse({
          chunks,
          count: chunks.length,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      params: t.Object({
        id: t.String({ description: 'Document ID' }),
      }),
      detail: {
        summary: 'Get document chunks',
        description: 'Returns all chunk mappings for a document with offsets and checksums',
        tags: ['Documents'],
      },
    }
  )

  // POST /documents/import - Import a document by chunking
  .post(
    '/documents/import',
    async ({ body, set }) => {
      try {
        const data = body as any;

        if (!data.body || typeof data.body !== 'string' || data.body.trim().length === 0) {
          throw new ValidationError('body is required and must be a non-empty string');
        }

        const result = await importDocumentCore(data.body, {
          documentTitle: data.title,
          tags: data.tags,
          chunkStrategy: data.chunkStrategy,
          maxTokens: data.maxTokens,
          overlap: data.overlap,
          autoLink: data.autoLink,
          createParent: data.createParent,
          linkSequential: data.linkSequential,
        });

        set.status = 201;
        return createSuccessResponse({
          documentTitle: result.documentTitle,
          rootNode: result.rootNode
            ? {
                id: result.rootNode.id,
                shortId: formatId(result.rootNode.id),
                title: result.rootNode.title,
                tags: result.rootNode.tags,
              }
            : null,
          chunks: result.chunks.map((c) => ({
            id: c.node.id,
            shortId: formatId(c.node.id),
            title: c.node.title,
            tags: c.node.tags,
            chunkIndex: c.chunk.metadata.chunkIndex,
            estimatedTokens: c.chunk.metadata.estimatedTokens,
          })),
          totalChunks: result.totalChunks,
          linking: result.linking,
        });
      } catch (error) {
        if (error instanceof ForestError) {
          set.status = error.getStatusCode();
        } else {
          set.status = 500;
        }
        return createErrorResponse(error);
      }
    },
    {
      detail: {
        summary: 'Import document',
        description: 'Import a document by chunking it into nodes',
        tags: ['Documents'],
      },
    }
  );
