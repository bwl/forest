import { formatId, handleError } from '../shared/utils';
import { getVersion } from './version';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr';
import { getBackend } from '../shared/remote';
import type { ContextResultRemote, ContextNodeRemote, ContextEdgeRemote } from '../../lib/client';

type ClercModule = typeof import('clerc');

type ContextFlags = {
  tag?: string;
  query?: string;
  budget?: number;
  json?: boolean;
  tldr?: string;
};

export function createContextCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'context',
      description: 'Show cluster topology around a topic (agent-consumable)',
      flags: {
        tag: {
          type: String,
          alias: 't',
          description: 'Seed cluster by tag (e.g. project:kingdom)',
        },
        query: {
          type: String,
          alias: 'q',
          description: 'Seed by semantic search query',
        },
        budget: {
          type: Number,
          alias: 'b',
          description: 'Token budget for output',
          default: 8000,
        },
        json: {
          type: Boolean,
          description: 'JSON output instead of XML',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption',
        },
      },
    },
    async ({ flags }) => {
      try {
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.context, getVersion(), jsonMode);
        }
        await runContext(flags as ContextFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runContext(flags: ContextFlags) {
  const budget =
    typeof flags.budget === 'number' && Number.isFinite(flags.budget) && flags.budget > 0
      ? Math.floor(flags.budget)
      : 8000;

  const backend = getBackend();
  const result = await backend.getContext({
    tag: flags.tag,
    query: flags.query,
    budget,
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // XML output (default)
  console.log(serializeContextXml(result));
}

// ── XML Serializer ───────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function serializeContextXml(result: ContextResultRemote): string {
  const lines: string[] = [];
  const s = result.summary;

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<forest_context version="1.0" generated="${new Date().toISOString()}">`);

  // Summary
  lines.push('  <summary>');
  lines.push(`    <seed_tags>${escapeXml(s.seedTags.join(', '))}</seed_tags>`);
  lines.push(`    <seed_query>${escapeXml(s.seedQuery)}</seed_query>`);
  lines.push(`    <total_nodes>${s.totalNodes}</total_nodes>`);
  lines.push(`    <hub_count>${s.hubCount}</hub_count>`);
  lines.push(`    <bridge_count>${s.bridgeCount}</bridge_count>`);
  lines.push(`    <periphery_count>${s.peripheryCount}</periphery_count>`);
  lines.push(`    <internal_edges>${s.internalEdges}</internal_edges>`);
  lines.push(`    <external_edges>${s.externalEdges}</external_edges>`);
  lines.push(`    <dominant_tags>${escapeXml(s.dominantTags.join(', '))}</dominant_tags>`);
  lines.push(`    <date_range>${escapeXml(s.dateRange)}</date_range>`);
  lines.push(`    <budget_tokens>${s.budgetTokens}</budget_tokens>`);
  lines.push(`    <used_tokens>${s.usedTokens}</used_tokens>`);
  lines.push('  </summary>');

  // Hubs
  lines.push('');
  lines.push('  <hubs>');
  for (const node of result.hubs) {
    lines.push(...serializeNode(node, '    '));
  }
  lines.push('  </hubs>');

  // Bridges
  lines.push('');
  lines.push('  <bridges>');
  for (const node of result.bridges) {
    lines.push(...serializeNode(node, '    '));
  }
  lines.push('  </bridges>');

  // Periphery
  lines.push('');
  lines.push('  <periphery>');
  if (result.periphery.length === 0 && s.peripheryCount > 0) {
    lines.push(`    <!-- ${s.peripheryCount} peripheral nodes collapsed to fit budget -->`);
  } else {
    for (const node of result.periphery) {
      lines.push(...serializeNode(node, '    '));
    }
  }
  lines.push('  </periphery>');

  // Edges
  lines.push('');
  lines.push('  <edges type="structural">');
  for (const edge of result.edges) {
    const parts = [
      `source="${formatId(edge.sourceId)}"`,
      `source_title="${escapeXml(edge.sourceTitle)}"`,
      `target="${formatId(edge.targetId)}"`,
      `target_title="${escapeXml(edge.targetTitle)}"`,
      `score="${edge.score.toFixed(2)}"`,
    ];
    if (edge.semanticScore !== null) {
      parts.push(`semantic="${edge.semanticScore.toFixed(2)}"`);
    }
    if (edge.tagScore !== null) {
      parts.push(`tag="${edge.tagScore.toFixed(2)}"`);
    }
    lines.push(`    <edge ${parts.join(' ')} />`);
  }
  lines.push('  </edges>');

  lines.push('</forest_context>');

  return lines.join('\n');
}

function serializeNode(node: ContextNodeRemote, indent: string): string[] {
  const lines: string[] = [];
  const roleStr = node.roles.join(',');

  lines.push(
    `${indent}<node id="${node.shortId}" title="${escapeXml(node.title)}" role="${roleStr}" pagerank="${node.pagerank.toFixed(3)}">`,
  );
  lines.push(`${indent}  <tags>${escapeXml(node.tags.join(', '))}</tags>`);
  lines.push(
    `${indent}  <degree internal="${node.degree.internal}" external="${node.degree.external}" />`,
  );

  if (node.bodyPreview) {
    lines.push(`${indent}  <body_preview>${escapeXml(node.bodyPreview)}</body_preview>`);
  }

  if (node.bridgeTo && node.bridgeTo.length > 0) {
    lines.push(`${indent}  <bridge_to>${escapeXml(node.bridgeTo.join(', '))}</bridge_to>`);
  }

  lines.push(`${indent}</node>`);
  return lines;
}
