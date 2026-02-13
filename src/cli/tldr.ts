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
 * When jsonMode is true, emit only the JSON object (no preamble lines).
 */
export function formatTldrV02(data: GlobalTldr | CommandTldr, version: string, jsonMode = false): string {
  const lines: string[] = [];

  if ('tool' in data) {
    // Global index
    if (!jsonMode) {
      lines.push('--- tool: forest ---');
      lines.push(`# meta: tool=forest, version=${version}, keymap=${formatKeymap()}`);
    }

    // Global metadata object
    lines.push(JSON.stringify({
      tool: data.tool,
      version: data.version,
      summary: data.summary,
      commands: data.commands,
    }));
  } else {
    // Command-specific
    if (!jsonMode) {
      lines.push('--- tool: forest ---');
      lines.push(`# meta: tool=forest, version=${version}, keymap=${formatKeymap()}`);
    }

    // Command object with abbreviated keys
    lines.push(JSON.stringify(data));
  }

  return lines.join('\n');
}

/**
 * Format all commands as NDJSON v0.2
 * Outputs tool delimiter, metadata header, and all command objects
 * When jsonMode is true, emit only the JSON objects (no preamble lines).
 */
export function formatAllCommandsTldr(version: string, jsonMode = false): string {
  const lines: string[] = [];

  // Tool delimiter and metadata header (once)
  if (!jsonMode) {
    lines.push('--- tool: forest ---');
    lines.push(`# meta: tool=forest, version=${version}, keymap=${formatKeymap()}`);
  }

  // All command objects as NDJSON (one per line)
  for (const [_key, commandData] of Object.entries(COMMAND_TLDR)) {
    lines.push(JSON.stringify(commandData));
  }

  return lines.join('\n');
}

/**
 * Emit TLDR and exit process
 */
export function emitTldrAndExit(data: GlobalTldr | CommandTldr, version: string, jsonMode = false): never {
  const output = formatTldrV02(data, version, jsonMode);
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
      'link',
      'search',
      'read',
      'edit',
      'update',
      'delete',
      'import',
      'synthesize',
      'tag',
      'stats',
      'serve',
      'config',
      'version',
      'lint',
      'edges.explain',
      'edges.threshold',
      'edges',
      'tags.add',
      'tags.remove',
      'tags.list',
      'tags.rename',
      'tags.stats',
      'tags',
      'admin.embeddings',
      'admin.rescore',
      'admin.tags',
      'admin.backfill-chunk-titles',
      'admin.health',
      'admin.doctor',
      'admin.migrate-v2',
      'admin',
      'export.graphviz',
      'export.json',
      'export',
      'documents',
      'suggest',
      'context',
      'path',
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
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest capture --title "Named Idea" --body "Free-form text with #tags"',
      'forest capture --stdin < note.md',
      'forest capture --file captured.md --tags focus,ops',
      'forest capture --no-preview --json',
    ],
    rel: ['explore', 'read'],
  },

  explore: {
    cmd: 'explore',
    p: 'Graph navigation around a specific node',
    in: ['args'],
    out: ['node_list', 'neighborhood_graph'],
    fx: 'none',
    fl: [
      { n: 'id', t: 'str', desc: 'node id or short id (positional or flag)' },
      { n: 'title', t: 'str', desc: 'exact title of the node to open' },
      { n: 'depth', t: 'int', d: 1, desc: 'neighborhood depth (1 or 2)' },
      { n: 'by', t: 'str', desc: 'filter edges by layer: semantic|tags' },
      { n: 'min-semantic', t: 'float', desc: 'only include edges with semantic_score >= N' },
      { n: 'min-tags', t: 'float', desc: 'only include edges with tag_score >= N' },
      { n: 'limit', t: 'int', d: 25, desc: 'max neighbors to render' },
      { n: 'long-ids', t: 'bool', d: false, desc: 'show full UUIDs' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest explore 7fa7acb2',
      'forest explore --title "Graph architecture notes"',
      'forest explore --depth 2 --min-semantic 0.6',
    ],
    rel: ['search', 'read'],
  },

  link: {
    cmd: 'link',
    p: 'Create a bridge tag between two notes (#link/...)',
    in: ['args'],
    out: ['updated_nodes', 'edge_update'],
    fx: 'db:write',
    fl: [
      { n: 'name', t: 'str', desc: 'optional bridge name (creates #link/<name>)' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest link abc123 def456',
      'forest link abc123 def456 --name=chapter-1-arc',
    ],
    rel: ['explore', 'link', 'tags.list'],
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
      { n: 'origin', t: 'str', desc: 'filter by origin: capture, write, synthesize, import, api (metadata)' },
      { n: 'created-by', t: 'str', desc: 'filter by creator: user, ai, or agent name (metadata)' },
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
    out: ['node_counts', 'edge_counts', 'recent_captures', 'high_degree_nodes'],
    fx: 'none',
    fl: [
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: ['forest stats', 'forest stats --json'],
    rel: ['admin.health', 'edges'],
  },


  context: {
    cmd: 'context',
    p: 'Show cluster topology (hubs, bridges, periphery) around a topic for agent consumption',
    in: ['tag', 'query'],
    out: ['xml_topology', 'json_topology'],
    fx: 'none',
    fl: [
      { n: 'tag', t: 'str', desc: 'seed cluster by tag (e.g. project:kingdom)' },
      { n: 'query', t: 'str', desc: 'seed by semantic search query' },
      { n: 'budget', t: 'int', d: 8000, desc: 'token budget for output' },
      { n: 'json', t: 'bool', d: false, desc: 'JSON output instead of XML' },
    ],
    ex: [
      'forest context --tag project:kingdom',
      'forest context --query "audio processing"',
      'forest context --tag project:kingdom --query "quest system"',
      'forest context --tag domain:projects --budget 4000',
      'forest context --tag project:forest --json',
    ],
    rel: ['search', 'explore', 'suggest'],
  },

  suggest: {
    cmd: 'suggest',
    p: 'Suggest relevant nodes for the current project (auto-detects from cwd)',
    in: ['cwd'],
    out: ['ranked_node_list'],
    fx: 'none',
    fl: [
      { n: 'project', t: 'str', desc: 'override project name (default: auto-detect)' },
      { n: 'limit', t: 'int', d: 10, desc: 'max suggestions to show' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest suggest',
      'forest suggest --project kingdom',
      'forest suggest --json',
      'forest suggest --limit 5',
    ],
    rel: ['search', 'explore', 'stats'],
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
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output (use with --show)' },
    ],
    ex: [
      'forest config',
      'forest config --show',
      'forest config --reset',
      'forest config embedProvider openai',
    ],
    rel: ['admin.embeddings', 'capture'],
  },

  admin: {
    cmd: 'admin',
    p: 'System maintenance and diagnostics (base command)',
    in: [],
    out: ['help_text'],
    fx: 'none',
    fl: [],
    ex: ['forest admin'],
    rel: [
      'admin.health',
      'admin.embeddings',
      'admin.rescore',
      'admin.tags',
      'admin.backfill-chunk-titles',
      'admin.doctor',
    ],
  },

  'admin.migrate-v2': {
    cmd: 'admin.migrate-v2',
    p: 'Migrate database to scoring v2 (dual semantic/tag scores)',
    in: [],
    out: ['progress_log', 'updated_records'],
    fx: 'db:write',
    fl: [],
    ex: ['forest admin migrate-v2'],
    rel: ['edges', 'admin.embeddings', 'link'],
  },

  'admin.embeddings': {
    cmd: 'admin.embeddings',
    p: 'Recompute embeddings for all nodes and optionally rescore edges',
    in: [],
    out: ['progress_log', 'updated_records'],
    fx: 'db:write,compute:embedding',
    fl: [
      { n: 'rescore', t: 'bool', d: false, desc: 'rescore all edges after recomputing embeddings' },
    ],
    ex: [
      'forest admin embeddings',
      'forest admin embeddings --rescore',
    ],
    rel: ['admin.health', 'admin.rescore', 'edges'],
  },

  'admin.rescore': {
    cmd: 'admin.rescore',
    p: 'Rescore all edges using current embeddings and scoring rules',
    in: [],
    out: ['progress_log', 'updated_records'],
    fx: 'db:write',
    fl: [],
    ex: ['forest admin rescore'],
    rel: ['admin.embeddings', 'edges', 'edges.threshold'],
  },

  'admin.tags': {
    cmd: 'admin.tags',
    p: 'Regenerate tags for all nodes using current tagging method (LLM or lexical)',
    in: [],
    out: ['progress_log', 'updated_records', 'cost_estimate'],
    fx: 'db:write,network:api_call',
    fl: [
      { n: 'dry-run', t: 'bool', d: false, desc: 'preview changes without saving' },
      { n: 'limit', t: 'int', desc: 'only retag first N nodes (for testing)' },
      { n: 'skip', t: 'int', d: 0, desc: 'skip first N nodes before starting' },
      { n: 'skip-unchanged', t: 'bool', d: false, desc: 'skip nodes where tags would not change' },
    ],
    ex: [
      'forest admin tags --dry-run',
      'forest admin tags --limit 10',
      'forest admin tags --skip-unchanged',
    ],
    rel: ['config', 'capture', 'tags.list'],
  },

  'admin.backfill-chunk-titles': {
    cmd: 'admin.backfill-chunk-titles',
    p: 'Rename existing chunk nodes to the new "Doc [2/7] Section" title format',
    in: [],
    out: ['progress_log', 'updated_records'],
    fx: 'db:write',
    fl: [
      { n: 'dry-run', t: 'bool', d: false, desc: 'preview changes without saving' },
    ],
    ex: [
      'forest admin backfill-chunk-titles --dry-run',
      'forest admin backfill-chunk-titles',
    ],
    rel: ['import', 'documents.list', 'admin.tags'],
  },

  'admin.health': {
    cmd: 'admin.health',
    p: 'System health check (DB, embeddings, graph integrity)',
    in: [],
    out: ['health_status', 'diagnostics', 'warnings'],
    fx: 'none',
    fl: [
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: ['forest admin health', 'forest admin health --json'],
    rel: ['stats', 'admin.embeddings', 'admin.doctor'],
  },

  'admin.doctor': {
    cmd: 'admin.doctor',
    p: 'Guided setup and troubleshooting wizard',
    in: [],
    out: ['diagnostics', 'recommendations'],
    fx: 'none',
    fl: [],
    ex: ['forest admin doctor'],
    rel: ['admin.health', 'config'],
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

  documents: {
    cmd: 'documents',
    p: 'Manage canonical documents (imported markdown split into linked chunks)',
    in: ['args'],
    out: ['document_list', 'document_record', 'chunk_list', 'document_stats', 'deletion_summary'],
    fx: 'db:write (delete)',
    fl: [
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
      { n: 'chunks', t: 'bool', d: false, desc: 'include chunk details (show)' },
      { n: 'force', t: 'bool', d: false, desc: 'skip confirmation (delete)' },
    ],
    ex: [
      'forest documents list',
      'forest documents show abc123 --chunks',
      'forest documents delete abc123 --force',
      'forest documents stats',
    ],
    rel: ['import', 'read', 'delete', 'stats'],
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
    rel: ['edges.threshold', 'link'],
  },

  'edges.threshold': {
    cmd: 'edges.threshold',
    p: 'View the current edge acceptance threshold',
    in: [],
    out: ['threshold_value'],
    fx: 'none',
    fl: [],
    ex: ['forest edges threshold'],
    rel: ['edges', 'edges.explain'],
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
    rel: ['edges.threshold', 'link'],
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

  'tags.add': {
    cmd: 'tags.add',
    p: 'Add one or more tags to a note',
    in: ['args'],
    out: ['updated_node_tags'],
    fx: 'db:write',
    fl: [
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest tags add @0 to-review',
      'forest tags add abc123 focus,ops',
      'forest tags add abc123 #link/chapter-1-arc',
    ],
    rel: ['tags.remove', 'tags.list', 'update'],
  },

  'tags.remove': {
    cmd: 'tags.remove',
    p: 'Remove one or more tags from a note',
    in: ['args'],
    out: ['updated_node_tags'],
    fx: 'db:write',
    fl: [
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest tags remove @0 to-review',
      'forest tags remove abc123 focus,ops',
      'forest tags remove abc123 #link/chapter-1-arc',
    ],
    rel: ['tags.add', 'tags.list', 'update'],
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
    rel: ['tags.list', 'tags.stats', 'tags.rename', 'tags.add', 'tags.remove'],
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

  // --- Note commands ---

  read: {
    cmd: 'read',
    p: 'Show the full content of a note (includes provenance: origin, createdBy, model)',
    in: ['args'],
    out: ['node_metadata', 'body_text', 'edge_summary', 'provenance'],
    fx: 'none',
    fl: [
      { n: 'meta', t: 'bool', d: false, desc: 'show metadata only (no body)' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
      { n: 'long-ids', t: 'bool', d: false, desc: 'display full UUIDs' },
      { n: 'raw', t: 'bool', d: false, desc: 'output only raw markdown body (for piping)' },
    ],
    ex: [
      'forest read abc123',
      'forest read @ --raw | glow',
      'forest read @1 --json',
    ],
    rel: ['edit', 'update', 'explore'],
  },

  edit: {
    cmd: 'edit',
    p: 'Open a note in your editor for inline updates',
    in: ['args'],
    out: ['updated_record', 'rescore_summary'],
    fx: 'db:write,compute:embedding',
    fl: [
      { n: 'editor', t: 'str', desc: 'override editor command' },
      { n: 'no-auto-link', t: 'bool', d: false, desc: 'skip rescoring edges' },
    ],
    ex: [
      'forest edit abc123',
      'forest edit @ --editor "code --wait"',
    ],
    rel: ['read', 'update', 'capture', 'edges'],
  },

  update: {
    cmd: 'update',
    p: 'Update note fields from flags or files and rescore links',
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
      'forest update abc123 --title "New Title"',
      'forest update @ --stdin < updated.md',
    ],
    rel: ['read', 'edit', 'capture', 'edges'],
  },

  'delete': {
    cmd: 'delete',
    p: 'Delete a note and its edges',
    in: ['args'],
    out: ['deletion_confirmation'],
    fx: 'db:write',
    fl: [
      { n: 'force', t: 'bool', d: false, desc: 'skip confirmation prompt' },
    ],
    ex: [
      'forest delete abc123',
      'forest delete abc123 --force',
    ],
    rel: ['read', 'edges'],
  },

  'import': {
    cmd: 'import',
    p: 'Import a markdown document by chunking into linked nodes',
    in: ['stdin', 'file'],
    out: ['document_record', 'chunk_list', 'linking_summary'],
    fx: 'db:write,compute:embedding',
    fl: [
      { n: 'file', t: 'file', desc: 'read document from file' },
      { n: 'stdin', t: 'bool', d: false, desc: 'read document from stdin' },
      { n: 'title', t: 'str', desc: 'override auto-detected title' },
      { n: 'tags', t: 'list', desc: 'comma-separated tags for all chunks' },
      { n: 'chunk-strategy', t: 'str', d: 'headers', desc: 'chunking strategy: headers, size, hybrid' },
      { n: 'max-tokens', t: 'int', d: 2000, desc: 'max tokens per chunk' },
      { n: 'overlap', t: 'int', d: 200, desc: 'character overlap' },
      { n: 'no-parent', t: 'bool', d: false, desc: 'skip creating root/index node' },
      { n: 'no-sequential', t: 'bool', d: false, desc: 'skip linking chunks sequentially' },
      { n: 'no-auto-link', t: 'bool', d: false, desc: 'skip semantic auto-linking' },
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest import --file doc.md',
      'forest import --stdin < doc.md',
    ],
    rel: ['capture', 'read', 'documents.list'],
  },

  synthesize: {
    cmd: 'synthesize',
    p: 'Synthesize a new article from 2+ notes via GPT-5',
    in: ['args'],
    out: ['synthesis_result', 'node_record'],
    fx: 'db:write,network:api_call',
    fl: [
      { n: 'model', t: 'str', d: 'gpt-5', desc: 'model: gpt-5 or gpt-5-mini' },
      { n: 'reasoning', t: 'str', d: 'high', desc: 'reasoning effort: minimal, low, medium, high' },
      { n: 'verbosity', t: 'str', d: 'high', desc: 'output verbosity: low, medium, high' },
      { n: 'preview', t: 'bool', d: false, desc: 'preview without saving' },
      { n: 'auto-link', t: 'bool', d: true, desc: 'auto-link new node to sources' },
      { n: 'max-tokens', t: 'int', desc: 'maximum output tokens' },
    ],
    ex: [
      'forest synthesize abc123 def456',
      'forest synthesize abc123 def456 --preview',
    ],
    rel: ['read', 'capture'],
  },

  tag: {
    cmd: 'tag',
    p: 'Add one or more tags to a note (alias for tags add)',
    in: ['args'],
    out: ['updated_node_tags'],
    fx: 'db:write',
    fl: [
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
    ],
    ex: [
      'forest tag @ to-review',
      'forest tag abc123 focus,ops',
    ],
    rel: ['tags.add', 'tags.remove', 'tags.list'],
  },

  lint: {
    cmd: 'lint',
    p: 'Check tag and note hygiene, report issues',
    in: [],
    out: ['lint_report'],
    fx: 'none',
    fl: [
      { n: 'json', t: 'bool', d: false, desc: 'emit JSON output' },
      { n: 'type', t: 'str', desc: 'filter by issue type' },
    ],
    ex: [
      'forest lint',
      'forest lint --json',
      'forest lint --type orphan_tag',
    ],
    rel: ['tags.list', 'tags.rename', 'tags.stats'],
  },
};
