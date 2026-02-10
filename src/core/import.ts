/**
 * Core import logic for large documents
 * Implements 3-layer architecture: pure business logic, no I/O dependencies
 */

import { randomUUID, createHash } from 'crypto';
import {
  NodeRecord,
  NodeMetadata,
  insertNode,
  listNodes,
  insertOrUpdateEdge,
  updateNode,
  EdgeRecord,
  DocumentRecord,
  DocumentChunkRecord,
  DocumentMetadata,
  upsertDocument,
  replaceDocumentChunks,
  beginBatch,
  endBatch,
} from '../lib/db';
import { extractTags, tokenize, pickTitle } from '../lib/text';
import { computeEmbeddingForNode } from '../lib/embeddings';
import { linkAgainstExisting } from '../cli/shared/linking';
import { chunkDocument, extractDocumentTitle, ChunkingOptions, DocumentChunk } from '../lib/chunking';

export type ImportOptions = {
  documentTitle?: string;    // Override auto-detected title
  tags?: string[];            // Override auto-detected tags
  chunkStrategy?: 'headers' | 'size' | 'hybrid';
  maxTokens?: number;         // Default: 9999 (env: FOREST_CHUNK_MAX_TOKENS)
  overlap?: number;           // Default: 200 characters
  autoLink?: boolean;         // Default: true
  createParent?: boolean;     // Create root/index node (default: true)
  linkSequential?: boolean;   // Link chunks in order (default: true)
  sourceFile?: string;        // Original filename (for provenance)
};

export type ChunkNodeInfo = {
  node: NodeRecord;
  chunk: DocumentChunk;
};

/**
 * Compose a display title for a chunk node.
 * Returns "Doc Title [2/7] Section Title" or just "Doc Title [2/7]" if the raw title is generic.
 */
function composeChunkTitle(docTitle: string, index: number, total: number, rawTitle: string): string {
  const position = `[${index + 1}/${total}]`;
  const isGeneric = /^Chunk \d+$/i.test(rawTitle);
  if (isGeneric || !rawTitle) {
    return `${docTitle} ${position}`;
  }
  return `${docTitle} ${position} ${rawTitle}`;
}

export type ImportResult = {
  documentTitle: string;
  rootNode: NodeRecord | null;
  chunks: ChunkNodeInfo[];
  totalChunks: number;
  linking: {
    parentChildEdges: number;
    sequentialEdges: number;
    semanticAccepted: number;
  };
};

/**
 * Core import function
 * Takes document text and options, returns structured result
 */
export async function importDocumentCore(
  documentText: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  // Batch all DB writes — persist once at the end instead of after every insert.
  // Without this, each insertNode/insertOrUpdateEdge exports the full 80MB+ DB to disk,
  // which crashes the server on memory-constrained hosts.
  await beginBatch();
  try {
    return await _importDocumentCoreInner(documentText, options);
  } finally {
    await endBatch();
  }
}

async function _importDocumentCoreInner(
  documentText: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  // Extract document title
  const documentTitle = options.documentTitle || extractDocumentTitle(documentText);

  // Set defaults (FOREST_CHUNK_MAX_TOKENS env var overrides default)
  const chunkStrategy = options.chunkStrategy || 'headers';
  const defaultMaxTokens = parseInt(process.env.FOREST_CHUNK_MAX_TOKENS || '9999', 10);
  const maxTokens = options.maxTokens || defaultMaxTokens;
  const overlap = options.overlap || 200;
  const autoLink = options.autoLink !== false;
  const createParent = options.createParent !== false;
  const linkSequential = options.linkSequential !== false;

  // Chunk the document
  const chunkingOptions: ChunkingOptions = {
    strategy: chunkStrategy,
    maxTokens,
    overlap,
  };

  const chunks = chunkDocument(documentText, chunkingOptions);

  if (chunks.length === 0) {
    throw new Error('Document produced no chunks - content may be empty');
  }

  // Create root/parent node if requested
  let rootNode: NodeRecord | null = null;
  const rootId = randomUUID();

  if (createParent) {
    // We'll update the root node body after creating chunks to include their IDs
    // For now, create a placeholder
    const firstChunkPreview = chunks[0].body.substring(0, 500);
    const placeholderBody = `# ${documentTitle}

Imported document with ${chunks.length} chunks.

## First chunk preview:
${firstChunkPreview}${chunks[0].body.length > 500 ? '...' : ''}
`;

    const rootTokenCounts = tokenize(placeholderBody);
    const rootTags = options.tags || extractTags(`${documentTitle}\n${placeholderBody}`, rootTokenCounts);
    const rootEmbedding = await computeEmbeddingForNode({ title: documentTitle, body: placeholderBody });

    const importMetadata: NodeMetadata = {
      origin: 'import',
      createdBy: 'user',
      ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
    };

    rootNode = {
      id: rootId,
      title: documentTitle,
      body: placeholderBody,
      tags: rootTags,
      tokenCounts: rootTokenCounts,
      embedding: rootEmbedding,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isChunk: false,
      parentDocumentId: null,
      chunkOrder: null,
      metadata: importMetadata,
    };

    await insertNode(rootNode);
  }

  // Compute embeddings for all chunks concurrently (limit 3 parallel calls)
  const EMBED_CONCURRENCY = 3;
  const chunkEmbeddings: (number[] | undefined)[] = new Array(chunks.length);

  for (let i = 0; i < chunks.length; i += EMBED_CONCURRENCY) {
    const batch = chunks.slice(i, i + EMBED_CONCURRENCY);
    const results = await Promise.all(
      batch.map((chunk) => computeEmbeddingForNode({ title: chunk.title, body: chunk.body }))
    );
    for (let j = 0; j < results.length; j++) {
      chunkEmbeddings[i + j] = results[j];
    }
  }

  // Create nodes for each chunk
  const chunkNodes: ChunkNodeInfo[] = [];
  const existingNodes = await listNodes();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkId = randomUUID();
    const combinedText = `${chunk.title}\n${chunk.body}`;
    const tokenCounts = tokenize(combinedText);

    // Use provided tags or auto-extract
    const chunkTags = options.tags || extractTags(combinedText, tokenCounts);

    const chunkNodeMetadata: NodeMetadata = {
      origin: 'import',
      createdBy: 'user',
      ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
    };

    const displayTitle = composeChunkTitle(documentTitle, i, chunks.length, chunk.title);

    const node: NodeRecord = {
      id: chunkId,
      title: displayTitle,
      body: chunk.body,
      tags: chunkTags,
      tokenCounts,
      embedding: chunkEmbeddings[i],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isChunk: true,
      parentDocumentId: rootId,
      chunkOrder: chunk.metadata.chunkIndex,
      metadata: chunkNodeMetadata,
    };

    await insertNode(node);
    chunkNodes.push({ node, chunk });
  }

  // Register canonical document + segment mappings
  const canonicalBody = chunkNodes.map((entry) => entry.node.body.replace(/\r\n/g, '\n')).join('\n\n');
  const documentMetadata: DocumentMetadata = {
    chunkStrategy,
    maxTokens,
    overlap,
    autoLink,
    createParent,
    linkSequential,
    chunkCount: chunkNodes.length,
    source: 'import',
  };

  const documentId = rootNode ? rootNode.id : rootId;
  const docCreatedAt = rootNode?.createdAt ?? chunkNodes[0]?.node.createdAt ?? new Date().toISOString();
  const docUpdatedAt = rootNode?.updatedAt ?? chunkNodes[chunkNodes.length - 1]?.node.updatedAt ?? docCreatedAt;

  const canonicalDocument: DocumentRecord = {
    id: documentId,
    title: documentTitle,
    body: canonicalBody,
    metadata: documentMetadata,
    version: 1,
    rootNodeId: rootNode ? rootNode.id : null,
    createdAt: docCreatedAt,
    updatedAt: docUpdatedAt,
  };

  let offset = 0;
  const chunkRecords: DocumentChunkRecord[] = chunkNodes
    .sort((a, b) => (a.node.chunkOrder ?? 0) - (b.node.chunkOrder ?? 0))
    .map((entry, index) => {
      const body = entry.node.body.replace(/\r\n/g, '\n');
      const record: DocumentChunkRecord = {
        documentId,
        segmentId: entry.node.id,
        nodeId: entry.node.id,
        offset,
        length: body.length,
        chunkOrder: entry.node.chunkOrder ?? index,
        checksum: createHash('sha256').update(body, 'utf8').digest('hex'),
        createdAt: entry.node.createdAt,
        updatedAt: entry.node.updatedAt,
      };
      offset += body.length;
      if (index < chunkNodes.length - 1) {
        offset += 2;
      }
      return record;
    });

  await upsertDocument(canonicalDocument);
  await replaceDocumentChunks(documentId, chunkRecords);

  // Update root node with full structure including chunk IDs
  if (rootNode) {
    const firstChunkPreview = chunks[0].body.substring(0, 500);
    const structureSection = chunkNodes
      .map((cn, i) => `${i + 1}. [${cn.node.id.substring(0, 8)}] ${cn.chunk.title}`)
      .join('\n');

    const finalBody = `# ${documentTitle}

Imported document with ${chunks.length} chunks.

## Structure:
${structureSection}

## First chunk preview:
${firstChunkPreview}${chunks[0].body.length > 500 ? '...' : ''}
`;

    await updateNode(rootNode.id, { body: finalBody });
    rootNode.body = finalBody; // Update local copy for return value
  }

  // Create edges
  let parentChildEdges = 0;
  let sequentialEdges = 0;
  let semanticAccepted = 0;

  // 1. Parent-child edges (root → chunks)
  if (rootNode) {
    for (const { node } of chunkNodes) {
      await insertOrUpdateEdge({
        id: randomUUID(),
        sourceId: rootNode.id < node.id ? rootNode.id : node.id,
        targetId: rootNode.id < node.id ? node.id : rootNode.id,
        score: 1.0, // Perfect score for structural relationship
        semanticScore: null,
        tagScore: null,
        sharedTags: [],
        status: 'accepted',
        edgeType: 'parent-child',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          type: 'parent-child',
          relationship: 'document-structure',
          parentId: rootNode.id,
          childId: node.id,
        },
      });
      parentChildEdges++;
    }
  }

  // 2. Sequential edges (chunk[i] → chunk[i+1])
  if (linkSequential && chunkNodes.length > 1) {
    for (let i = 0; i < chunkNodes.length - 1; i++) {
      const current = chunkNodes[i].node;
      const next = chunkNodes[i + 1].node;

      await insertOrUpdateEdge({
        id: randomUUID(),
        sourceId: current.id < next.id ? current.id : next.id,
        targetId: current.id < next.id ? next.id : current.id,
        score: 0.95, // High score for sequential relationship
        semanticScore: null,
        tagScore: null,
        sharedTags: [],
        status: 'accepted',
        edgeType: 'sequential',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          type: 'sequential',
          relationship: 'document-flow',
          prevChunkIndex: i,
          nextChunkIndex: i + 1,
        },
      });
      sequentialEdges++;
    }
  }

  // 3. Semantic auto-linking (if enabled)
  if (autoLink) {
    // Link root node against existing graph
    if (rootNode) {
      const rootLinking = await linkAgainstExisting(rootNode, existingNodes);
      semanticAccepted += rootLinking.accepted;
    }

    // Link each chunk against existing graph
    for (const { node } of chunkNodes) {
      const chunkLinking = await linkAgainstExisting(node, existingNodes);
      semanticAccepted += chunkLinking.accepted;
    }
  }

  return {
    documentTitle,
    rootNode,
    chunks: chunkNodes,
    totalChunks: chunks.length,
    linking: {
      parentChildEdges,
      sequentialEdges,
      semanticAccepted,
    },
  };
}
