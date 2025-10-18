const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into', 'is', 'it',
  'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they',
  'this', 'to', 'was', 'will', 'with', 'we', 'you', 'i'
]);

export function extractTags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_-]+/g) ?? [];
  const normalized = new Set(matches.map((tag) => tag.replace(/^#/, '').toLowerCase()));
  return [...normalized];
}

export function tokenize(text: string): Record<string, number> {
  const normalized = text.toLowerCase().replace(/[^a-z0-9#\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter((token) => token.length >= 2 && !STOPWORDS.has(token));
  const counts: Record<string, number> = {};
  for (const token of tokens) {
    counts[token] = (counts[token] ?? 0) + 1;
  }
  return counts;
}

export function tokensFromTitle(title: string): string[] {
  const normalized = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter((token) => token.length >= 2 && !STOPWORDS.has(token));
  return tokens;
}

export function pickTitle(rawBody: string, providedTitle?: string): string {
  if (providedTitle && providedTitle.trim().length > 0) {
    return providedTitle.trim();
  }
  const firstLine = rawBody.split(/\r?\n/).find((line) => line.trim().length > 0);
  if (firstLine) {
    return firstLine.trim();
  }
  return rawBody.slice(0, 80).trim() || 'Untitled Idea';
}
