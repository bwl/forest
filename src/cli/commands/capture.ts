import { randomUUID } from 'crypto';

import { NodeRecord, insertNode, listNodes } from '../../lib/db';
import { pickTitle, tokenize, extractTags } from '../../lib/text';
import { computeEmbeddingForNode } from '../../lib/embeddings';
import { getAutoAcceptThreshold, getSuggestionThreshold } from '../../lib/scoring';

import { handleError, resolveBodyInput } from '../shared/utils';
import {
  SelectionResult,
  fetchSuggestionsForNode,
  printExplore,
} from '../shared/explore';
import { linkAgainstExisting } from '../shared/linking';

type ClercModule = typeof import('clerc');

type CaptureFlags = {
  title?: string;
  body?: string;
  file?: string;
  stdin?: boolean;
  tags?: string;
  autoLink?: boolean;
  preview?: boolean;
  noPreview?: boolean;
  previewSuggestionsOnly?: boolean;
  json?: boolean;
};

export function createCaptureCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'capture',
      description: 'Capture a new idea and auto-link it into the graph',
      flags: {
        title: {
          type: String,
          alias: 't',
          description: 'Title for the idea',
        },
        body: {
          type: String,
          alias: 'b',
          description: 'Body content; if omitted use --file or --stdin',
        },
        file: {
          type: String,
          alias: 'f',
          description: 'Read body from file',
        },
        stdin: {
          type: Boolean,
          description: 'Read body from standard input',
        },
        tags: {
          type: String,
          description: 'Comma-separated list of tags to force (overrides auto-detected tags)',
        },
        autoLink: {
          type: Boolean,
          description: 'Score/link against existing nodes',
          default: true,
        },
        preview: {
          type: Boolean,
          description: 'Force an explore preview after capture',
        },
        noPreview: {
          type: Boolean,
          description: 'Skip the explore preview after capture',
        },
        previewSuggestionsOnly: {
          type: Boolean,
          description: 'In preview, only show suggestions (hide metadata and accepted edges)',
        },
        json: {
          type: Boolean,
          description: 'Emit JSON output for the capture summary',
        },
      },
    },
    async ({ flags }) => {
      try {
        await runCapture(flags as CaptureFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runCapture(flags: CaptureFlags) {
  const bodyResult = await resolveBodyInput(flags.body, flags.file, flags.stdin);
  const body = bodyResult.value;

  if (!body || body.trim().length === 0) {
    console.error('✖ No content provided. Use --body, --file, or --stdin.');
    process.exitCode = 1;
    return;
  }

  const title = pickTitle(body, flags.title);
  const combinedText = `${title}\n${body}`;
  const tokenCounts = tokenize(combinedText);
  const tags = resolveTags(flags.tags, combinedText, tokenCounts);

  const embedding = await computeEmbeddingForNode({ title, body });

  const newNode: NodeRecord = {
    id: randomUUID(),
    title,
    body,
    tags,
    tokenCounts,
    embedding,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const existingNodes = await listNodes();
  await insertNode(newNode);

  const autoLink = computeAutoLinkIntent(flags);

  let summary = { accepted: 0, suggested: 0 };
  if (autoLink) {
    summary = await linkAgainstExisting(newNode, existingNodes);
  }

  if (flags.json) {
    await emitJsonSummary(newNode, summary, autoLink);
    return;
  }

  emitTextSummary(newNode, tags, summary, autoLink);

  const shouldPreview = computePreviewIntent(flags);
  if (shouldPreview) {
    await runPreview(newNode, autoLink, Boolean(flags.previewSuggestionsOnly));
  }
}

function computeAutoLinkIntent(flags: CaptureFlags) {
  if (typeof flags.autoLink === 'boolean') return flags.autoLink;
  return true;
}

function resolveTags(tagsOption: string | undefined, combined: string, tokenCounts: NodeRecord['tokenCounts']) {
  if (typeof tagsOption === 'string') {
    return tagsOption
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }
  return extractTags(combined, tokenCounts);
}

async function emitJsonSummary(node: NodeRecord, summary: { accepted: number; suggested: number }, autoLinked: boolean) {
  const suggestions = await fetchSuggestionsForNode(node.id);
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
        links: {
          autoLinked,
          accepted: summary.accepted,
          suggested: summary.suggested,
          thresholds: {
            auto: getAutoAcceptThreshold(),
            suggest: getSuggestionThreshold(),
          },
        },
        suggestions: suggestions.map((s) => ({
          id: s.id,
          score: s.score,
          otherId: s.otherId,
          otherTitle: s.otherTitle,
        })),
      },
      null,
      2,
    ),
  );
}

function emitTextSummary(
  node: NodeRecord,
  tags: string[],
  summary: { accepted: number; suggested: number },
  autoLinked: boolean,
) {
  console.log(`✔ Captured idea: ${node.title}`);
  console.log(`   id: ${node.id}`);
  if (tags.length > 0) {
    console.log(`   tags: ${tags.join(', ')}`);
  }
  if (autoLinked) {
    console.log(
      `   links: ${summary.accepted} accepted, ${summary.suggested} pending (thresholds auto=${getAutoAcceptThreshold().toFixed(
        3,
      )}, suggest=${getSuggestionThreshold().toFixed(3)})`,
    );
  } else {
    console.log('   links: auto-linking skipped (--no-auto-link)');
  }
}

function computePreviewIntent(flags: CaptureFlags) {
  let shouldPreview = true;
  if (flags.noPreview) shouldPreview = false;
  if (flags.preview) shouldPreview = true;
  return shouldPreview;
}

async function runPreview(node: NodeRecord, includeSuggestions: boolean, suggestionsOnly: boolean) {
  console.log('\nPreview:');
  const selection: SelectionResult = {
    selected: { node, score: 1 },
    matches: [{ node, score: 1 }],
    limit: 1,
  };
  await printExplore({
    selection,
    limit: 15,
    matchLimit: 1,
    depth: 1,
    includeSuggestions,
    longIds: false,
    json: false,
    showMatches: false,
    focusSelected: true,
    suppressOverview: suggestionsOnly,
  });
}
