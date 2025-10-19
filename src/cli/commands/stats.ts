import { listEdges, listNodes } from '../../lib/db';
import { buildGraph } from '../../lib/graph';

import { describeSuggestion } from '../shared/edges';
import { formatId, handleError } from '../shared/utils';

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
  const allEdges = await listEdges('all');
  const graph = await buildGraph();
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

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

  // Graph health metrics (from doctor)
  const recent = [...nodes]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const highDegree = nodes
    .map((node) => ({
      node,
      degree: graph.hasNode(node.id) ? graph.degree(node.id) : 0,
    }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 5);

  const suggestions = (await listEdges('suggested'))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          counts: {
            nodes: nodes.length,
            edges: edges.length,
            suggested: allEdges.filter((e) => e.status === 'suggested').length,
          },
          degree: { avg, median, p90, max: Math.max(0, ...degrees) },
          tags: topTags,
          tagPairs: topPairs,
          recent: recent.map((node) => ({
            id: node.id,
            title: node.title,
            tags: node.tags,
            updatedAt: node.updatedAt,
          })),
          highDegree: highDegree.map((entry) => ({
            id: entry.node.id,
            title: entry.node.title,
            degree: entry.degree,
          })),
          topSuggestions: suggestions.map((edge, index) => {
            const desc = describeSuggestion(edge, nodeMap, { longIds: true, allEdges });
            return {
              index: index + 1,
              id: edge.id,
              shortId: desc.shortId,
              code: desc.code,
              score: edge.score,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
              sourceTitle: desc.sourceTitle,
              targetTitle: desc.targetTitle,
            };
          }),
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
  console.log(`Suggested edges: ${allEdges.filter((e) => e.status === 'suggested').length}`);
  console.log('');
  console.log(`Degree — avg ${avg.toFixed(3)}  median ${median}  p90 ${p90}  max ${Math.max(0, ...degrees)}`);
  console.log('');

  if (recent.length > 0) {
    console.log('Recent captures:');
    for (const node of recent) {
      console.log(`  ${formatId(node.id)}  ${node.title}  (updated ${node.updatedAt})`);
    }
    console.log('');
  }

  if (highDegree.length > 0) {
    console.log('High-degree nodes:');
    for (const entry of highDegree) {
      console.log(`  ${formatId(entry.node.id)}  ${entry.node.title}  (degree ${entry.degree})`);
    }
    console.log('');
  }

  if (topTags.length) {
    console.log('Top tags:');
    topTags.forEach((entry) => console.log(`  ${String(entry.count).padStart(3, ' ')}  ${entry.tag}`));
    console.log('');
  }
  if (topPairs.length) {
    console.log('Top tag pairs:');
    topPairs.forEach((entry) => console.log(`  ${String(entry.count).padStart(3, ' ')}  ${entry.pair.replace('::', ' + ')}`));
    console.log('');
  }

  if (suggestions.length > 0) {
    console.log('Top suggestions:');
    suggestions.forEach((edge, index) => {
      const desc = describeSuggestion(edge, nodeMap, { longIds: false, allEdges });
      const indexLabel = String(index + 1).padStart(2, ' ');
      console.log(
        `  ${indexLabel}. [${desc.code}] ${desc.shortId}  score=${edge.score.toFixed(3)}  ${desc.sourceTitle ?? desc.sourceLabel} ↔ ${desc.targetTitle ?? desc.targetLabel}`,
      );
    });
  }
}
