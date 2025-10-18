const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'if',
  'in',
  'into',
  'is',
  'it',
  'no',
  'not',
  'of',
  'on',
  'or',
  'such',
  'that',
  'the',
  'their',
  'then',
  'there',
  'these',
  'they',
  'this',
  'to',
  'was',
  'will',
  'with',
  'we',
  'you',
  'i',
  'should',
  'ensure',
  'include',
  'including',
  'includes',
  'using',
  'use',
  'used',
  'based'
]);

const TAG_BLACKLIST = new Set(['idea', 'plan', 'project', 'projects', 'system', 'systems']);

function normalizeToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('ies') && token.length > 4) {
    return token.slice(0, -3) + 'y';
  }
  if (
    token.endsWith('s') &&
    token.length > 4 &&
    !token.endsWith('ss') &&
    !token.endsWith('us') &&
    !token.endsWith('is')
  ) {
    return token.slice(0, -1);
  }
  return token;
}

export function extractTags(
  text: string,
  tokenCounts?: Record<string, number>,
  limit = 5
): string[] {
  const matches = text.match(/#[a-zA-Z0-9_-]+/g) ?? [];
  const normalizedMatches = new Set(matches.map((tag) => tag.replace(/^#/, '').toLowerCase()));
  if (normalizedMatches.size > 0) {
    return [...normalizedMatches];
  }

  const counts = tokenCounts ?? tokenize(text);
  return Object.entries(counts)
    .filter(([token]) => token.length >= 3 && !TAG_BLACKLIST.has(token))
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([token]) => token);
}

export function tokenize(text: string): Record<string, number> {
  const normalized = text.toLowerCase().replace(/[^a-z0-9#\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter((token) => token.length >= 2 && !STOPWORDS.has(token));
  const counts: Record<string, number> = {};
  for (const rawToken of tokens) {
    const token = normalizeToken(rawToken);
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
