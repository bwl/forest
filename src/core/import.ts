/**
 * Core import logic for large documents
 * Implements 3-layer architecture: pure business logic, no I/O dependencies
 */

import { randomUUID } from 'crypto';
import { NodeRecord, insertNode, listNodes, insertOrUpdateEdge, updateNode, EdgeRecord } from '../lib/db';
import { extractTags, tokenize, pickTitle } from '../lib/text';
import { computeEmbeddingForNode } from '../lib/embeddings';
import { linkAgainstExisting } from '../cli/shared/linking';
import { chunkDocument, extractDocumentTitle, ChunkingOptions, DocumentChunk } from '../lib/chunking';

export type ImportOptions = {
  documentTitle?: string;    // Override auto-detected title
  tags?: string[];            // Override auto-detected tags
  chunkStrategy?: 'headers' | 'size' | 'hybrid';
  maxTokens?: number;         // Default: 2000
  overlap?: number;           // Default: 200 characters
  autoLink?: boolean;         // Default: true
  createParent?: boolean;     // Create root/index node (default: true)
  linkSequential?: boolean;   // Link chunks in order (default: true)
};

export type ChunkNodeInfo = {
  node: NodeRecord;
  chunk: DocumentChunk;
};

export type ImportResult = {
  documentTitle: string;
  rootNode: NodeRecord | null;
  chunks: ChunkNodeInfo[];
  totalChunks: number;
  linking: {
    parentChildEdges: number;
    sequentialEdges: number;
    semanticAccepted: number;
    semanticSuggested: number;
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
  // Extract document title
  const documentTitle = options.documentTitle || extractDocumentTitle(documentText);

  // Set defaults
  const chunkStrategy = options.chunkStrategy || 'headers';
  const maxTokens = options.maxTokens || 2000;
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
    };

    await insertNode(rootNode);
  }

  // Create nodes for each chunk
  const chunkNodes: ChunkNodeInfo[] = [];
  const existingNodes = await listNodes();

  for (const chunk of chunks) {
    const chunkId = randomUUID();
    const combinedText = `${chunk.title}\n${chunk.body}`;
    const tokenCounts = tokenize(combinedText);

    // Use provided tags or auto-extract
    const chunkTags = options.tags || extractTags(combinedText, tokenCounts);

    // Compute embedding
    const embedding = await computeEmbeddingForNode({ title: chunk.title, body: chunk.body });

    const node: NodeRecord = {
      id: chunkId,
      title: chunk.title,
      body: chunk.body,
      tags: chunkTags,
      tokenCounts,
      embedding,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isChunk: true,
      parentDocumentId: rootId,
      chunkOrder: chunk.metadata.chunkIndex,
    };

    await insertNode(node);
    chunkNodes.push({ node, chunk });
  }

  // Update root node with full structure including chunk IDs
  if (rootNode) {
    const firstChunkPreview = chunks[0].body.substring(0, 500);
    const structureSection = chunkNodes
      .map((cn, i) => `${i + 1}. [${cn.node.id.substring(0, 8)}] ${cn.node.title}`)
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
  let semanticSuggested = 0;

  // 1. Parent-child edges (root → chunks)
  if (rootNode) {
    for (const { node } of chunkNodes) {
      await insertOrUpdateEdge({
        id: randomUUID(),
        sourceId: rootNode.id < node.id ? rootNode.id : node.id,
        targetId: rootNode.id < node.id ? node.id : rootNode.id,
        score: 1.0, // Perfect score for structural relationship
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
      semanticSuggested += rootLinking.suggested;
    }

    // Link each chunk against existing graph
    for (const { node } of chunkNodes) {
      const chunkLinking = await linkAgainstExisting(node, existingNodes);
      semanticAccepted += chunkLinking.accepted;
      semanticSuggested += chunkLinking.suggested;
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
      semanticSuggested,
    },
  };
}
