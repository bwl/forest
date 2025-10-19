import { listEdges, listNodes } from '../../lib/db';
import { buildGraph } from '../../lib/graph';

import { handleError } from '../shared/utils';

type ClercModule = typeof import('clerc');

type StatsFlags = {
  json?: boolean;
  top?: number;
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
      },
    },
    async ({ flags }) => {
      try {
        await runStats(flags as StatsFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runStats(flags: StatsFlags) {
  const nodes = await listNodes();
  const edges = await listEdges('accepted');
  const graph = await buildGraph();

  const degrees = nodes.map((node) => (graph.hasNode(node.id) ? graph.degree(node.id) : 0));
  const sortedDegrees = [...degrees].sort((a, b) => a - b);
  const sumDegrees = degrees.reduce((acc, value) => acc + value, 0);
  const avg = degrees.length ? sumDegrees / degrees.length : 0;
  const median = sortedDegrees.length
    ? sortedDegrees[Math.floor(sortedDegrees.length / 2)]
    : 0;
  const p90 = sortedDegrees.length
    ? sortedDegrees[Math.floor(sortedDegrees.length * 0.9)]
    : 0;

  const tagCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  for (const node of nodes) {
    const uniqueTags = Array.from(new Set(node.tags));
    for (const tag of uniqueTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    for (let i = 0; i < uniqueTags.length; i += 1) {
      for (let j = i + 1; j < uniqueTags.length; j += 1) {
        const a = uniqueTags[i];
        const b = uniqueTags[j];
        const key = a < b ? `${a}::${b}` : `${b}::${a}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const top = typeof flags.top === 'number' && Number.isFinite(flags.top) && flags.top > 0
    ? Math.floor(flags.top)
    : 10;

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([tag, count]) => ({ tag, count }));
  const topPairs = [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([pair, count]) => ({ pair, count }));

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          counts: { nodes: nodes.length, edges: edges.length },
          degree: { avg, median, p90, max: Math.max(0, ...degrees) },
          tags: topTags,
          tagPairs: topPairs,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log('forest stats');
  console.log(`Nodes: ${nodes.length}`);
  console.log(`Accepted edges: ${edges.length}`);
  console.log('');
  console.log(`Degree — avg ${avg.toFixed(3)}  median ${median}  p90 ${p90}  max ${Math.max(0, ...degrees)}`);
  console.log('');
  if (topTags.length) {
    console.log('Top tags:');
    topTags.forEach((entry) => console.log(`  ${String(entry.count).padStart(3, ' ')}  ${entry.tag}`));
    console.log('');
  }
  if (topPairs.length) {
    console.log('Top tag pairs:');
    topPairs.forEach((entry) => console.log(`  ${String(entry.count).padStart(3, ' ')}  ${entry.pair.replace('::', ' + ')}`));
  }
}
