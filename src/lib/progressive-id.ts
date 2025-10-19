/**
 * Progressive ID system for edges (Git-style minimal unique prefixes)
 *
 * Instead of fixed 4-char codes, we generate stable long hashes and display
 * the shortest unique prefix (minimum 4 chars, growing as needed to avoid collisions).
 */

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Generate a stable, long hash ID for an edge pair.
 * Uses FNV-1a 64-bit hash encoded as base62 (16 chars).
 *
 * @param sourceId - First node ID (unnormalized)
 * @param targetId - Second node ID (unnormalized)
 * @returns 16-character base62 hash
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

  // Combine into 64-bit number (as BigInt for precision)
  const hash64 = (BigInt(h1) << 32n) | BigInt(h2);

  // Encode as base62 (16 chars minimum)
  return toBase62(hash64, 16);
}

/**
 * Convert a BigInt to base62 string with minimum length.
 */
function toBase62(value: bigint, minLength: number): string {
  if (value === 0n) return '0'.padStart(minLength, '0');

  let result = '';
  let num = value;
  while (num > 0n) {
    const remainder = Number(num % 62n);
    result = BASE62_CHARS[remainder] + result;
    num = num / 62n;
  }

  return result.padStart(minLength, '0');
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
 * @param prefix - The prefix to search for (case-sensitive)
 * @param allHashes - All hashes in the system
 * @returns Array of matching hashes
 */
export function findHashesByPrefix(prefix: string, allHashes: string[]): string[] {
  if (!prefix) return [];

  const normalized = prefix;
  return allHashes.filter((hash) => hash.startsWith(normalized));
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
