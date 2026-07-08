/**
 * Extract a bridge constellation into a standalone Forest DB.
 *
 * Takes the #1 bridge node + its best connection from each document,
 * copies those 12 nodes and all edges between them into a new database.
 *
 * Usage:
 *   FOREST_DB_PATH=./databases/books.db FOREST_TESTING_LOCALDB=1 \
 *     bun run scripts/extract-bridge-graph.ts [output.db]
 */

import {
  getTopBridgeNodes,
  getCrossDocEdgesForNode,
  getNodeById,
  listEdges,
  getDocumentById,
} from '../src/lib/db';

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const outputPath = process.argv[2] || './databases/bridge-constellation.db';

// ── Step 1: Find the hub and its best spoke per document ──────────────

console.log('Finding top bridge node...');
const [hub] = await getTopBridgeNodes(1);
if (!hub) {
  console.error('No bridge nodes found.');
  process.exit(1);
}

console.log(`Hub: ${hub.nodeTitle} (${hub.nodeId.slice(0, 8)})`);
console.log(`Cross-doc edges: ${hub.crossDocDegree}, connected docs: ${hub.connectedDocCount}`);

// Get enough edges to cover all documents (best per doc)
const crossEdges = await getCrossDocEdgesForNode(hub.nodeId, 2000);

// Pick the single best edge per document
const bestPerDoc = new Map<string, typeof crossEdges[0]>();
for (const e of crossEdges) {
  const docKey = e.edgeDocId || e.edgeNodeId;
  if (!bestPerDoc.has(docKey) || e.score > bestPerDoc.get(docKey)!.score) {
    bestPerDoc.set(docKey, e);
  }
}

const spokeNodeIds = [...bestPerDoc.values()].map(e => e.edgeNodeId);
const allNodeIds = [hub.nodeId, ...spokeNodeIds];

console.log(`\nConstellation: 1 hub + ${spokeNodeIds.length} spokes = ${allNodeIds.length} nodes`);

// ── Step 2: Load full node records ────────────────────────────────────

console.log('Loading node records...');
const nodes = [];
for (const id of allNodeIds) {
  const node = await getNodeById(id);
  if (node) {
    nodes.push(node);
    const doc = node.parentDocumentId ? await getDocumentById(node.parentDocumentId) : null;
    const docLabel = doc ? ` [${doc.title}]` : '';
    console.log(`  ${node.id.slice(0, 8)}${docLabel} ${node.title.slice(0, 60)}`);
  }
}

// ── Step 3: Find all edges between these nodes ────────────────────────

console.log('\nFinding inter-constellation edges...');
const nodeSet = new Set(allNodeIds);
const allEdges = await listEdges('accepted');
const constellationEdges = allEdges.filter(
  e => nodeSet.has(e.sourceId) && nodeSet.has(e.targetId)
);
console.log(`Found ${constellationEdges.length} edges between constellation nodes`);

// ── Step 4: Write to new database ────────────────────────────────────

console.log(`\nWriting to ${outputPath}...`);

// Ensure output directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Remove existing file
if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath);
}

const sqljs = await initSqlJs();
const db = new sqljs.Database();

// Create schema (minimal — just what Forest needs)
db.exec(`
  CREATE TABLE nodes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tags TEXT NOT NULL,
    token_counts TEXT NOT NULL,
    embedding TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    approximate_scored INTEGER NOT NULL DEFAULT 1,
    is_chunk INTEGER NOT NULL DEFAULT 0,
    parent_document_id TEXT,
    chunk_order INTEGER,
    accepted_degree INTEGER NOT NULL DEFAULT 0,
    metadata TEXT,
    embedding_blob BLOB
  );

  CREATE TABLE edges (
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

  CREATE TABLE node_tags (
    node_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY (node_id, tag)
  );
  CREATE INDEX idx_node_tags_tag ON node_tags(tag);

  CREATE TABLE tag_idf (
    tag TEXT PRIMARY KEY,
    doc_freq INTEGER NOT NULL,
    idf REAL NOT NULL
  );

  CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX idx_edges_status ON edges(status);
  CREATE INDEX idx_edges_source ON edges(source_id);
  CREATE INDEX idx_edges_target ON edges(target_id);

  CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    metadata TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    root_node_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE document_chunks (
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

  CREATE TABLE edge_events (
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

  CREATE TABLE node_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tags TEXT NOT NULL,
    token_counts TEXT NOT NULL,
    embedding TEXT,
    metadata TEXT,
    operation TEXT NOT NULL DEFAULT 'update',
    restored_from_version INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE graph_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taken_at TEXT NOT NULL,
    node_count INTEGER NOT NULL,
    edge_count INTEGER NOT NULL,
    tag_count INTEGER NOT NULL,
    nodes TEXT NOT NULL,
    edges TEXT NOT NULL,
    snapshot_type TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT ''
  );
`);

// Insert nodes
const insertNode = db.prepare(`
  INSERT INTO nodes (id, title, body, tags, token_counts, embedding, created_at, updated_at,
    approximate_scored, is_chunk, parent_document_id, chunk_order, accepted_degree, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const n of nodes) {
  insertNode.run([
    n.id, n.title, n.body,
    JSON.stringify(n.tags),
    JSON.stringify(n.tokenCounts),
    n.embedding ? JSON.stringify(n.embedding) : null,
    n.createdAt, n.updatedAt,
    n.approximateScored ? 1 : 0,
    n.isChunk ? 1 : 0,
    n.parentDocumentId,
    n.chunkOrder,
    0, // will recount
    n.metadata ? JSON.stringify(n.metadata) : null,
  ]);

  // Insert node_tags
  for (const tag of n.tags) {
    db.run('INSERT OR IGNORE INTO node_tags (node_id, tag) VALUES (?, ?)', [n.id, tag]);
  }
}
insertNode.free();

// Insert edges and count degrees
const degreeCounts = new Map<string, number>();
const insertEdge = db.prepare(`
  INSERT INTO edges (id, source_id, target_id, score, semantic_score, tag_score,
    shared_tags, status, edge_type, metadata, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const e of constellationEdges) {
  insertEdge.run([
    e.id, e.sourceId, e.targetId, e.score,
    e.semanticScore, e.tagScore,
    JSON.stringify(e.sharedTags),
    e.status, e.edgeType,
    e.metadata ? JSON.stringify(e.metadata) : null,
    e.createdAt, e.updatedAt,
  ]);
  degreeCounts.set(e.sourceId, (degreeCounts.get(e.sourceId) || 0) + 1);
  degreeCounts.set(e.targetId, (degreeCounts.get(e.targetId) || 0) + 1);
}
insertEdge.free();

// Update accepted_degree
for (const [nodeId, degree] of degreeCounts) {
  db.run('UPDATE nodes SET accepted_degree = ? WHERE id = ?', [degree, nodeId]);
}

// Build tag_idf
const tagCounts = new Map<string, number>();
for (const n of nodes) {
  for (const tag of n.tags) {
    tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
}
const totalNodes = nodes.length;
for (const [tag, count] of tagCounts) {
  const idf = Math.log(totalNodes / count);
  db.run('INSERT INTO tag_idf (tag, doc_freq, idf) VALUES (?, ?, ?)', [tag, count, idf]);
}

// Insert stub documents for context
const docIds = new Set<string>();
for (const n of nodes) {
  if (n.parentDocumentId) docIds.add(n.parentDocumentId);
}
for (const docId of docIds) {
  const doc = await getDocumentById(docId);
  if (doc) {
    db.run(
      `INSERT OR IGNORE INTO documents (id, title, body, metadata, version, root_node_id, created_at, updated_at)
       VALUES (?, ?, '', ?, ?, ?, ?, ?)`,
      [doc.id, doc.title, doc.metadata ? JSON.stringify(doc.metadata) : null,
       doc.version, doc.rootNodeId, doc.createdAt, doc.updatedAt],
    );
  }
}

// Save
const data = db.export();
fs.writeFileSync(outputPath, Buffer.from(data));
db.close();

console.log(`\nDone! ${nodes.length} nodes, ${constellationEdges.length} edges`);
console.log(`\nTo explore:`);
console.log(`  FOREST_DB_PATH=${outputPath} FOREST_TESTING_LOCALDB=1 bun run dev -- explore`);
console.log(`  FOREST_DB_PATH=${outputPath} FOREST_TESTING_LOCALDB=1 bun run dev -- bridges`);
console.log(`  FOREST_DB_PATH=${outputPath} FOREST_TESTING_LOCALDB=1 bun run dev -- stats`);

process.exit(0);
