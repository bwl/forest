/**
 * forest path - Find paths between nodes in the graph
 */

import { findPath, PathResult } from '../../core/graph';
import { resolveNodeReference, formatId } from '../shared/utils';
import { isRemoteMode, getClient } from '../shared/remote';

type ClercModule = typeof import('clerc');

type PathFlags = {
  json?: boolean;
  longIds?: boolean;
};

export function createPathCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'path',
      description: 'Find the shortest path between two nodes',
      parameters: ['[from]', '[to]'],
      flags: {
        json: {
          type: Boolean,
          description: 'Output as JSON',
        },
        longIds: {
          type: Boolean,
          description: 'Display full UUIDs instead of short prefixes',
        },
      },
    },
    async ({ parameters, flags }: { parameters: { from?: string; to?: string }; flags: PathFlags }) => {
      try {
        await runPath(parameters.from, parameters.to, flags);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
      }
    },
  );
}

async function runPathRemote(fromRef: string, toRef: string, flags: PathFlags) {
  const client = getClient();
  const result = await client.findPath(fromRef, toRef);

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.found) {
    console.log(`No path found between "${fromRef}" and "${toRef}"`);
    return;
  }

  console.log(`Path found (${result.hopCount} hops, total score: ${result.totalScore.toFixed(3)}):`);
  console.log('');

  for (let i = 0; i < result.path.length; i++) {
    const step = result.path[i];
    const id = flags.longIds ? step.nodeId : formatId(step.nodeId);

    if (i === 0) {
      console.log(`  ${id}  ${step.nodeTitle}`);
    } else {
      const arrow = step.edgeType && step.edgeType !== 'semantic'
        ? `  ↓ [${step.edgeType}] (${step.edgeScore?.toFixed(3)})`
        : `  ↓ (${step.edgeScore?.toFixed(3)})`;
      console.log(arrow);
      console.log(`  ${id}  ${step.nodeTitle}`);
    }
  }
}

async function runPath(fromRef: string | undefined, toRef: string | undefined, flags: PathFlags) {
  if (!fromRef || !toRef) {
    console.error('Usage: forest path <from> <to>');
    console.error('');
    console.error('Examples:');
    console.error('  forest path abc123 def456');
    console.error('  forest path seedworld rustrogue');
    console.error('  forest path "my idea" "my project" --json');
    process.exitCode = 1;
    return;
  }

  if (isRemoteMode()) {
    return runPathRemote(fromRef, toRef, flags);
  }

  const fromNode = await resolveNodeReference(fromRef);
  const toNode = await resolveNodeReference(toRef);

  if (!fromNode) {
    console.error(`✖ Could not find node: ${fromRef}`);
    process.exitCode = 1;
    return;
  }

  if (!toNode) {
    console.error(`✖ Could not find node: ${toRef}`);
    process.exitCode = 1;
    return;
  }

  const result = await findPath(fromNode.id, toNode.id);

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.found) {
    console.log(`No path found between "${fromNode.title}" and "${toNode.title}"`);
    return;
  }

  console.log(`Path found (${result.hopCount} hops, total score: ${result.totalScore.toFixed(3)}):`);
  console.log('');

  for (let i = 0; i < result.path.length; i++) {
    const step = result.path[i];
    const id = flags.longIds ? step.nodeId : formatId(step.nodeId);

    if (i === 0) {
      console.log(`  ${id}  ${step.nodeTitle}`);
    } else {
      const arrow = step.edgeType && step.edgeType !== 'semantic'
        ? `  ↓ [${step.edgeType}] (${step.edgeScore?.toFixed(3)})`
        : `  ↓ (${step.edgeScore?.toFixed(3)})`;
      console.log(arrow);
      console.log(`  ${id}  ${step.nodeTitle}`);
    }
  }
}
