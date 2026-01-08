import fs from 'fs';
import path from 'path';

import { listEdges, listNodes } from '../../lib/db.js';
import { buildNeighborhoodPayload, fetchSuggestionsForNode, selectNode } from '../shared/explore.js';
import { DEFAULT_NEIGHBORHOOD_LIMIT, escapeLabel, formatId, handleError } from '../shared/utils.js';
import { getVersion } from './version.js';
import { COMMAND_TLDR, emitTldrAndExit } from '../tldr.js';

import type { HandlerContext } from '@clerc/core';

type ClercModule = typeof import('clerc');
type ClercInstance = ReturnType<ClercModule['Clerc']['create']>;

type ExportGraphvizFlags = {
  id?: string;
  depth?: number;
  limit?: number;
  includeSuggestions?: boolean;
  file?: string;
  tldr?: string;
};

type ExportJsonFlags = {
  file?: string;
  body?: boolean;
  edges?: boolean;
  tldr?: string;
};

export function registerExportCommands(cli: ClercInstance, clerc: ClercModule) {
  const graphvizCommand = clerc.defineCommand(
    {
      name: 'export graphviz',
      description: 'Export a Graphviz DOT for a node neighborhood',
      flags: {
        id: {
          type: String,
          description: 'Center node id or short id',
        },
        depth: {
          type: Number,
          description: 'Neighborhood depth',
          default: 1,
          alias: 'd',
        },
        limit: {
          type: Number,
          description: 'Maximum nodes in neighborhood',
          default: DEFAULT_NEIGHBORHOOD_LIMIT,
          alias: 'l',
        },
        includeSuggestions: {
          type: Boolean,
          description: 'Include suggestion edges from the center node',
        },
        file: {
          type: String,
          description: 'Write DOT output to a file instead of stdout',
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: ExportGraphvizFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['export.graphviz'], getVersion());
        }
        await runExportGraphviz(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(graphvizCommand);

  const jsonCommand = clerc.defineCommand(
    {
      name: 'export json',
      description: 'Export the full database as JSON',
      flags: {
        file: {
          type: String,
          description: 'Write JSON to a file instead of stdout',
        },
        body: {
          type: Boolean,
          description: 'Include note bodies in export (use --no-body to omit)',
          default: true,
        },
        edges: {
          type: Boolean,
          description: 'Include edges in export (use --no-edges to omit)',
          default: true,
        },
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async ({ flags }: { flags: ExportJsonFlags }) => {
      try {
        // Handle TLDR request first
        if (flags.tldr !== undefined) {
          const jsonMode = flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR['export.json'], getVersion());
        }
        await runExportJson(flags);
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(jsonCommand);

  const baseCommand = clerc.defineCommand(
    {
      name: 'export',
      description: 'Export graph data',
      help: {
        notes: [
          'Subcommands:',
          '  graphviz  Export a Graphviz DOT for a node neighborhood',
          '  json      Export the entire database as JSON',
          '',
          'Use `forest export <subcommand> --help` for flag details.',
        ],
        examples: [
          ['$ forest export graphviz --id abc123', 'Render a DOT graph around a node'],
          ['$ forest export json --no-body', 'Export metadata without note bodies'],
        ],
      },
      flags: {
        tldr: {
          type: String,
          description: 'Output command metadata for agent consumption (--tldr or --tldr=json)',
        },
      },
    },
    async (ctx: HandlerContext) => {
      try {
        // Handle TLDR request first
        if ((ctx as any).flags?.tldr !== undefined) {
          const jsonMode = (ctx as any).flags.tldr === 'json';
          emitTldrAndExit(COMMAND_TLDR.export, getVersion());
        }
        await runExportDashboard();
      } catch (error) {
        handleError(error);
      }
    },
  );
  cli.command(baseCommand);
}

async function runExportDashboard() {
  const nodes = await listNodes();
  const edges = await listEdges('all');

  console.log('');
  console.log(`Your graph: ${nodes.length} nodes, ${edges.length} edges`);
  console.log('');
  console.log('Available formats:');
  console.log('');
  console.log('  JSON       Export full database as structured JSON');
  console.log('  Graphviz   Export node neighborhood as DOT graph');
  console.log('');
  console.log('Quick actions:');
  console.log('  forest export json                    Export everything');
  console.log('  forest export json --no-body          Export without note bodies');
  console.log('  forest export graphviz --id <id>      Export neighborhood graph');
  console.log('');
}

async function runExportGraphviz(flags: ExportGraphvizFlags) {
  if (!flags.id || typeof flags.id !== 'string' || flags.id.trim().length === 0) {
    console.error('✖ Provide --id with the node identifier to export.');
    process.exitCode = 1;
    return;
  }

  const selection = await selectNode({ id: flags.id });
  const center = selection.selected.node;
  const depth =
    typeof flags.depth === 'number' && Number.isFinite(flags.depth) && flags.depth > 0
      ? Math.floor(flags.depth)
      : 1;
  const limit =
    typeof flags.limit === 'number' && Number.isFinite(flags.limit) && flags.limit > 0
      ? Math.floor(flags.limit)
      : DEFAULT_NEIGHBORHOOD_LIMIT;

  const { payload } = await buildNeighborhoodPayload(center.id, depth, limit);
  const nodes = await listNodes();
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const suggestions = flags.includeSuggestions ? await fetchSuggestionsForNode(center.id) : [];

  const lines: string[] = [];
  lines.push('graph forest {');
  lines.push('  rankdir=LR;');
  lines.push('  node [shape=box, fontname="Helvetica"];');

  const defined = new Set<string>();
  const ensureNodeDefined = (id: string) => {
    if (defined.has(id)) return;
    const title = nodeMap.get(id)?.title ?? id;
    lines.push(`  "${id}" [label="${formatId(id)} ${escapeLabel(title)}"];`);
    defined.add(id);
  };

  payload.nodes.forEach((node) => ensureNodeDefined(node.id));
  payload.edges.forEach((edge) => {
    ensureNodeDefined(edge.source);
    ensureNodeDefined(edge.target);
    lines.push(`  "${edge.source}" -- "${edge.target}" [label="${edge.score.toFixed(3)}"];`);
  });

  for (const suggestion of suggestions) {
    ensureNodeDefined(center.id);
    ensureNodeDefined(suggestion.otherId);
    lines.push(
      `  "${center.id}" -- "${suggestion.otherId}" [style=dotted, color=gray50, label="${suggestion.score.toFixed(
        3,
      )}"];`,
    );
  }

  lines.push('}');

  const dot = lines.join('\n');
  if (typeof flags.file === 'string' && flags.file.trim().length > 0) {
    const filePath = path.resolve(flags.file);
    fs.writeFileSync(filePath, dot, 'utf-8');
  } else {
    console.log(dot);
  }
}

async function runExportJson(flags: ExportJsonFlags) {
  const nodes = await listNodes();
  const edges = await listEdges('all');

  const includeBody = flags.body !== false;
  const includeEdges = flags.edges !== false;

  const payload = {
    nodes: nodes.map((node) => ({
      id: node.id,
      title: node.title,
      tags: node.tags,
      body: includeBody ? node.body : undefined,
      tokenCounts: node.tokenCounts,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    })),
    edges: includeEdges
      ? edges.map((edge) => ({
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          status: edge.status,
          score: edge.score,
          metadata: edge.metadata,
          createdAt: edge.createdAt,
          updatedAt: edge.updatedAt,
        }))
      : [],
  };

  const json = JSON.stringify(payload, null, 2);

  if (typeof flags.file === 'string' && flags.file.trim().length > 0) {
    const filePath = path.resolve(flags.file);
    fs.writeFileSync(filePath, json, 'utf-8');
  } else {
    console.log(json);
  }
}
