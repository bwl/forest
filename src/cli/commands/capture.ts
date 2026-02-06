import { randomUUID } from 'crypto';

import { NodeRecord, insertNode, listNodes } from '../../lib/db';
import { pickTitle, tokenize, extractTags } from '../../lib/text';
import { computeEmbeddingForNode } from '../../lib/embeddings';
import { getSemanticThreshold, getTagThreshold } from '../../lib/scoring';

import { handleError, resolveBodyInput } from '../shared/utils';
import {
  SelectionResult,
  printExplore,
} from '../shared/explore';
import { linkAgainstExisting } from '../shared/linking';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { colorize } from '../formatters';

type ClercModule = typeof import('clerc');

type CaptureFlags = {
  title?: string;
  body?: string;
  file?: string;
  stdin?: boolean;
  tags?: string;
  autoLink?: boolean;
  noAutoLink?: boolean;
  preview?: boolean;
  noPreview?: boolean;
  json?: boolean;
  tldr?: string;
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
        noAutoLink: {
          type: Boolean,
          description: 'Disable immediate link scoring',
        },
        preview: {
          type: Boolean,
          description: 'Force an explore preview after capture',
        },
        noPreview: {
          type: Boolean,
          description: 'Skip the explore preview after capture',
        },
        json: {
          type: Boolean,
          description: 'Emit JSON output for the capture summary',
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
          emitTldrAndExit(COMMAND_TLDR.capture, getVersion(), jsonMode);
        }
        await runCapture(flags as CaptureFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

// TODO: Refactor to use createNodeCore() from src/core/nodes.ts
// This function currently reimplements node creation logic that should be
// in the core layer. See CLAUDE.md "3-Layer Architecture" section.
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
    isChunk: false,
    parentDocumentId: null,
    chunkOrder: null,
  };

  const existingNodes = await listNodes();
  await insertNode(newNode);

  const autoLink = computeAutoLinkIntent(flags);

  let summary = { accepted: 0 };
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
    await runPreview(newNode);
  }
}

function computeAutoLinkIntent(flags: CaptureFlags) {
  if (typeof flags.noAutoLink === 'boolean') return !flags.noAutoLink;
  if (typeof flags.autoLink === 'boolean') return flags.autoLink;
  return true;
}

function resolveTags(tagsOption: string | undefined, combined: string, tokenCounts: NodeRecord['tokenCounts']) {
  if (typeof tagsOption === 'string') {
    return tagsOption
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
      .filter((tag) => tag.length > 0);
  }
  return extractTags(combined, tokenCounts);
}

async function emitJsonSummary(node: NodeRecord, summary: { accepted: number }, autoLinked: boolean) {
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
          thresholds: {
            semantic: getSemanticThreshold(),
            tags: getTagThreshold(),
          },
        },
      },
      null,
      2,
    ),
  );
}

function emitTextSummary(
  node: NodeRecord,
  tags: string[],
  summary: { accepted: number },
  autoLinked: boolean,
) {
  console.log(`${colorize.success('✔')} Captured idea: ${node.title}`);
  console.log(`   ${colorize.label('id:')} ${colorize.nodeId(node.id.slice(0, 8))}`);
  if (tags.length > 0) {
    const coloredTags = tags.map(tag => colorize.tag(tag)).join(', ');
    console.log(`   ${colorize.label('tags:')} ${coloredTags}`);
  }
  if (autoLinked) {
    console.log(
      `   ${colorize.label('links:')} ${colorize.success(String(summary.accepted))} edges (semantic>=${getSemanticThreshold().toFixed(3)}, tags>=${getTagThreshold().toFixed(3)})`,
    );
  } else {
    console.log(`   ${colorize.label('links:')} auto-linking skipped (--no-auto-link)`);
  }
}

function computePreviewIntent(flags: CaptureFlags) {
  let shouldPreview = true;
  if (flags.noPreview) shouldPreview = false;
  if (flags.preview) shouldPreview = true;
  return shouldPreview;
}

async function runPreview(node: NodeRecord) {
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
    longIds: false,
    json: false,
    showMatches: false,
    focusSelected: true,
  });
}
