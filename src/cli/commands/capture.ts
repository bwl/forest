import { handleError, resolveBodyInput, formatId } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { colorize } from '../formatters';
import { getBackend } from '../shared/remote';

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

async function runCapture(flags: CaptureFlags) {
  const bodyResult = await resolveBodyInput(flags.body, flags.file, flags.stdin);
  const body = bodyResult.value;

  if (!body || body.trim().length === 0) {
    console.error('✖ No content provided. Use --body, --file, or --stdin.');
    process.exitCode = 1;
    return;
  }

  const autoLink = computeAutoLinkIntent(flags);
  const tags = typeof flags.tags === 'string'
    ? flags.tags.split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter((t) => t.length > 0)
    : undefined;

  const backend = getBackend();
  const result = await backend.createNode({
    title: flags.title,
    body,
    tags,
    autoLink,
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

  // Preview: show neighborhood after capture
  const shouldPreview = computePreviewIntent(flags);
  if (shouldPreview) {
    console.log('');
    try {
      const NEARBY_LIMIT = 6;
      const neighborhood = await backend.getNeighborhood(node.id, { depth: 1, limit: NEARBY_LIMIT });
      const directEdges = neighborhood.edges.filter(
        (e) => e.source === node.id || e.target === node.id,
      );
      if (directEdges.length > 0) {
        console.log(`${colorize.label('nearby:')}`);
        const nodeMap = new Map(neighborhood.nodes.map((n) => [n.id, n]));
        const shown = directEdges.slice(0, NEARBY_LIMIT);
        for (const edge of shown) {
          const otherId = edge.source === node.id ? edge.target : edge.source;
          const otherNode = nodeMap.get(otherId);
          const otherTitle = otherNode ? otherNode.title : formatId(otherId);
          const otherFmtId = formatId(otherId);
          const coloredScore = colorize.embeddingScore(edge.score);
          console.log(`  ${coloredScore}  ${colorize.nodeId(otherFmtId)}  ${otherTitle}`);
        }
        const remaining = result.linking.edgesCreated - shown.length;
        if (remaining > 0) {
          console.log(`  ${colorize.grey(`...and ${remaining} more`)}`);
        }
      }
    } catch {
      // Preview is best-effort
    }
  }
}

function computeAutoLinkIntent(flags: CaptureFlags) {
  if (typeof flags.noAutoLink === 'boolean') return !flags.noAutoLink;
  if (typeof flags.autoLink === 'boolean') return flags.autoLink;
  return true;
}

function computePreviewIntent(flags: CaptureFlags) {
  let shouldPreview = true;
  if (flags.noPreview) shouldPreview = false;
  if (flags.preview) shouldPreview = true;
  return shouldPreview;
}
