import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';

export type NodeRecord = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  tokenCounts: Record<string, number>;
  createdAt: string;
  updatedAt: string;
};

export type EdgeStatus = 'accepted' | 'suggested';

export type EdgeRecord = {
  id: string;
  sourceId: string;
  targetId: string;
  score: number;
  status: EdgeStatus;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
};

const DEFAULT_DB_PATH = path.join(process.cwd(), 'forest.db');

let sqljs: SqlJsStatic | null = null;
let database: Database | null = null;
let dirty = false;

function getDbPath(): string {
  return process.env.FOREST_DB_PATH ?? DEFAULT_DB_PATH;
}

function locateWasmFile(file: string): string {
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
  `);
}

async function markDirtyAndPersist() {
  dirty = true;
  await persist();
}

export async function insertNode(record: NodeRecord): Promise<void> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `INSERT INTO nodes (id, title, body, tags, token_counts, created_at, updated_at)
     VALUES (:id, :title, :body, :tags, :tokenCounts, :createdAt, :updatedAt)`
  );
  stmt.bind({
    ':id': record.id,
    ':title': record.title,
    ':body': record.body,
    ':tags': JSON.stringify(record.tags),
    ':tokenCounts': JSON.stringify(record.tokenCounts),
    ':createdAt': record.createdAt,
    ':updatedAt': record.updatedAt,
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
  fields: Partial<Pick<NodeRecord, 'title' | 'body' | 'tags' | 'tokenCounts'>>
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

export async function listNodes(): Promise<NodeRecord[]> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT * FROM nodes');
  const nodes: NodeRecord[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    nodes.push({
      id: String(row.id),
      title: String(row.title),
      body: String(row.body),
      tags: JSON.parse(String(row.tags)),
      tokenCounts: JSON.parse(String(row.token_counts)),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    });
  }
  stmt.free();
  return nodes;
}

export async function getNodeById(id: string): Promise<NodeRecord | null> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT * FROM nodes WHERE id = :id LIMIT 1');
  stmt.bind({ ':id': id });
  const node = stmt.step()
    ? (() => {
        const row = stmt.getAsObject();
        return {
          id: String(row.id),
          title: String(row.title),
          body: String(row.body),
          tags: JSON.parse(String(row.tags)),
          tokenCounts: JSON.parse(String(row.token_counts)),
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at),
        } satisfies NodeRecord;
      })()
    : null;
  stmt.free();
  return node;
}

export async function findNodeByTitle(title: string): Promise<NodeRecord | null> {
  const db = await ensureDatabase();
  const stmt = db.prepare('SELECT * FROM nodes WHERE lower(title) = lower(:title) LIMIT 1');
  stmt.bind({ ':title': title });
  const node = stmt.step()
    ? (() => {
        const row = stmt.getAsObject();
        return {
          id: String(row.id),
          title: String(row.title),
          body: String(row.body),
          tags: JSON.parse(String(row.tags)),
          tokenCounts: JSON.parse(String(row.token_counts)),
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at),
        } satisfies NodeRecord;
      })()
    : null;
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

export async function insertOrUpdateEdge(record: EdgeRecord): Promise<void> {
  const db = await ensureDatabase();
  const stmt = db.prepare(
    `INSERT INTO edges (id, source_id, target_id, score, status, metadata, created_at, updated_at)
     VALUES (:id, :sourceId, :targetId, :score, :status, :metadata, :createdAt, :updatedAt)
     ON CONFLICT(source_id, target_id)
     DO UPDATE SET
       score = excluded.score,
       status = excluded.status,
       metadata = excluded.metadata,
       updated_at = excluded.updated_at`
  );
  stmt.bind({
    ':id': record.id,
    ':sourceId': record.sourceId,
    ':targetId': record.targetId,
    ':score': record.score,
    ':status': record.status,
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
    const row = stmt.getAsObject();
    edges.push({
      id: String(row.id),
      sourceId: String(row.source_id),
      targetId: String(row.target_id),
      score: Number(row.score),
      status: row.status as EdgeStatus,
      metadata: row.metadata ? JSON.parse(String(row.metadata)) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    });
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

  if (edgesRemoved > 0 || nodeRemoved) {
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
