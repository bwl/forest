import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { getDirname } from './esm.js';

export type NodeRecord = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  tokenCounts: Record<string, number>;
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
  // Document chunking metadata
  isChunk: boolean;
  parentDocumentId: string | null;
  chunkOrder: number | null;
};

export type EdgeStatus = 'accepted' | 'suggested';
export type EdgeType = 'semantic' | 'parent-child' | 'sequential' | 'manual';

export type EdgeRecord = {
  id: string;
  sourceId: string;
  targetId: string;
  score: number;
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

const DEFAULT_DB_PATH = path.join(process.cwd(), 'forest.db');

let sqljs: SqlJsStatic | null = null;
let database: Database | null = null;
let dirty = false;

function getDbPath(): string {
  return process.env.FOREST_DB_PATH ?? DEFAULT_DB_PATH;
}

function locateWasmFile(file: string): string {
  const __dirname = getDirname(import.meta);
  return path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file);
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
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      score REAL NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('accepted', 'suggested')),
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(source_id, target_id)
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
  } catch (_) {
    // Best-effort; ignore if pragma not supported in this context
  }

  // Add edge_type column to edges table if missing
  try {
    const res = db.exec(`PRAGMA table_info(edges);`);
    const columns = res.length > 0 ? res[0].values.map((row) => String(row[1])) : [];

    if (!columns.includes('edge_type')) {
      db.exec(`ALTER TABLE edges ADD COLUMN edge_type TEXT NOT NULL DEFAULT 'semantic';`);
      dirty = true;
    }
  } catch (_) {
    // Best-effort; ignore if pragma not supported in this context
  }
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
    isChunk: Number(row.is_chunk || 0) === 1,
    parentDocumentId: row.parent_document_id ? String(row.parent_document_id) : null,
    chunkOrder: row.chunk_order ? Number(row.chunk_order) : null,
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
    status: row.status as EdgeStatus,
    edgeType: (row.edge_type as EdgeType) || 'semantic',
    metadata: row.metadata ? JSON.parse(String(row.metadata)) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function insertNode(record: NodeRecord): Promise<void> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `INSERT INTO nodes (id, title, body, tags, token_counts, embedding, created_at, updated_at, is_chunk, parent_document_id, chunk_order)
     VALUES (:id, :title, :body, :tags, :tokenCounts, :embedding, :createdAt, :updatedAt, :isChunk, :parentDocumentId, :chunkOrder)`
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
  });
  stmt.step();
  stmt.free();
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
  fields: Partial<Pick<NodeRecord, 'title' | 'body' | 'tags' | 'tokenCounts' | 'embedding'>>
): Promise<void> {
  const db = await ensureDatabase();
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
  sets.push('updated_at = :updatedAt');
  const sql = `UPDATE nodes SET ${sets.join(', ')} WHERE id = :id`;
  const stmt = db.prepare(sql);
  stmt.bind(params as any);
  stmt.step();
  stmt.free();
  await markDirtyAndPersist();
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

export async function getNodeById(id: string): Promise<NodeRecord | null> {
  const db = await ensureDatabase();

  // Try exact match first (fast path)
  let stmt = db.prepare('SELECT * FROM nodes WHERE id = :id LIMIT 1');
  stmt.bind({ ':id': id });
  let node = stmt.step() ? parseNodeRow(stmt.getAsObject()) : null;
  stmt.free();

  if (node) return node;

  // If not found and looks like a short ID (hex chars, 6-8 chars), try prefix match
  const isShortId = /^[0-9a-f]{6,8}$/i.test(id);
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
  const stmt = db.prepare(
    `INSERT INTO edges (id, source_id, target_id, score, status, edge_type, metadata, created_at, updated_at)
     VALUES (:id, :sourceId, :targetId, :score, :status, :edgeType, :metadata, :createdAt, :updatedAt)
     ON CONFLICT(source_id, target_id)
     DO UPDATE SET
       score = excluded.score,
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
    ':status': record.status,
    ':edgeType': record.edgeType,
    ':metadata': record.metadata ? JSON.stringify(record.metadata) : null,
    ':createdAt': record.createdAt,
    ':updatedAt': record.updatedAt,
  });
  stmt.step();
  stmt.free();
  await markDirtyAndPersist();
}

export async function listEdges(status: EdgeStatus | 'all' = 'all'): Promise<EdgeRecord[]> {
  const db = await ensureDatabase();
  const query = status === 'all' ? 'SELECT * FROM edges' : 'SELECT * FROM edges WHERE status = :status';
  const stmt = db.prepare(query);
  if (status !== 'all') {
    stmt.bind({ ':status': status });
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
    await markDirtyAndPersist();
    return true;
  }
  return false;
}

export async function deleteNode(id: string): Promise<{ edgesRemoved: number; nodeRemoved: boolean }> {
  const db = await ensureDatabase();
  // Count edges first
  let edgesRemoved = 0;
  {
    const countStmt = db.prepare('SELECT COUNT(1) as c FROM edges WHERE source_id = :id OR target_id = :id');
    countStmt.bind({ ':id': id });
    if (countStmt.step()) {
      const row = countStmt.getAsObject();
      edgesRemoved = Number(row.c) || 0;
    }
    countStmt.free();
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

export async function promoteSuggestions(minScore: number): Promise<number> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `UPDATE edges SET status = 'accepted', updated_at = :updatedAt WHERE status = 'suggested' AND score >= :minScore`
  );
  stmt.bind({ ':updatedAt': new Date().toISOString(), ':minScore': minScore });
  stmt.step();
  const changes = db.getRowsModified();
  stmt.free();
  if (changes > 0) {
    await markDirtyAndPersist();
  }
  return changes;
}

export async function deleteSuggestion(edgeId: string): Promise<number> {
  const db = await ensureDatabase();
  const stmt = db.prepare(`DELETE FROM edges WHERE id = :id AND status = 'suggested'`);
  stmt.bind({ ':id': edgeId });
  stmt.step();
  const changes = db.getRowsModified();
  stmt.free();
  if (changes > 0) {
    await markDirtyAndPersist();
  }
  return changes;
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
