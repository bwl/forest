/**
 * TLDR Standard (v0.1) - Agent-First Command Metadata
 *
 * Minimal, parseable command documentation for AI agents.
 * Wire format: ASCII KEY: value pairs (uppercase keys, no blank lines)
 * Optional JSON mode via --tldr=json
 */

export type FlagType = 'STR' | 'BOOL' | 'INT' | 'FLOAT' | 'FILE' | 'LIST' | 'STDIN';

export interface TldrFlag {
  name: string;
  type: FlagType;
  default?: string | number | boolean | null;
  desc: string;
}

export interface CommandTldr {
  cmd: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  sideEffects: string;
  flags: TldrFlag[];
  examples: string[];
  related: string[];
  schemaJson?: string;
}

export interface GlobalTldr {
  name: string;
  version: string;
  summary: string;
  commands: string[];
  tldrCall: string;
}

/**
 * Format TLDR metadata as ASCII (KEY: value pairs)
 */
export function formatTldrAscii(data: GlobalTldr | CommandTldr): string {
  if ('commands' in data) {
    // Global index
    return [
      `NAME: ${data.name}`,
      `VERSION: ${data.version}`,
      `SUMMARY: ${data.summary}`,
      `COMMANDS: ${data.commands.join(',')}`,
      `TLDR_CALL: ${data.tldrCall}`,
    ].join('\n');
  }

  // Command-specific
  const lines: string[] = [
    `CMD: ${data.cmd}`,
    `PURPOSE: ${data.purpose}`,
    `INPUTS: ${data.inputs.join(',')}`,
    `OUTPUTS: ${data.outputs.join(',')}`,
    `SIDE_EFFECTS: ${data.sideEffects}`,
  ];

  // Format flags: --flag[=TYPE][=DEFAULT]|desc
  const flagStrings = data.flags.map((f) => {
    const defaultPart = f.default !== undefined && f.default !== null ? `=${f.default}` : '';
    return `--${f.name}=${f.type}${defaultPart}|${f.desc}`;
  });
  lines.push(`FLAGS: ${flagStrings.join(';')}`);

  lines.push(`EXAMPLES: ${data.examples.join('|')}`);
  lines.push(`RELATED: ${data.related.join(',')}`);

  if (data.schemaJson) {
    lines.push(`SCHEMA_JSON: ${data.schemaJson}`);
  }

  return lines.join('\n');
}

/**
 * Format TLDR metadata as JSON
 */
export function formatTldrJson(data: GlobalTldr | CommandTldr): string {
  if ('commands' in data) {
    return JSON.stringify(
      {
        NAME: data.name,
        VERSION: data.version,
        SUMMARY: data.summary,
        COMMANDS: data.commands,
        TLDR_CALL: data.tldrCall,
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      CMD: data.cmd,
      PURPOSE: data.purpose,
      INPUTS: data.inputs,
      OUTPUTS: data.outputs,
      SIDE_EFFECTS: data.sideEffects,
      FLAGS: data.flags.map((f) => ({
        name: f.name,
        type: f.type,
        default: f.default ?? null,
        desc: f.desc,
      })),
      EXAMPLES: data.examples,
      RELATED: data.related,
      ...(data.schemaJson ? { SCHEMA_JSON: data.schemaJson } : {}),
    },
    null,
    2,
  );
}

/**
 * Emit TLDR and exit process
 */
export function emitTldrAndExit(data: GlobalTldr | CommandTldr, jsonMode: boolean): never {
  const output = jsonMode ? formatTldrJson(data) : formatTldrAscii(data);
  console.log(output);
  process.exit(0);
}

/**
 * Global TLDR index for the Forest CLI
 */
export function getGlobalTldr(version: string): GlobalTldr {
  return {
    name: 'forest',
    version,
    summary: 'Graph-native knowledge base CLI',
    commands: [
      'help',
      'completions',
      'capture',
      'explore',
      'search',
      'stats',
      'health',
      'serve',
      'admin.recompute-embeddings',
      'version',
      'node.read',
      'node.edit',
      'node.delete',
      'node.link',
      'node',
      'edges.propose',
      'edges.promote',
      'edges.accept',
      'edges.reject',
      'edges.sweep',
      'edges.explain',
      'edges.undo',
      'edges',
      'tags.list',
      'tags.rename',
      'tags.stats',
      'tags',
      'export.graphviz',
      'export.json',
      'export',
    ],
    tldrCall: 'forest <command> --tldr',
  };
}

/**
 * Command-specific TLDR metadata registry
 */
export const COMMAND_TLDR: Record<string, CommandTldr> = {
  capture: {
    cmd: 'capture',
    purpose: 'Create a new note and optionally auto-link into the graph',
    inputs: ['ARGS(title,body,tags)', 'STDIN', 'FILE'],
    outputs: ['node record', 'edges summary', 'optional preview'],
    sideEffects: 'writes to SQLite DB,computes embeddings,creates/updates edges',
    flags: [
      { name: 'title', type: 'STR', desc: 'note title' },
      { name: 'body', type: 'STR', desc: 'note body' },
      { name: 'stdin', type: 'BOOL', default: false, desc: 'read entire stdin as body' },
      { name: 'file', type: 'FILE', desc: 'read body from file' },
      { name: 'tags', type: 'LIST', desc: 'comma-separated tags' },
      { name: 'no-preview', type: 'BOOL', default: false, desc: 'skip post-capture explore' },
      { name: 'no-auto-link', type: 'BOOL', default: false, desc: 'disable immediate link scoring' },
      {
        name: 'preview-suggestions-only',
        type: 'BOOL',
        default: false,
        desc: 'show suggestions only in preview',
      },
      { name: 'json', type: 'BOOL', default: false, desc: 'emit JSON output' },
    ],
    examples: [
      'forest capture --title "Named Idea" --body "Free-form text with #tags"',
      'forest capture --stdin < note.md',
      'forest capture --file captured.md --tags focus,ops',
      'forest capture --no-preview --json',
    ],
    related: ['explore', 'edges.propose', 'node.read'],
    schemaJson:
      'emits {"node":{"id":STR,"title":STR,"tags":[STR]},"links":{"accepted":INT,"suggested":INT},"suggestions":[{"id":STR,"score":FLOAT}]}',
  },

  explore: {
    cmd: 'explore',
    purpose: 'Interactive graph exploration via search/filter/navigation',
    inputs: ['ARGS(query)', 'STDIN'],
    outputs: ['node list', 'neighborhood graph', 'suggestions'],
    sideEffects: 'none (read-only)',
    flags: [
      { name: 'query', type: 'STR', desc: 'search query (title/tag/text match)' },
      { name: 'limit', type: 'INT', default: 15, desc: 'max neighbors per node' },
      { name: 'match-limit', type: 'INT', default: 10, desc: 'max search matches to show' },
      { name: 'depth', type: 'INT', default: 1, desc: 'neighborhood depth (1 or 2)' },
      { name: 'suggestions', type: 'BOOL', default: false, desc: 'include pending suggestions' },
      { name: 'long-ids', type: 'BOOL', default: false, desc: 'show full UUIDs' },
      { name: 'json', type: 'BOOL', default: false, desc: 'emit JSON output' },
    ],
    examples: [
      'forest explore',
      'forest explore "search term"',
      'forest explore --depth 2 --limit 20',
      'forest explore --suggestions --json',
    ],
    related: ['search', 'node.read', 'edges.propose'],
  },

  search: {
    cmd: 'search',
    purpose: 'Semantic search using embeddings',
    inputs: ['ARGS(query)', 'STDIN'],
    outputs: ['ranked node list with similarity scores'],
    sideEffects: 'none (read-only)',
    flags: [
      { name: 'limit', type: 'INT', default: 10, desc: 'max results to return' },
      { name: 'min-score', type: 'FLOAT', default: 0.0, desc: 'minimum similarity threshold' },
      { name: 'json', type: 'BOOL', default: false, desc: 'emit JSON output' },
    ],
    examples: [
      'forest search "machine learning patterns"',
      'forest search --limit 20 --min-score 0.3 "async architecture"',
      'forest search --json "knowledge graphs"',
    ],
    related: ['explore', 'capture'],
  },

  stats: {
    cmd: 'stats',
    purpose: 'Show graph statistics and health metrics',
    inputs: ['none'],
    outputs: ['node/edge counts', 'recent captures', 'top suggestions', 'high-degree nodes'],
    sideEffects: 'none (read-only)',
    flags: [{ name: 'json', type: 'BOOL', default: false, desc: 'emit JSON output' }],
    examples: ['forest stats', 'forest stats --json'],
    related: ['health', 'edges.propose'],
  },

  health: {
    cmd: 'health',
    purpose: 'System health check (DB, embeddings, graph integrity)',
    inputs: ['none'],
    outputs: ['health status', 'diagnostics', 'warnings'],
    sideEffects: 'none (read-only)',
    flags: [{ name: 'json', type: 'BOOL', default: false, desc: 'emit JSON output' }],
    examples: ['forest health', 'forest health --json'],
    related: ['stats', 'admin.recompute-embeddings'],
  },

  serve: {
    cmd: 'serve',
    purpose: 'Start REST API server with WebSocket event stream',
    inputs: ['ENV(FOREST_PORT,FOREST_HOST,FOREST_DB_PATH)'],
    outputs: ['HTTP server', 'WebSocket events'],
    sideEffects: 'binds to network port,serves REST API endpoints',
    flags: [
      { name: 'port', type: 'INT', default: 3000, desc: 'server port' },
      { name: 'host', type: 'STR', default: '::', desc: 'bind hostname (:: = dual-stack IPv4/IPv6)' },
    ],
    examples: [
      'forest serve',
      'forest serve --port 8080',
      'forest serve --host 0.0.0.0',
      'FOREST_PORT=3000 forest serve',
    ],
    related: ['health', 'stats'],
  },

  'admin.recompute-embeddings': {
    cmd: 'admin.recompute-embeddings',
    purpose: 'Recompute embeddings for all nodes and optionally rescore edges',
    inputs: ['none'],
    outputs: ['progress log', 'updated node/edge records'],
    sideEffects: 'updates all node embeddings,optionally updates all edge scores',
    flags: [
      { name: 'rescore', type: 'BOOL', default: false, desc: 'rescore all edges after recomputing embeddings' },
    ],
    examples: [
      'forest admin:recompute-embeddings',
      'forest admin:recompute-embeddings --rescore',
    ],
    related: ['health', 'edges.propose'],
  },

  version: {
    cmd: 'version',
    purpose: 'Display CLI version',
    inputs: ['none'],
    outputs: ['version string'],
    sideEffects: 'none',
    flags: [],
    examples: ['forest version'],
    related: ['health'],
  },

  'node.read': {
    cmd: 'node.read',
    purpose: 'Show the full content of a note',
    inputs: ['ARGS(id)'],
    outputs: ['node metadata', 'body text', 'edge summary'],
    sideEffects: 'none (read-only)',
    flags: [
      { name: 'meta', type: 'BOOL', default: false, desc: 'show metadata only (no body)' },
      { name: 'json', type: 'BOOL', default: false, desc: 'emit JSON output' },
      { name: 'long-ids', type: 'BOOL', default: false, desc: 'display full UUIDs' },
    ],
    examples: [
      'forest node read abc123',
      'forest node read abc123 --meta',
      'forest node read abc123 --json',
    ],
    related: ['explore', 'node.edit', 'capture'],
  },

  'node.edit': {
    cmd: 'node.edit',
    purpose: 'Edit an existing note and optionally rescore links',
    inputs: ['ARGS(id,title,body,tags)', 'STDIN', 'FILE'],
    outputs: ['updated node record', 'rescore summary'],
    sideEffects: 'updates node in DB,recomputes embeddings,optionally rescores edges',
    flags: [
      { name: 'title', type: 'STR', desc: 'new title' },
      { name: 'body', type: 'STR', desc: 'new body content' },
      { name: 'file', type: 'FILE', desc: 'read new body from file' },
      { name: 'stdin', type: 'BOOL', default: false, desc: 'read new body from stdin' },
      { name: 'tags', type: 'LIST', desc: 'comma-separated tags (overrides auto-detected)' },
      { name: 'no-auto-link', type: 'BOOL', default: false, desc: 'skip rescoring edges' },
    ],
    examples: [
      'forest node edit abc123 --title "New Title"',
      'forest node edit abc123 --stdin < updated.md',
      'forest node edit abc123 --tags focus,ops --no-auto-link',
    ],
    related: ['node.read', 'capture', 'edges.propose'],
  },

  'node.delete': {
    cmd: 'node.delete',
    purpose: 'Delete a note and its edges',
    inputs: ['ARGS(id)'],
    outputs: ['deletion confirmation'],
    sideEffects: 'removes node and all connected edges from DB',
    flags: [
      { name: 'force', type: 'BOOL', default: false, desc: 'skip confirmation prompt' },
    ],
    examples: [
      'forest node delete abc123',
      'forest node delete abc123 --force',
    ],
    related: ['node.read', 'edges'],
  },

  'node.link': {
    cmd: 'node.link',
    purpose: 'Manually create an edge between two notes',
    inputs: ['ARGS(a,b)'],
    outputs: ['edge record with score'],
    sideEffects: 'creates/updates edge in DB',
    flags: [
      { name: 'score', type: 'FLOAT', desc: 'override computed score' },
      { name: 'suggest', type: 'BOOL', default: false, desc: 'create as suggestion (not accepted)' },
      { name: 'explain', type: 'BOOL', default: false, desc: 'print scoring components' },
    ],
    examples: [
      'forest node link abc123 def456',
      'forest node link abc123 def456 --score 0.8',
      'forest node link abc123 def456 --suggest --explain',
    ],
    related: ['edges.accept', 'edges.explain', 'node.read'],
  },

  node: {
    cmd: 'node',
    purpose: 'View node dashboard (total count, recent nodes, quick actions)',
    inputs: ['none'],
    outputs: ['dashboard summary'],
    sideEffects: 'none (read-only)',
    flags: [],
    examples: ['forest node'],
    related: ['node.read', 'node.edit', 'explore'],
  },

  'edges.propose': {
    cmd: 'edges.propose',
    purpose: 'List suggested links ordered by score',
    inputs: ['none'],
    outputs: ['ranked suggestion list with scores'],
    sideEffects: 'none (read-only)',
    flags: [
      { name: 'limit', type: 'INT', default: 10, desc: 'max suggestions to show' },
      { name: 'long-ids', type: 'BOOL', default: false, desc: 'display full UUIDs' },
      { name: 'json', type: 'BOOL', default: false, desc: 'emit JSON output' },
    ],
    examples: [
      'forest edges propose',
      'forest edges propose --limit 20',
      'forest edges propose --json',
    ],
    related: ['edges.accept', 'edges.promote', 'edges.explain'],
  },

  'edges.promote': {
    cmd: 'edges.promote',
    purpose: 'Promote suggestions above a score threshold to accepted edges',
    inputs: ['none'],
    outputs: ['promotion count'],
    sideEffects: 'updates edge status from suggested to accepted in DB',
    flags: [
      { name: 'min-score', type: 'FLOAT', default: 0.5, desc: 'minimum score to accept' },
    ],
    examples: [
      'forest edges promote',
      'forest edges promote --min-score 0.6',
    ],
    related: ['edges.propose', 'edges.accept'],
  },

  'edges.accept': {
    cmd: 'edges.accept',
    purpose: 'Promote a single suggestion by reference (index/code/ID)',
    inputs: ['ARGS(ref)'],
    outputs: ['acceptance confirmation'],
    sideEffects: 'updates edge status to accepted,logs edge event for undo',
    flags: [],
    examples: [
      'forest edges accept 1',
      'forest edges accept 0L5a',
      'forest edges accept abc123::def456',
    ],
    related: ['edges.propose', 'edges.undo', 'edges.reject'],
  },

  'edges.reject': {
    cmd: 'edges.reject',
    purpose: 'Reject and remove a suggestion by reference',
    inputs: ['ARGS(ref)'],
    outputs: ['rejection confirmation'],
    sideEffects: 'deletes edge from DB,logs edge event for undo',
    flags: [],
    examples: [
      'forest edges reject 1',
      'forest edges reject 0L5a',
      'forest edges reject abc123::def456',
    ],
    related: ['edges.propose', 'edges.undo', 'edges.sweep'],
  },

  'edges.sweep': {
    cmd: 'edges.sweep',
    purpose: 'Bulk-reject suggestions by index range or score threshold',
    inputs: ['none'],
    outputs: ['rejection count'],
    sideEffects: 'deletes multiple edges from DB',
    flags: [
      { name: 'range', type: 'STR', desc: 'comma-separated indexes or ranges (e.g., 1-10,15)' },
      { name: 'max-score', type: 'FLOAT', desc: 'reject suggestions at or below this score' },
    ],
    examples: [
      'forest edges sweep --range 1-5',
      'forest edges sweep --max-score 0.3',
      'forest edges sweep --range 1-10 --max-score 0.25',
    ],
    related: ['edges.reject', 'edges.propose'],
  },

  'edges.explain': {
    cmd: 'edges.explain',
    purpose: 'Explain scoring components for a link',
    inputs: ['ARGS(ref)'],
    outputs: ['score breakdown (token,embedding,tag,title similarity)'],
    sideEffects: 'none (read-only)',
    flags: [
      { name: 'json', type: 'BOOL', default: false, desc: 'emit JSON output' },
    ],
    examples: [
      'forest edges explain 0L5a',
      'forest edges explain abc123::def456 --json',
    ],
    related: ['edges.propose', 'node.link'],
  },

  'edges.undo': {
    cmd: 'edges.undo',
    purpose: 'Undo the last accept/reject action for a link',
    inputs: ['ARGS(ref)'],
    outputs: ['undo confirmation'],
    sideEffects: 'restores edge to previous status in DB',
    flags: [],
    examples: [
      'forest edges undo 0L5a',
      'forest edges undo abc123::def456',
    ],
    related: ['edges.accept', 'edges.reject'],
  },

  edges: {
    cmd: 'edges',
    purpose: 'View recent accepted edges (base command)',
    inputs: ['none'],
    outputs: ['recent edge list with scores'],
    sideEffects: 'none (read-only)',
    flags: [
      { name: 'limit', type: 'INT', default: 10, desc: 'max edges to show' },
      { name: 'long-ids', type: 'BOOL', default: false, desc: 'display full UUIDs' },
      { name: 'json', type: 'BOOL', default: false, desc: 'emit JSON output' },
    ],
    examples: [
      'forest edges',
      'forest edges --limit 20',
      'forest edges --json',
    ],
    related: ['edges.propose', 'node.link'],
  },

  'tags.list': {
    cmd: 'tags.list',
    purpose: 'List tags with usage counts',
    inputs: ['none'],
    outputs: ['tag list with counts'],
    sideEffects: 'none (read-only)',
    flags: [
      { name: 'top', type: 'INT', desc: 'limit to top N tags' },
      { name: 'json', type: 'BOOL', default: false, desc: 'emit JSON output' },
    ],
    examples: [
      'forest tags list',
      'forest tags list --top 20',
      'forest tags list --json',
    ],
    related: ['tags.stats', 'tags.rename'],
  },

  'tags.rename': {
    cmd: 'tags.rename',
    purpose: 'Rename a tag across all notes',
    inputs: ['ARGS(old,new)'],
    outputs: ['rename count'],
    sideEffects: 'updates tag field on all affected nodes in DB',
    flags: [],
    examples: [
      'forest tags rename old-tag new-tag',
    ],
    related: ['tags.list', 'tags.stats'],
  },

  'tags.stats': {
    cmd: 'tags.stats',
    purpose: 'Show tag co-occurrence statistics',
    inputs: ['none'],
    outputs: ['top tags', 'top tag pairs', 'optional focused co-occurrence'],
    sideEffects: 'none (read-only)',
    flags: [
      { name: 'tag', type: 'STR', desc: 'focus on a single tag and show co-occurring tags' },
      { name: 'min-count', type: 'INT', default: 0, desc: 'only show items with count >= N' },
      { name: 'top', type: 'INT', default: 10, desc: 'top N results to show' },
      { name: 'json', type: 'BOOL', default: false, desc: 'emit JSON output' },
    ],
    examples: [
      'forest tags stats',
      'forest tags stats --tag focus',
      'forest tags stats --min-count 3 --top 15 --json',
    ],
    related: ['tags.list', 'explore'],
  },

  tags: {
    cmd: 'tags',
    purpose: 'View tag dashboard (total count, top tags, quick actions)',
    inputs: ['none'],
    outputs: ['dashboard summary'],
    sideEffects: 'none (read-only)',
    flags: [],
    examples: ['forest tags'],
    related: ['tags.list', 'tags.stats', 'tags.rename'],
  },

  'export.graphviz': {
    cmd: 'export.graphviz',
    purpose: 'Export graph as DOT format (Graphviz)',
    inputs: ['none'],
    outputs: ['DOT graph file'],
    sideEffects: 'writes to stdout or file',
    flags: [],
    examples: [
      'forest export graphviz > graph.dot',
      'forest export graphviz | dot -Tpng > graph.png',
    ],
    related: ['export.json', 'stats'],
  },

  'export.json': {
    cmd: 'export.json',
    purpose: 'Export entire graph as JSON',
    inputs: ['none'],
    outputs: ['JSON graph structure (nodes + edges)'],
    sideEffects: 'writes to stdout',
    flags: [],
    examples: [
      'forest export json > export.json',
    ],
    related: ['export.graphviz', 'stats'],
  },

  export: {
    cmd: 'export',
    purpose: 'Export graph data (base command, delegates to subcommands)',
    inputs: ['none'],
    outputs: ['help text'],
    sideEffects: 'none',
    flags: [],
    examples: ['forest export graphviz', 'forest export json'],
    related: ['stats', 'health'],
  },
};
