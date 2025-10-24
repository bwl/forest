-- Initial Forest database schema
-- This schema matches the TypeScript implementation for backward compatibility

-- Core node storage with full metadata
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    tags TEXT NOT NULL,              -- JSON array: ["tag1", "tag2"]
    token_counts TEXT NOT NULL,      -- JSON object: {"token": count}
    embedding TEXT,                  -- JSON array: [0.123, -0.456, ...]
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_chunk INTEGER NOT NULL DEFAULT 0,
    parent_document_id TEXT,
    chunk_order INTEGER
);

-- Edge relationships between nodes
CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    score REAL NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('accepted', 'suggested')),
    edge_type TEXT NOT NULL DEFAULT 'semantic',
    metadata TEXT,                   -- JSON object: {"key": value}
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(source_id, target_id)
);

-- Canonical document storage
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    metadata TEXT,                   -- JSON object: DocumentMetadata
    version INTEGER NOT NULL DEFAULT 1,
    root_node_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Document-to-node chunk mappings
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

-- Edge event history for undo support
CREATE TABLE IF NOT EXISTS edge_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    edge_id TEXT,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    prev_status TEXT,
    next_status TEXT NOT NULL,
    payload TEXT,                    -- JSON object
    created_at TEXT NOT NULL,
    undone INTEGER NOT NULL DEFAULT 0
);

-- Metadata key-value store
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_edges_status ON edges(status);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edge_events_pair ON edge_events(source_id, target_id);
CREATE INDEX IF NOT EXISTS idx_edge_events_edge ON edge_events(edge_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_chunks_node ON document_chunks(node_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_order ON document_chunks(document_id, chunk_order);
