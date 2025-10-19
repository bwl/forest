import {
  listEdges,
  listNodes,
  findNodeByTitle,
  getNodeById,
  searchNodes,
  NodeRecord,
  SearchMatch,
} from '../../lib/db';
import { collectNeighborhood, buildGraph } from '../../lib/graph';

import {
  DEFAULT_MATCH_DISPLAY_LIMIT,
  DEFAULT_NEIGHBORHOOD_LIMIT,
  DEFAULT_SEARCH_LIMIT,
  formatId,
  formatScore,
  edgeShortCode,
  isShortId,
  normalizeSort,
  parseCsvList,
  parseDate,
  resolveByIdPrefix,
} from './utils';

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
};

export type ExploreRenderOptions = {
  selection?: SelectionResult;
  id?: string;
  limit: number;
  matchLimit?: number;
  depth: number;
  includeSuggestions: boolean;
  longIds: boolean;
  json: boolean;
  showMatches: boolean;
  focusSelected: boolean;
  suppressOverview?: boolean;
};

export async function selectNode(input: SelectionInput): Promise<SelectionResult> {
  const searchLimit = input.limit ?? DEFAULT_SEARCH_LIMIT;

  if (input.id) {
    let node = await getNodeById(input.id);
    if (!node && isShortId(input.id)) {
      const byPrefix = await resolveByIdPrefix(input.id);
      if (byPrefix) node = byPrefix;
    }
    if (!node) {
      throw new Error(`Node with id ${input.id} not found.`);
    }
    return { selected: { node, score: 1 }, matches: [{ node, score: 1 }], limit: 1 };
  }

  if (input.term && isShortId(input.term)) {
    const prefixMatch = await resolveByIdPrefix(input.term);
    if (prefixMatch) {
      return { selected: { node: prefixMatch, score: 1 }, matches: [{ node: prefixMatch, score: 1 }], limit: 1 };
    }
  }

  if (input.title) {
    const titleMatch = await findNodeByTitle(input.title);
    if (titleMatch) {
      return { selected: { node: titleMatch, score: 1 }, matches: [{ node: titleMatch, score: 1 }], limit: 1 };
    }
  }

  const term = input.title ?? input.term ?? '';
  const hasFilters = Boolean(
    (input.tagsAll && input.tagsAll.length) ||
      (input.tagsAny && input.tagsAny.length) ||
      input.since ||
      input.until ||
      (input.sort && input.sort !== 'score'),
  );

  let matches: SearchMatch[] = [];
  if (!hasFilters && term) {
    matches = await searchNodes(term, searchLimit);
  } else {
    const all = await listNodes();
    const filtered = all.filter((node) => {
      if (input.tagsAll && input.tagsAll.length) {
        for (const t of input.tagsAll) if (!node.tags.includes(t)) return false;
      }
      if (input.tagsAny && input.tagsAny.length) {
        let ok = false;
        for (const t of input.tagsAny) if (node.tags.includes(t)) ok = true;
        if (!ok) return false;
      }
      if (input.since) {
        const ts = new Date(node.updatedAt).getTime();
        if (Number.isFinite(ts) && ts < input.since.getTime()) return false;
      }
      if (input.until) {
        const ts = new Date(node.updatedAt).getTime();
        if (Number.isFinite(ts) && ts >= input.until.getTime()) return false;
      }
      return true;
    });

    let scored: SearchMatch[];
    if (term) {
      const normalized = term.trim().toLowerCase();
      scored = filtered
        .map((node) => {
          const titleMatch = node.title.toLowerCase().includes(normalized);
          const tagMatch = node.tags.some((tag) => tag.toLowerCase().includes(normalized));
          const bodyMatch = node.body.toLowerCase().includes(normalized);
          const score = (titleMatch ? 3 : 0) + (tagMatch ? 2 : 0) + (bodyMatch ? 1 : 0);
          return { node, score } as SearchMatch;
        })
        .filter((e) => e.score > 0)
        .map((e) => ({ node: e.node, score: Math.min(1, e.score / 6) }));
    } else {
      scored = filtered
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((node, index) => ({ node, score: Math.max(0.2, 1 - index / Math.max(1, filtered.length)) }));
    }

    let sorted = scored;
    if (input.sort === 'recent') {
      sorted = [...scored].sort(
        (a, b) => new Date(b.node.updatedAt).getTime() - new Date(a.node.updatedAt).getTime(),
      );
    } else if (input.sort === 'degree') {
      const graph = await buildGraph();
      sorted = [...scored].sort((a, b) => {
        const da = graph.hasNode(a.node.id) ? graph.degree(a.node.id) : 0;
        const db = graph.hasNode(b.node.id) ? graph.degree(b.node.id) : 0;
        if (db !== da) return db - da;
        return new Date(b.node.updatedAt).getTime() - new Date(a.node.updatedAt).getTime();
      });
    } else {
      sorted = [...scored].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.node.updatedAt).getTime() - new Date(a.node.updatedAt).getTime();
      });
    }

    matches = sorted.slice(0, searchLimit);
  }
  if (matches.length === 0) {
    const why = term ? `"${term}"` : 'filters';
    throw new Error(`No node matching ${why}.`);
  }

  let index = 0;
  if (typeof input.select === 'number') {
    index = input.select - 1;
    if (Number.isNaN(index) || index < 0 || index >= matches.length) {
      throw new Error(`Select value out of range (must be between 1 and ${matches.length}).`);
    }
  }

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

export async function buildNeighborhoodPayload(centerId: string, depth: number, limit: number) {
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

export async function fetchSuggestionsForNode(nodeId: string) {
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
        2,
      ),
    );

    return;
  }

  if (!focusSelected && options.showMatches) {
    printMatches(matches, match, { longIds: options.longIds, label: 'Matches:', limit: selection.limit });
  } else {
    printMatches(matches, match, {
      longIds: options.longIds,
      label: 'Matches (selected first):',
      limit: selection.limit,
    });
  }

  if (!options.suppressOverview) {
    printNodeOverview(match.node, neighborhoodData.directEdges, { longIds: options.longIds });
    if (options.includeSuggestions && suggestionData.length > 0) {
      console.log('');
      console.log('suggested edges:');
      for (const suggestion of suggestionData) {
        const [sa, sb] = suggestion.id.split('::');
        const code = sa && sb ? edgeShortCode(sa, sb) : '????';
        console.log(
          `  ${formatScore(suggestion.score)}  [${code}] ${formatId(suggestion.otherId, {
            long: options.longIds,
          })}  ${suggestion.otherTitle}  (${suggestion.id})`,
        );
      }
    }
  }
}

export function printNodeOverview(
  node: NodeRecord,
  directEdges: Array<{ otherId: string; otherTitle: string; score: number }>,
  options: { longIds: boolean },
) {
  console.log(`${formatId(node.id, { long: options.longIds })} ${node.title}`);
  if (node.tags.length > 0) {
    console.log(`tags: ${node.tags.join(', ')}`);
  }
  console.log(`created: ${node.createdAt}`);
  console.log(`updated: ${node.updatedAt}`);
  console.log('');

  if (directEdges.length > 0) {
    console.log('accepted edges:');
    for (const edge of directEdges) {
      console.log(
        `  ${formatScore(edge.score)}  ${formatId(edge.otherId, { long: options.longIds })}  ${edge.otherTitle}`,
      );
    }
  } else {
    console.log('accepted edges: none');
  }
}

function printMatches(
  matches: SearchMatch[],
  _selected: SearchMatch,
  options: { longIds: boolean; label: string; limit: number },
) {
  if (matches.length === 0) return;
  console.log(options.label);
  const limit = Math.min(matches.length, options.limit ?? DEFAULT_MATCH_DISPLAY_LIMIT);
  for (let index = 0; index < limit; index += 1) {
    const entry = matches[index];
    const tags = entry.node.tags.length > 0 ? ` [${entry.node.tags.join(', ')}]` : '';
    console.log(
      `${index + 1}. ${formatScore(entry.score)}  ${formatId(entry.node.id, { long: options.longIds })}  ${
        entry.node.title
      }${tags}`,
    );
  }
  if (matches.length > limit) {
    console.log(`  …and ${matches.length - limit} more`);
  }
}
