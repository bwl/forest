import fs from 'fs';
import path from 'path';

import { getNodeById, listNodes, NodeRecord, EdgeRecord } from '../../lib/db';
import { generateEdgeHash, buildPrefixMap, normalizeNodeId, findHashesByPrefix, buildNodePrefixMap } from '../../lib/progressive-id';

// Cache prefix maps per edge list so callers can reuse them within a command invocation.
const edgePrefixCache = new WeakMap<EdgeRecord[], Map<string, string>>();

export const SHORT_ID_LENGTH = 8;
export const MIN_NODE_ID_LENGTH = 4;
export const DEFAULT_SEARCH_LIMIT = 6;
export const DEFAULT_NEIGHBORHOOD_LIMIT = 25;
export const DEFAULT_MATCH_DISPLAY_LIMIT = 6;

/**
 * Format a node ID for display (legacy function - uses fixed 8-char length).
 * For progressive display, use formatNodeIdProgressive() instead.
 *
 * @param id - Node UUID
 * @param options - Formatting options
 * @returns Formatted ID (full UUID if long=true, otherwise 8 chars)
 */
export function formatId(id: string, options: { long?: boolean } = {}): string {
  if (options.long) return id;
  const segment = id.split('-')[0] ?? id;
  return segment.slice(0, SHORT_ID_LENGTH);
}

/**
 * Format a node ID using progressive abbreviation (Git-style).
 * Shows the shortest unique prefix (minimum 4 chars, grows as needed).
 *
 * @param id - Node UUID
 * @param allNodes - All nodes in the graph (for uniqueness checking)
 * @param options - Formatting options
 * @returns Shortest unique prefix or full UUID if long=true
 */
export function formatNodeIdProgressive(
  id: string,
  allNodes: NodeRecord[],
  options: { long?: boolean } = {}
): string {
  if (options.long) return id;

  const allIds = allNodes.map((n) => n.id);
  const prefixMap = buildNodePrefixMap(allIds, MIN_NODE_ID_LENGTH);
  return prefixMap.get(id) ?? normalizeNodeId(id).slice(0, MIN_NODE_ID_LENGTH);
}

export function formatScore(score: number): string {
  if (Number.isNaN(score)) return '   -';
  const clamped = Math.max(0, Math.min(1, score));
  return clamped.toFixed(3);
}

/**
 * Get the full stable hash for an edge (Git-style long ID).
 */
export function getEdgeHash(sourceId: string, targetId: string): string {
  return generateEdgeHash(sourceId, targetId);
}

/**
 * Get the minimal unique prefix for an edge among all edges.
 * Uses Git-style progressive abbreviation (min 4 chars, grows as needed).
 */
export function getEdgePrefix(sourceId: string, targetId: string, allEdges: EdgeRecord[]): string {
  const hash = generateEdgeHash(sourceId, targetId);

  if (allEdges.length === 0) {
    return hash.slice(0, 4);
  }

  let prefixMap = edgePrefixCache.get(allEdges);
  if (!prefixMap) {
    const allHashes = allEdges.map(e => generateEdgeHash(e.sourceId, e.targetId));
    prefixMap = buildPrefixMap(allHashes, 4);
    edgePrefixCache.set(allEdges, prefixMap);
  }

  return prefixMap.get(hash) ?? hash.slice(0, 4);
}

/**
 * Check if a string looks like a progressive edge ID (hex chars, 4+ chars).
 */
export function isProgressiveEdgeId(term: string): boolean {
  return /^[0-9a-f]{4,}$/i.test(term);
}

export type ResolveOptions = {
  select?: number;  // 1-based index to pick from ambiguous matches
};

export function isShortId(term: string): boolean {
  return /^[0-9a-f]{4,}$/i.test(term) && term.length <= SHORT_ID_LENGTH;
}

export async function resolveByIdPrefix(prefix: string, options: ResolveOptions = {}): Promise<NodeRecord | null> {
  const nodes = await listNodes();
  const normalizedPrefix = prefix.toLowerCase().replace(/-/g, '');

  // Find all nodes that match the prefix (case-insensitive, works with or without dashes)
  const matches = nodes.filter((node) => {
    const normalizedId = normalizeNodeId(node.id);
    return normalizedId.startsWith(normalizedPrefix);
  });

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    // Sort by recency for consistent ordering
    const sortedMatches = matches
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // If --select is provided, pick the Nth match
    if (typeof options.select === 'number' && options.select >= 1 && options.select <= sortedMatches.length) {
      return sortedMatches[options.select - 1];
    }

    // Rich disambiguation UI (Git-style)
    console.error(`✖ Ambiguous ID '${prefix}' matches ${matches.length} nodes. Use --select N or a more specific reference.`);
    const displayMatches = sortedMatches.slice(0, 10); // Show max 10

    for (const match of displayMatches) {
      const shortId = normalizeNodeId(match.id).slice(0, 8);
      const date = new Date(match.updatedAt).toISOString().split('T')[0];
      const title = match.title ? `"${match.title}"` : '(untitled)';
      console.error(`  ${shortId}  ${title} (${date})`);
    }

    if (matches.length > 10) {
      console.error(`  ... and ${matches.length - 10} more`);
    }
    console.error('\nUse a longer prefix to disambiguate.');
  }

  return null;
}

/**
 * Resolve recency references (@, @0, @1, etc.) to node records.
 * @ or @0 = most recently updated node
 * @1 = second most recently updated
 * @2 = third most recently updated, etc.
 *
 * @param ref - Recency reference (e.g., '@', '@0', '@1')
 * @returns Node record or null if invalid/out of range
 */
export async function resolveRecencyReference(ref: string): Promise<NodeRecord | null> {
  const match = /^@(\d*)$/.exec(ref);
  if (!match) return null;

  const index = match[1] === '' ? 0 : Number.parseInt(match[1], 10);
  if (!Number.isFinite(index) || index < 0) return null;

  const nodes = await listNodes();
  const sorted = nodes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return sorted[index] ?? null;
}

/**
 * Resolve node references with Git-like patterns:
 * - Short IDs: '7fa7acb2' (any length prefix)
 * - Full UUIDs: '7fa7acb2-ed4a-4f3b-9c1e-8a2b3c4d5e6f'
 * - Recency refs: '@' or '@0' (last updated), '@1' (second last), etc.
 * - Tag search: '#typescript' (finds nodes tagged with 'typescript')
 * - Title search: '"API design"' (finds nodes with matching title)
 *
 * @param ref - Node reference string
 * @param options - Resolution options (e.g., select index for ambiguous matches)
 * @returns Node record or null if not found/ambiguous
 */
export async function resolveNodeReference(ref: string, options: ResolveOptions = {}): Promise<NodeRecord | null> {
  if (!ref) return null;

  // Try recency reference first (@, @1, @2, etc.)
  if (ref.startsWith('@')) {
    return await resolveRecencyReference(ref);
  }

  // Try tag search (#tagname)
  if (ref.startsWith('#')) {
    const tagName = ref.slice(1).toLowerCase();
    if (tagName) {
      const nodes = await listNodes();
      const matches = nodes.filter((node) =>
        node.tags.some((tag) => tag.toLowerCase() === tagName)
      );

      if (matches.length === 1) {
        return matches[0];
      }

      if (matches.length > 1) {
        // Sort by recency for consistent ordering
        const sorted = matches
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        // If --select is provided, pick the Nth match
        if (typeof options.select === 'number' && options.select >= 1 && options.select <= sorted.length) {
          return sorted[options.select - 1];
        }

        console.error(`✖ Tag '#${tagName}' matches ${matches.length} nodes. Use --select N or a more specific reference.`);
        const recent = sorted.slice(0, 5);

        for (const match of recent) {
          const shortId = normalizeNodeId(match.id).slice(0, 8);
          const title = match.title ? `"${match.title}"` : '(untitled)';
          console.error(`  ${shortId}  ${title}`);
        }

        if (matches.length > 5) {
          console.error(`  ... and ${matches.length - 5} more`);
        }
      }

      return null;
    }
  }

  // Try title search ("title fragment")
  if (ref.startsWith('"') && ref.endsWith('"')) {
    const titleFragment = ref.slice(1, -1).toLowerCase();
    if (titleFragment) {
      const nodes = await listNodes();
      const matches = nodes.filter((node) =>
        node.title && node.title.toLowerCase().includes(titleFragment)
      );

      if (matches.length === 1) {
        return matches[0];
      }

      if (matches.length > 1) {
        // Sort by recency for consistent ordering
        const sorted = matches
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        // If --select is provided, pick the Nth match
        if (typeof options.select === 'number' && options.select >= 1 && options.select <= sorted.length) {
          return sorted[options.select - 1];
        }

        console.error(`✖ Title search "${titleFragment}" matches ${matches.length} nodes. Use --select N or a more specific search.`);
        const recent = sorted.slice(0, 5);

        for (const match of recent) {
          const shortId = normalizeNodeId(match.id).slice(0, 8);
          console.error(`  ${shortId}  "${match.title}"`);
        }

        if (matches.length > 5) {
          console.error(`  ... and ${matches.length - 5} more`);
        }
      }

      return null;
    }
  }

  // Try short ID prefix (case-insensitive, works with/without dashes)
  if (isShortId(ref) || /^[0-9a-f-]{4,}$/i.test(ref)) {
    const prefix = await resolveByIdPrefix(ref, options);
    if (prefix) return prefix;
  }

  // Try exact match on full UUID
  const direct = await getNodeById(ref);
  if (direct) return direct;

  return null;
}

export function toNumber(value: string, defaultValue?: number): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  if (typeof defaultValue === 'number') return defaultValue;
  return NaN;
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve) => {
    process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    process.stdin.resume();
  });
}

export function edgeIdentifier(a: string, b: string): string {
  return `${a}::${b}`;
}

export function parseCsvList(value?: string): string[] | undefined {
  if (typeof value !== 'string') return undefined;
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length ? parts : undefined;
}

export function parseDate(value?: string): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const v = value.trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00.000Z` : v;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function normalizeSort(value?: string): 'score' | 'recent' | 'degree' | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.toLowerCase();
  if (v === 'recent' || v === 'score' || v === 'degree') return v as any;
  return undefined;
}

export function escapeLabel(text: string): string {
  return String(text).replace(/"/g, '\\"');
}

export function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`✖ ${error.message}`);
  } else {
    console.error('✖ Unexpected error', error);
  }
  process.exitCode = 1;
}

export type ResolvedBody = { value: string; provided: boolean };

export async function resolveBodyInput(
  bodyOption?: string,
  fileOption?: string,
  stdinOption?: boolean,
): Promise<ResolvedBody> {
  if (bodyOption !== undefined) return { value: bodyOption, provided: true };
  if (fileOption) {
    const filePath = path.resolve(fileOption);
    return { value: fs.readFileSync(filePath, 'utf-8'), provided: true };
  }
  if (stdinOption) {
    return { value: await readStdin(), provided: true };
  }
  return { value: '', provided: false };
}

export async function resolveBody(bodyOption?: string, fileOption?: string, stdinOption?: boolean): Promise<string> {
  const result = await resolveBodyInput(bodyOption, fileOption, stdinOption);
  return result.value;
}
