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
  // modal/auxiliary/filler
  'can',
  'could',
  'should',
  'would',
  'may',
  'might',
  'must',
  'also',
  'very',
  'much',
  'more',
  'most',
  'many',
  'few',
  'several',
  'often',
  'usually',
  'sometimes',
  'generally',
  // discourse/connectives
  'from',
  'after',
  'before',
  'between',
  'across',
  'along',
  'within',
  'without',
  'via',
  'per',
  'because',
  'however',
  'therefore',
  'thus',
  // generic verbs
  'ensure',
  'include',
  'including',
  'includes',
  'using',
  'use',
  'used',
  'based',
  'make',
  'made',
  'makes',
  'provide',
  'provides',
  'provided',
  'create',
  'creates',
  'created',
  // domain-agnostic nouns that add noise
  'system',
  'systems',
  'process',
  'processes',
  'structure',
  'pattern',
  'patterns',
  'interface',
  'method',
  'methods',
  'approach',
  'approaches',
  'way',
  'ways'
]);

const TAG_BLACKLIST = new Set([
  'idea',
  'plan',
  'project',
  'projects',
  'system',
  'systems',
]);
// Lightweight stemmer: plural/verb endings and comparatives.
function normalizeToken(token: string): string {
  if (token.length <= 3) return token;
  // Common plurals
  if (token.endsWith('ies') && token.length > 4) return token.slice(0, -3) + 'y'; // policies -> policy
  if (token.endsWith('sses')) return token.slice(0, -2); // classes -> class
  if (/(ches|shes|xes|zes)$/i.test(token)) return token.slice(0, -2); // branches -> branch
  // Past/gerund
  if (token.endsWith('ing') && token.length > 5) return token.slice(0, -3); // flowing -> flow
  if (token.endsWith('ed') && token.length > 4) return token.slice(0, -2); // flowed -> flow
  // Avoid naive 'er'/'est' stripping to prevent nouns like "river" -> "riv"
  // Trailing simple plural 's' (avoid ss/us/is)
  if (token.endsWith('s') && token.length > 4 && !/(ss|us|is)$/i.test(token)) return token.slice(0, -1);
  return token;
}

// Down-weight generic technical terms when ranking tags
const GENERIC_TECH = new Set(['flow', 'flows', 'stream', 'streams', 'pipe', 'pipes', 'branch', 'branches', 'terminal', 'terminals']);

function tokenWeight(token: string): number {
  return GENERIC_TECH.has(token) ? 0.4 : 1;
}

/**
 * Strip fenced code blocks and inline code before tag extraction
 * so that hashtags inside code (e.g. #include, #tag/test) are ignored.
 */
function stripCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
}

function tokenizeToList(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9#\s]/g, ' ');
  const raw = normalized.split(/\s+/).filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return raw.map((t) => normalizeToken(t));
}

/**
 * Extract tags from text - routes to LLM or lexical based on config
 * NOTE: This is sync for backward compat - use extractTagsAsync for LLM support
 */
export function extractTags(
  text: string,
  tokenCounts?: Record<string, number>,
  limit = 5
): string[] {
  // Check for explicit hashtags first (strip code blocks to avoid false positives)
  const strippedText = stripCodeBlocks(text);
  const matches = strippedText.match(/#[a-zA-Z0-9_/-]+/g) ?? [];
  const normalizedMatches = new Set(matches.map((tag) => tag.replace(/^#/, '').toLowerCase()));
  if (normalizedMatches.size > 0) {
    return [...normalizedMatches];
  }

  // Fall through to lexical tagging (LLM requires async, so we use extractTagsLexical)
  return extractTagsLexical(text, tokenCounts, limit);
}

/**
 * Lexical tag extraction (frequency-based)
 */
export function extractTagsLexical(
  text: string,
  tokenCounts?: Record<string, number>,
  limit = 5
): string[] {
  // Build unigrams
  const counts = tokenCounts ?? tokenize(text);
  const unigramEntries = Object.entries(counts)
    .filter(([token]) => token.length >= 3 && !TAG_BLACKLIST.has(token))
    .map(([token, count]) => ({ tag: token, score: count * tokenWeight(token) }));

  // Build bigrams from the same normalization pipeline
  // Build bigrams from body only to avoid title->body bridges
  const bodyOnly = (() => {
    const idx = text.indexOf('\n');
    return idx >= 0 ? text.slice(idx + 1) : text;
  })();
  const seq = tokenizeToList(bodyOnly);
  const bigramCounts: Record<string, number> = {};
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i];
    const b = seq[i + 1];
    if (a.length < 3 || b.length < 3) continue;
    const bigram = `${a} ${b}`;
    bigramCounts[bigram] = (bigramCounts[bigram] ?? 0) + 1;
  }
  const bigramEntries = Object.entries(bigramCounts).map(([tag, count]) => {
    const [a, b] = tag.split(' ');
    const w = 1.75 * Math.max(tokenWeight(a), tokenWeight(b));
    return { tag, score: count * w };
  });

  // Combine and pick top tags, capping bigrams to avoid crowding
  const combined = [...unigramEntries, ...bigramEntries]
    .sort((x, y) => (y.score !== x.score ? y.score - x.score : x.tag.localeCompare(y.tag)));

  const picked: string[] = [];
  let bigramsUsed = 0;
  for (const entry of combined) {
    const isBigram = entry.tag.includes(' ');
    if (isBigram && bigramsUsed >= Math.max(1, Math.floor(limit / 2))) continue;
    if (picked.includes(entry.tag)) continue;
    picked.push(entry.tag);
    if (isBigram) bigramsUsed += 1;
    if (picked.length >= limit) break;
  }
  return picked;
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
  return tokens.map((t) => normalizeToken(t));
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

/**
 * Async tag extraction - routes to LLM or lexical based on config
 */
export async function extractTagsAsync(
  text: string,
  title?: string,
  tokenCounts?: Record<string, number>,
  limit = 7
): Promise<string[]> {
  // Check for explicit hashtags first (strip code blocks to avoid false positives)
  const strippedText = stripCodeBlocks(text);
  const matches = strippedText.match(/#[a-zA-Z0-9_/-]+/g) ?? [];
  const normalizedMatches = new Set(matches.map((tag) => tag.replace(/^#/, '').toLowerCase()));
  if (normalizedMatches.size > 0) {
    return [...normalizedMatches];
  }

  // Load config to determine tagging method
  const { loadConfig } = await import('./config');
  const config = loadConfig();

  // Use LLM tagging if configured
  if (config.taggingMethod === 'llm') {
    try {
      const { generateTagsLLM } = await import('./llm-tagger');
      const result = await generateTagsLLM(title || '', text, limit);
      return result.tags;
    } catch (err) {
      // Fallback to lexical on error
      console.warn('LLM tagging failed, falling back to lexical:', err);
      return extractTagsLexical(text, tokenCounts, limit);
    }
  }

  // Default: lexical tagging
  return extractTagsLexical(text, tokenCounts, limit);
}
