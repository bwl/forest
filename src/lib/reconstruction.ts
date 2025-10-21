/**
 * Document reconstruction utilities
 *
 * This module handles reassembling chunked documents back into their original form.
 * When a document is imported and chunked, we create:
 * - A root/parent node (isChunk: false)
 * - Multiple chunk nodes (isChunk: true, parentDocumentId: <root-id>)
 * - Parent-child edges (edgeType: 'parent-child')
 * - Sequential edges (edgeType: 'sequential')
 *
 * When reading, we detect chunks and automatically reconstruct the full document.
 */

import { NodeRecord, listNodes, getNodeById, EdgeRecord, listEdges } from './db';

export type ReconstructedDocument = {
  rootNode: NodeRecord;
  chunks: NodeRecord[];
  fullBody: string;
  metadata: {
    totalChunks: number;
    isReconstructed: true;
  };
};

/**
 * Check if a node is a chunk of a larger document
 */
export function isChunk(node: NodeRecord): boolean {
  return node.isChunk === true && node.parentDocumentId !== null;
}

/**
 * Check if a node is a document root (has chunks)
 */
export async function isDocumentRoot(node: NodeRecord): Promise<boolean> {
  if (node.isChunk) return false;

  // Check if any nodes reference this as parent
  const allNodes = await listNodes();
  return allNodes.some(n => n.parentDocumentId === node.id);
}

/**
 * Get all chunks for a given parent document
 * Returns chunks sorted by chunkOrder
 */
export async function getChunksForDocument(parentDocumentId: string): Promise<NodeRecord[]> {
  const allNodes = await listNodes();
  const chunks = allNodes.filter(n => n.parentDocumentId === parentDocumentId);

  // Sort by chunk order
  chunks.sort((a, b) => {
    const orderA = a.chunkOrder ?? 0;
    const orderB = b.chunkOrder ?? 0;
    return orderA - orderB;
  });

  return chunks;
}

/**
 * Get the parent document for a given chunk
 */
export async function getParentDocument(chunk: NodeRecord): Promise<NodeRecord | null> {
  if (!chunk.isChunk || !chunk.parentDocumentId) {
    return null;
  }

  return await getNodeById(chunk.parentDocumentId);
}

/**
 * Reconstruct a full document from its chunks
 *
 * If the node is a chunk, we find the parent and reconstruct from all chunks.
 * If the node is a root with chunks, we reconstruct from its chunks.
 * If the node is neither, we return null (not a chunked document).
 */
export async function reconstructDocument(node: NodeRecord): Promise<ReconstructedDocument | null> {
  let rootNode: NodeRecord;

  // Case 1: Node is a chunk - find parent
  if (isChunk(node)) {
    const parent = await getParentDocument(node);
    if (!parent) {
      // Orphaned chunk - shouldn't happen, but handle gracefully
      return null;
    }
    rootNode = parent;
  }
  // Case 2: Node is a root - check if it has chunks
  else if (await isDocumentRoot(node)) {
    rootNode = node;
  }
  // Case 3: Node is neither chunk nor root
  else {
    return null;
  }

  // Get all chunks for this document
  const chunks = await getChunksForDocument(rootNode.id);

  if (chunks.length === 0) {
    // Root exists but no chunks found - shouldn't happen
    return null;
  }

  // Reconstruct full body by concatenating chunks in order
  const fullBody = chunks.map(chunk => chunk.body).join('\n\n');

  return {
    rootNode,
    chunks,
    fullBody,
    metadata: {
      totalChunks: chunks.length,
      isReconstructed: true,
    },
  };
}

/**
 * Filter out chunks from a list of nodes, keeping only roots and standalone nodes
 * This is useful for search/explore views where we don't want to show individual chunks
 */
export function filterOutChunks(nodes: NodeRecord[]): NodeRecord[] {
  return nodes.filter(node => !isChunk(node));
}

/**
 * Get a deduplicated list of nodes where chunks are replaced by their parents
 * If multiple chunks from the same document appear, only the parent is included once
 */
export async function deduplicateChunks(nodes: NodeRecord[]): Promise<NodeRecord[]> {
  const seen = new Set<string>();
  const result: NodeRecord[] = [];

  for (const node of nodes) {
    if (isChunk(node)) {
      // For chunks, add the parent if not already seen
      const parentId = node.parentDocumentId!;
      if (!seen.has(parentId)) {
        const parent = await getParentDocument(node);
        if (parent) {
          result.push(parent);
          seen.add(parentId);
        }
      }
    } else {
      // For non-chunks, add directly if not already seen
      if (!seen.has(node.id)) {
        result.push(node);
        seen.add(node.id);
      }
    }
  }

  return result;
}

/**
 * Format a reconstructed document for display
 * Returns a string suitable for `forest node read` output
 */
export function formatReconstructedDocument(doc: ReconstructedDocument): string {
  const lines: string[] = [];

  lines.push(`# ${doc.rootNode.title}`);
  lines.push('');
  lines.push(`[Document with ${doc.metadata.totalChunks} chunks - automatically reconstructed]`);
  lines.push('');
  lines.push(doc.fullBody);
  lines.push('');
  lines.push('---');
  lines.push(`Chunks: ${doc.chunks.map(c => c.id.substring(0, 8)).join(', ')}`);

  return lines.join('\n');
}
