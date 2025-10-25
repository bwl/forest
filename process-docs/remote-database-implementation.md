# Remote Database Implementation

Technical implementation plan for adding remote database support to Forest for team collaboration.

## Goals

1. **Support multiple database backends**: SQLite (local), PostgreSQL (team), MySQL (optional)
2. **Maintain backward compatibility**: Existing local Forest DBs continue working
3. **Zero breaking changes**: CLI/API behavior identical regardless of backend
4. **Simple configuration**: Environment variables or config file
5. **Production-ready**: Connection pooling, error handling, migrations

## Architecture

### Database Adapter Pattern

Create an abstraction layer that supports multiple backends with a unified interface.

```
┌─────────────────────────────────────────┐
│         Core Business Logic             │
│  (src/core/*.ts, src/cli/*.ts)          │
└────────────────┬────────────────────────┘
                 │
                 │ Uses unified interface
                 │
┌────────────────▼────────────────────────┐
│      Database Adapter Interface         │
│       (src/lib/db-adapter.ts)           │
│                                         │
│  - query(sql, params): Promise<Result> │
│  - exec(sql): Promise<void>            │
│  - transaction(fn): Promise<T>         │
│  - close(): Promise<void>              │
└────────────────┬────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
┌────────▼──────┐  ┌─────▼──────────┐
│ SQLiteAdapter │  │ PostgresAdapter│
│ (sql.js)      │  │ (pg library)   │
└───────────────┘  └────────────────┘
```

### Database Types

```typescript
// src/types/database.ts

export type DatabaseConfig =
  | SqliteConfig
  | PostgresConfig
  | MysqlConfig;

export interface SqliteConfig {
  type: 'sqlite';
  path: string;
}

export interface PostgresConfig {
  type: 'postgres';
  url: string;              // postgresql://user:pass@host:port/db
  pool?: {
    min?: number;           // Default: 2
    max?: number;           // Default: 10
    idleTimeout?: number;   // Default: 30000
  };
  ssl?: boolean | {         // For production
    rejectUnauthorized?: boolean;
    ca?: string;
  };
}

export interface MysqlConfig {
  type: 'mysql';
  url: string;
  pool?: {
    min?: number;
    max?: number;
  };
}

// Unified query result type
export interface QueryResult {
  rows: Array<Record<string, any>>;
  rowCount: number;
  fields?: Array<{ name: string; type: string }>;
}

export interface DatabaseAdapter {
  // Execute query and return results
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult>;

  // Execute statement without results (DDL, DML)
  exec(sql: string): Promise<void>;

  // Run multiple statements in a transaction
  transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T>;

  // Get a single value
  get<T = any>(sql: string, params?: any[]): Promise<T | null>;

  // Get single row
  getRow<T = any>(sql: string, params?: any[]): Promise<T | null>;

  // Close connection(s)
  close(): Promise<void>;

  // Check if connected
  isConnected(): boolean;
}
```

### SQLite Adapter (Current Behavior)

```typescript
// src/lib/adapters/sqlite-adapter.ts

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { DatabaseAdapter, QueryResult, SqliteConfig } from '../../types/database';

export class SqliteAdapter implements DatabaseAdapter {
  private sqljs: SqlJsStatic | null = null;
  private database: Database | null = null;
  private config: SqliteConfig;
  private dirty = false;

  constructor(config: SqliteConfig) {
    this.config = config;
  }

  private async ensureDatabase(): Promise<Database> {
    if (!this.sqljs) {
      this.sqljs = await initSqlJs({
        locateFile: (file) => path.join(__dirname, '../../../node_modules/sql.js/dist', file),
      });
    }

    if (!this.database) {
      const dbPath = this.config.path;

      if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        this.database = new this.sqljs.Database(new Uint8Array(fileBuffer));
      } else {
        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        this.database = new this.sqljs.Database();
        this.dirty = true;
      }
    }

    return this.database;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult> {
    const db = await this.ensureDatabase();
    const result = db.exec(sql, params);

    if (result.length === 0) {
      return { rows: [], rowCount: 0 };
    }

    const { columns, values } = result[0];
    const rows = values.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj as T;
    });

    return { rows, rowCount: rows.length };
  }

  async exec(sql: string): Promise<void> {
    const db = await this.ensureDatabase();
    db.exec(sql);
    this.dirty = true;
    await this.persist();
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0]?.[Object.keys(result.rows[0])[0]] ?? null;
  }

  async getRow<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0] ?? null;
  }

  async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    await this.exec('BEGIN TRANSACTION');
    try {
      const result = await fn(this);
      await this.exec('COMMIT');
      return result;
    } catch (error) {
      await this.exec('ROLLBACK');
      throw error;
    }
  }

  async persist(): Promise<void> {
    if (!this.dirty || !this.database) return;

    const data = this.database.export();
    fs.writeFileSync(this.config.path, data);
    this.dirty = false;
  }

  async close(): Promise<void> {
    await this.persist();
    this.database?.close();
    this.database = null;
  }

  isConnected(): boolean {
    return this.database !== null;
  }
}
```

### PostgreSQL Adapter (New)

```typescript
// src/lib/adapters/postgres-adapter.ts

import { Pool, PoolClient, PoolConfig } from 'pg';
import { DatabaseAdapter, QueryResult, PostgresConfig } from '../../types/database';

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool;
  private config: PostgresConfig;

  constructor(config: PostgresConfig) {
    this.config = config;

    const poolConfig: PoolConfig = {
      connectionString: config.url,
      min: config.pool?.min ?? 2,
      max: config.pool?.max ?? 10,
      idleTimeoutMillis: config.pool?.idleTimeout ?? 30000,
    };

    if (config.ssl) {
      poolConfig.ssl = typeof config.ssl === 'boolean'
        ? { rejectUnauthorized: false }
        : config.ssl;
    }

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult> {
    const result = await this.pool.query(sql, params);

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
      fields: result.fields?.map(f => ({ name: f.name, type: f.dataTypeID.toString() })),
    };
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const result = await this.query(sql, params);
    if (result.rows.length === 0) return null;

    const firstRow = result.rows[0];
    const firstKey = Object.keys(firstRow)[0];
    return firstRow[firstKey] ?? null;
  }

  async getRow<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const result = await this.query(sql, params);
    return result.rows[0] ?? null;
  }

  async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const txAdapter = new PostgresTransactionAdapter(client);
      const result = await fn(txAdapter);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  isConnected(): boolean {
    return this.pool.totalCount > 0;
  }
}

// Transaction-scoped adapter using a single client
class PostgresTransactionAdapter implements DatabaseAdapter {
  constructor(private client: PoolClient) {}

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult> {
    const result = await this.client.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    };
  }

  async exec(sql: string): Promise<void> {
    await this.client.query(sql);
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const result = await this.query(sql, params);
    const firstRow = result.rows[0];
    if (!firstRow) return null;
    return firstRow[Object.keys(firstRow)[0]] ?? null;
  }

  async getRow<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const result = await this.query(sql, params);
    return result.rows[0] ?? null;
  }

  async transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    // Nested transactions not supported, just execute the function
    return fn(this);
  }

  async close(): Promise<void> {
    // Don't close the client, it's managed by the parent transaction
  }

  isConnected(): boolean {
    return true;
  }
}
```

### Configuration Management

```typescript
// src/lib/db-config.ts

import fs from 'fs';
import path from 'path';
import { DatabaseConfig, SqliteConfig, PostgresConfig } from '../types/database';

const DEFAULT_SQLITE_PATH = path.join(process.cwd(), 'forest.db');
const CONFIG_FILE_PATH = path.join(process.env.HOME ?? '~', '.config/forest/config.json');

export function loadDatabaseConfig(): DatabaseConfig {
  // Priority 1: Environment variables
  const dbType = process.env.FOREST_DB_TYPE;

  if (dbType === 'postgres' || dbType === 'postgresql') {
    const url = process.env.FOREST_DB_URL;
    if (!url) {
      throw new Error('FOREST_DB_URL must be set when FOREST_DB_TYPE=postgres');
    }

    return {
      type: 'postgres',
      url,
      pool: {
        min: parseInt(process.env.FOREST_DB_POOL_MIN ?? '2'),
        max: parseInt(process.env.FOREST_DB_POOL_MAX ?? '10'),
      },
      ssl: process.env.FOREST_DB_SSL === 'true',
    } as PostgresConfig;
  }

  if (dbType === 'sqlite' || !dbType) {
    return {
      type: 'sqlite',
      path: process.env.FOREST_DB_PATH ?? DEFAULT_SQLITE_PATH,
    } as SqliteConfig;
  }

  // Priority 2: Config file
  if (fs.existsSync(CONFIG_FILE_PATH)) {
    const configFile = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'));
    if (configFile.database) {
      return configFile.database as DatabaseConfig;
    }
  }

  // Default: SQLite
  return {
    type: 'sqlite',
    path: DEFAULT_SQLITE_PATH,
  };
}

export function validateConfig(config: DatabaseConfig): void {
  if (config.type === 'postgres') {
    if (!config.url) {
      throw new Error('PostgreSQL URL is required');
    }
    if (!config.url.startsWith('postgres://') && !config.url.startsWith('postgresql://')) {
      throw new Error('Invalid PostgreSQL URL format');
    }
  } else if (config.type === 'sqlite') {
    if (!config.path) {
      throw new Error('SQLite path is required');
    }
  } else {
    throw new Error(`Unsupported database type: ${(config as any).type}`);
  }
}
```

### Adapter Factory

```typescript
// src/lib/db-factory.ts

import { DatabaseAdapter, DatabaseConfig } from '../types/database';
import { SqliteAdapter } from './adapters/sqlite-adapter';
import { PostgresAdapter } from './adapters/postgres-adapter';
import { loadDatabaseConfig, validateConfig } from './db-config';

let adapter: DatabaseAdapter | null = null;

export function getAdapter(): DatabaseAdapter {
  if (!adapter) {
    const config = loadDatabaseConfig();
    validateConfig(config);
    adapter = createAdapter(config);
  }
  return adapter;
}

export function createAdapter(config: DatabaseConfig): DatabaseAdapter {
  switch (config.type) {
    case 'sqlite':
      return new SqliteAdapter(config);
    case 'postgres':
      return new PostgresAdapter(config);
    default:
      throw new Error(`Unsupported database type: ${(config as any).type}`);
  }
}

export async function closeAdapter(): Promise<void> {
  if (adapter) {
    await adapter.close();
    adapter = null;
  }
}

// For testing: inject custom adapter
export function setAdapter(customAdapter: DatabaseAdapter): void {
  adapter = customAdapter;
}
```

### Refactor `src/lib/db.ts`

Replace direct sql.js usage with adapter pattern:

```typescript
// src/lib/db.ts (refactored)

import { getAdapter } from './db-factory';
import { DatabaseAdapter } from '../types/database';

// Export the adapter getter
export function db(): DatabaseAdapter {
  return getAdapter();
}

// Example: getNodeById refactored to use adapter
export async function getNodeById(id: string): Promise<NodeRecord | null> {
  const adapter = db();

  const result = await adapter.query(
    `SELECT id, title, body, tags, token_counts, embedding,
            created_at, updated_at, is_chunk, parent_document_id, chunk_order
     FROM nodes WHERE id = ?`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tags: JSON.parse(row.tags),
    tokenCounts: JSON.parse(row.token_counts),
    embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isChunk: Boolean(row.is_chunk),
    parentDocumentId: row.parent_document_id,
    chunkOrder: row.chunk_order,
  };
}

// Example: createNode refactored to use adapter
export async function createNode(data: Partial<NodeRecord>): Promise<NodeRecord> {
  const adapter = db();

  const node: NodeRecord = {
    id: data.id ?? generateId(),
    title: data.title ?? '',
    body: data.body ?? '',
    tags: data.tags ?? [],
    tokenCounts: data.tokenCounts ?? {},
    embedding: data.embedding,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isChunk: data.isChunk ?? false,
    parentDocumentId: data.parentDocumentId ?? null,
    chunkOrder: data.chunkOrder ?? null,
  };

  await adapter.query(
    `INSERT INTO nodes (id, title, body, tags, token_counts, embedding,
                        created_at, updated_at, is_chunk, parent_document_id, chunk_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      node.id,
      node.title,
      node.body,
      JSON.stringify(node.tags),
      JSON.stringify(node.tokenCounts),
      node.embedding ? JSON.stringify(node.embedding) : null,
      node.createdAt,
      node.updatedAt,
      node.isChunk ? 1 : 0,
      node.parentDocumentId,
      node.chunkOrder,
    ]
  );

  return node;
}
```

## Schema Migrations

### Migration System

```typescript
// src/lib/migrations.ts

import { DatabaseAdapter } from '../types/database';

export interface Migration {
  version: number;
  name: string;
  up: (adapter: DatabaseAdapter) => Promise<void>;
  down?: (adapter: DatabaseAdapter) => Promise<void>;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: async (adapter) => {
      await adapter.exec(`
        CREATE TABLE IF NOT EXISTS nodes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          tags TEXT NOT NULL,
          token_counts TEXT NOT NULL,
          embedding TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          is_chunk INTEGER DEFAULT 0,
          parent_document_id TEXT,
          chunk_order INTEGER
        );

        CREATE TABLE IF NOT EXISTS edges (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          score REAL NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('accepted', 'suggested')),
          edge_type TEXT DEFAULT 'semantic',
          metadata TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(source_id, target_id)
        );

        CREATE INDEX IF NOT EXISTS idx_edges_status ON edges(status);
        CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
        CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
      `);
    },
  },
  {
    version: 2,
    name: 'add_documents_table',
    up: async (adapter) => {
      await adapter.exec(`
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
      `);
    },
  },
  {
    version: 3,
    name: 'add_author_tracking',
    up: async (adapter) => {
      await adapter.exec(`
        ALTER TABLE nodes ADD COLUMN author TEXT;
        ALTER TABLE documents ADD COLUMN author TEXT;
        ALTER TABLE edges ADD COLUMN author TEXT;
      `);
    },
  },
];

export async function runMigrations(adapter: DatabaseAdapter): Promise<void> {
  // Ensure metadata table exists
  await adapter.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Get current version
  const currentVersion = await adapter.get<number>(
    `SELECT value FROM metadata WHERE key = 'schema_version'`
  ) ?? 0;

  // Run pending migrations
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Running migration ${migration.version}: ${migration.name}`);
      await migration.up(adapter);
      await adapter.exec(
        `INSERT OR REPLACE INTO metadata (key, value) VALUES ('schema_version', '${migration.version}')`
      );
    }
  }
}
```

## Author Tracking

Add user/author metadata to support team collaboration:

```typescript
// src/lib/auth.ts

export interface User {
  username: string;
  email?: string;
  displayName?: string;
}

let currentUser: User | null = null;

export function setCurrentUser(user: User): void {
  currentUser = user;
}

export function getCurrentUser(): User {
  if (currentUser) return currentUser;

  // Fall back to environment or git config
  const username =
    process.env.FOREST_USER ??
    process.env.USER ??
    process.env.USERNAME ??
    'unknown';

  const email = process.env.FOREST_EMAIL ?? tryGetGitEmail();

  return { username, email };
}

function tryGetGitEmail(): string | undefined {
  try {
    const { execSync } = require('child_process');
    return execSync('git config user.email', { encoding: 'utf-8' }).trim();
  } catch {
    return undefined;
  }
}

// Update node creation to include author
export async function createNodeWithAuthor(data: Partial<NodeRecord>): Promise<NodeRecord> {
  const user = getCurrentUser();

  return createNode({
    ...data,
    author: user.username,
  });
}
```

## Configuration Examples

### Local Development

```bash
# Use local SQLite (default)
forest capture --stdin < note.md
```

### Team Collaboration

```bash
# Environment variables
export FOREST_DB_TYPE=postgres
export FOREST_DB_URL=postgresql://forest:password@db.company.local:5432/team_knowledge
export FOREST_USER=alice
export FOREST_EMAIL=alice@company.com

forest capture --stdin < note.md
```

### Config File

```json
// ~/.config/forest/config.json
{
  "database": {
    "type": "postgres",
    "url": "postgresql://forest@db.company.local/team_kb",
    "pool": {
      "min": 2,
      "max": 10
    },
    "ssl": true
  },
  "user": {
    "username": "alice",
    "email": "alice@company.com",
    "displayName": "Alice Johnson"
  },
  "embeddings": {
    "provider": "openai",
    "apiKey": "${OPENAI_API_KEY}"
  }
}
```

## Deployment Example

### Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: forest_kb
      POSTGRES_USER: forest
      POSTGRES_PASSWORD: secure_password
    volumes:
      - forest_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  forest-api:
    image: forest-cli:latest
    command: forest serve --port 3000 --host 0.0.0.0
    environment:
      FOREST_DB_TYPE: postgres
      FOREST_DB_URL: postgresql://forest:secure_password@postgres:5432/forest_kb
      FOREST_EMBED_PROVIDER: openai
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - postgres

volumes:
  forest_data:
```

### CLI Usage

```bash
# Team members configure their CLI
export FOREST_DB_TYPE=postgres
export FOREST_DB_URL=postgresql://forest:password@team-db.company.internal:5432/forest_kb

# Use Forest as normal
forest capture --template meeting-notes --stdin < standup.md
forest search "authentication"
forest explore
```

## Migration Path

### Phase 1: Adapter Implementation (Week 1-2)
- [ ] Implement `DatabaseAdapter` interface
- [ ] Create `SqliteAdapter` (refactor existing code)
- [ ] Create `PostgresAdapter` with connection pooling
- [ ] Add configuration management
- [ ] Update migration system

### Phase 2: Core Integration (Week 3-4)
- [ ] Refactor `src/lib/db.ts` to use adapters
- [ ] Add author tracking to nodes/documents/edges
- [ ] Test all core operations with both SQLite and Postgres
- [ ] Update CLI commands to handle multi-user scenarios
- [ ] Add user configuration (`FOREST_USER`, `FOREST_EMAIL`)

### Phase 3: Team Features (Week 5-6)
- [ ] Add author display in CLI output
- [ ] Implement `--author` filter for search/explore
- [ ] Add team stats (`forest stats --by-author`)
- [ ] Create setup guide for team deployments
- [ ] Add conflict detection (warn if node edited by multiple users)

### Phase 4: Production Hardening (Week 7-8)
- [ ] Connection pooling optimization
- [ ] Error handling and retry logic
- [ ] Logging and monitoring
- [ ] Performance benchmarks (local vs remote)
- [ ] Security audit (SQL injection, auth)
- [ ] Backup/restore utilities

## Testing Strategy

```typescript
// tests/database-adapters.test.ts

import { SqliteAdapter } from '../src/lib/adapters/sqlite-adapter';
import { PostgresAdapter } from '../src/lib/adapters/postgres-adapter';

describe('Database Adapters', () => {
  const adapters = [
    { name: 'SQLite', create: () => new SqliteAdapter({ type: 'sqlite', path: ':memory:' }) },
    { name: 'Postgres', create: () => new PostgresAdapter({ type: 'postgres', url: process.env.TEST_DB_URL }) },
  ];

  for (const { name, create } of adapters) {
    describe(name, () => {
      let adapter: DatabaseAdapter;

      beforeEach(async () => {
        adapter = create();
        await runMigrations(adapter);
      });

      afterEach(async () => {
        await adapter.close();
      });

      test('should create and retrieve node', async () => {
        const node = await createNode({ title: 'Test', body: 'Content' });
        const retrieved = await getNodeById(node.id);
        expect(retrieved).toEqual(node);
      });

      test('should handle transactions', async () => {
        await adapter.transaction(async (tx) => {
          await createNode({ title: 'Node 1', body: 'Body 1' });
          await createNode({ title: 'Node 2', body: 'Body 2' });
        });

        const nodes = await listNodes();
        expect(nodes).toHaveLength(2);
      });

      test('should rollback on error', async () => {
        await expect(async () => {
          await adapter.transaction(async (tx) => {
            await createNode({ title: 'Node 1', body: 'Body 1' });
            throw new Error('Rollback test');
          });
        }).rejects.toThrow('Rollback test');

        const nodes = await listNodes();
        expect(nodes).toHaveLength(0);
      });
    });
  }
});
```

## Performance Considerations

### Local SQLite
- **Latency**: < 1ms (in-memory operations)
- **Throughput**: 10,000+ ops/sec
- **Scaling**: Single user, no network overhead
- **Best for**: Personal knowledge base, development

### Remote PostgreSQL
- **Latency**: 5-50ms (depends on network)
- **Throughput**: 100-1000 ops/sec (with connection pooling)
- **Scaling**: Multiple users, shared knowledge
- **Best for**: Team collaboration, production

### Optimization Strategies

1. **Connection pooling**: Reuse connections (min: 2, max: 10)
2. **Prepared statements**: Cache query plans
3. **Batch operations**: Insert multiple nodes in one transaction
4. **Lazy loading**: Fetch embeddings only when needed
5. **Caching**: Cache frequently accessed nodes (optional)

## Open Questions

1. **Conflict resolution**: Use optimistic locking (version numbers) or last-write-wins?
2. **Real-time updates**: Poll on read, WebSocket push, or SSE?
3. **Permissions**: Role-based access control or simple read/write?
4. **Multi-tenancy**: Separate databases per team or shared with team_id?
5. **Embedding storage**: Store in DB or external vector store (Pinecone, Weaviate)?
6. **Backup strategy**: Automated backups, point-in-time recovery?
7. **Analytics**: Track usage metrics, popular nodes, search patterns?

## Success Metrics

- [ ] Both SQLite and Postgres adapters pass 100% of tests
- [ ] Zero breaking changes to existing CLI commands
- [ ] PostgreSQL adapter performs within 2x of SQLite for single-user workloads
- [ ] Team of 10 developers can collaborate without conflicts
- [ ] Migration from local to remote takes < 5 minutes
- [ ] Documentation covers all configuration options

---

**This implementation enables Forest to scale from personal knowledge base to team collaboration platform while maintaining its developer-friendly CLI-first experience.**
