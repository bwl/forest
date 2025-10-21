import { semanticSearchCore } from '../../core/search';
import { handleError, formatId, formatNodeIdProgressive, parseCsvList } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { deduplicateChunks } from '../../lib/reconstruction';
import { listNodes } from '../../lib/db';
import { colorize } from '../formatters';

type ClercModule = typeof import('clerc');

type SearchFlags = {
  query?: string;
  limit?: number;
  tags?: string;
  minScore?: number;
  json?: boolean;
  longIds?: boolean;
  tldr?: string;
};

export function createSearchCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'search',
      description: 'Search for notes using semantic similarity (embeddings)',
      parameters: ['[query]'],
      flags: {
        query: {
          type: String,
          alias: 'q',
          description: 'Search query (can also be passed as positional argument)',
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
          description: 'Minimum similarity score (0.0 to 1.0)',
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

  if (!query || query.trim().length === 0) {
    console.error('✖ Search query is required. Use: forest search "your query" or --query "your query"');
    process.exitCode = 1;
    return;
  }

  // Parse flags
  const limit = typeof flags.limit === 'number' ? flags.limit : 20;
  const minScore = typeof flags.minScore === 'number' ? flags.minScore : 0.0;
  const tags = parseCsvList(flags.tags);

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
    console.log(JSON.stringify({
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
    }, null, 2));
  } else {
    await printTextResults(
      query,
      { nodes: deduplicatedResults, total: deduplicatedResults.length },
      tags || [],
      minScore,
      flags.longIds || false
    );
  }
}

async function printTextResults(
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
  console.log(`${'SCORE'.padEnd(scoreWidth)} ${'ID'.padEnd(idWidth)} ${'TITLE'.padEnd(maxTitleWidth)} ${'TAGS'.padEnd(tagsWidth)}`);
  console.log('─'.repeat(scoreWidth + idWidth + maxTitleWidth + tagsWidth + 3));

  // Use progressive IDs unless --long is specified
  const allNodes = await listNodes();
  const formatNodeId = (id: string) =>
    longIds ? id : formatNodeIdProgressive(id, allNodes);

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
