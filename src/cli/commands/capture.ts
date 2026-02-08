import { NodeRecord } from '../../lib/db';
import { getSemanticThreshold, getTagThreshold } from '../../lib/scoring';
import { createNodeCore } from '../../core/nodes';

import { handleError, resolveBodyInput, formatId } from '../shared/utils';
import {
  SelectionResult,
  printExplore,
} from '../shared/explore';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { colorize } from '../formatters';
import { isRemoteMode, getClient } from '../shared/remote';

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

async function runCaptureRemote(flags: CaptureFlags) {
  const bodyResult = await resolveBodyInput(flags.body, flags.file, flags.stdin);
  const body = bodyResult.value;

  if (!body || body.trim().length === 0) {
    console.error('✖ No content provided. Use --body, --file, or --stdin.');
    process.exitCode = 1;
    return;
  }

  const client = getClient();
  const tags = typeof flags.tags === 'string'
    ? flags.tags.split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter((t) => t.length > 0)
    : undefined;

  const result = await client.createNode({
    title: flags.title,
    body,
    tags,
    autoLink: computeAutoLinkIntent(flags),
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const node = result.node;
  console.log(`${colorize.success('✔')} Captured idea: ${node.title}`);
  console.log(`   ${colorize.label('id:')} ${colorize.nodeId(node.shortId)}`);
  if (node.tags.length > 0) {
    const coloredTags = node.tags.map((tag: string) => colorize.tag(tag)).join(', ');
    console.log(`   ${colorize.label('tags:')} ${coloredTags}`);
  }
  console.log(`   ${colorize.label('links:')} ${colorize.success(String(result.linking.edgesCreated))} edges`);
}

async function runCapture(flags: CaptureFlags) {
  if (isRemoteMode()) {
    return runCaptureRemote(flags);
  }

  const bodyResult = await resolveBodyInput(flags.body, flags.file, flags.stdin);
  const body = bodyResult.value;

  if (!body || body.trim().length === 0) {
    console.error('✖ No content provided. Use --body, --file, or --stdin.');
    process.exitCode = 1;
    return;
  }

  const autoLink = computeAutoLinkIntent(flags);

  // Parse explicit tags if provided
  const tags = typeof flags.tags === 'string'
    ? flags.tags.split(',').map((tag) => tag.trim().replace(/^#/, '').toLowerCase()).filter((tag) => tag.length > 0)
    : undefined;

  const result = await createNodeCore({
    title: flags.title,
    body,
    tags,
    autoLink,
    metadata: { origin: 'capture', createdBy: 'user' },
  });

  const newNode = result.node;
  const summary = { accepted: result.linking.edgesCreated };

  if (flags.json) {
    await emitJsonSummary(newNode, summary, autoLink);
    return;
  }

  emitTextSummary(newNode, newNode.tags, summary, autoLink);

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
          metadata: node.metadata ?? null,
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
  console.log(`   ${colorize.label('id:')} ${colorize.nodeId(formatId(node.id))}`);
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
