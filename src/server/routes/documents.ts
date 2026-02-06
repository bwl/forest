import { Elysia, t } from 'elysia';
import {
  listDocuments,
  getDocumentById,
  getDocumentChunks,
  DocumentRecord,
  DocumentChunkRecord,
} from '../../lib/db';
import { importDocumentCore } from '../../core/import';
import { ForestError, ValidationError, createErrorResponse } from '../utils/errors';
import { createSuccessResponse } from '../utils/helpers';
import { formatId } from '../../cli/shared/utils';

export const documentsRoutes = new Elysia({ prefix: '/api/v1' })
  .get(
    '/documents',
    async ({ set }) => {
      try {
        const documents = await listDocuments();
        return {
          data: documents,
          count: documents.length,
        };
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
    '/documents/:id',
    async ({ params, set }) => {
      try {
        const document = await getDocumentById(params.id);
        if (!document) {
          set.status = 404;
          return { error: 'Document not found', code: 'DOCUMENT_NOT_FOUND' };
        }
        return { data: document };
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
          set.status = 404;
          return { error: 'Document not found', code: 'DOCUMENT_NOT_FOUND' };
        }

        const chunks = await getDocumentChunks(params.id);
        return {
          data: chunks,
          count: chunks.length,
        };
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
