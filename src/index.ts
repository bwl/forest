#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

import {
  EdgeRecord,
  EdgeStatus,
  NodeRecord,
  SearchMatch,
  deleteSuggestion,
  findNodeByTitle,
  getNodeById,
  insertNode,
  insertOrUpdateEdge,
  listEdges,
  listNodes,
  promoteSuggestions,
  searchNodes,
} from './lib/db';
import { collectNeighborhood, buildGraph } from './lib/graph';
import { extractTags, pickTitle, tokenize } from './lib/text';
import {
  classifyScore,
  computeScore,
  getAutoAcceptThreshold,
  getSuggestionThreshold,
  normalizeEdgePair,
} from './lib/scoring';

const SHORT_ID_LENGTH = 8;
const DEFAULT_SEARCH_LIMIT = 10;
const MATCH_DISPLAY_LIMIT = 5;

const program = new Command();
program
  .name('forest')
  .description('Graph-native knowledge base CLI')
  .version('0.1.0');

program
  .command('capture')
  .description('Capture a new idea and auto-link it into the graph')
  .option('-t, --title <title>', 'Title for the idea')
  .option('-b, --body <body>', 'Body content; if omitted use --file or --stdin')
  .option('-f, --file <path>', 'Read body from file')
  .option('--stdin', 'Read body from standard input')
  .option('--tags <tags>', 'Comma-separated list of tags to force (overrides auto-detected tags)')
  .option('--no-auto-link', 'Skip scoring/linking against existing nodes')
  .option('--preview', 'Force an explore preview after capture')
  .option('--no-preview', 'Skip the explore preview after capture')
  .action(async (options) => {
    try {
      const body = await resolveBody(options.body, options.file, options.stdin);
      if (!body || body.trim().length === 0) {
        console.error('✖ No content provided. Use --body, --file, or --stdin.');
        process.exitCode = 1;
        return;
      }

      const title = pickTitle(body, options.title);
      const tags = options.tags
        ? options.tags
            .split(',')
            .map((tag: string) => tag.trim())
            .filter((tag: string) => tag.length > 0)
        : extractTags(`${title}\n${body}`);
      const tokenCounts = tokenize(`${title}\n${body}`);

      const newNode: NodeRecord = {
        id: randomUUID(),
        title,
        body,
        tags,
        tokenCounts,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingNodes = await listNodes();
      await insertNode(newNode);

      let summary: { accepted: number; suggested: number } = { accepted: 0, suggested: 0 };
      if (!options.noAutoLink) {
        summary = await linkAgainstExisting(newNode, existingNodes);
      }

      console.log(`✔ Captured idea: ${newNode.title}`);
      console.log(`   id: ${newNode.id}`);
      if (tags.length > 0) {
        console.log(`   tags: ${tags.join(', ')}`);
      }
      if (!options.noAutoLink) {
        console.log(
          `   links: ${summary.accepted} accepted, ${summary.suggested} pending (thresholds auto=${getAutoAcceptThreshold().toFixed(
            2
          )}, suggest=${getSuggestionThreshold().toFixed(2)})`
        );
      } else {
        console.log('   links: auto-linking skipped (--no-auto-link)');
      }

      let shouldPreview = true;
      if (options.noPreview) shouldPreview = false;
      if (options.preview) shouldPreview = true;

      if (shouldPreview) {
        console.log('\nPreview:');
        const selection: SelectionResult = {
          selected: { node: newNode, score: 1 },
          matches: [{ node: newNode, score: 1 }],
        };
        await printExplore({
          selection,
          limit: 15,
          depth: 1,
          includeSuggestions: false,
          longIds: false,
          json: false,
          showMatches: false,
        });
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('explore')
  .description('Search for a note and inspect its graph neighborhood')
  .argument('[term]', 'Title, tag, or search phrase to locate the node')
  .option('--id <id>', 'Node id to focus on')
  .option('--title <title>', 'Node title to match (case-insensitive)')
  .option('--select <index>', '1-based index of the match to explore', (value) => Number(value))
  .option('--search-limit <count>', 'Maximum matches to consider', toNumber, DEFAULT_SEARCH_LIMIT)
  .option('-d, --depth <depth>', 'Neighborhood depth', toNumber, 1)
  .option('-l, --limit <limit>', 'Maximum number of nodes in neighborhood', toNumber, 25)
  .option('--include-suggestions', 'Include suggested edges in the neighborhood output')
  .option('--long-ids', 'Display full ids in human-readable output')
  .option('--json', 'Emit JSON instead of text output')
  .option('--interactive', 'Prompt to choose a match')
  .action(async (term, options) => {
    try {
      const selection = await selectNode({
        id: options.id,
        title: options.title,
        term: typeof term === 'string' ? term : undefined,
        limit: options.searchLimit,
        select: options.select,
        interactive: Boolean(options.interactive),
      });

      await printExplore({
        selection,
        limit: options.limit,
        depth: options.depth,
        includeSuggestions: Boolean(options.includeSuggestions),
        longIds: Boolean(options.longIds),
        json: Boolean(options.json),
        showMatches: !Boolean(options.json),
      });
    } catch (error) {
      handleError(error);
    }
  });

const insights = program.command('insights').description('Manage suggested edges');

insights
  .command('list')
  .description('List suggested links ordered by score')
  .option('--limit <limit>', 'Limit number of suggestions returned', toNumber, 10)
  .option('--json', 'Emit JSON output')
  .action(async (options) => {
    try {
      const edges = (await listEdges('suggested'))
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit);

      if (options.json) {
        console.log(
          JSON.stringify(
            edges.map((edge) => ({
              id: edge.id,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              score: edge.score,
              metadata: edge.metadata,
            })),
            null,
            2
          )
        );
        return;
      }

      if (edges.length === 0) {
        console.log('No suggestions ready.');
        return;
      }

      const nodeMap = new Map((await listNodes()).map((node) => [node.id, node]));
      for (const edge of edges) {
        const source = nodeMap.get(edge.sourceId);
        const target = nodeMap.get(edge.targetId);
        console.log(
          `${edge.id}  score=${edge.score.toFixed(2)}  ${source?.title ?? edge.sourceId} ↔ ${target?.title ?? edge.targetId}`
        );
      }
    } catch (error) {
      handleError(error);
    }
  });

insights
  .command('promote')
  .description('Promote suggestions above a score threshold to accepted edges')
  .option('--min-score <score>', 'Minimum score to accept', parseFloat, getAutoAcceptThreshold())
  .action(async (options) => {
    try {
      const changes = await promoteSuggestions(options.minScore);
      console.log(`✔ Promoted ${changes} suggestions with score ≥ ${options.minScore.toFixed(2)}`);
    } catch (error) {
      handleError(error);
    }
  });

insights
  .command('accept')
  .description('Promote a single suggestion by id')
  .argument('<edgeId>', 'Edge id to accept')
  .action(async (edgeId) => {
    try {
      const edge = (await listEdges('suggested')).find((candidate) => candidate.id === edgeId);
      if (!edge) {
        console.error('✖ No suggestion found with that id.');
        process.exitCode = 1;
        return;
      }
      const accepted: EdgeRecord = {
        ...edge,
        status: 'accepted',
        updatedAt: new Date().toISOString(),
      };
      await insertOrUpdateEdge(accepted);
      console.log(`✔ Accepted suggestion ${edgeId}`);
    } catch (error) {
      handleError(error);
    }
  });

insights
  .command('reject')
  .description('Reject and remove a suggestion by id')
  .argument('<edgeId>', 'Edge id to reject')
  .action(async (edgeId) => {
    try {
      const removed = await deleteSuggestion(edgeId);
      if (removed === 0) {
        console.error('✖ No suggestion found with that id.');
        process.exitCode = 1;
        return;
      }
      console.log('✔ Suggestion removed.');
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('doctor')
  .description('Show graph health metrics and recent activity')
  .option('--json', 'Emit JSON output')
  .action(async (options) => {
    try {
      const nodes = await listNodes();
      const edges = await listEdges('all');
      const graph = await buildGraph();

      const counts = {
        nodes: nodes.length,
        edgesAccepted: edges.filter((edge) => edge.status === 'accepted').length,
        edgesSuggested: edges.filter((edge) => edge.status === 'suggested').length,
      };

      const recent = [...nodes]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);

      const degrees = nodes
        .map((node) => ({
          node,
          degree: graph.hasNode(node.id) ? graph.degree(node.id) : 0,
        }))
        .sort((a, b) => b.degree - a.degree)
        .slice(0, 5);

      const suggestions = (await listEdges('suggested'))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              counts,
              recent: recent.map((node) => ({
                id: node.id,
                title: node.title,
                tags: node.tags,
                updatedAt: node.updatedAt,
              })),
              highDegree: degrees.map((entry) => ({
                id: entry.node.id,
                title: entry.node.title,
                degree: entry.degree,
              })),
              suggestions: suggestions.map((edge) => ({
                id: edge.id,
                sourceId: edge.sourceId,
                targetId: edge.targetId,
                score: edge.score,
              })),
            },
            null,
            2
          )
        );
        return;
      }

      console.log('forest doctor');
      console.log(`Nodes: ${counts.nodes}`);
      console.log(`Accepted edges: ${counts.edgesAccepted}`);
      console.log(`Suggested edges: ${counts.edgesSuggested}`);
      console.log('');

      if (recent.length > 0) {
        console.log('Recent captures:');
        for (const node of recent) {
          console.log(`  ${formatId(node.id)}  ${node.title}  (updated ${node.updatedAt})`);
        }
        console.log('');
      }

      if (degrees.length > 0) {
        console.log('High-degree nodes:');
        for (const entry of degrees) {
          console.log(`  ${formatId(entry.node.id)}  ${entry.node.title}  (degree ${entry.degree})`);
        }
        console.log('');
      }

      if (suggestions.length > 0) {
        console.log('Top suggestions:');
        for (const edge of suggestions) {
          console.log(`  ${edge.id}  score=${edge.score.toFixed(2)}  ${edge.sourceId} ↔ ${edge.targetId}`);
        }
        console.log('');
      }

      console.log('Next steps:');
      console.log('  - Run `forest insights list` to triage pending links.');
      console.log('  - Capture new ideas with `forest capture`.');
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('read')
  .description('Show the full content of a note')
  .argument('[term]', 'Title, tag, or search phrase to locate the node')
  .option('--id <id>', 'Node id to read')
  .option('--title <title>', 'Node title to match (case-insensitive)')
  .option('--select <index>', '1-based index of the match to read', (value) => Number(value))
  .option('--search-limit <count>', 'Maximum matches to consider', toNumber, DEFAULT_SEARCH_LIMIT)
  .option('--json', 'Emit JSON output')
  .option('--long-ids', 'Display full ids in text output')
  .action(async (term, options) => {
    try {
      const selection = await selectNode({
        id: options.id,
        title: options.title,
        term: typeof term === 'string' ? term : undefined,
        limit: options.searchLimit,
        select: options.select,
        interactive: Boolean(options.interactive),
      });

      const node = selection.selected.node;
      const longIds = Boolean(options.longIds);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              node: {
                id: node.id,
                title: node.title,
                tags: node.tags,
                createdAt: node.createdAt,
                updatedAt: node.updatedAt,
              },
              body: node.body,
            },
            null,
            2
          )
        );
        return;
      }

      printMatches(selection.matches, selection.selected, { longIds, label: 'Matches' });
      console.log('');
      console.log(`${formatId(node.id, { long: longIds })} ${node.title}`);
      if (node.tags.length > 0) {
        console.log(`tags: ${node.tags.join(', ')}`);
      }
      console.log(`created: ${node.createdAt}`);
      console.log(`updated: ${node.updatedAt}`);
      console.log('');
      console.log(node.body);
    } catch (error) {
      handleError(error);
    }
  });

program.parseAsync(process.argv);

type ExploreRenderOptions = {
  selection?: SelectionResult;
  id?: string;
  limit: number;
  depth: number;
  includeSuggestions: boolean;
  longIds: boolean;
  json: boolean;
  showMatches: boolean;
};

async function printExplore(options: ExploreRenderOptions) {
  let selection = options.selection;
  if (!selection) {
    if (!options.id) {
      throw new Error('No node id provided for explore output.');
    }
    selection = await selectNode({ id: options.id });
  }

  const match = selection.selected;
  const matches = selection.matches;

  const neighborhoodData = await buildNeighborhoodPayload(match.node.id, options.depth, options.limit);
  const suggestionData = await fetchSuggestionsForNode(match.node.id);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          search: matches.map((entry) => serializeMatch(entry)),
          selected: serializeMatch(match),
          neighborhood: neighborhoodData.payload,
          suggestions: suggestionData.map((suggestion) => ({
            id: suggestion.id,
            score: suggestion.score,
            otherId: suggestion.otherId,
            otherTitle: suggestion.otherTitle,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  if (options.showMatches) {
    printMatches(matches, match, { longIds: options.longIds, label: 'Matches' });
    console.log('');
  }

  const node = match.node;
  console.log(`${formatId(node.id, { long: options.longIds })} ${node.title}`);
  if (node.tags.length > 0) {
    console.log(`tags: ${node.tags.join(', ')}`);
  }
  console.log(`created: ${node.createdAt}`);
  console.log(`updated: ${node.updatedAt}`);
  console.log('');

  const directEdges = neighborhoodData.directEdges;
  if (directEdges.length > 0) {
    console.log('accepted edges:');
    for (const edge of directEdges) {
      console.log(
        `  ${formatScore(edge.score)}  ${formatId(edge.otherId, { long: options.longIds })}  ${edge.otherTitle}`
      );
    }
  } else {
    console.log('accepted edges: none');
  }

  if (options.includeSuggestions && suggestionData.length > 0) {
    console.log('');
    console.log('suggested edges:');
    for (const suggestion of suggestionData) {
      console.log(
        `  ${formatScore(suggestion.score)}  ${formatId(suggestion.otherId, { long: options.longIds })}  ${suggestion.otherTitle}  (${suggestion.id})`
      );
    }
  }
}

function printMatches(matches: SearchMatch[], selected: SearchMatch, options: { longIds: boolean; label: string }) {
  if (matches.length === 0) return;
  console.log(options.label);
  const limit = Math.min(matches.length, MATCH_DISPLAY_LIMIT);
  for (let index = 0; index < limit; index += 1) {
    const entry = matches[index];
    const marker = entry.node.id === selected.node.id ? '→' : ' ';
    const tags = entry.node.tags.length > 0 ? ` [${entry.node.tags.join(', ')}]` : '';
    console.log(
      `${marker} ${index + 1}. ${formatScore(entry.score)}  ${formatId(entry.node.id, { long: options.longIds })}  ${entry.node.title}${tags}`
    );
  }
  if (matches.length > limit) {
    console.log(`  …and ${matches.length - limit} more`);
  }
}

async function buildNeighborhoodPayload(centerId: string, depth: number, limit: number) {
  const graph = await buildGraph();
  if (!graph.hasNode(centerId)) {
    return {
      payload: { center: centerId, nodes: [], edges: [] },
      directEdges: [] as Array<{ otherId: string; otherTitle: string; score: number }>,
    };
  }

  const neighborhood = collectNeighborhood(graph, centerId, depth, limit);
  const allNodes = await listNodes();
  const nodeMap = new Map(allNodes.map((node) => [node.id, node]));

  const payload = {
    center: centerId,
    nodes: neighborhood.nodes
      .filter((id) => nodeMap.has(id))
      .map((id) => {
        const node = nodeMap.get(id)!;
        return {
          id: node.id,
          title: node.title,
          tags: node.tags,
          snippet: node.body.slice(0, 280),
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
        };
      }),
    edges: neighborhood.edges.map((edge) => ({
      id: edge.key,
      source: edge.source,
      target: edge.target,
      score: edge.attributes.score,
      status: edge.attributes.status,
    })),
  };

  const directEdges = payload.edges
    .filter((edge) => edge.source === centerId || edge.target === centerId)
    .map((edge) => {
      const otherId = edge.source === centerId ? edge.target : edge.source;
      const otherNode = nodeMap.get(otherId);
      return {
        otherId,
        otherTitle: otherNode ? otherNode.title : otherId,
        score: edge.score,
      };
    })
    .sort((a, b) => b.score - a.score);

  return { payload, directEdges };
}

async function fetchSuggestionsForNode(nodeId: string) {
  const nodeMap = new Map((await listNodes()).map((node) => [node.id, node]));
  return (await listEdges('suggested'))
    .filter((edge) => edge.sourceId === nodeId || edge.targetId === nodeId)
    .map((edge) => {
      const otherId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
      return {
        id: edge.id,
        score: edge.score,
        otherId,
        otherTitle: nodeMap.get(otherId)?.title ?? otherId,
      };
    })
    .sort((a, b) => b.score - a.score);
}

type SelectionResult = { selected: SearchMatch; matches: SearchMatch[] };

type SelectionInput = {
  id?: string;
  title?: string;
  term?: string;
  limit?: number;
  select?: number;
  interactive?: boolean;
};

async function selectNode(input: SelectionInput): Promise<SelectionResult> {
  const searchLimit = input.limit ?? DEFAULT_SEARCH_LIMIT;

  if (input.id) {
    const node = await getNodeById(input.id);
    if (!node) {
      throw new Error(`Node with id ${input.id} not found.`);
    }
    return { selected: { node, score: 1 }, matches: [{ node, score: 1 }] };
  }

  if (input.term && isShortId(input.term)) {
    const prefixMatch = await resolveByIdPrefix(input.term);
    if (prefixMatch) {
      return { selected: { node: prefixMatch, score: 1 }, matches: [{ node: prefixMatch, score: 1 }] };
    }
  }

  if (input.title) {
    const titleMatch = await findNodeByTitle(input.title);
    if (titleMatch) {
      return { selected: { node: titleMatch, score: 1 }, matches: [{ node: titleMatch, score: 1 }] };
    }
  }

  const term = input.title ?? input.term ?? '';
  const matches = await searchNodes(term, searchLimit);
  if (matches.length === 0) {
    throw new Error(term ? `No node matching "${term}".` : 'No nodes found. Capture ideas to populate the graph.');
  }

  let index = 0;
  if (typeof input.select === 'number') {
    index = input.select - 1;
    if (Number.isNaN(index) || index < 0 || index >= matches.length) {
      throw new Error(`Select value out of range (must be between 1 and ${matches.length}).`);
    }
  }

  if (input.interactive && matches.length > 1) {
    printMatches(matches, matches[index], { longIds: false, label: 'Matches' });
    console.log('Use --select <n> to choose a different match in automated workflows.');
  }

  return { selected: matches[index], matches };
}

async function resolveBody(bodyOption?: string, fileOption?: string, stdinOption?: boolean): Promise<string> {
  if (bodyOption) return bodyOption;
  if (fileOption) {
    const filePath = path.resolve(fileOption);
    return fs.readFileSync(filePath, 'utf-8');
  }
  if (stdinOption) {
    return readStdin();
  }
  return '';
}

async function linkAgainstExisting(newNode: NodeRecord, existing: NodeRecord[]) {
  let accepted = 0;
  let suggested = 0;
  for (const other of existing) {
    const { score, components } = computeScore(newNode, other);
    const status = classifyScore(score);
    if (status === 'discard') continue;
    const [sourceId, targetId] = normalizeEdgePair(newNode.id, other.id);
    const edge: EdgeRecord = {
      id: edgeIdentifier(sourceId, targetId),
      sourceId,
      targetId,
      score,
      status,
      metadata: {
        components,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await insertOrUpdateEdge(edge);
    if (status === 'accepted') accepted += 1;
    if (status === 'suggested') suggested += 1;
  }
  return { accepted, suggested };
}

function toNumber(value: string, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve) => {
    process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    process.stdin.resume();
  });
}

function edgeIdentifier(a: string, b: string): string {
  return `${a}::${b}`;
}

function formatId(id: string, options: { long?: boolean } = {}): string {
  if (options.long) return id;
  const segment = id.split('-')[0] ?? id;
  return segment.slice(0, SHORT_ID_LENGTH);
}

function formatScore(score: number): string {
  if (Number.isNaN(score)) return '   -';
  const clamped = Math.max(0, Math.min(1, score));
  return clamped.toFixed(2);
}

function isShortId(term: string): boolean {
  return /^[0-9a-f]{6,}$/i.test(term) && term.length <= SHORT_ID_LENGTH;
}

async function resolveByIdPrefix(prefix: string): Promise<NodeRecord | null> {
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

function serializeMatch(match: SearchMatch) {
  return {
    id: match.node.id,
    title: match.node.title,
    tags: match.node.tags,
    score: match.score,
    updatedAt: match.node.updatedAt,
  };
}

function handleError(error: unknown) {
  if (error instanceof Error) {
    console.error(`✖ ${error.message}`);
  } else {
    console.error('✖ Unexpected error', error);
  }
  process.exitCode = 1;
}
