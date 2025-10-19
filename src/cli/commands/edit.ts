import { NodeRecord, updateNode } from '../../lib/db';
import { extractTags, tokenize } from '../../lib/text';
import { computeEmbeddingForNode } from '../../lib/embeddings';
import { classifyScore, computeScore, normalizeEdgePair } from '../../lib/scoring';

import { handleError, resolveBodyInput, resolveNodeReference } from '../shared/utils';
import { rescoreNode } from '../shared/linking';

type ClercModule = typeof import('clerc');

type EditFlags = {
  title?: string;
  body?: string;
  file?: string;
  stdin?: boolean;
  tags?: string;
  autoLink?: boolean;
};

export function createEditCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'edit',
      description: 'Edit an existing note and optionally rescore links',
      parameters: ['<id>'],
      flags: {
        title: {
          type: String,
          description: 'New title',
        },
        body: {
          type: String,
          description: 'New body content',
        },
        file: {
          type: String,
          description: 'Read new body from file',
        },
        stdin: {
          type: Boolean,
          description: 'Read new body from standard input',
        },
        tags: {
          type: String,
          description: 'Comma-separated list of tags to set (overrides auto-detected tags)',
        },
        autoLink: {
          type: Boolean,
          description: 'Rescore/link against existing nodes',
          default: true,
        },
      },
    },
    async ({ parameters, flags }) => {
      try {
        await runEdit(parameters.id, flags as EditFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runEdit(idRef: string | undefined, flags: EditFlags) {
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

  const nextTitle = typeof flags.title === 'string' ? flags.title : node.title;

  const bodyResult = await resolveBodyInput(flags.body, flags.file, flags.stdin);
  const nextBody = bodyResult.provided ? bodyResult.value : node.body;

  const combinedText = `${nextTitle}\n${nextBody}`;
  const tokenCounts = tokenize(combinedText);
  const tags = resolveTags(flags.tags, combinedText, tokenCounts);

  const embedding = await computeEmbeddingForNode({ title: nextTitle, body: nextBody });

  await updateNode(node.id, {
    title: nextTitle,
    body: nextBody,
    tags,
    tokenCounts,
    embedding,
  });

  const autoLink = computeAutoLinkIntent(flags);

  let accepted = 0;
  let suggested = 0;
  if (autoLink) {
    const updatedNode: NodeRecord = {
      ...node,
      title: nextTitle,
      body: nextBody,
      tags,
      tokenCounts,
      embedding,
    };
    ({ accepted, suggested } = await rescoreNode(updatedNode));
  }

  console.log(`✔ Updated note: ${nextTitle}`);
  console.log(`   id: ${node.id}`);
  if (tags.length > 0) console.log(`   tags: ${tags.join(', ')}`);
  if (autoLink) {
    console.log(`   links after rescore: ${accepted} accepted, ${suggested} pending`);
  } else {
    console.log('   links: rescoring skipped (--no-auto-link)');
  }
}

function resolveTags(tagsOption: string | undefined, combinedText: string, tokenCounts: NodeRecord['tokenCounts']) {
  if (typeof tagsOption === 'string') {
    return tagsOption
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  return extractTags(combinedText, tokenCounts);
}

function computeAutoLinkIntent(flags: EditFlags) {
  if (typeof flags.autoLink === 'boolean') return flags.autoLink;
  return true;
}
