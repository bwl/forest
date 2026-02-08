import {
  listEdges,
  listNodes,
  NodeRecord,
  SearchMatch,
  EdgeRecord,
} from '../../lib/db';
import { collectNeighborhood, graphFromRecords } from '../../lib/graph';
import { metadataSearchCore } from '../../core/search';

import {
  DEFAULT_MATCH_DISPLAY_LIMIT,
  DEFAULT_NEIGHBORHOOD_LIMIT,
  DEFAULT_SEARCH_LIMIT,
  formatId,
  formatNodeIdProgressive,
  formatScore,
  getEdgePrefix,
} from './utils';
import { colorize } from '../formatters';

export type SelectionResult = { selected: SearchMatch; matches: SearchMatch[]; limit: number };

export type SelectionInput = {
  id?: string;
  title?: string;
  term?: string;
  limit?: number;
  select?: number;
  interactive?: boolean;
  tagsAll?: string[];
  tagsAny?: string[];
  since?: Date | null;
  until?: Date | null;
  sort?: 'score' | 'recent' | 'degree';
  showChunks?: boolean;
  origin?: string;
  createdBy?: string;
};

export type ExploreRenderOptions = {
  selection?: SelectionResult;
  id?: string;
  limit: number;
  matchLimit?: number;
  depth: number;
  longIds: boolean;
  json: boolean;
  showMatches: boolean;
  focusSelected: boolean;
  suppressOverview?: boolean;
  by?: 'semantic' | 'tags';
  minSemantic?: number;
  minTags?: number;
};

export async function selectNode(input: SelectionInput): Promise<SelectionResult> {
  const searchLimit = input.limit ?? DEFAULT_SEARCH_LIMIT;

  // Delegate filtering/scoring to the shared core function
  const result = await metadataSearchCore({
    id: input.id,
    title: input.title,
    term: input.term,
    limit: searchLimit,
    tagsAll: input.tagsAll,
    tagsAny: input.tagsAny,
    since: input.since ? input.since.toISOString() : undefined,
    until: input.until ? input.until.toISOString() : undefined,
    sort: input.sort,
    showChunks: input.showChunks,
    origin: input.origin,
    createdBy: input.createdBy,
  });

  const matches = result.matches;
  if (matches.length === 0) {
    const term = input.title ?? input.term ?? '';
    const why = term ? `"${term}"` : 'filters';
    throw new Error(`No node matching ${why}.`);
  }

  // CLI-only: select by index
  let index = 0;
  if (typeof input.select === 'number') {
    index = input.select - 1;
    if (Number.isNaN(index) || index < 0 || index >= matches.length) {
      throw new Error(`Select value out of range (must be between 1 and ${matches.length}).`);
    }
  }

  // CLI-only: interactive prompt
  if (input.interactive && matches.length > 1) {
    console.log('Matches:');
    matches.forEach((entry, i) => {
      const tags = entry.node.tags.length > 0 ? ` [${entry.node.tags.join(', ')}]` : '';
      console.log(
        `${i + 1}. ${formatScore(entry.score)}  ${formatId(entry.node.id)}  ${entry.node.title}${tags}`,
      );
    });
    console.log('');
    console.log('Use --select <n> to choose a different match in automated workflows.');
  }

  return { selected: matches[index], matches, limit: searchLimit };
}

export async function buildNeighborhoodPayload(
  centerId: string,
  depth: number,
  limit: number,
  filters: { by?: 'semantic' | 'tags'; minSemantic?: number; minTags?: number } = {},
) {
  const nodes = await listNodes();
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const edges = await listEdges('accepted');
  const filteredEdges = filterEdgesForExplore(edges, filters);
  const graph = graphFromRecords(nodes, filteredEdges);

  if (!graph.hasNode(centerId)) {
    return {
      payload: { center: centerId, nodes: [], edges: [] },
      directEdges: [] as DirectEdge[],
    };
  }

  const neighborhood = collectNeighborhood(graph, centerId, depth, limit);

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
      semanticScore: edge.attributes.semanticScore ?? null,
      tagScore: edge.attributes.tagScore ?? null,
      sharedTags: edge.attributes.sharedTags ?? [],
      status: edge.attributes.status,
      edgeType: edge.attributes.edgeType ?? 'semantic',
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
        semanticScore: edge.semanticScore,
        tagScore: edge.tagScore,
        edgeType: edge.edgeType,
      };
    })
    .sort((a, b) => {
      if (filters.by === 'tags') {
        return (b.tagScore ?? -1) - (a.tagScore ?? -1);
      }
      if (filters.by === 'semantic') {
        return (b.semanticScore ?? -1) - (a.semanticScore ?? -1);
      }
      return b.score - a.score;
    });

  return { payload, directEdges };
}

export function serializeMatch(match: SearchMatch) {
  return {
    id: match.node.id,
    title: match.node.title,
    tags: match.node.tags,
    score: match.score,
    updatedAt: match.node.updatedAt,
  };
}

export async function printExplore(options: ExploreRenderOptions) {
  let selection = options.selection;
  if (!selection) {
    if (!options.id) {
      throw new Error('No node id provided for explore output.');
    }
    selection = await selectNode({ id: options.id });
  }

  const match = selection.selected;
  const matches = selection.matches;
  const focusSelected = options.focusSelected ?? true;

  const neighborhoodData = await buildNeighborhoodPayload(match.node.id, options.depth, options.limit, {
    by: options.by,
    minSemantic: options.minSemantic,
    minTags: options.minTags,
  });

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          search: matches.map((entry) => serializeMatch(entry)),
          selected: serializeMatch(match),
          neighborhood: neighborhoodData.payload,
        },
        null,
        2,
      ),
    );

    return;
  }

  if (!focusSelected && options.showMatches) {
    await printMatches(matches, match, { longIds: options.longIds, label: 'Matches:', limit: selection.limit });
  } else {
    await printMatches(matches, match, {
      longIds: options.longIds,
      label: 'Matches (selected first):',
      limit: selection.limit,
    });
  }

  if (!options.suppressOverview) {
    await printNodeOverview(match.node, neighborhoodData.directEdges, { longIds: options.longIds });
    // Suggestions no longer exist - edges are auto-created above threshold
  }
}

export async function printNodeOverview(
  node: NodeRecord,
  directEdges: DirectEdge[],
  options: { longIds: boolean },
) {
  // Use progressive IDs unless --long is specified
  const allNodes = await listNodes();
  const formatNodeId = (id: string) =>
    options.longIds ? id : formatNodeIdProgressive(id, allNodes);

  console.log(`${colorize.nodeId(formatNodeId(node.id))} ${node.title}`);
  if (node.tags.length > 0) {
    const tagLabels = node.tags.map(tag => colorize.tag(tag)).join(', ');
    console.log(`${colorize.label('tags:')} ${tagLabels}`);
  }
  console.log(`${colorize.label('created:')} ${node.createdAt}`);
  console.log(`${colorize.label('updated:')} ${node.updatedAt}`);

  // Provenance fields from metadata
  if (node.metadata) {
    if (node.metadata.origin) {
      console.log(`${colorize.label('origin:')} ${node.metadata.origin}`);
    }
    if (node.metadata.createdBy) {
      const modelSuffix = node.metadata.model ? ` (${node.metadata.model})` : '';
      console.log(`${colorize.label('created by:')} ${node.metadata.createdBy}${modelSuffix}`);
    }
    if (node.metadata.sourceNodes && node.metadata.sourceNodes.length > 0) {
      const shortSources = node.metadata.sourceNodes.map(id => formatId(id)).join(', ');
      console.log(`${colorize.label('sources:')} ${shortSources}`);
    }
    if (node.metadata.sourceFile) {
      console.log(`${colorize.label('source file:')} ${node.metadata.sourceFile}`);
    }
  }
  console.log('');

  if (directEdges.length > 0) {
    console.log(`${colorize.label('accepted edges:')}`);
    for (const edge of directEdges) {
      const coloredScore = colorize.edgeDualScore(edge.semanticScore, edge.tagScore);
      const coloredId = colorize.nodeId(formatNodeId(edge.otherId));
      const typeLabel = edge.edgeType && edge.edgeType !== 'semantic' ? `  [${edge.edgeType}]` : '';
      console.log(`  ${coloredScore}  ${coloredId}  ${edge.otherTitle}${typeLabel}`);
    }
  } else {
    console.log(`${colorize.label('accepted edges:')} none`);
  }
}

type DirectEdge = {
  otherId: string;
  otherTitle: string;
  score: number;
  semanticScore: number | null;
  tagScore: number | null;
  edgeType?: string;
};

function filterEdgesForExplore(
  edges: EdgeRecord[],
  filters: { by?: 'semantic' | 'tags'; minSemantic?: number; minTags?: number },
): EdgeRecord[] {
  const by = filters.by;
  const minSemantic =
    typeof filters.minSemantic === 'number' && Number.isFinite(filters.minSemantic)
      ? filters.minSemantic
      : undefined;
  const minTags = typeof filters.minTags === 'number' && Number.isFinite(filters.minTags) ? filters.minTags : undefined;

  return edges.filter((edge) => {
    if (by === 'semantic' && edge.semanticScore === null) return false;
    if (by === 'tags' && edge.tagScore === null) return false;

    if (typeof minSemantic === 'number') {
      if (edge.semanticScore === null) return false;
      if (edge.semanticScore < minSemantic) return false;
    }

    if (typeof minTags === 'number') {
      if (edge.tagScore === null) return false;
      if (edge.tagScore < minTags) return false;
    }

    return true;
  });
}

async function printMatches(
  matches: SearchMatch[],
  _selected: SearchMatch,
  options: { longIds: boolean; label: string; limit: number },
) {
  if (matches.length === 0) return;

  // Use progressive IDs unless --long is specified
  const allNodes = matches.map((m) => m.node);
  const formatNodeId = (id: string) =>
    options.longIds ? id : formatNodeIdProgressive(id, allNodes);

  console.log(options.label);
  const limit = Math.min(matches.length, options.limit ?? DEFAULT_MATCH_DISPLAY_LIMIT);
  for (let index = 0; index < limit; index += 1) {
    const entry = matches[index];
    const coloredScore = colorize.embeddingScore(entry.score);
    const coloredId = colorize.nodeId(formatNodeId(entry.node.id));
    const tags = entry.node.tags.length > 0
      ? ` [${entry.node.tags.map(tag => colorize.tag(tag)).join(', ')}]`
      : '';
    console.log(
      `${index + 1}. ${coloredScore}  ${coloredId}  ${
        entry.node.title
      }${tags}`,
    );
  }
  if (matches.length > limit) {
    console.log(`  …and ${matches.length - limit} more`);
  }
}
