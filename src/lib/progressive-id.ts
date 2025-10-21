/**
 * Progressive ID system for nodes and edges (Git-style minimal unique prefixes)
 *
 * Instead of fixed-length codes, we display the shortest unique prefix
 * (minimum 4 chars for edges, 4-8 for nodes, growing as needed to avoid collisions).
 *
 * For nodes: Uses UUID without dashes as the stable identifier
 * For edges: Uses FNV-1a hash of normalized node pair
 */

/**
 * Generate a stable, long hash ID for an edge pair.
 * Uses FNV-1a 64-bit hash encoded as hex (16 chars).
 *
 * @param sourceId - First node ID (unnormalized)
 * @param targetId - Second node ID (unnormalized)
 * @returns 16-character hex hash (lowercase, like Git)
 */
export function generateEdgeHash(sourceId: string, targetId: string): string {
  // Normalize pair order to ensure stability
  const [a, b] = sourceId < targetId ? [sourceId, targetId] : [targetId, sourceId];
  const input = `${a}::${b}`;

  // FNV-1a 64-bit hash (simulated with two 32-bit hashes for JavaScript)
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0xcbf29ce4 >>> 0;

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code;
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }

  // Encode as hex (8 chars each = 16 total)
  const hex1 = h1.toString(16).padStart(8, '0');
  const hex2 = h2.toString(16).padStart(8, '0');

  return hex1 + hex2;
}

/**
 * Find the shortest unique prefix for a hash among a set of hashes.
 *
 * @param hash - The hash to find a prefix for
 * @param allHashes - All hashes in the system
 * @param minLength - Minimum prefix length (default: 4)
 * @returns Shortest unique prefix
 */
export function findUniquePrefix(hash: string, allHashes: string[], minLength = 4): string {
  if (!hash || hash.length < minLength) {
    return hash.padEnd(minLength, '0');
  }

  // Start with minimum length and grow until unique
  for (let len = minLength; len <= hash.length; len += 1) {
    const prefix = hash.slice(0, len);
    const conflicts = allHashes.filter((h) => h !== hash && h.startsWith(prefix));

    if (conflicts.length === 0) {
      return prefix;
    }
  }

  // If we got here, return full hash (shouldn't happen with good hashes)
  return hash;
}

/**
 * Find all hashes that match a given prefix.
 *
 * @param prefix - The prefix to search for (case-insensitive)
 * @param allHashes - All hashes in the system
 * @returns Array of matching hashes
 */
export function findHashesByPrefix(prefix: string, allHashes: string[]): string[] {
  if (!prefix) return [];

  const normalized = prefix.toLowerCase();
  return allHashes.filter((hash) => hash.toLowerCase().startsWith(normalized));
}

/**
 * Resolve a prefix to exactly one hash, or return null if ambiguous/not found.
 *
 * @param prefix - The prefix to resolve
 * @param allHashes - All hashes in the system
 * @returns The matched hash, or null if not found or ambiguous
 */
export function resolvePrefix(prefix: string, allHashes: string[]): string | null {
  const matches = findHashesByPrefix(prefix, allHashes);

  if (matches.length === 0) {
    return null; // Not found
  }

  if (matches.length > 1) {
    return null; // Ambiguous
  }

  return matches[0];
}

/**
 * Build a map of all edge hashes with their minimal unique prefixes.
 *
 * @param edgeHashes - Array of edge hashes
 * @param minLength - Minimum prefix length (default: 4)
 * @returns Map from hash to its minimal unique prefix
 */
export function buildPrefixMap(edgeHashes: string[], minLength = 4): Map<string, string> {
  const map = new Map<string, string>();

  for (const hash of edgeHashes) {
    const prefix = findUniquePrefix(hash, edgeHashes, minLength);
    map.set(hash, prefix);
  }

  return map;
}

/**
 * Normalize a node UUID to a stable hash string (removes dashes, lowercase).
 * For nodes, we use the UUID itself as the stable identifier.
 *
 * @param nodeId - UUID with or without dashes
 * @returns Normalized hex string (32 chars for full UUID, or as provided)
 */
export function normalizeNodeId(nodeId: string): string {
  return nodeId.toLowerCase().replace(/-/g, '');
}

/**
 * Get the minimal unique prefix for a node ID among all nodes.
 *
 * @param nodeId - The node UUID to abbreviate
 * @param allNodeIds - All node UUIDs in the system
 * @param minLength - Minimum prefix length (default: 4)
 * @returns Shortest unique prefix of the normalized node ID
 */
export function getNodePrefix(nodeId: string, allNodeIds: string[], minLength = 4): string {
  const normalized = normalizeNodeId(nodeId);
  const allNormalized = allNodeIds.map(normalizeNodeId);
  return findUniquePrefix(normalized, allNormalized, minLength);
}

/**
 * Build a map of all node IDs with their minimal unique prefixes.
 *
 * @param nodeIds - Array of node UUIDs
 * @param minLength - Minimum prefix length (default: 4)
 * @returns Map from original node ID to its minimal unique prefix
 */
export function buildNodePrefixMap(nodeIds: string[], minLength = 4): Map<string, string> {
  const map = new Map<string, string>();

  for (const nodeId of nodeIds) {
    const prefix = getNodePrefix(nodeId, nodeIds, minLength);
    map.set(nodeId, prefix);
  }

  return map;
}
