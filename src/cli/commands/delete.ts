import { deleteNode } from '../../lib/db';

import { formatId, handleError, resolveNodeReference } from '../shared/utils';

type ClercModule = typeof import('clerc');

type DeleteFlags = {
  force?: boolean;
};

export function createDeleteCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'delete',
      description: 'Delete a note and its edges',
      parameters: ['<id>'],
      flags: {
        force: {
          type: Boolean,
          description: 'Do not prompt for confirmation (non-interactive mode)',
        },
      },
    },
    async ({ parameters, flags }) => {
      try {
        await runDelete(parameters.id, flags as DeleteFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runDelete(idRef: string | undefined, _flags: DeleteFlags) {
  if (!idRef) {
    console.error('✖ Missing required parameter "id".');
    process.exitCode = 1;
    return;
  }

  const node = await resolveNodeReference(String(idRef));
  if (!node) {
    console.error('✖ No node found. Provide a full id or unique short id.');
    process.exitCode = 1;
    return;
  }

  const result = await deleteNode(node.id);
  if (!result.nodeRemoved) {
    console.error('✖ Node could not be removed.');
    process.exitCode = 1;
    return;
  }

  console.log(`✔ Deleted note ${formatId(node.id)} (${node.title})`);
  console.log(`   removed ${result.edgesRemoved} associated edges`);
}
