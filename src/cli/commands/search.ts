import {
  handleError,
  parseCsvList,
  parseDate,
  normalizeSort,
} from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { colorize } from '../formatters';
import { getBackend } from '../shared/remote';

type ClercModule = typeof import('clerc');

type SearchFlags = {
  query?: string;
  limit?: number;
  tags?: string;
  minScore?: number;
  json?: boolean;
  longIds?: boolean;
  tldr?: string;
  mode?: string;
  term?: string;
  id?: string;
  title?: string;
  anyTag?: string;
  since?: string;
  before?: string;
  until?: string;
  sort?: string;
  showChunks?: boolean;
  origin?: string;
  createdBy?: string;
};

type SearchMode = 'semantic' | 'metadata';

export function createSearchCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'search',
      description: 'Search for notes using semantic similarity (embeddings) or metadata filters',
      parameters: ['[query]'],
      flags: {
        query: {
          type: String,
          alias: 'q',
          description: 'Semantic search query (can also be passed as positional argument)',
        },
        limit: {
          type: Number,
          alias: 'l',
          description: 'Maximum number of results to return',
          default: 20,
        },
        tags: {
          type: String,
          alias: 't',
          description: 'Filter by tags (comma-separated, AND logic)',
        },
        minScore: {
          type: Number,
          description: 'Minimum similarity score for semantic search (0.0 to 1.0)',
          default: 0.0,
        },
        json: {
          type: Boolean,
          description: 'Output results as JSON',
        },
        longIds: {
          type: Boolean,
          description: 'Display full UUIDs instead of short prefixes',
        },
        mode: {
          type: String,
          description: 'Search mode: semantic|metadata (auto-detected when omitted)',
        },
        term: {
          type: String,
          description: 'Keyword term for metadata search (title/tags/body)',
        },
        id: {
          type: String,
          description: 'Match a specific node id or short id (metadata search)',
        },
        title: {
          type: String,
          description: 'Match an exact node title (metadata search)',
        },
        anyTag: {
          type: String,
          description: 'Match notes containing any of the tags (comma-separated, metadata search)',
        },
        since: {
          type: String,
          description: 'Only include notes updated on/after this date (YYYY-MM-DD, metadata search)',
        },
        before: {
          type: String,
          description: 'Only include notes updated before this date (YYYY-MM-DD, metadata search)',
        },
        until: {
          type: String,
          description: 'Alias of --before (metadata search)',
        },
        sort: {
          type: String,
          description: 'Sort metadata matches: score|recent|degree',
        },
        showChunks: {
          type: Boolean,
          description: 'Include document chunks in metadata results',
        },
        origin: {
          type: String,
          description: 'Filter by origin: capture, write, synthesize, import, api (metadata search)',
        },
        createdBy: {
          type: String,
          description: 'Filter by creator: user, ai, or agent name (metadata search)',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags, parameters }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.search, getVersion(), jsonMode);
        }
        await runSearch(flags as SearchFlags, parameters.query as string | undefined);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

function detectSearchMode(flags: SearchFlags, query: string | undefined): { mode: SearchMode | null; tags: string[] } {
  const requestedMode = normalizeMode(flags.mode);
  const tags = parseCsvList(flags.tags) ?? [];
  const metadataSignals =
    requestedMode === 'metadata' ||
    Boolean(
      flags.term ||
        flags.id ||
        flags.title ||
        flags.anyTag ||
        flags.since ||
        flags.before ||
        flags.until ||
        flags.sort ||
        flags.showChunks ||
        flags.origin ||
        flags.createdBy ||
        tags.length,
    );
  const hasQuery = typeof query === 'string' && query.trim().length > 0;

  let mode: SearchMode | null = null;
  if (requestedMode) {
    mode = requestedMode;
  } else if (hasQuery) {
    mode = 'semantic';
  } else if (metadataSignals) {
    mode = 'metadata';
  }

  return { mode, tags };
}

async function runSearch(flags: SearchFlags, positionalQuery?: string) {
  const query = flags.query ?? positionalQuery;
  const { mode, tags } = detectSearchMode(flags, query);
  const hasQuery = typeof query === 'string' && query.trim().length > 0;

  if (mode === 'semantic' && !hasQuery) {
    console.error('✖ Provide a --query or positional query for semantic search.');
    process.exitCode = 1;
    return;
  }

  if (mode === null) {
    console.error(
      '✖ Provide a search query or metadata filters. Use --mode metadata to search by tags, ids, or recency.',
    );
    process.exitCode = 1;
    return;
  }

  if (mode === 'semantic') {
    await runSemanticSearch(query!, flags, tags);
    return;
  }

  await runMetadataSearch(flags, tags, query, positionalQuery);
}

async function runSemanticSearch(query: string, flags: SearchFlags, tags: string[]) {
  const limit = typeof flags.limit === 'number' ? flags.limit : 20;
  const minScore = typeof flags.minScore === 'number' ? flags.minScore : 0.0;

  if (minScore < 0 || minScore > 1) {
    console.error('✖ minScore must be between 0.0 and 1.0');
    process.exitCode = 1;
    return;
  }

  const backend = getBackend();
  const result = await backend.searchSemantic(query, {
    limit,
    minScore,
    tags: tags.length > 0 ? tags.join(',') : undefined,
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Semantic search: "${query}"`);
  console.log(`\nFound ${result.nodes.length} ${result.nodes.length === 1 ? 'result' : 'results'}:\n`);

  if (result.nodes.length === 0) {
    console.log('  (no matches)');
    return;
  }

  const maxTitleWidth = 50;
  console.log(`${'SCORE'.padEnd(10)} ${'ID'.padEnd(10)} ${'TITLE'.padEnd(maxTitleWidth)} ${'TAGS'.padEnd(30)}`);
  console.log('─'.repeat(10 + 10 + maxTitleWidth + 30 + 3));

  for (const item of result.nodes) {
    const coloredScore = colorize.embeddingScore(item.similarity);
    const score = coloredScore.padEnd(20);
    const shortId = colorize.nodeId(item.shortId ?? item.id.slice(0, 8));
    const idCol = shortId.padEnd(30);
    const title = truncate(item.title, maxTitleWidth).padEnd(maxTitleWidth);
    const tagsStr = truncate((item.tags?.join(', ') ?? ''), 30);
    console.log(`${score} ${idCol} ${title} ${tagsStr}`);
  }
  console.log();
}

async function runMetadataSearch(
  flags: SearchFlags,
  tagsAll: string[],
  query: string | undefined,
  positionalQuery?: string,
) {
  const limit = typeof flags.limit === 'number' && !Number.isNaN(flags.limit) ? flags.limit : 20;
  const tagsAny = parseCsvList(flags.anyTag);
  const sort = normalizeSort(flags.sort);
  const showChunks = Boolean(flags.showChunks);
  const originFilter = flags.origin?.trim().toLowerCase();
  const createdByFilter = flags.createdBy?.trim().toLowerCase();

  const termCandidate =
    typeof flags.term === 'string' && flags.term.trim().length > 0 ? flags.term : undefined;
  const inferredTerm = termCandidate ?? (flags.mode === 'metadata' ? query : undefined) ?? positionalQuery;

  const backend = getBackend();
  const result = await backend.searchMetadata({
    id: flags.id,
    title: flags.title,
    term: inferredTerm,
    limit,
    tagsAll: tagsAll.length > 0 ? tagsAll : undefined,
    tagsAny: tagsAny ?? undefined,
    since: flags.since,
    until: flags.before ?? flags.until,
    sort,
    showChunks,
    origin: originFilter,
    createdBy: createdByFilter,
  });

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          mode: 'metadata',
          term: inferredTerm ?? null,
          limit,
          filters: {
            tagsAll: tagsAll.length > 0 ? tagsAll : null,
            tagsAny: tagsAny && tagsAny.length > 0 ? tagsAny : null,
            since: flags.since ?? null,
            until: (flags.before ?? flags.until) ?? null,
            sort: sort ?? 'score',
            showChunks,
            origin: originFilter ?? null,
            createdBy: createdByFilter ?? null,
          },
          results: result.matches,
          total: result.total,
        },
        null,
        2,
      ),
    );
    return;
  }

  printMetadataResults(result.matches, {
    term: inferredTerm,
    tagsAll,
    tagsAny: tagsAny ?? [],
    since: parseDate(flags.since),
    until: parseDate(flags.before ?? flags.until),
    sort,
    showChunks,
    longIds: Boolean(flags.longIds),
    origin: originFilter,
    createdBy: createdByFilter,
  });
}

function printMetadataResults(
  matches: Array<{ id: string; shortId?: string; title: string; tags: string[]; score: number; [key: string]: any }>,
  options: {
    term?: string;
    tagsAll: string[];
    tagsAny: string[];
    since: Date | null;
    until: Date | null;
    sort?: 'score' | 'recent' | 'degree';
    showChunks: boolean;
    longIds: boolean;
    origin?: string;
    createdBy?: string;
  },
) {
  const termLabel = options.term && options.term.trim().length > 0 ? options.term.trim() : undefined;

  if (termLabel) {
    console.log(`Metadata search: "${termLabel}"`);
  } else {
    console.log('Metadata search');
  }

  const filterLines: string[] = [];
  if (options.tagsAll.length > 0) filterLines.push(`All tags: ${options.tagsAll.join(', ')}`);
  if (options.tagsAny.length > 0) filterLines.push(`Any tags: ${options.tagsAny.join(', ')}`);
  if (options.since) filterLines.push(`Since: ${options.since.toISOString().split('T')[0]}`);
  if (options.until) filterLines.push(`Before: ${options.until.toISOString().split('T')[0]}`);
  if (options.sort && options.sort !== 'score') filterLines.push(`Sort: ${options.sort}`);
  if (options.showChunks) filterLines.push('Including document chunks');
  if (options.origin) filterLines.push(`Origin: ${options.origin}`);
  if (options.createdBy) filterLines.push(`Created by: ${options.createdBy}`);

  if (filterLines.length > 0) {
    for (const line of filterLines) {
      console.log(line);
    }
  }

  console.log(`\nFound ${matches.length} ${matches.length === 1 ? 'result' : 'results'}:\n`);

  if (matches.length === 0) {
    console.log('  (no matches)');
    return;
  }

  const maxTitleWidth = 50;
  const scoreWidth = 10;
  const idWidth = 10;
  const tagsWidth = 30;

  console.log(
    `${'SCORE'.padEnd(scoreWidth)} ${'ID'.padEnd(idWidth)} ${'TITLE'.padEnd(maxTitleWidth)} ${'TAGS'.padEnd(tagsWidth)}`,
  );
  console.log('─'.repeat(scoreWidth + idWidth + tagsWidth + maxTitleWidth + 3));

  for (const item of matches) {
    const coloredScore = colorize.embeddingScore(item.score);
    const score = coloredScore.padEnd(scoreWidth + 10);
    const displayId = options.longIds ? item.id : (item.shortId ?? item.id.slice(0, 8));
    const coloredId = colorize.nodeId(displayId);
    const shortId = coloredId.padEnd(idWidth + 20);
    const title = truncate(item.title, maxTitleWidth).padEnd(maxTitleWidth);
    const tags = truncate(item.tags.join(', '), tagsWidth);
    console.log(`${score} ${shortId} ${title} ${tags}`);
  }

  console.log('');
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

function normalizeMode(value?: string): SearchMode | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'semantic' || normalized === 'metadata') {
    return normalized;
  }
  return undefined;
}
