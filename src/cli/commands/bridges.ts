/**
 * forest bridges - Discover cross-document bridge nodes
 */

import { formatId } from '../shared/utils';
import { getBackend } from '../shared/remote';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { getVersion } from './version';

type ClercModule = typeof import('clerc');

type BridgesFlags = {
  limit?: number;
  minScore?: number;
  json?: boolean;
  tldr?: string;
};

export function createBridgesCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'bridges',
      description: 'Find nodes that bridge across different documents',
      flags: {
        limit: {
          type: Number,
          description: 'Number of bridge nodes to show',
          default: 20,
        },
        minScore: {
          type: Number,
          description: 'Minimum edge score to consider',
        },
        json: {
          type: Boolean,
          description: 'Output as JSON',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: BridgesFlags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.bridges, getVersion(), jsonMode);
        }
        await runBridges(flags);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
      }
    },
  );
}

async function runBridges(flags: BridgesFlags) {
  const backend = getBackend();
  const result = await backend.getBridges({
    limit: flags.limit,
    minScore: flags.minScore,
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.bridges.length === 0) {
    console.log('No cross-document bridge nodes found.');
    console.log('Bridge nodes connect passages across different imported documents.');
    return;
  }

  console.log('Bridge Nodes \u2014 cross-document connections:\n');

  result.bridges.forEach((bridge, i) => {
    const shortId = formatId(bridge.nodeId);
    const docLabel = bridge.documentTitle
      ? `  [${bridge.documentTitle}]`
      : '';
    console.log(
      `${String(i + 1).padStart(2)}.  ${shortId}${docLabel}  ${bridge.nodeTitle}`,
    );
    console.log(
      `    \u2194 ${bridge.connectedDocCount} documents, ${bridge.crossDocDegree} cross-links (best: ${bridge.maxScore.toFixed(2)})`,
    );

    for (const conn of bridge.topConnections) {
      const connId = formatId(conn.nodeId);
      const connDoc = conn.documentTitle ? `[${conn.documentTitle}]` : '';
      console.log(
        `      \u2192 ${connId} ${connDoc}  ${conn.nodeTitle.slice(0, 50).padEnd(50)}  ${conn.score.toFixed(2)}`,
      );
    }

    console.log('');
  });
}
