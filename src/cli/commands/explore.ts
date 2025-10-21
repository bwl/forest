import {
  DEFAULT_NEIGHBORHOOD_LIMIT,
  DEFAULT_SEARCH_LIMIT,
  handleError,
  normalizeSort,
  parseCsvList,
  parseDate,
} from '../shared/utils';
import { printExplore, selectNode } from '../shared/explore';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';

type ClercModule = typeof import('clerc');

export function createExploreCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
    name: 'explore',
    description: 'Search for a note and inspect its graph neighborhood',
    parameters: ['[term]'],
    flags: {
      id: {
        type: String,
        description: 'Node id to focus on',
      },
      title: {
        type: String,
        description: 'Node title to match (case-insensitive)',
      },
      select: {
        type: Number,
        description: '1-based index of the match to explore',
      },
      searchLimit: {
        type: Number,
        description: 'Maximum matches to consider',
      },
      tag: {
        type: String,
        description: 'Filter by notes containing all tags (comma-separated)',
      },
      anyTag: {
        type: String,
        description: 'Filter by notes containing any of the tags (comma-separated)',
      },
      since: {
        type: String,
        description: 'Only include notes updated on/after this date (YYYY-MM-DD or ISO)',
      },
      before: {
        type: String,
        description: 'Only include notes updated before this date (YYYY-MM-DD or ISO)',
      },
      until: {
        type: String,
        description: 'Alias of --before',
      },
      sort: {
        type: String,
        description: 'Sort matches: score|recent|degree',
      },
      depth: {
        type: Number,
        alias: 'd',
        description: 'Neighborhood depth',
        default: 1,
      },
      limit: {
        type: Number,
        alias: 'l',
        description: 'Maximum number of nodes in neighborhood',
      },
      includeSuggestions: {
        type: Boolean,
        description: 'Include suggested edges in the neighborhood output',
      },
      longIds: {
        type: Boolean,
        description: 'Display full ids in human-readable output',
      },
      json: {
        type: Boolean,
        description: 'Emit JSON instead of text output',
      },
      interactive: {
        type: Boolean,
        description: 'Prompt to choose a match',
      },
      showChunks: {
        type: Boolean,
        description: 'Include document chunks in results (default: false)',
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
          emitTldrAndExit(COMMAND_TLDR.explore, jsonMode);
        }
        const limitFlag =
          typeof flags.limit === 'number' && !Number.isNaN(flags.limit) ? flags.limit : undefined;
        const neighborhoodLimit = limitFlag ?? DEFAULT_NEIGHBORHOOD_LIMIT;
        const searchLimit =
          typeof flags.searchLimit === 'number' && !Number.isNaN(flags.searchLimit)
            ? flags.searchLimit
            : limitFlag ?? DEFAULT_SEARCH_LIMIT;

        const termValue = parameters.term;

        const selection = await selectNode({
          id: flags.id,
          title: flags.title,
          term: termValue,
          limit: searchLimit,
          select: typeof flags.select === 'number' ? flags.select : undefined,
          interactive: Boolean(flags.interactive),
          tagsAll: parseCsvList(flags.tag),
          tagsAny: parseCsvList(flags.anyTag),
          since: parseDate(flags.since),
          until: parseDate(flags.before ?? flags.until),
          sort: normalizeSort(flags.sort),
          showChunks: Boolean(flags.showChunks),
        });

        const hasSearchTerm = typeof termValue === 'string' && termValue.trim().length > 0;
        const focusSelected =
          Boolean(flags.id) ||
          Boolean(flags.title) ||
          typeof flags.select === 'number' ||
          hasSearchTerm;

        await printExplore({
          selection,
          limit: neighborhoodLimit,
          matchLimit: searchLimit,
          depth: typeof flags.depth === 'number' && !Number.isNaN(flags.depth) ? flags.depth : 1,
          includeSuggestions: Boolean(flags.includeSuggestions),
          longIds: Boolean(flags.longIds),
          json: Boolean(flags.json),
          showMatches: !Boolean(flags.json),
          focusSelected: focusSelected || Boolean(flags.json),
        });
      } catch (error) {
        handleError(error);
      }
    },
  );
}
