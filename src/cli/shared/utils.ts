import fs from 'fs';
import path from 'path';

import { getNodeById, listNodes, NodeRecord } from '../../lib/db';

export const SHORT_ID_LENGTH = 8;
export const DEFAULT_SEARCH_LIMIT = 6;
export const DEFAULT_NEIGHBORHOOD_LIMIT = 25;
export const DEFAULT_MATCH_DISPLAY_LIMIT = 6;

export function formatId(id: string, options: { long?: boolean } = {}): string {
  if (options.long) return id;
  const segment = id.split('-')[0] ?? id;
  return segment.slice(0, SHORT_ID_LENGTH);
}

export function formatScore(score: number): string {
  if (Number.isNaN(score)) return '   -';
  const clamped = Math.max(0, Math.min(1, score));
  return clamped.toFixed(3);
}

export function edgeShortCode(a: string, b: string): string {
  const pair = `${formatId(a)}::${formatId(b)}`;
  let h = 0x811c9dc5 >>> 0; // FNV-1a 32-bit
  for (let i = 0; i < pair.length; i += 1) {
    h ^= pair.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0; // * 16777619
  }
  const base36 = h.toString(36);
  return base36.slice(-4).padStart(4, '0');
}

export function isShortId(term: string): boolean {
  return /^[0-9a-f]{6,}$/i.test(term) && term.length <= SHORT_ID_LENGTH;
}

export async function resolveByIdPrefix(prefix: string): Promise<NodeRecord | null> {
  const normalized = prefix.toLowerCase();
  const nodes = await listNodes();
  const matches = nodes.filter((node) => node.id.toLowerCase().startsWith(normalized));
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length > 1) {
    console.warn(`⚠ Multiple nodes share prefix ${prefix}. Use --id with the full identifier.`);
  }
  return null;
}

export async function resolveNodeReference(ref: string): Promise<NodeRecord | null> {
  if (!ref) return null;
  if (isShortId(ref)) {
    const prefix = await resolveByIdPrefix(ref);
    if (prefix) return prefix;
  }
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
