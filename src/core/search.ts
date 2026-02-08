import {
  NodeRecord,
  SearchMatch,
  listNodes as dbListNodes,
  searchNodes as dbSearchNodes,
  findNodeByTitle,
  getNodeById,
} from '../lib/db';
import { embedNoteText } from '../lib/embeddings';
import { cosineEmbeddings } from '../lib/scoring';
import { filterOutChunks } from '../lib/reconstruction';
import { buildGraph } from '../lib/graph';
import { isShortId, resolveByIdPrefix } from '../cli/shared/utils';

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

// ── Metadata search ────────────────────────────────────────────────────

export type MetadataSearchOptions = {
  id?: string;
  title?: string;
  term?: string;
  limit?: number;
  tagsAll?: string[];
  tagsAny?: string[];
  since?: string;
  until?: string;
  sort?: 'score' | 'recent' | 'degree';
  showChunks?: boolean;
  origin?: string;
  createdBy?: string;
};

export type MetadataSearchResult = {
  matches: SearchMatch[];
  total: number;
};

/**
 * Metadata search — filters nodes by id, title, term, tags, dates, and provenance.
 * Shared by CLI (selectNode) and API (/search/metadata).
 */
export async function metadataSearchCore(
  options: MetadataSearchOptions = {},
): Promise<MetadataSearchResult> {
  const searchLimit = options.limit ?? 20;

  // 1. Exact id lookup
  if (options.id) {
    let node = await getNodeById(options.id);
    if (!node && isShortId(options.id)) {
      const byPrefix = await resolveByIdPrefix(options.id);
      if (byPrefix) node = byPrefix;
    }
    if (!node) {
      throw new Error(`Node with id ${options.id} not found.`);
    }
    return { matches: [{ node, score: 1 }], total: 1 };
  }

  // 1b. If term looks like a short id, try prefix match first
  if (options.term && isShortId(options.term)) {
    const prefixMatch = await resolveByIdPrefix(options.term);
    if (prefixMatch) {
      return { matches: [{ node: prefixMatch, score: 1 }], total: 1 };
    }
  }

  // 2. Exact title lookup
  if (options.title) {
    const titleMatch = await findNodeByTitle(options.title);
    if (titleMatch) {
      return { matches: [{ node: titleMatch, score: 1 }], total: 1 };
    }
  }

  const term = options.title ?? options.term ?? '';
  const hasFilters = Boolean(
    (options.tagsAll && options.tagsAll.length) ||
      (options.tagsAny && options.tagsAny.length) ||
      options.since ||
      options.until ||
      options.origin ||
      options.createdBy ||
      (options.sort && options.sort !== 'score'),
  );

  let matches: SearchMatch[] = [];

  if (!hasFilters && term) {
    // Simple keyword search via db
    matches = await dbSearchNodes(term, searchLimit);
    if (!options.showChunks) {
      matches = matches.filter((m) => !m.node.isChunk);
    }
  } else {
    // Load all nodes and apply filters
    const allNodes = await dbListNodes();
    const all = options.showChunks ? allNodes : filterOutChunks(allNodes);

    const sinceDate = options.since ? parseIsoDate(options.since) : null;
    const untilDate = options.until ? parseIsoDate(options.until) : null;
    const originFilter = options.origin?.trim().toLowerCase();
    const createdByFilter = options.createdBy?.trim().toLowerCase();

    const filtered = all.filter((node) => {
      if (options.tagsAll && options.tagsAll.length) {
        for (const t of options.tagsAll) if (!node.tags.includes(t)) return false;
      }
      if (options.tagsAny && options.tagsAny.length) {
        let ok = false;
        for (const t of options.tagsAny) if (node.tags.includes(t)) ok = true;
        if (!ok) return false;
      }
      if (sinceDate) {
        const ts = new Date(node.updatedAt).getTime();
        if (Number.isFinite(ts) && ts < sinceDate.getTime()) return false;
      }
      if (untilDate) {
        const ts = new Date(node.updatedAt).getTime();
        if (Number.isFinite(ts) && ts >= untilDate.getTime()) return false;
      }
      // Provenance filters
      if (originFilter) {
        if (node.metadata?.origin !== originFilter) return false;
      }
      if (createdByFilter) {
        if (node.metadata?.createdBy?.toLowerCase() !== createdByFilter) return false;
      }
      return true;
    });

    let scored: SearchMatch[];
    if (term) {
      const normalized = term.trim().toLowerCase();
      scored = filtered
        .map((node) => {
          const titleMatch = node.title.toLowerCase().includes(normalized);
          const tagMatch = node.tags.some((tag) => tag.toLowerCase().includes(normalized));
          const bodyMatch = node.body.toLowerCase().includes(normalized);
          const score = (titleMatch ? 3 : 0) + (tagMatch ? 2 : 0) + (bodyMatch ? 1 : 0);
          return { node, score } as SearchMatch;
        })
        .filter((e) => e.score > 0)
        .map((e) => ({ node: e.node, score: Math.min(1, e.score / 6) }));
    } else {
      scored = filtered
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((node, index) => ({ node, score: Math.max(0.2, 1 - index / Math.max(1, filtered.length)) }));
    }

    let sorted = scored;
    if (options.sort === 'recent') {
      sorted = [...scored].sort(
        (a, b) => new Date(b.node.updatedAt).getTime() - new Date(a.node.updatedAt).getTime(),
      );
    } else if (options.sort === 'degree') {
      const graph = await buildGraph();
      sorted = [...scored].sort((a, b) => {
        const da = graph.hasNode(a.node.id) ? graph.degree(a.node.id) : 0;
        const db = graph.hasNode(b.node.id) ? graph.degree(b.node.id) : 0;
        if (db !== da) return db - da;
        return new Date(b.node.updatedAt).getTime() - new Date(a.node.updatedAt).getTime();
      });
    } else {
      sorted = [...scored].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.node.updatedAt).getTime() - new Date(a.node.updatedAt).getTime();
      });
    }

    matches = sorted.slice(0, searchLimit);
  }

  return { matches, total: matches.length };
}

function parseIsoDate(value: string): Date | null {
  const v = value.trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00.000Z` : v;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}
