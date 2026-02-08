import { formatId, handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { colorize } from '../formatters';
import { getBackend } from '../shared/remote';

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
          emitTldrAndExit(COMMAND_TLDR.stats, getVersion(), jsonMode);
        }
        await runStats(flags as StatsFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runStats(flags: StatsFlags) {
  const backend = getBackend();
  const top = typeof flags.top === 'number' && Number.isFinite(flags.top) && flags.top > 0
    ? Math.floor(flags.top)
    : 10;
  const stats = await backend.getStats({ top });

  if (flags.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log('forest stats');
  console.log(`Nodes: ${stats.nodes.total}`);
  console.log(`Edges: ${stats.edges.total}`);
  console.log('');
  if (stats.degree) {
    console.log(`Degree — avg ${stats.degree.avg.toFixed(3)}  median ${stats.degree.median}  p90 ${stats.degree.p90}  max ${stats.degree.max}`);
    console.log('');
  }

  if (stats.nodes.recent.length > 0) {
    console.log('Recent captures:');
    for (const node of stats.nodes.recent) {
      const coloredId = colorize.nodeId(formatId(node.id));
      console.log(`  ${coloredId}  ${node.title}`);
    }
    console.log('');
  }

  if (stats.highDegreeNodes.length > 0) {
    console.log('High-degree nodes:');
    const maxDegree = stats.degree?.max ?? 0;
    for (const entry of stats.highDegreeNodes) {
      const coloredId = colorize.nodeId(formatId(entry.id));
      const degreeRatio = maxDegree > 0 ? entry.edgeCount / maxDegree : 0;
      const coloredDegree = colorize.embeddingScore(degreeRatio);
      console.log(`  ${coloredId}  ${entry.title}  (degree ${coloredDegree})`);
    }
    console.log('');
  }

  if (stats.tags.topTags.length > 0) {
    console.log('Top tags:');
    stats.tags.topTags.forEach((entry) => console.log(`  ${String(entry.count).padStart(3, ' ')}  ${entry.name}`));
    console.log('');
  }

  if (stats.tagPairs && stats.tagPairs.length > 0) {
    console.log('Top tag pairs:');
    stats.tagPairs.forEach((entry) => console.log(`  ${String(entry.count).padStart(3, ' ')}  ${entry.pair.replace('::', ' + ')}`));
    console.log('');
  }
}
