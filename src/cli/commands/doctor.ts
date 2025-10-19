import { listEdges, listNodes } from '../../lib/db';
import { buildGraph } from '../../lib/graph';

import { describeSuggestion } from '../shared/edges';
import { formatId, handleError } from '../shared/utils';

type ClercModule = typeof import('clerc');

type DoctorFlags = {
  json?: boolean;
};

export function createDoctorCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'doctor',
      description: 'Show graph health metrics and recent activity',
      flags: {
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
      },
    },
    async ({ flags }) => {
      try {
        await runDoctor(flags as DoctorFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runDoctor(flags: DoctorFlags) {
  const nodes = await listNodes();
  const edges = await listEdges('all');
  const graph = await buildGraph();

  const counts = {
    nodes: nodes.length,
    edgesAccepted: edges.filter((edge) => edge.status === 'accepted').length,
    edgesSuggested: edges.filter((edge) => edge.status === 'suggested').length,
  };

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

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

  if (flags.json) {
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
          suggestions: suggestions.map((edge, index) => {
            const desc = describeSuggestion(edge, nodeMap, { longIds: true });
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
    suggestions.forEach((edge, index) => {
      const desc = describeSuggestion(edge, nodeMap, { longIds: false });
      const indexLabel = String(index + 1).padStart(2, ' ');
      console.log(
        `  ${indexLabel}. [${desc.code}] ${desc.shortId}  score=${edge.score.toFixed(3)}  ${desc.sourceTitle ?? desc.sourceLabel} ↔ ${desc.targetTitle ?? desc.targetLabel}`,
      );
    });
    console.log('');
  }

  console.log('Next steps:');
  console.log('  - Run `forest insights list` to triage pending links.');
  console.log('  - Capture new ideas with `forest capture`.');
}
