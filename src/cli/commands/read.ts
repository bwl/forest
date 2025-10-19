import { buildNeighborhoodPayload, printNodeOverview } from '../shared/explore';
import { DEFAULT_NEIGHBORHOOD_LIMIT, handleError, resolveNodeReference } from '../shared/utils';

type ClercModule = typeof import('clerc');

type ReadFlags = {
  meta?: boolean;
  json?: boolean;
  longIds?: boolean;
};

export function createReadCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'read',
      description: 'Show the full content of a note',
      parameters: ['<id>'],
      flags: {
        meta: {
          type: Boolean,
          description: 'Show metadata summary without the body text',
        },
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
        longIds: {
          type: Boolean,
          description: 'Display full ids in text output',
        },
      },
    },
    async ({ parameters, flags }) => {
      try {
        await runRead(parameters.id, flags as ReadFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runRead(idRef: string | undefined, flags: ReadFlags) {
  if (!idRef || idRef.trim().length === 0) {
    console.error('✖ Provide a node id or unique short id (run `forest explore` to discover ids).');
    process.exitCode = 1;
    return;
  }

  const node = await resolveNodeReference(idRef.trim());
  if (!node) {
    console.error('✖ No node found. Provide a full id or unique short id.');
    process.exitCode = 1;
    return;
  }

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          node: {
            id: node.id,
            title: node.title,
            tags: node.tags,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
          },
          body: node.body,
        },
        null,
        2,
      ),
    );
    return;
  }

  const { directEdges } = await buildNeighborhoodPayload(node.id, 1, DEFAULT_NEIGHBORHOOD_LIMIT);
  printNodeOverview(node, directEdges, { longIds: Boolean(flags.longIds) });

  if (!flags.meta) {
    console.log('');
    console.log(node.body);
  }
}
