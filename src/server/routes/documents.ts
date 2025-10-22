import { Elysia, t } from 'elysia';
import {
  listDocuments,
  getDocumentById,
  getDocumentChunks,
  DocumentRecord,
  DocumentChunkRecord,
} from '../../lib/db';
import { ForestError, createErrorResponse } from '../utils/errors';

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
  );
