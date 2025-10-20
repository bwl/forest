import { NodeRecord, listNodes as dbListNodes } from '../lib/db';
import { embedNoteText } from '../lib/embeddings';
import { cosineEmbeddings } from '../lib/scoring';

export type SemanticSearchOptions = {
  limit?: number;
  offset?: number;
  minScore?: number;
  tags?: string[];
};

export type SemanticSearchResult = {
  nodes: Array<{ node: NodeRecord; similarity: number }>;
  total: number;
};

/**
 * Perform semantic search using vector embeddings.
 * Searches for nodes semantically similar to the query string.
 */
export async function semanticSearchCore(
  query: string,
  options: SemanticSearchOptions = {},
): Promise<SemanticSearchResult> {
  // Validate query
  if (!query || query.trim().length === 0) {
    throw new Error('Search query cannot be empty');
  }

  // Generate embedding for the query
  const queryEmbedding = await embedNoteText(query);
  if (!queryEmbedding || queryEmbedding.length === 0) {
    throw new Error('Failed to generate embedding for query. Check FOREST_EMBED_PROVIDER setting.');
  }

  // Load all nodes from database
  const allNodes = await dbListNodes();

  // Filter to only nodes that have embeddings
  const nodesWithEmbeddings = allNodes.filter((node) => node.embedding && node.embedding.length > 0);

  if (nodesWithEmbeddings.length === 0) {
    return {
      nodes: [],
      total: 0,
    };
  }

  // Compute similarity scores for all nodes
  const scoredNodes = nodesWithEmbeddings.map((node) => {
    const similarity = cosineEmbeddings(queryEmbedding, node.embedding);
    return {
      node,
      similarity,
    };
  });

  // Apply minScore filter
  const minScore = options.minScore ?? 0.0;
  let filteredNodes = scoredNodes.filter((item) => item.similarity >= minScore);

  // Apply tag filter (AND logic - all tags must be present)
  if (options.tags && options.tags.length > 0) {
    filteredNodes = filteredNodes.filter((item) =>
      options.tags!.every((tag) => item.node.tags.includes(tag)),
    );
  }

  // Sort by similarity descending
  filteredNodes.sort((a, b) => b.similarity - a.similarity);

  const total = filteredNodes.length;

  // Apply pagination
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const paginatedNodes = filteredNodes.slice(offset, offset + limit);

  return {
    nodes: paginatedNodes,
    total,
  };
}
