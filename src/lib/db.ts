import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';
import { getConfiguredDbPath } from './config';

export type NodeMetadata = {
  origin?: 'capture' | 'write' | 'synthesize' | 'import' | 'api';
  createdBy?: string;         // "user", "ai", agent name, etc.
  sourceNodes?: string[];     // for synthesize: IDs of source nodes
  sourceFile?: string;        // for import: original filename
  model?: string;             // for write/synthesize: model used
  [key: string]: unknown;     // extensible
};

export type NodeRecord = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  tokenCounts: Record<string, number>;
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
  approximateScored?: boolean;
  // Document chunking metadata
  isChunk: boolean;
  parentDocumentId: string | null;
  chunkOrder: number | null;
  metadata: NodeMetadata | null;
};

export type EdgeStatus = 'accepted';
// Well-known edge types: semantic, parent-child, sequential, manual
// Custom types allowed: inspired-by, implemented-as, documents, depends-on, etc.
export type EdgeType = string;

export type EdgeRecord = {
  id: string;
  sourceId: string;
  targetId: string;
  score: number;
  semanticScore: number | null;
  tagScore: number | null;
  sharedTags: string[];
  status: EdgeStatus;
  edgeType: EdgeType;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
};

export type DocumentMetadata = {
  // Import settings
  chunkStrategy?: 'headers' | 'size' | 'hybrid';
  maxTokens?: number;
  overlap?: number;
  chunkCount?: number;
  source?: 'import' | 'backfill';
  autoLink?: boolean;
  createParent?: boolean;
  linkSequential?: boolean;

  // Edit tracking
  lastEditedAt?: string;
  lastEditedNodeId?: string;

  // Backfill tracking
  backfill?: boolean;
  chunkOrdersProvided?: boolean;

  // Allow extensions
  [key: string]: unknown;
};

export type DocumentRecord = {
  id: string;
  title: string;
  body: string;
  metadata: DocumentMetadata | null;
  version: number;
  rootNodeId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentChunkRecord = {
  documentId: string;
  segmentId: string;
  nodeId: string;
  offset: number;
  length: number;
  chunkOrder: number;
  checksum: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentWithChunk = {
  document: DocumentRecord;
  chunk: DocumentChunkRecord;
};

let sqljs: SqlJsStatic | null = null;
let database: Database | null = null;
let dirty = false;
let tempWasmPath: string | null = null;

export function getDbPath(): string {
  // Priority 1: Explicit FOREST_DB_PATH environment variable
  if (process.env.FOREST_DB_PATH) {
    return process.env.FOREST_DB_PATH;
  }

  // Priority 2: Config file dbPath setting
  const configDbPath = getConfiguredDbPath();
  if (configDbPath) {
    return configDbPath;
  }

  // Priority 3: Platform-appropriate app data directory
  const homeDir = os.homedir();
  let appDataDir: string;

  if (process.platform === 'darwin') {
    // macOS: ~/Library/Application Support/com.ettio.forest.desktop
    appDataDir = path.join(homeDir, 'Library', 'Application Support', 'com.ettio.forest.desktop');
  } else if (process.platform === 'win32') {
    // Windows: %APPDATA%\com.ettio.forest.desktop
    appDataDir = path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'com.ettio.forest.desktop');
  } else {
    // Linux/Unix: ~/.local/share/com.ettio.forest.desktop
    const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
    appDataDir = path.join(xdgDataHome, 'com.ettio.forest.desktop');
  }

  return path.join(appDataDir, 'forest.db');
}

function locateWasmFile(file: string): string {
  // For standalone binaries, extract embedded WASM to temp file
  if (tempWasmPath && fs.existsSync(tempWasmPath)) {
    return tempWasmPath;
  }

  // Try development path first (when running from source)
  const devPath = path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file);
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // Extract embedded WASM to temp file (for compiled binary)
  try {
    // Dynamic import to avoid bundling issues if file doesn't exist
    const { EMBEDDED_WASM_BASE64 } = require('./embedded-wasm');
    const buffer = Buffer.from(EMBEDDED_WASM_BASE64, 'base64');

    // Create temp file
    tempWasmPath = path.join(os.tmpdir(), `forest-sql-wasm-${process.pid}.wasm`);
    fs.writeFileSync(tempWasmPath, buffer);

    // Clean up on exit
    process.on('exit', () => {
      if (tempWasmPath && fs.existsSync(tempWasmPath)) {
        try {
          fs.unlinkSync(tempWasmPath);
        } catch (_) {
          // Ignore cleanup errors
        }
      }
    });

    return tempWasmPath;
  } catch (err) {
    // Embedded WASM not available - this should only happen during development
    // before running the embed script
    throw new Error(
      `Failed to locate ${file}. ` +
        `Tried:\n  1. ${devPath} (not found)\n  2. Embedded WASM (not available)\n` +
        `If building, run: bun run scripts/embed-wasm.ts`
    );
  }
}

async function ensureDatabase(): Promise<Database> {
  if (!sqljs) {
    sqljs = await initSqlJs({
      locateFile: locateWasmFile,
    });
  }
  if (!database) {
    const dbPath = getDbPath();
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      database = new sqljs.Database(new Uint8Array(fileBuffer));
    } else {
      ensureDirectories(dbPath);
      database = new sqljs.Database();
      dirty = true;
    }
    runMigrations(database);
    await backfillCanonicalDocuments(database);
    await persist();
  }
  return database;
}

function ensureDirectories(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function runMigrations(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tags TEXT NOT NULL,
      token_counts TEXT NOT NULL,
      embedding TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      approximate_scored INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      score REAL NOT NULL,
      semantic_score REAL,
      tag_score REAL,
      shared_tags TEXT DEFAULT '[]',
      status TEXT NOT NULL CHECK (status IN ('accepted')),
      edge_type TEXT NOT NULL DEFAULT 'semantic',
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(source_id, target_id)
    );

    CREATE TABLE IF NOT EXISTS node_tags (
      node_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (node_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_node_tags_tag ON node_tags(tag);

    CREATE TABLE IF NOT EXISTS tag_idf (
      tag TEXT PRIMARY KEY,
      doc_freq INTEGER NOT NULL,
      idf REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_edges_status ON edges(status);
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);

    CREATE TABLE IF NOT EXISTS edge_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      edge_id TEXT,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      prev_status TEXT,
      next_status TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL,
      undone INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_edge_events_pair ON edge_events(source_id, target_id);
    CREATE INDEX IF NOT EXISTS idx_edge_events_edge ON edge_events(edge_id);

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      metadata TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      root_node_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_chunks (
      document_id TEXT NOT NULL,
      segment_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      offset INTEGER NOT NULL,
      length INTEGER NOT NULL,
      chunk_order INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (document_id, segment_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_document_chunks_node ON document_chunks(node_id);
    CREATE INDEX IF NOT EXISTS idx_document_chunks_document_order ON document_chunks(document_id, chunk_order);
  `);

  // Add missing columns for existing databases (best-effort migrations)
  try {
    const res = db.exec(`PRAGMA table_info(nodes);`);
    const columns = res.length > 0 ? res[0].values.map((row) => String(row[1])) : [];

    // Add embedding column if missing
    if (!columns.includes('embedding')) {
      db.exec(`ALTER TABLE nodes ADD COLUMN embedding TEXT;`);
      dirty = true;
    }

    // Add document chunking columns if missing
    if (!columns.includes('is_chunk')) {
      db.exec(`ALTER TABLE nodes ADD COLUMN is_chunk INTEGER NOT NULL DEFAULT 0;`);
      dirty = true;
    }
    if (!columns.includes('parent_document_id')) {
      db.exec(`ALTER TABLE nodes ADD COLUMN parent_document_id TEXT;`);
      dirty = true;
    }
    if (!columns.includes('chunk_order')) {
      db.exec(`ALTER TABLE nodes ADD COLUMN chunk_order INTEGER;`);
      dirty = true;
    }

    // Add precomputed degree counter for performance-critical stats
    if (!columns.includes('accepted_degree')) {
      db.exec(`ALTER TABLE nodes ADD COLUMN accepted_degree INTEGER NOT NULL DEFAULT 0;`);
      backfillAllDegrees(db);
      dirty = true;
    }

    // Scoring v2: approximate scoring marker
    if (!columns.includes('approximate_scored')) {
      db.exec(`ALTER TABLE nodes ADD COLUMN approximate_scored INTEGER NOT NULL DEFAULT 1;`);
      dirty = true;
    }

    // Provenance tracking: node metadata JSON column
    if (!columns.includes('metadata')) {
      db.exec(`ALTER TABLE nodes ADD COLUMN metadata TEXT;`);
      dirty = true;
    }
  } catch (_) {
    // Best-effort; ignore if pragma not supported in this context
  }

  // Add scoring v2 columns to edges table if missing
  try {
    const res = db.exec(`PRAGMA table_info(edges);`);
    const columns = res.length > 0 ? res[0].values.map((row) => String(row[1])) : [];

    if (!columns.includes('semantic_score')) {
      db.exec(`ALTER TABLE edges ADD COLUMN semantic_score REAL;`);
      dirty = true;
    }

    if (!columns.includes('tag_score')) {
      db.exec(`ALTER TABLE edges ADD COLUMN tag_score REAL;`);
      dirty = true;
    }

    if (!columns.includes('shared_tags')) {
      db.exec(`ALTER TABLE edges ADD COLUMN shared_tags TEXT DEFAULT '[]';`);
      dirty = true;
    }

    if (!columns.includes('edge_type')) {
      db.exec(`ALTER TABLE edges ADD COLUMN edge_type TEXT NOT NULL DEFAULT 'semantic';`);
      dirty = true;
    }
  } catch (_) {
    // Best-effort; ignore if pragma not supported in this context
  }

  // Migrate suggested edges to accepted (v0.5.0: simplified edge model)
  try {
    const result = db.exec(`UPDATE edges SET status = 'accepted' WHERE status = 'suggested'`);
    // Check if any rows were updated via changes()
    const changesResult = db.exec(`SELECT changes() as count`);
    if (changesResult.length > 0 && changesResult[0].values.length > 0) {
      const changedRows = Number(changesResult[0].values[0][0]);
      if (changedRows > 0) {
        dirty = true;
      }
    }
  } catch (_) {
    // Best-effort; ignore if no suggested edges exist
  }
}

// Backfill degree counters from existing edge rows
function backfillAllDegrees(db: Database) {
  // Seed all nodes with zero degree
  const nodeIds: string[] = [];
  {
    const stmt = db.prepare('SELECT id FROM nodes');
    while (stmt.step()) {
      nodeIds.push(String(stmt.getAsObject().id));
    }
    stmt.free();
  }

  // Use in-memory map to count quickly in JS
  const degrees = new Map<string, number>();
  for (const id of nodeIds) {
    degrees.set(id, 0);
  }

  // Count edges (all edges are now 'accepted')
  {
    const stmt = db.prepare('SELECT source_id, target_id FROM edges');
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const s = String(row.source_id);
      const t = String(row.target_id);
      degrees.set(s, (degrees.get(s) ?? 0) + 1);
      degrees.set(t, (degrees.get(t) ?? 0) + 1);
    }
    stmt.free();
  }

  // Write counters back to nodes
  const update = db.prepare(`UPDATE nodes SET accepted_degree = :d WHERE id = :id`);
  for (const id of nodeIds) {
    update.bind({ ':d': degrees.get(id) ?? 0, ':id': id });
    update.step();
    update.reset();
  }
  update.free();
}

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function backfillCanonicalDocuments(db: Database) {
  // Ensure tables exist before attempting backfill
  const tables = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='documents'`);
  if (tables.length === 0) return;

  const docsToCreate: string[] = [];
  const stmt = db.prepare(`
    SELECT DISTINCT parent_document_id AS document_id
    FROM nodes
    WHERE is_chunk = 1
      AND parent_document_id IS NOT NULL
      AND parent_document_id NOT IN (SELECT id FROM documents)
  `);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const docId = row.document_id ? String(row.document_id) : null;
    if (docId) docsToCreate.push(docId);
  }
  stmt.free();

  if (docsToCreate.length === 0) return;

  console.log(`Backfilling ${docsToCreate.length} canonical documents...`);

  let madeChanges = false;
  let successCount = 0;

  for (const documentId of docsToCreate) {
    const chunkStmt = db.prepare(
      `SELECT id, title, body, chunk_order, created_at, updated_at
       FROM nodes
       WHERE parent_document_id = :docId
       ORDER BY COALESCE(chunk_order, 0), created_at`
    );
    chunkStmt.bind({ ':docId': documentId });

    const chunks: {
      id: string;
      title: string;
      body: string;
      chunkOrder: number | null;
      createdAt: string;
      updatedAt: string;
    }[] = [];

    while (chunkStmt.step()) {
      const row = chunkStmt.getAsObject();
      chunks.push({
        id: String(row.id),
        title: String(row.title),
        body: String(row.body),
        chunkOrder: row.chunk_order !== null ? Number(row.chunk_order) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      });
    }
    chunkStmt.free();

    if (chunks.length === 0) continue;

    const rootStmt = db.prepare(
      `SELECT id, title, body, created_at, updated_at
       FROM nodes
       WHERE id = :docId
       LIMIT 1`
    );
    rootStmt.bind({ ':docId': documentId });
    const rootRow = rootStmt.step() ? rootStmt.getAsObject() : null;
    rootStmt.free();

    const rootNodeId = rootRow ? String(rootRow.id) : null;
    const documentTitle = rootRow ? String(rootRow.title) : chunks[0]?.title ?? 'Untitled Document';

    const bodyParts = chunks.map(chunk => chunk.body);
    const fullBody = bodyParts.join('\n\n');

    const chunkCount = chunks.length;
    const createdAt =
      rootRow?.created_at ? String(rootRow.created_at) : chunks[0]?.createdAt ?? new Date().toISOString();
    const updatedAt =
      rootRow?.updated_at
        ? String(rootRow.updated_at)
        : chunks[chunks.length - 1]?.updatedAt ?? new Date().toISOString();

    const metadata = {
      backfill: true,
      chunkCount,
      chunkOrdersProvided: chunks.every(chunk => chunk.chunkOrder !== null),
    };

    const insertDocument = db.prepare(
      `INSERT OR IGNORE INTO documents (id, title, body, metadata, version, root_node_id, created_at, updated_at)
       VALUES (:id, :title, :body, :metadata, :version, :rootNodeId, :createdAt, :updatedAt)`
    );
    insertDocument.bind({
      ':id': documentId,
      ':title': documentTitle,
      ':body': fullBody,
      ':metadata': JSON.stringify(metadata),
      ':version': 1,
      ':rootNodeId': rootNodeId,
      ':createdAt': createdAt,
      ':updatedAt': updatedAt,
    });
    insertDocument.step();
    insertDocument.free();

    // If insert was ignored because document already exists, skip chunk inserts
    const existsCheck = db.prepare(`SELECT 1 FROM documents WHERE id = :id LIMIT 1`);
    existsCheck.bind({ ':id': documentId });
    const exists = existsCheck.step();
    existsCheck.free();
    if (!exists) continue;

    const insertChunk = db.prepare(
      `INSERT OR REPLACE INTO document_chunks
        (document_id, segment_id, node_id, offset, length, chunk_order, checksum, created_at, updated_at)
       VALUES
        (:documentId, :segmentId, :nodeId, :offset, :length, :chunkOrder, :checksum, :createdAt, :updatedAt)`
    );

    let offset = 0;
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index]!;
      const length = chunk.body.length;
      const chunkOrder = chunk.chunkOrder !== null ? chunk.chunkOrder : index;
      const checksum = hashContent(chunk.body);

      insertChunk.bind({
        ':documentId': documentId,
        ':segmentId': chunk.id,
        ':nodeId': chunk.id,
        ':offset': offset,
        ':length': length,
        ':chunkOrder': chunkOrder,
        ':checksum': checksum,
        ':createdAt': chunk.createdAt,
        ':updatedAt': chunk.updatedAt,
      });
      insertChunk.step();
      insertChunk.reset();

      offset += length;
      if (index < chunks.length - 1) {
        offset += 2; // account for '\n\n' separator
      }
    }
    insertChunk.free();

    madeChanges = true;
    successCount++;
  }

  if (madeChanges) {
    dirty = true;
    console.log(`Successfully backfilled ${successCount}/${docsToCreate.length} canonical documents`);
  }
}

async function markDirtyAndPersist() {
  dirty = true;
  await persist();
}

// Helper function to parse node row from database
function parseNodeRow(row: any): NodeRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    tags: JSON.parse(String(row.tags)),
    tokenCounts: JSON.parse(String(row.token_counts)),
    embedding: row.embedding ? (JSON.parse(String(row.embedding)) as number[]) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    approximateScored: Number(row.approximate_scored ?? 1) === 1,
    isChunk: Number(row.is_chunk || 0) === 1,
    parentDocumentId: row.parent_document_id ? String(row.parent_document_id) : null,
    chunkOrder: row.chunk_order ? Number(row.chunk_order) : null,
    metadata: row.metadata ? JSON.parse(String(row.metadata)) : null,
  };
}

function parseDocumentRow(row: any): DocumentRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    metadata: row.metadata ? JSON.parse(String(row.metadata)) : null,
    version: Number(row.version),
    rootNodeId: row.root_node_id ? String(row.root_node_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function parseDocumentChunkRow(row: any): DocumentChunkRecord {
  return {
    documentId: String(row.document_id),
    segmentId: String(row.segment_id),
    nodeId: String(row.node_id),
    offset: Number(row.offset),
    length: Number(row.length),
    chunkOrder: Number(row.chunk_order),
    checksum: String(row.checksum),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// Helper function to parse edge row from database
function parseEdgeRow(row: any): EdgeRecord {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    targetId: String(row.target_id),
    score: Number(row.score),
    semanticScore: row.semantic_score === null || row.semantic_score === undefined ? null : Number(row.semantic_score),
    tagScore: row.tag_score === null || row.tag_score === undefined ? null : Number(row.tag_score),
    sharedTags: row.shared_tags ? (JSON.parse(String(row.shared_tags)) as string[]) : [],
    status: row.status as EdgeStatus,
    edgeType: (row.edge_type as EdgeType) || 'semantic',
    metadata: row.metadata ? JSON.parse(String(row.metadata)) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function normalizeTagsForStorage(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0),
    ),
  );
}

function syncNodeTagsInternal(db: Database, nodeId: string, tags: string[]) {
  // Best-effort: if table does not exist yet, do nothing.
  try {
    const del = db.prepare('DELETE FROM node_tags WHERE node_id = :id');
    del.bind({ ':id': nodeId });
    del.step();
    del.free();

    const normalized = normalizeTagsForStorage(tags);
    if (normalized.length === 0) return;

    const ins = db.prepare('INSERT OR IGNORE INTO node_tags (node_id, tag) VALUES (:id, :tag)');
    for (const tag of normalized) {
      ins.bind({ ':id': nodeId, ':tag': tag });
      ins.step();
      ins.reset();
    }
    ins.free();
  } catch (_) {
    // Ignore missing table during early migrations.
  }
}

export async function syncNodeTags(nodeId: string, tags: string[]): Promise<void> {
  const db = await ensureDatabase();
  syncNodeTagsInternal(db, nodeId, tags);
  await markDirtyAndPersist();
}

export async function bulkSyncNodeTags(
  entries: Array<{ nodeId: string; tags: string[] }>
): Promise<{ nodes: number; rowsAttempted: number }> {
  const db = await ensureDatabase();

  // Best-effort: if table does not exist yet, do nothing.
  try {
    db.exec('BEGIN');

    const del = db.prepare('DELETE FROM node_tags WHERE node_id = :id');
    const ins = db.prepare('INSERT OR IGNORE INTO node_tags (node_id, tag) VALUES (:id, :tag)');

    let rowsAttempted = 0;

    for (const entry of entries) {
      del.bind({ ':id': entry.nodeId });
      del.step();
      del.reset();

      const normalized = normalizeTagsForStorage(entry.tags);
      for (const tag of normalized) {
        ins.bind({ ':id': entry.nodeId, ':tag': tag });
        ins.step();
        ins.reset();
        rowsAttempted += 1;
      }
    }

    del.free();
    ins.free();

    db.exec('COMMIT');

    await markDirtyAndPersist();
    return { nodes: entries.length, rowsAttempted };
  } catch (_) {
    try {
      db.exec('ROLLBACK');
    } catch (_) {
      // ignore
    }
    return { nodes: entries.length, rowsAttempted: 0 };
  }
}

export type TagIdfRecord = { tag: string; docFreq: number; idf: number };

export async function rebuildTagIdf(): Promise<{ totalNodes: number; totalTags: number }> {
  const db = await ensureDatabase();

  const countStmt = db.prepare('SELECT COUNT(*) as count FROM nodes');
  countStmt.step();
  const totalNodes = Number(countStmt.getAsObject().count);
  countStmt.free();

  const freqStmt = db.prepare(
    'SELECT tag, COUNT(DISTINCT node_id) AS doc_freq FROM node_tags GROUP BY tag',
  );

  const rows: TagIdfRecord[] = [];
  while (freqStmt.step()) {
    const row = freqStmt.getAsObject();
    const tag = String(row.tag);
    const docFreq = Number(row.doc_freq);
    const idf = totalNodes > 0 && docFreq > 0 ? Math.log(totalNodes / docFreq) : 0;
    rows.push({ tag, docFreq, idf });
  }
  freqStmt.free();

  db.exec('DELETE FROM tag_idf');

  const insertStmt = db.prepare(
    'INSERT OR REPLACE INTO tag_idf (tag, doc_freq, idf) VALUES (:tag, :docFreq, :idf)',
  );
  for (const row of rows) {
    insertStmt.bind({ ':tag': row.tag, ':docFreq': row.docFreq, ':idf': row.idf });
    insertStmt.step();
    insertStmt.reset();
  }
  insertStmt.free();

  await markDirtyAndPersist();
  return { totalNodes, totalTags: rows.length };
}

export async function listTagIdf(): Promise<TagIdfRecord[]> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT tag, doc_freq, idf FROM tag_idf ORDER BY idf DESC, tag ASC');
  const rows: TagIdfRecord[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    rows.push({
      tag: String(row.tag),
      docFreq: Number(row.doc_freq),
      idf: Number(row.idf),
    });
  }
  stmt.free();
  return rows;
}

export async function insertNode(record: NodeRecord): Promise<void> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `INSERT INTO nodes (id, title, body, tags, token_counts, embedding, created_at, updated_at, is_chunk, parent_document_id, chunk_order, metadata)
     VALUES (:id, :title, :body, :tags, :tokenCounts, :embedding, :createdAt, :updatedAt, :isChunk, :parentDocumentId, :chunkOrder, :metadata)`
  );
  stmt.bind({
    ':id': record.id,
    ':title': record.title,
    ':body': record.body,
    ':tags': JSON.stringify(record.tags),
    ':tokenCounts': JSON.stringify(record.tokenCounts),
    ':embedding': record.embedding ? JSON.stringify(record.embedding) : null,
    ':createdAt': record.createdAt,
    ':updatedAt': record.updatedAt,
    ':isChunk': record.isChunk ? 1 : 0,
    ':parentDocumentId': record.parentDocumentId,
    ':chunkOrder': record.chunkOrder,
    ':metadata': record.metadata ? JSON.stringify(record.metadata) : null,
  });
  stmt.step();
  stmt.free();
  syncNodeTagsInternal(db, record.id, record.tags);
  await markDirtyAndPersist();
}

export async function updateNodeTokens(id: string, tokenCounts: Record<string, number>): Promise<void> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `UPDATE nodes SET token_counts = :tokenCounts, updated_at = :updatedAt WHERE id = :id`
  );
  stmt.bind({
    ':tokenCounts': JSON.stringify(tokenCounts),
    ':updatedAt': new Date().toISOString(),
    ':id': id,
  });
  stmt.step();
  stmt.free();
  await markDirtyAndPersist();
}

export async function updateNode(
  id: string,
  fields: Partial<Pick<NodeRecord, 'title' | 'body' | 'tags' | 'tokenCounts' | 'embedding' | 'metadata'>>
): Promise<void> {
  const db = await ensureDatabase();
  const nextTags = Array.isArray(fields.tags) ? fields.tags : undefined;
  const sets: string[] = [];
  const params: Record<string, unknown> = { ':id': id, ':updatedAt': new Date().toISOString() };
  if (typeof fields.title === 'string') {
    sets.push('title = :title');
    params[':title'] = fields.title;
  }
  if (typeof fields.body === 'string') {
    sets.push('body = :body');
    params[':body'] = fields.body;
  }
  if (Array.isArray(fields.tags)) {
    sets.push('tags = :tags');
    params[':tags'] = JSON.stringify(fields.tags);
  }
  if (fields.tokenCounts) {
    sets.push('token_counts = :tokenCounts');
    params[':tokenCounts'] = JSON.stringify(fields.tokenCounts);
  }
  if (Array.isArray(fields.embedding)) {
    sets.push('embedding = :embedding');
    params[':embedding'] = JSON.stringify(fields.embedding);
  }
  if (fields.metadata !== undefined) {
    sets.push('metadata = :metadata');
    params[':metadata'] = fields.metadata ? JSON.stringify(fields.metadata) : null;
  }
  sets.push('updated_at = :updatedAt');
  const sql = `UPDATE nodes SET ${sets.join(', ')} WHERE id = :id`;
  const stmt = db.prepare(sql);
  stmt.bind(params as any);
  stmt.step();
  stmt.free();
  if (nextTags) {
    syncNodeTagsInternal(db, id, nextTags);
  }
  await markDirtyAndPersist();
}

// Internal helper: adjust degree counter for a node
function adjustNodeDegree(db: Database, nodeId: string, delta: number) {
  if (delta === 0) return;
  const stmt = db.prepare(
    `UPDATE nodes SET accepted_degree = accepted_degree + :d WHERE id = :id`
  );
  stmt.bind({ ':d': delta, ':id': nodeId });
  stmt.step();
  stmt.free();
}

// Internal helper: apply degree delta for an edge transition
function applyDegreeTransition(
  db: Database,
  sourceId: string,
  targetId: string,
  wasEdge: boolean,
  isEdge: boolean,
) {
  const delta = (isEdge ? 1 : 0) - (wasEdge ? 1 : 0);
  if (delta !== 0) {
    adjustNodeDegree(db, sourceId, delta);
    adjustNodeDegree(db, targetId, delta);
  }
}

export async function updateNodeIndexData(
  id: string,
  tags: string[],
  tokenCounts: Record<string, number>
): Promise<void> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `UPDATE nodes
     SET tags = :tags, token_counts = :tokenCounts, updated_at = :updatedAt
     WHERE id = :id`
  );
  stmt.bind({
    ':tags': JSON.stringify(tags),
    ':tokenCounts': JSON.stringify(tokenCounts),
    ':updatedAt': new Date().toISOString(),
    ':id': id,
  });
  stmt.step();
  stmt.free();
  syncNodeTagsInternal(db, id, tags);
  await markDirtyAndPersist();
}

export async function updateNodeChunkOrder(id: string, chunkOrder: number): Promise<void> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `UPDATE nodes
     SET chunk_order = :chunkOrder, updated_at = :updatedAt
     WHERE id = :id`
  );
  stmt.bind({
    ':chunkOrder': chunkOrder,
    ':updatedAt': new Date().toISOString(),
    ':id': id,
  });
  stmt.step();
  stmt.free();
  await markDirtyAndPersist();
}

export async function listNodes(): Promise<NodeRecord[]> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT * FROM nodes');
  const nodes: NodeRecord[] = [];
  while (stmt.step()) {
    nodes.push(parseNodeRow(stmt.getAsObject()));
  }
  stmt.free();
  return nodes;
}

// Optimized queries for stats command (avoid loading full bodies and embeddings)
export async function countNodes(): Promise<number> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM nodes');
  stmt.step();
  const count = Number(stmt.getAsObject().count);
  stmt.free();
  return count;
}

export async function countEdges(status: EdgeStatus | 'all' = 'all'): Promise<number> {
  const db = await ensureDatabase();
  const sql = status === 'all'
    ? 'SELECT COUNT(*) as count FROM edges'
    : 'SELECT COUNT(*) as count FROM edges WHERE status = :status';
  const stmt = db.prepare(sql);
  if (status !== 'all') {
    stmt.bind({ ':status': status });
  }
  stmt.step();
  const count = Number(stmt.getAsObject().count);
  stmt.free();
  return count;
}

export async function getNodeIds(): Promise<string[]> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT id FROM nodes');
  const ids: string[] = [];
  while (stmt.step()) {
    ids.push(String(stmt.getAsObject().id));
  }
  stmt.free();
  return ids;
}

export async function getNodeTagsOnly(): Promise<Array<{ id: string; tags: string[] }>> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT id, tags FROM nodes');
  const results: Array<{ id: string; tags: string[] }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: String(row.id),
      tags: JSON.parse(String(row.tags)),
    });
  }
  stmt.free();
  return results;
}

export async function getRecentNodes(limit: number = 5): Promise<Array<{
  id: string;
  title: string;
  tags: string[];
  updatedAt: string;
}>> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT id, title, tags, updated_at FROM nodes ORDER BY updated_at DESC LIMIT :limit');
  stmt.bind({ ':limit': limit });
  const results: Array<{ id: string; title: string; tags: string[]; updatedAt: string }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: String(row.id),
      title: String(row.title),
      tags: JSON.parse(String(row.tags)),
      updatedAt: String(row.updated_at),
    });
  }
  stmt.free();
  return results;
}

export async function getHighDegreeNodes(limit: number = 5): Promise<Array<{
  id: string;
  title: string;
  degree: number;
}>> {
  const db = await ensureDatabase();
  // Use precomputed degree counters on nodes for performance
  const stmt = db.prepare(
    `SELECT id, title, accepted_degree AS degree FROM nodes ORDER BY degree DESC LIMIT :limit`
  );
  stmt.bind({ ':limit': limit });
  const results: Array<{ id: string; title: string; degree: number }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: String(row.id),
      title: String(row.title),
      degree: Number(row.degree),
    });
  }
  stmt.free();
  return results;
}

export async function getDegreeStats(): Promise<{
  degrees: number[];
  avg: number;
  median: number;
  p90: number;
  max: number;
}> {
  const db = await ensureDatabase();
  // Read precomputed degrees directly from nodes
  const stmt = db.prepare(
    `SELECT accepted_degree AS degree FROM nodes ORDER BY degree ASC`
  );
  const degrees: number[] = [];
  while (stmt.step()) {
    degrees.push(Number(stmt.getAsObject().degree));
  }
  stmt.free();

  const sumDegrees = degrees.reduce((acc, value) => acc + value, 0);
  const avg = degrees.length ? sumDegrees / degrees.length : 0;
  const median = degrees.length
    ? degrees[Math.floor(degrees.length / 2)]
    : 0;
  const p90 = degrees.length
    ? degrees[Math.floor(degrees.length * 0.9)]
    : 0;
  const max = degrees.length ? degrees[degrees.length - 1] : 0;

  return { degrees, avg, median, p90, max };
}

export async function getNodeById(id: string): Promise<NodeRecord | null> {
  const db = await ensureDatabase();

  // Try exact match first (fast path)
  let stmt = db.prepare('SELECT * FROM nodes WHERE id = :id LIMIT 1');
  stmt.bind({ ':id': id });
  let node = stmt.step() ? parseNodeRow(stmt.getAsObject()) : null;
  stmt.free();

  if (node) return node;

  // If not found and looks like a short ID (hex chars, 4-36 chars), try prefix match
  const isShortId = /^[0-9a-f]{4,36}$/i.test(id);
  if (!isShortId) return null;

  // Git-style prefix search
  const normalized = id.toLowerCase();
  stmt = db.prepare('SELECT * FROM nodes WHERE lower(id) LIKE :prefix');
  stmt.bind({ ':prefix': `${normalized}%` });

  const matches: NodeRecord[] = [];
  while (stmt.step()) {
    matches.push(parseNodeRow(stmt.getAsObject()));
  }
  stmt.free();

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  // Ambiguous short ID
  throw new Error(`Ambiguous short ID '${id}': matches ${matches.length} nodes. Use a longer prefix.`);
}

export async function getNodesByIds(ids: string[]): Promise<NodeRecord[]> {
  if (ids.length === 0) return [];

  const db = await ensureDatabase();

  // Build WHERE id IN (?, ?, ...) clause
  const placeholders = ids.map((_, i) => `:id${i}`).join(', ');
  const query = `SELECT * FROM nodes WHERE id IN (${placeholders})`;
  const stmt = db.prepare(query);

  // Bind each ID
  const bindings: Record<string, string> = {};
  ids.forEach((id, i) => {
    bindings[`:id${i}`] = id;
  });
  stmt.bind(bindings);

  const nodes: NodeRecord[] = [];
  while (stmt.step()) {
    nodes.push(parseNodeRow(stmt.getAsObject()));
  }
  stmt.free();

  return nodes;
}

export async function findNodeByTitle(title: string): Promise<NodeRecord | null> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT * FROM nodes WHERE lower(title) = lower(:title) LIMIT 1');
  stmt.bind({ ':title': title });
  const node = stmt.step() ? parseNodeRow(stmt.getAsObject()) : null;
  stmt.free();
  return node;
}

export type SearchMatch = {
  node: NodeRecord;
  score: number;
};

export async function searchNodes(term: string, limit = 25): Promise<SearchMatch[]> {
  const normalized = term.trim().toLowerCase();
  if (!normalized) {
    const nodes = await listNodes();
    return nodes
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit)
      .map((node, index) => ({ node, score: Math.max(0.2, 1 - index / limit) }));
  }

  const nodes = await listNodes();
  const scored = nodes
    .map((node) => {
      const titleMatch = node.title.toLowerCase().includes(normalized);
      const tagMatch = node.tags.some((tag) => tag.toLowerCase().includes(normalized));
      const bodyMatch = node.body.toLowerCase().includes(normalized);
      const score = (titleMatch ? 3 : 0) + (tagMatch ? 2 : 0) + (bodyMatch ? 1 : 0);
      return { node, score } as SearchMatch;
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.node.updatedAt).getTime() - new Date(a.node.updatedAt).getTime();
    })
    .slice(0, limit)
    .map((entry) => ({
      node: entry.node,
      score: Math.min(1, entry.score / 6),
    }));

  return scored;
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT * FROM documents ORDER BY updated_at DESC');
  const documents: DocumentRecord[] = [];
  while (stmt.step()) {
    documents.push(parseDocumentRow(stmt.getAsObject()));
  }
  stmt.free();
  return documents;
}

export async function getDocumentById(id: string): Promise<DocumentRecord | null> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT * FROM documents WHERE id = :id LIMIT 1');
  stmt.bind({ ':id': id });
  const document = stmt.step() ? parseDocumentRow(stmt.getAsObject()) : null;
  stmt.free();
  return document;
}

export async function getDocumentByRootNode(rootNodeId: string): Promise<DocumentRecord | null> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT * FROM documents WHERE root_node_id = :root LIMIT 1');
  stmt.bind({ ':root': rootNodeId });
  const document = stmt.step() ? parseDocumentRow(stmt.getAsObject()) : null;
  stmt.free();
  return document;
}

export async function getDocumentForNode(nodeId: string): Promise<DocumentWithChunk | null> {
  const db = await ensureDatabase();
  const mappingStmt = db.prepare('SELECT * FROM document_chunks WHERE node_id = :node LIMIT 1');
  mappingStmt.bind({ ':node': nodeId });
  const mapping = mappingStmt.step() ? parseDocumentChunkRow(mappingStmt.getAsObject()) : null;
  mappingStmt.free();
  if (!mapping) return null;

  const documentStmt = db.prepare('SELECT * FROM documents WHERE id = :id LIMIT 1');
  documentStmt.bind({ ':id': mapping.documentId });
  const document = documentStmt.step() ? parseDocumentRow(documentStmt.getAsObject()) : null;
  documentStmt.free();
  if (!document) return null;

  return { document, chunk: mapping };
}

export async function getDocumentChunks(documentId: string): Promise<DocumentChunkRecord[]> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `SELECT * FROM document_chunks WHERE document_id = :id ORDER BY chunk_order ASC`
  );
  stmt.bind({ ':id': documentId });
  const chunks: DocumentChunkRecord[] = [];
  while (stmt.step()) {
    chunks.push(parseDocumentChunkRow(stmt.getAsObject()));
  }
  stmt.free();
  return chunks;
}

export async function upsertDocument(record: DocumentRecord): Promise<void> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `INSERT INTO documents (id, title, body, metadata, version, root_node_id, created_at, updated_at)
     VALUES (:id, :title, :body, :metadata, :version, :rootNodeId, :createdAt, :updatedAt)
     ON CONFLICT(id)
     DO UPDATE SET
       title = excluded.title,
       body = excluded.body,
       metadata = excluded.metadata,
       version = excluded.version,
       root_node_id = excluded.root_node_id,
       updated_at = excluded.updated_at`
  );
  stmt.bind({
    ':id': record.id,
    ':title': record.title,
    ':body': record.body,
    ':metadata': record.metadata ? JSON.stringify(record.metadata) : null,
    ':version': record.version,
    ':rootNodeId': record.rootNodeId,
    ':createdAt': record.createdAt,
    ':updatedAt': record.updatedAt,
  });
  stmt.step();
  stmt.free();
  await markDirtyAndPersist();
}

export async function replaceDocumentChunks(
  documentId: string,
  chunks: DocumentChunkRecord[]
): Promise<void> {
  const db = await ensureDatabase();
  const deleteStmt = db.prepare('DELETE FROM document_chunks WHERE document_id = :id');
  deleteStmt.bind({ ':id': documentId });
  deleteStmt.step();
  const deleted = db.getRowsModified();
  deleteStmt.free();

  if (chunks.length === 0) {
    if (deleted > 0) {
      await markDirtyAndPersist();
    }
    return;
  }

  const insertStmt = db.prepare(
    `INSERT INTO document_chunks
      (document_id, segment_id, node_id, offset, length, chunk_order, checksum, created_at, updated_at)
     VALUES
      (:documentId, :segmentId, :nodeId, :offset, :length, :chunkOrder, :checksum, :createdAt, :updatedAt)`
  );

  for (const chunk of chunks) {
    insertStmt.bind({
      ':documentId': chunk.documentId,
      ':segmentId': chunk.segmentId,
      ':nodeId': chunk.nodeId,
      ':offset': chunk.offset,
      ':length': chunk.length,
      ':chunkOrder': chunk.chunkOrder,
      ':checksum': chunk.checksum,
      ':createdAt': chunk.createdAt,
      ':updatedAt': chunk.updatedAt,
    });
    insertStmt.step();
    insertStmt.reset();
  }
  insertStmt.free();

  await markDirtyAndPersist();
}

export async function deleteDocumentChunksForNodes(nodeIds: string[]): Promise<void> {
  if (nodeIds.length === 0) return;
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `DELETE FROM document_chunks WHERE node_id IN (${nodeIds.map((_, i) => `:n${i}`).join(', ')})`
  );
  const params: Record<string, string> = {};
  nodeIds.forEach((nodeId, index) => {
    params[`:n${index}`] = nodeId;
  });
  stmt.bind(params as any);
  stmt.step();
  const changes = db.getRowsModified();
  stmt.free();
  if (changes > 0) {
    await markDirtyAndPersist();
  }
}

export async function insertOrUpdateEdge(record: EdgeRecord): Promise<void> {
  const db = await ensureDatabase();
  // Check if edge already exists to update degree counters accurately
  let existedBefore = false;
  {
    const prev = db.prepare(
      `SELECT 1 FROM edges WHERE source_id = :sourceId AND target_id = :targetId LIMIT 1`
    );
    prev.bind({ ':sourceId': record.sourceId, ':targetId': record.targetId });
    existedBefore = prev.step();
    prev.free();
  }
  const stmt = db.prepare(
    `INSERT INTO edges (id, source_id, target_id, score, semantic_score, tag_score, shared_tags, status, edge_type, metadata, created_at, updated_at)
     VALUES (:id, :sourceId, :targetId, :score, :semanticScore, :tagScore, :sharedTags, :status, :edgeType, :metadata, :createdAt, :updatedAt)
     ON CONFLICT(source_id, target_id)
     DO UPDATE SET
       score = excluded.score,
       semantic_score = excluded.semantic_score,
       tag_score = excluded.tag_score,
       shared_tags = excluded.shared_tags,
       status = excluded.status,
       edge_type = excluded.edge_type,
       metadata = excluded.metadata,
       updated_at = excluded.updated_at`
  );
  stmt.bind({
    ':id': record.id,
    ':sourceId': record.sourceId,
    ':targetId': record.targetId,
    ':score': record.score,
    ':semanticScore': record.semanticScore,
    ':tagScore': record.tagScore,
    ':sharedTags': JSON.stringify(record.sharedTags ?? []),
    ':status': record.status,
    ':edgeType': record.edgeType,
    ':metadata': record.metadata ? JSON.stringify(record.metadata) : null,
    ':createdAt': record.createdAt,
    ':updatedAt': record.updatedAt,
  });
  stmt.step();
  stmt.free();

  // Apply degree counter transition if edge was newly inserted
  applyDegreeTransition(db, record.sourceId, record.targetId, existedBefore, true);

  await markDirtyAndPersist();
}

export async function bulkUpdateEdgesV2(
  updates: Array<{
    sourceId: string;
    targetId: string;
    semanticScore: number | null;
    tagScore: number | null;
    sharedTags: string[];
    metadata: Record<string, unknown> | null;
  }>,
): Promise<{ updated: number }> {
  if (updates.length === 0) return { updated: 0 };

  const db = await ensureDatabase();
  db.exec('BEGIN');

  const stmt = db.prepare(
    `UPDATE edges
     SET semantic_score = :semanticScore,
         tag_score = :tagScore,
         shared_tags = :sharedTags,
         metadata = :metadata
     WHERE source_id = :sourceId AND target_id = :targetId`,
  );

  let updated = 0;
  for (const edge of updates) {
    stmt.bind({
      ':sourceId': edge.sourceId,
      ':targetId': edge.targetId,
      ':semanticScore': edge.semanticScore,
      ':tagScore': edge.tagScore,
      ':sharedTags': JSON.stringify(edge.sharedTags ?? []),
      ':metadata': edge.metadata ? JSON.stringify(edge.metadata) : null,
    });
    stmt.step();
    updated += db.getRowsModified();
    stmt.reset();
  }

  stmt.free();
  db.exec('COMMIT');

  await markDirtyAndPersist();
  return { updated };
}

export type ListEdgesOptions = {
  status?: EdgeStatus | 'all';
  orderBy?: 'score' | 'updated_at' | 'created_at';
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
};

export async function listEdges(
  statusOrOptions?: EdgeStatus | 'all' | ListEdgesOptions
): Promise<EdgeRecord[]> {
  const db = await ensureDatabase();

  // Handle backward compatibility: if string passed, treat as status
  let options: ListEdgesOptions;
  if (typeof statusOrOptions === 'string' || statusOrOptions === undefined) {
    options = { status: statusOrOptions ?? 'all' };
  } else {
    options = statusOrOptions;
  }

  const status = options.status ?? 'all';

  // Build query with optional ORDER BY and LIMIT
  let query = status === 'all' ? 'SELECT * FROM edges' : 'SELECT * FROM edges WHERE status = :status';

  if (options.orderBy) {
    const direction = options.orderDirection ?? 'DESC';
    query += ` ORDER BY ${options.orderBy} ${direction}`;
  }

  if (options.limit) {
    query += ' LIMIT :limit';
  }

  const stmt = db.prepare(query);

  const bindings: Record<string, any> = {};
  if (status !== 'all') {
    bindings[':status'] = status;
  }
  if (options.limit) {
    bindings[':limit'] = options.limit;
  }

  if (Object.keys(bindings).length > 0) {
    stmt.bind(bindings);
  }

  const edges: EdgeRecord[] = [];
  while (stmt.step()) {
    edges.push(parseEdgeRow(stmt.getAsObject()));
  }
  stmt.free();
  return edges;
}

export type EdgeEvent = {
  id: number;
  edgeId: string | null;
  sourceId: string;
  targetId: string;
  prevStatus: string | null;
  nextStatus: string;
  payload: any | null;
  createdAt: string;
  undone: boolean;
};

export async function logEdgeEvent(event: {
  edgeId?: string | null;
  sourceId: string;
  targetId: string;
  prevStatus?: string | null;
  nextStatus: string;
  payload?: any | null;
}): Promise<number> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `INSERT INTO edge_events (edge_id, source_id, target_id, prev_status, next_status, payload, created_at, undone)
     VALUES (:edgeId, :sourceId, :targetId, :prevStatus, :nextStatus, :payload, :createdAt, 0)`
  );
  const createdAt = new Date().toISOString();
  stmt.bind({
    ':edgeId': event.edgeId ?? null,
    ':sourceId': event.sourceId,
    ':targetId': event.targetId,
    ':prevStatus': event.prevStatus ?? null,
    ':nextStatus': event.nextStatus,
    ':payload': event.payload ? JSON.stringify(event.payload) : null,
    ':createdAt': createdAt,
  });
  stmt.step();
  const rowId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
  stmt.free();
  await markDirtyAndPersist();
  return rowId;
}

export async function getLastEdgeEventForPair(
  sourceId: string,
  targetId: string
): Promise<EdgeEvent | null> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `SELECT * FROM edge_events WHERE source_id = :source AND target_id = :target AND undone = 0 ORDER BY id DESC LIMIT 1`
  );
  stmt.bind({ ':source': sourceId, ':target': targetId });
  const ev = stmt.step()
    ? (() => {
        const row = stmt.getAsObject();
        return {
          id: Number(row.id),
          edgeId: row.edge_id ? String(row.edge_id) : null,
          sourceId: String(row.source_id),
          targetId: String(row.target_id),
          prevStatus: row.prev_status ? String(row.prev_status) : null,
          nextStatus: String(row.next_status),
          payload: row.payload ? JSON.parse(String(row.payload)) : null,
          createdAt: String(row.created_at),
          undone: Number(row.undone) === 1,
        } as EdgeEvent;
      })()
    : null;
  stmt.free();
  return ev;
}

export async function markEdgeEventUndone(id: number): Promise<void> {
  const db = await ensureDatabase();
  const stmt = db.prepare(`UPDATE edge_events SET undone = 1 WHERE id = :id`);
  stmt.bind({ ':id': id });
  stmt.step();
  stmt.free();
  await markDirtyAndPersist();
}

export async function listEdgeEvents(limit = 500): Promise<EdgeEvent[]> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `SELECT * FROM edge_events WHERE undone = 0 ORDER BY id DESC LIMIT :limit`
  );
  stmt.bind({ ':limit': limit });
  const events: EdgeEvent[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    events.push({
      id: Number(row.id),
      edgeId: row.edge_id ? String(row.edge_id) : null,
      sourceId: String(row.source_id),
      targetId: String(row.target_id),
      prevStatus: row.prev_status ? String(row.prev_status) : null,
      nextStatus: String(row.next_status),
      payload: row.payload ? JSON.parse(String(row.payload)) : null,
      createdAt: String(row.created_at),
      undone: Number(row.undone) === 1,
    });
  }
  stmt.free();
  return events;
}

export async function deleteEdgeBetween(sourceId: string, targetId: string): Promise<boolean> {
  const db = await ensureDatabase();
  const stmt = db.prepare(`DELETE FROM edges WHERE source_id = :source AND target_id = :target`);
  stmt.bind({ ':source': sourceId, ':target': targetId });
  stmt.step();
  const changes = db.getRowsModified();
  stmt.free();

  if (changes > 0) {
    // Apply degree decrement for the removed edge
    applyDegreeTransition(db, sourceId, targetId, true, false);
    await markDirtyAndPersist();
    return true;
  }
  return false;
}

export async function deleteNode(id: string): Promise<{ edgesRemoved: number; nodeRemoved: boolean }> {
  const db = await ensureDatabase();
  // Count edges and gather affected neighbors to adjust degree counters
  let edgesRemoved = 0;
  const affectedNeighbors: string[] = [];
  {
    const q = db.prepare('SELECT source_id, target_id FROM edges WHERE source_id = :id OR target_id = :id');
    q.bind({ ':id': id });
    while (q.step()) {
      const row = q.getAsObject();
      const s = String(row.source_id);
      const t = String(row.target_id);
      const otherId = s === id ? t : s;
      affectedNeighbors.push(otherId);
      edgesRemoved += 1;
    }
    q.free();
  }

  let chunkMappingRemoved = false;
  {
    const deleteMapping = db.prepare('DELETE FROM document_chunks WHERE node_id = :id');
    deleteMapping.bind({ ':id': id });
    deleteMapping.step();
    chunkMappingRemoved = db.getRowsModified() > 0;
    deleteMapping.free();
  }

  // Delete edges
  const delEdges = db.prepare('DELETE FROM edges WHERE source_id = :id OR target_id = :id');
  delEdges.bind({ ':id': id });
  delEdges.step();
  delEdges.free();

  // Delete normalized tags
  {
    const delTags = db.prepare('DELETE FROM node_tags WHERE node_id = :id');
    delTags.bind({ ':id': id });
    delTags.step();
    delTags.free();
  }

  // Adjust neighbors' degree counters (the node itself is being deleted)
  for (const otherId of affectedNeighbors) {
    adjustNodeDegree(db, otherId, -1);
  }

  // Delete node
  const delNode = db.prepare('DELETE FROM nodes WHERE id = :id');
  delNode.bind({ ':id': id });
  delNode.step();
  const nodeRemoved = db.getRowsModified() > 0;
  delNode.free();

  if (edgesRemoved > 0 || nodeRemoved || chunkMappingRemoved) {
    await markDirtyAndPersist();
  }
  return { edgesRemoved, nodeRemoved };
}

export async function closeDb(): Promise<void> {
  await persist();
  database?.close();
  database = null;
  dirty = false;
}

async function persist(): Promise<void> {
  if (!database || !dirty) return;
  const dbPath = getDbPath();
  ensureDirectories(dbPath);
  const data = database.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  dirty = false;
}
