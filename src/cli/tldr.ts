/**
 * TLDR Standard (v0.2) - Agent-First Command Metadata
 *
 * NDJSON format with metadata headers and abbreviated keys
 * Wire format: tool delimiter + metadata header + JSON objects (one per line)
 */

// Forest's condensed keymap - only the 12 keys we actually use
export const FOREST_KEYMAP = {
  cmd: 'command',
  p: 'purpose',
  in: 'inputs',
  out: 'outputs',
  fx: 'side_effects',
  fl: 'flags',
  n: 'name',
  t: 'type',
  d: 'default',
  desc: 'description',
  ex: 'examples',
  rel: 'related',
};

export type FlagType = 'str' | 'bool' | 'int' | 'float' | 'file' | 'list';

export interface TldrFlag {
  n: string;           // name
  t: FlagType;         // type
  d?: string | number | boolean | null;  // default
  desc: string;        // description
}

export interface CommandTldr {
  cmd: string;
  p: string;           // purpose
  in: string[];        // inputs
  out: string[];       // outputs
  fx: string;          // side_effects
  fl: TldrFlag[];      // flags
  ex: string[];        // examples
  rel: string[];       // related
}

export interface GlobalTldr {
  tool: string;
  version: string;
  summary: string;
  commands: string[];
}

/**
 * Format keymap for metadata header
 */
function formatKeymap(): string {
  const pairs = Object.entries(FOREST_KEYMAP).map(([k, v]) => `${k}:${v}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Format TLDR metadata as NDJSON v0.2
 */
export function formatTldrV02(data: GlobalTldr | CommandTldr, version: string): string {
  const lines: string[] = [];

  if ('tool' in data) {
    // Global index
    lines.push('--- tool: forest ---');
    lines.push(`# meta: tool=forest, version=${version}, keymap=${formatKeymap()}`);

    // Global metadata object
    lines.push(JSON.stringify({
      tool: data.tool,
      version: data.version,
      summary: data.summary,
      commands: data.commands,
    }));
  } else {
    // Command-specific
    lines.push('--- tool: forest ---');
    lines.push(`# meta: tool=forest, version=${version}, keymap=${formatKeymap()}`);

    // Command object with abbreviated keys
    lines.push(JSON.stringify(data));
  }

  return lines.join('\n');
}

/**
 * Format all commands as NDJSON v0.2
 * Outputs tool delimiter, metadata header, and all command objects
 */
export function formatAllCommandsTldr(version: string): string {
  const lines: string[] = [];

  // Tool delimiter and metadata header (once)
  lines.push('--- tool: forest ---');
  lines.push(`# meta: tool=forest, version=${version}, keymap=${formatKeymap()}`);

  // All command objects as NDJSON (one per line)
  for (const [_key, commandData] of Object.entries(COMMAND_TLDR)) {
    lines.push(JSON.stringify(commandData));
  }

  return lines.join('\n');
}

/**
 * Emit TLDR and exit process
 */
export function emitTldrAndExit(data: GlobalTldr | CommandTldr, version: string): never {
  const output = formatTldrV02(data, version);
  console.log(output);
  process.exit(0);
}

/**
 * Global TLDR index for the Forest CLI
 */
export function getGlobalTldr(version: string): GlobalTldr {
  return {
    tool: 'forest',
    version,
    summary: 'Graph-native knowledge base CLI with semantic embeddings and auto-linking',
    commands: [
      'help',
      'completions',
      'capture',
      'write',
      'explore',
      'search',
      'stats',
      'health',
      'serve',
      'config',
      'admin.recompute-embeddings',
      'admin.retag-all',
      'version',
      'node.read',
      'node.edit',
      'node.refresh',
      'node.delete',
      'node.link',
      'node.recent',
      'node.import',
      'node.synthesize',
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
  };
}

/**
 * Command-specific TLDR metadata registry
 */
export const COMMAND_TLDR: Record<string, CommandTldr> = {
  capture: {
    cmd: 'capture',
    p: 'Create a new note and optionally auto-link into the graph',
    in: ['args', 'stdin', 'file'],
    out: ['node_record', 'edges_summary', 'preview'],
    fx: 'db:write,compute:embedding',
    fl: [
      { n: 'title', t: 'str', desc: 'note title' },
      { n: 'body', t: 'str', desc: 'note body' },
      { n: 'stdin', t: 'bool', d: false, desc: 'read entire stdin as body' },
      { n: 'file', t: 'file', desc: 'read body from file' },
      { n: 'tags', t: 'list', desc: 'comma-separated tags' },
      { n: 'no-preview', t: 'bool', d: false, desc: 'skip post-capture explore' },
      { n: 'no-auto-link', t: 'bool', d: false, desc: 'disable immediate link scoring' },
      { n: 'preview-suggestions-only', t: 'bool', d: false, desc: 'show suggestions only in preview' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest capture --title "Named Idea" --body "Free-form text with #tags"',
      'forest capture --stdin < note.md',
      'forest capture --file captured.md --tags focus,ops',
      'forest capture --no-preview --json',
    ],
    rel: ['explore', 'edges.propose', 'node.read'],
  },

  explore: {
    cmd: 'explore',
    p: 'Graph navigation around a specific node',
    in: ['args'],
    out: ['node_list', 'neighborhood_graph', 'suggestions'],
    fx: 'none',
    fl: [
      { n: 'id', t: 'str', desc: 'node id or short id (positional or flag)' },
      { n: 'title', t: 'str', desc: 'exact title of the node to open' },
      { n: 'depth', t: 'int', d: 1, desc: 'neighborhood depth (1 or 2)' },
      { n: 'limit', t: 'int', d: 25, desc: 'max neighbors to render' },
      { n: 'include-suggestions', t: 'bool', d: false, desc: 'show suggested edges from the focus node' },
      { n: 'long-ids', t: 'bool', d: false, desc: 'show full UUIDs' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest explore 7fa7acb2',
      'forest explore --title "Graph architecture notes"',
      'forest explore --include-suggestions --depth 2',
    ],
    rel: ['search', 'node.read', 'edges.propose'],
  },

  search: {
    cmd: 'search',
    p: 'Semantic search or metadata filtering for notes',
    in: ['args'],
    out: ['ranked_node_list'],
    fx: 'none',
    fl: [
      { n: 'query', t: 'str', desc: 'semantic embedding query (positional or --query)' },
      { n: 'mode', t: 'str', d: 'semantic', desc: 'semantic|metadata search strategy' },
      { n: 'limit', t: 'int', d: 20, desc: 'max results to return' },
      { n: 'min-score', t: 'float', d: 0.0, desc: 'minimum similarity threshold (semantic only)' },
      { n: 'tags', t: 'list', desc: 'require all tags (comma-separated)' },
      { n: 'any-tag', t: 'list', desc: 'match any of these tags (metadata)' },
      { n: 'id', t: 'str', desc: 'match a specific node id or short id (metadata)' },
      { n: 'title', t: 'str', desc: 'match an exact title (metadata)' },
      { n: 'term', t: 'str', desc: 'metadata keyword search across title/tags/body' },
      { n: 'since', t: 'str', desc: 'only include notes updated after this date (metadata)' },
      { n: 'until', t: 'str', desc: 'only include notes updated before this date (metadata)' },
      { n: 'sort', t: 'str', d: 'score', desc: 'metadata sort: score|recent|degree' },
      { n: 'show-chunks', t: 'bool', d: false, desc: 'include document chunks in metadata mode' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest search "machine learning patterns"',
      'forest search --mode metadata --term "knowledge graph" --since 2024-01-01',
      'forest search --mode metadata --tags research,ml --any-tag embeddings,metrics',
    ],
    rel: ['explore', 'capture'],
  },

  stats: {
    cmd: 'stats',
    p: 'Show graph statistics and health metrics',
    in: [],
    out: ['node_counts', 'edge_counts', 'recent_captures', 'top_suggestions'],
    fx: 'none',
    fl: [
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: ['forest stats', 'forest stats --json'],
    rel: ['health', 'edges.propose'],
  },

  health: {
    cmd: 'health',
    p: 'System health check (DB, embeddings, graph integrity)',
    in: [],
    out: ['health_status', 'diagnostics', 'warnings'],
    fx: 'none',
    fl: [
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: ['forest health', 'forest health --json'],
    rel: ['stats', 'admin.recompute-embeddings'],
  },

  serve: {
    cmd: 'serve',
    p: 'Start REST API server with WebSocket event stream',
    in: ['env'],
    out: ['http_server', 'websocket_events'],
    fx: 'network:bind',
    fl: [
      { n: 'port', t: 'int', d: 3000, desc: 'server port' },
      { n: 'host', t: 'str', d: '::', desc: 'bind hostname (:: = dual-stack IPv4/IPv6)' },
    ],
    ex: [
      'forest serve',
      'forest serve --port 8080',
      'forest serve --host 0.0.0.0',
      'FOREST_PORT=3000 forest serve',
    ],
    rel: ['health', 'stats'],
  },

  config: {
    cmd: 'config',
    p: 'Configure Forest settings interactively (embedding provider, API keys, models)',
    in: ['args', 'interactive'],
    out: ['config_file', 'confirmation'],
    fx: 'filesystem:write',
    fl: [
      { n: 'show', t: 'bool', d: false, desc: 'show current configuration' },
      { n: 'reset', t: 'bool', d: false, desc: 'reset config to defaults' },
    ],
    ex: [
      'forest config',
      'forest config --show',
      'forest config --reset',
      'forest config embedProvider openai',
    ],
    rel: ['admin.recompute-embeddings', 'capture'],
  },

  'admin.recompute-embeddings': {
    cmd: 'admin.recompute-embeddings',
    p: 'Recompute embeddings for all nodes and optionally rescore edges',
    in: [],
    out: ['progress_log', 'updated_records'],
    fx: 'db:write,compute:embedding',
    fl: [
      { n: 'rescore', t: 'bool', d: false, desc: 'rescore all edges after recomputing embeddings' },
    ],
    ex: [
      'forest admin:recompute-embeddings',
      'forest admin:recompute-embeddings --rescore',
    ],
    rel: ['health', 'edges.propose'],
  },

  'admin.retag-all': {
    cmd: 'admin.retag-all',
    p: 'Regenerate tags for all nodes using current tagging method (LLM or lexical)',
    in: [],
    out: ['progress_log', 'updated_records', 'cost_estimate'],
    fx: 'db:write,network:api_call',
    fl: [
      { n: 'dry-run', t: 'bool', d: false, desc: 'preview changes without saving' },
      { n: 'limit', t: 'int', desc: 'only retag first N nodes (for testing)' },
      { n: 'skip-unchanged', t: 'bool', d: false, desc: 'skip nodes where tags would not change' },
      { n: 'force', t: 'bool', d: false, desc: 'retag even if node has explicit #hashtags' },
    ],
    ex: [
      'forest admin:retag-all --dry-run',
      'forest admin:retag-all --limit 10',
      'forest admin:retag-all --skip-unchanged',
    ],
    rel: ['config', 'capture', 'tags.list'],
  },

  version: {
    cmd: 'version',
    p: 'Display CLI version',
    in: [],
    out: ['version_string'],
    fx: 'none',
    fl: [],
    ex: ['forest version'],
    rel: ['health'],
  },

  'node.read': {
    cmd: 'node.read',
    p: 'Show the full content of a note',
    in: ['args'],
    out: ['node_metadata', 'body_text', 'edge_summary'],
    fx: 'none',
    fl: [
      { n: 'meta', t: 'bool', d: false, desc: 'show metadata only (no body)' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
      { n: 'long-ids', t: 'bool', d: false, desc: 'display full UUIDs' },
      { n: 'raw', t: 'bool', d: false, desc: 'output only raw markdown body (for piping)' },
    ],
    ex: [
      'forest node read abc123',
      'forest node read abc123 --meta',
      'forest node read abc123 --json',
      'forest node read abc123 --raw | glow',
    ],
    rel: ['explore', 'node.edit', 'node.refresh', 'capture'],
  },

  'node.edit': {
    cmd: 'node.edit',
    p: 'Open an existing note in your editor and optionally rescore links',
    in: ['args'],
    out: ['updated_record', 'rescore_summary'],
    fx: 'db:write,compute:embedding',
    fl: [
      { n: 'editor', t: 'str', desc: 'override editor command' },
      { n: 'no-auto-link', t: 'bool', d: false, desc: 'skip rescoring edges' },
    ],
    ex: [
      'forest node edit abc123',
      'forest node edit abc123 --editor "code --wait"',
      'forest node edit abc123 --no-auto-link',
    ],
    rel: ['node.read', 'node.refresh', 'capture', 'edges.propose'],
  },

  'node.refresh': {
    cmd: 'node.refresh',
    p: 'Update fields from flags or files and rescore links',
    in: ['args', 'stdin', 'file'],
    out: ['updated_record', 'rescore_summary'],
    fx: 'db:write,compute:embedding',
    fl: [
      { n: 'title', t: 'str', desc: 'new title' },
      { n: 'body', t: 'str', desc: 'new body content' },
      { n: 'file', t: 'file', desc: 'read new body from file' },
      { n: 'stdin', t: 'bool', d: false, desc: 'read new body from stdin' },
      { n: 'tags', t: 'list', desc: 'comma-separated tags (overrides auto-detected)' },
      { n: 'no-auto-link', t: 'bool', d: false, desc: 'skip rescoring edges' },
    ],
    ex: [
      'forest node refresh abc123 --title "New Title"',
      'forest node refresh abc123 --stdin < updated.md',
      'forest node refresh abc123 --tags focus,ops --no-auto-link',
    ],
    rel: ['node.read', 'capture', 'edges.propose'],
  },

  'node.delete': {
    cmd: 'node.delete',
    p: 'Delete a note and its edges',
    in: ['args'],
    out: ['deletion_confirmation'],
    fx: 'db:write',
    fl: [
      { n: 'force', t: 'bool', d: false, desc: 'skip confirmation prompt' },
    ],
    ex: [
      'forest node delete abc123',
      'forest node delete abc123 --force',
    ],
    rel: ['node.read', 'edges'],
  },

  'node.link': {
    cmd: 'node.link',
    p: 'Manually create an edge between two notes',
    in: ['args'],
    out: ['edge_record'],
    fx: 'db:write',
    fl: [
      { n: 'score', t: 'float', desc: 'override computed score' },
      { n: 'suggest', t: 'bool', d: false, desc: 'create as suggestion (not accepted)' },
      { n: 'explain', t: 'bool', d: false, desc: 'print scoring components' },
    ],
    ex: [
      'forest node link abc123 def456',
      'forest node link abc123 def456 --score 0.8',
      'forest node link abc123 def456 --suggest --explain',
    ],
    rel: ['edges.accept', 'edges.explain', 'node.read'],
  },

  'node.recent': {
    cmd: 'node.recent',
    p: 'Show recent node activity (created/updated)',
    in: [],
    out: ['activity_timeline'],
    fx: 'none',
    fl: [
      { n: 'limit', t: 'int', d: 20, desc: 'max activities to show' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
      { n: 'created', t: 'bool', d: false, desc: 'show only created activities' },
      { n: 'updated', t: 'bool', d: false, desc: 'show only updated activities' },
      { n: 'since', t: 'str', desc: 'show activities since duration (e.g. 24h, 7d)' },
    ],
    ex: [
      'forest node recent',
      'forest node recent --limit 10',
      'forest node recent --since 24h',
      'forest node recent --created',
      'forest node recent --json',
    ],
    rel: ['node.read', 'explore', 'capture'],
  },

  node: {
    cmd: 'node',
    p: 'View node dashboard (total count, recent nodes, quick actions)',
    in: [],
    out: ['dashboard_summary'],
    fx: 'none',
    fl: [],
    ex: ['forest node'],
    rel: ['node.read', 'node.edit', 'node.refresh', 'explore'],
  },

  'edges.propose': {
    cmd: 'edges.propose',
    p: 'List suggested links ordered by score',
    in: [],
    out: ['ranked_suggestions'],
    fx: 'none',
    fl: [
      { n: 'limit', t: 'int', d: 10, desc: 'max suggestions to show' },
      { n: 'long-ids', t: 'bool', d: false, desc: 'display full UUIDs' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest edges propose',
      'forest edges propose --limit 20',
      'forest edges propose --json',
    ],
    rel: ['edges.accept', 'edges.promote', 'edges.explain'],
  },

  'edges.promote': {
    cmd: 'edges.promote',
    p: 'Promote suggestions above a score threshold to accepted edges',
    in: [],
    out: ['promotion_count'],
    fx: 'db:write',
    fl: [
      { n: 'min-score', t: 'float', d: 0.5, desc: 'minimum score to accept' },
    ],
    ex: [
      'forest edges promote',
      'forest edges promote --min-score 0.6',
    ],
    rel: ['edges.propose', 'edges.accept'],
  },

  'edges.accept': {
    cmd: 'edges.accept',
    p: 'Promote a single suggestion by reference (index/code/ID)',
    in: ['args'],
    out: ['acceptance_confirmation'],
    fx: 'db:write',
    fl: [],
    ex: [
      'forest edges accept 1',
      'forest edges accept 0L5a',
      'forest edges accept abc123::def456',
    ],
    rel: ['edges.propose', 'edges.undo', 'edges.reject'],
  },

  'edges.reject': {
    cmd: 'edges.reject',
    p: 'Reject and remove a suggestion by reference',
    in: ['args'],
    out: ['rejection_confirmation'],
    fx: 'db:write',
    fl: [],
    ex: [
      'forest edges reject 1',
      'forest edges reject 0L5a',
      'forest edges reject abc123::def456',
    ],
    rel: ['edges.propose', 'edges.undo', 'edges.sweep'],
  },

  'edges.sweep': {
    cmd: 'edges.sweep',
    p: 'Bulk-reject suggestions by index range or score threshold',
    in: [],
    out: ['rejection_count'],
    fx: 'db:write',
    fl: [
      { n: 'range', t: 'str', desc: 'comma-separated indexes or ranges (e.g., 1-10,15)' },
      { n: 'max-score', t: 'float', desc: 'reject suggestions at or below this score' },
    ],
    ex: [
      'forest edges sweep --range 1-5',
      'forest edges sweep --max-score 0.3',
      'forest edges sweep --range 1-10 --max-score 0.25',
    ],
    rel: ['edges.reject', 'edges.propose'],
  },

  'edges.explain': {
    cmd: 'edges.explain',
    p: 'Explain scoring components for a link',
    in: ['args'],
    out: ['score_breakdown'],
    fx: 'none',
    fl: [
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest edges explain 0L5a',
      'forest edges explain abc123::def456 --json',
    ],
    rel: ['edges.propose', 'node.link'],
  },

  'edges.undo': {
    cmd: 'edges.undo',
    p: 'Undo the last accept/reject action for a link',
    in: ['args'],
    out: ['undo_confirmation'],
    fx: 'db:write',
    fl: [],
    ex: [
      'forest edges undo 0L5a',
      'forest edges undo abc123::def456',
    ],
    rel: ['edges.accept', 'edges.reject'],
  },

  edges: {
    cmd: 'edges',
    p: 'View recent accepted edges (base command)',
    in: [],
    out: ['recent_edge_list'],
    fx: 'none',
    fl: [
      { n: 'limit', t: 'int', d: 10, desc: 'max edges to show' },
      { n: 'long-ids', t: 'bool', d: false, desc: 'display full UUIDs' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest edges',
      'forest edges --limit 20',
      'forest edges --json',
    ],
    rel: ['edges.propose', 'node.link'],
  },

  'tags.list': {
    cmd: 'tags.list',
    p: 'List tags with usage counts',
    in: [],
    out: ['tag_list'],
    fx: 'none',
    fl: [
      { n: 'top', t: 'int', desc: 'limit to top N tags' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest tags list',
      'forest tags list --top 20',
      'forest tags list --json',
    ],
    rel: ['tags.stats', 'tags.rename'],
  },

  'tags.rename': {
    cmd: 'tags.rename',
    p: 'Rename a tag across all notes',
    in: ['args'],
    out: ['rename_count'],
    fx: 'db:write',
    fl: [],
    ex: [
      'forest tags rename old-tag new-tag',
    ],
    rel: ['tags.list', 'tags.stats'],
  },

  'tags.stats': {
    cmd: 'tags.stats',
    p: 'Show tag co-occurrence statistics',
    in: [],
    out: ['top_tags', 'top_pairs', 'cooccurrence'],
    fx: 'none',
    fl: [
      { n: 'tag', t: 'str', desc: 'focus on a single tag and show co-occurring tags' },
      { n: 'min-count', t: 'int', d: 0, desc: 'only show items with count >= N' },
      { n: 'top', t: 'int', d: 10, desc: 'top N results to show' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest tags stats',
      'forest tags stats --tag focus',
      'forest tags stats --min-count 3 --top 15 --json',
    ],
    rel: ['tags.list', 'explore'],
  },

  tags: {
    cmd: 'tags',
    p: 'View tag dashboard (total count, top tags, quick actions)',
    in: [],
    out: ['dashboard_summary'],
    fx: 'none',
    fl: [],
    ex: ['forest tags'],
    rel: ['tags.list', 'tags.stats', 'tags.rename'],
  },

  'export.graphviz': {
    cmd: 'export.graphviz',
    p: 'Export graph as DOT format (Graphviz)',
    in: [],
    out: ['dot_file'],
    fx: 'stdout',
    fl: [],
    ex: [
      'forest export graphviz > graph.dot',
      'forest export graphviz | dot -Tpng > graph.png',
    ],
    rel: ['export.json', 'stats'],
  },

  'export.json': {
    cmd: 'export.json',
    p: 'Export entire graph as JSON',
    in: [],
    out: ['json_graph'],
    fx: 'stdout',
    fl: [],
    ex: [
      'forest export json > export.json',
    ],
    rel: ['export.graphviz', 'stats'],
  },

  export: {
    cmd: 'export',
    p: 'Export graph data (base command, delegates to subcommands)',
    in: [],
    out: ['help_text'],
    fx: 'none',
    fl: [],
    ex: ['forest export graphviz', 'forest export json'],
    rel: ['stats', 'health'],
  },
};
