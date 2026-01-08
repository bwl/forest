import { getStats } from '../../core/stats.js';
import { formatId, handleError } from '../shared/utils.js';
import { getVersion } from './version.js';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr.js';
import { colorize } from '../formatters/index.js';

type ClercModule = typeof import('clerc');

type StatsFlags = {
  json?: boolean;
  top?: number;
  tldr?: string;
};

export function createStatsCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'stats',
      description: 'Show graph and tag statistics',
      flags: {
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
        top: {
          type: Number,
          description: 'Top N tags/pairs to show',
          default: 10,
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.stats, getVersion());
        }
        await runStats(flags as StatsFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runStats(flags: StatsFlags) {
  const top = typeof flags.top === 'number' && Number.isFinite(flags.top) && flags.top > 0
    ? Math.floor(flags.top)
    : 10;

  const stats = await getStats({ top });

  if (flags.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log('forest stats');
  console.log(`Nodes: ${stats.counts.nodes}`);
  console.log(`Accepted edges: ${stats.counts.edges}`);
  console.log(`Suggested edges: ${stats.counts.suggested}`);
  console.log('');
  console.log(`Degree — avg ${stats.degree.avg.toFixed(3)}  median ${stats.degree.median}  p90 ${stats.degree.p90}  max ${stats.degree.max}`);
  console.log('');

  if (stats.recent.length > 0) {
    console.log('Recent captures:');
    for (const node of stats.recent) {
      const coloredId = colorize.nodeId(formatId(node.id));
      console.log(`  ${coloredId}  ${node.title}  (updated ${node.updatedAt})`);
    }
    console.log('');
  }

  if (stats.highDegree.length > 0) {
    console.log('High-degree nodes:');
    const maxDegree = stats.degree.max;
    for (const entry of stats.highDegree) {
      const coloredId = colorize.nodeId(formatId(entry.id));
      const degreeRatio = maxDegree > 0 ? entry.degree / maxDegree : 0;
      const coloredDegree = colorize.embeddingScore(degreeRatio);
      console.log(`  ${coloredId}  ${entry.title}  (degree ${coloredDegree})`);
    }
    console.log('');
  }

  if (stats.tags.length) {
    console.log('Top tags:');
    stats.tags.forEach((entry) => console.log(`  ${String(entry.count).padStart(3, ' ')}  ${entry.tag}`));
    console.log('');
  }
  if (stats.tagPairs.length) {
    console.log('Top tag pairs:');
    stats.tagPairs.forEach((entry) => console.log(`  ${String(entry.count).padStart(3, ' ')}  ${entry.pair.replace('::', ' + ')}`));
    console.log('');
  }

  if (stats.topSuggestions.length > 0) {
    console.log('Top suggestions:');
    stats.topSuggestions.forEach((suggestion) => {
      const indexLabel = String(suggestion.index).padStart(2, ' ');
      const coloredCode = colorize.edgeCode(suggestion.code);
      const coloredScore = colorize.aggregateScore(suggestion.score);
      console.log(
        `  ${indexLabel}. [${coloredCode}] ${suggestion.shortId}  score=${coloredScore}  ${suggestion.sourceTitle ?? formatId(suggestion.sourceId)} ↔ ${suggestion.targetTitle ?? formatId(suggestion.targetId)}`,
      );
    });
  }
}
