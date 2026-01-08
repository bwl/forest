import { semanticSearchCore } from '../../core/search.js';
import {
  handleError,
  formatNodeIdProgressive,
  parseCsvList,
  parseDate,
  normalizeSort,
} from '../shared/utils.js';
import { getVersion } from './version.js';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr.js';
import { deduplicateChunks } from '../../lib/reconstruction.js';
import { listNodes } from '../../lib/db.js';
import { colorize } from '../formatters/index.js';
import { selectNode, serializeMatch, type SelectionResult } from '../shared/explore.js';

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
  select?: number;
  interactive?: boolean;
  showChunks?: boolean;
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
        select: {
          type: Number,
          description: '1-based index of the metadata match to focus',
        },
        interactive: {
          type: Boolean,
          description: 'Prompt to choose a metadata match when multiple exist',
        },
        showChunks: {
          type: Boolean,
          description: 'Include document chunks in metadata results',
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
          emitTldrAndExit(COMMAND_TLDR.search, getVersion());
        }
        await runSearch(flags as SearchFlags, parameters.query as string | undefined);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runSearch(flags: SearchFlags, positionalQuery?: string) {
  // Resolve query from flag or positional argument
  const query = flags.query ?? positionalQuery;

  const requestedMode = normalizeMode(flags.mode);
  const tags = parseCsvList(flags.tags);
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
        flags.interactive ||
        flags.select ||
        flags.showChunks ||
        (tags && tags.length),
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
    await runSemanticSearch(flags, query!, tags ?? []);
    return;
  }

  await runMetadataSearch(flags, tags ?? [], query, positionalQuery);
}

async function runSemanticSearch(flags: SearchFlags, query: string, tags: string[]) {
  // Parse flags
  const limit = typeof flags.limit === 'number' ? flags.limit : 20;
  const minScore = typeof flags.minScore === 'number' ? flags.minScore : 0.0;

  // Validate minScore
  if (minScore < 0 || minScore > 1) {
    console.error('✖ minScore must be between 0.0 and 1.0');
    process.exitCode = 1;
    return;
  }

  // Call core search function
  const result = await semanticSearchCore(query, {
    limit,
    offset: 0,
    minScore,
    tags: tags && tags.length > 0 ? tags : undefined,
  });

  // Deduplicate chunks - replace chunks with their parent documents
  const deduplicatedNodes = await deduplicateChunks(result.nodes.map(item => item.node));

  // Map back to include similarity scores
  // For each deduplicated node, find the best matching similarity score from the original results
  const deduplicatedResults = deduplicatedNodes.map(node => {
    // Find all original results that match this node (either directly or as a parent)
    const matchingScores = result.nodes
      .filter(item => {
        // Direct match
        if (item.node.id === node.id) return true;
        // This was a chunk whose parent is now the deduplicated node
        if (item.node.isChunk && item.node.parentDocumentId === node.id) return true;
        return false;
      })
      .map(item => item.similarity);

    // Use the highest similarity score among matches
    const similarity = matchingScores.length > 0 ? Math.max(...matchingScores) : 0;

    return { node, similarity };
  });

  // Sort by similarity (highest first)
  deduplicatedResults.sort((a, b) => b.similarity - a.similarity);

  // Output results
  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          mode: 'semantic',
          query,
          total: deduplicatedResults.length,
          limit,
          minScore,
          tags: tags && tags.length > 0 ? tags : null,
          results: deduplicatedResults.map(item => ({
            id: item.node.id,
            title: item.node.title,
            tags: item.node.tags,
            similarity: item.similarity,
            bodyPreview: item.node.body.slice(0, 100),
            createdAt: item.node.createdAt,
            updatedAt: item.node.updatedAt,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    await printSemanticResults(
      query,
      { nodes: deduplicatedResults, total: deduplicatedResults.length },
      tags || [],
      minScore,
      flags.longIds || false,
    );
  }
}

async function runMetadataSearch(
  flags: SearchFlags,
  tagsAll: string[],
  query: string | undefined,
  positionalQuery?: string,
) {
  const limit = typeof flags.limit === 'number' && !Number.isNaN(flags.limit) ? flags.limit : undefined;
  const tagsAny = parseCsvList(flags.anyTag);
  const since = parseDate(flags.since);
  const until = parseDate(flags.before ?? flags.until);
  const sort = normalizeSort(flags.sort);
  const showChunks = Boolean(flags.showChunks);

  const termCandidate =
    typeof flags.term === 'string' && flags.term.trim().length > 0 ? flags.term : undefined;
  const inferredTerm = termCandidate ?? (flags.mode === 'metadata' ? query : undefined) ?? positionalQuery;

  const selection = await selectNode({
    id: flags.id,
    title: flags.title,
    term: inferredTerm,
    limit,
    select: typeof flags.select === 'number' ? flags.select : undefined,
    interactive: Boolean(flags.interactive),
    tagsAll,
    tagsAny,
    since,
    until,
    sort,
    showChunks,
  });

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          mode: 'metadata',
          term: inferredTerm ?? null,
          limit: selection.limit,
          filters: {
            tagsAll: tagsAll.length > 0 ? tagsAll : null,
            tagsAny: tagsAny && tagsAny.length > 0 ? tagsAny : null,
            since: since ? since.toISOString() : null,
            until: until ? until.toISOString() : null,
            sort: sort ?? 'score',
            showChunks,
          },
          selected: serializeMatch(selection.selected),
          results: selection.matches.map(serializeMatch),
        },
        null,
        2,
      ),
    );
    return;
  }

  await printMetadataResults(selection, {
    term: inferredTerm,
    tagsAll,
    tagsAny: tagsAny ?? [],
    since,
    until,
    sort,
    showChunks,
    longIds: Boolean(flags.longIds),
  });
}

async function printSemanticResults(
  query: string,
  result: { nodes: Array<{ node: any; similarity: number }>; total: number },
  tags: string[],
  minScore: number,
  longIds: boolean,
) {
  console.log(`Semantic search: "${query}"`);

  if (tags && tags.length > 0) {
    console.log(`Filtered by tags: ${tags.join(', ')}`);
  }

  if (minScore > 0) {
    console.log(`Minimum similarity: ${minScore.toFixed(2)}`);
  }

  console.log(`\nFound ${result.total} ${result.total === 1 ? 'result' : 'results'}:\n`);

  if (result.nodes.length === 0) {
    console.log('  (no matches)');
    return;
  }

  // Calculate column widths
  const maxTitleWidth = 50;
  const scoreWidth = 10;
  const idWidth = 10;
  const tagsWidth = 30;

  // Print header
  console.log(
    `${'SCORE'.padEnd(scoreWidth)} ${'ID'.padEnd(idWidth)} ${'TITLE'.padEnd(maxTitleWidth)} ${'TAGS'.padEnd(tagsWidth)}`,
  );
  console.log('─'.repeat(scoreWidth + idWidth + maxTitleWidth + tagsWidth + 3));

  // Use progressive IDs unless --long is specified
  const allNodes = await listNodes();
  const formatNodeId = (id: string) => (longIds ? id : formatNodeIdProgressive(id, allNodes));

  // Print results
  for (const item of result.nodes) {
    const coloredScore = colorize.embeddingScore(item.similarity);
    const score = coloredScore.padEnd(scoreWidth + 10); // Add extra padding for ANSI codes
    const coloredId = colorize.nodeId(formatNodeId(item.node.id));
    const shortId = coloredId.padEnd(idWidth + 20); // Add extra padding for ANSI codes
    const title = truncate(item.node.title, maxTitleWidth).padEnd(maxTitleWidth);
    const tags = truncate(item.node.tags.join(', '), tagsWidth);

    console.log(`${score} ${shortId} ${title} ${tags}`);
  }

  console.log();
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

async function printMetadataResults(
  selection: SelectionResult,
  options: {
    term?: string;
    tagsAll: string[];
    tagsAny: string[];
    since: Date | null;
    until: Date | null;
    sort?: 'score' | 'recent' | 'degree';
    showChunks: boolean;
    longIds: boolean;
  },
) {
  const { matches } = selection;
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

  const allNodes = matches.map((match) => match.node);
  const formatNodeId = (id: string) => (options.longIds ? id : formatNodeIdProgressive(id, allNodes));
  const selectedId = selection.selected.node.id;

  const orderedMatches = matches.slice();
  const selectedIndex = orderedMatches.findIndex((m) => m.node.id === selectedId);
  if (selectedIndex > 0) {
    const [selectedMatch] = orderedMatches.splice(selectedIndex, 1);
    orderedMatches.unshift(selectedMatch);
  }

  console.log(
    `${'SEL'.padEnd(4)}${'SCORE'.padEnd(scoreWidth)} ${'ID'.padEnd(idWidth)} ${'TITLE'.padEnd(maxTitleWidth)} ${'TAGS'.padEnd(
      tagsWidth,
    )}`,
  );
  console.log('─'.repeat(scoreWidth + idWidth + tagsWidth + maxTitleWidth + 7));

  for (const item of orderedMatches) {
    const coloredScore = colorize.embeddingScore(item.score);
    const score = coloredScore.padEnd(scoreWidth + 10);
    const coloredId = colorize.nodeId(formatNodeId(item.node.id));
    const shortId = coloredId.padEnd(idWidth + 20);
    const title = truncate(item.node.title, maxTitleWidth).padEnd(maxTitleWidth);
    const tags = truncate(item.node.tags.join(', '), tagsWidth);
    const marker = item.node.id === selectedId ? colorize.label('*') : ' ';

    console.log(`${marker.padEnd(4)}${score} ${shortId} ${title} ${tags}`);
  }

  console.log('');
}
