# Thin Client Mode: Forest CLI with Remote Server

## The Insight

Forest already has **everything needed** for thin client mode:
- Complete REST API server (`forest serve`)
- 3-layer architecture (CLI → Core → Database)
- Core functions already abstracted

**The opportunity**: Add a `FOREST_MODE=client` configuration that makes the CLI talk to a remote Forest API server instead of a local database.

## Architecture

### Current: Thick Client (Local Database)

```
┌─────────────┐
│ forest CLI  │
└──────┬──────┘
       │
┌──────▼──────┐
│   Core      │
└──────┬──────┘
       │
┌──────▼──────┐
│  Database   │  ← SQLite or PostgreSQL
│  (local)    │
└─────────────┘
```

### Proposed: Thin Client (Remote API)

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Alice's CLI │  │ Bob's CLI   │  │Claude Code  │
│ (thin)      │  │ (thin)      │  │ CLI (thin)  │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │ HTTP/HTTPS
                 ┌──────▼──────┐
                 │ Forest API  │  ← forest serve
                 │   Server    │
                 └──────┬──────┘
                        │
                 ┌──────▼──────┐
                 │  Database   │  ← Team's PostgreSQL
                 │  (shared)   │
                 └─────────────┘
```

### Hybrid: Both Modes Available

```
Developer's machine:
  FOREST_MODE=local   → Use local SQLite (default)
  FOREST_MODE=client  → Connect to team server

Sandboxed environment (Claude Code, CI/CD):
  FOREST_MODE=client  → Only option (no local DB)
  FOREST_API_URL=https://forest.company.com
```

## Configuration

### Environment Variables

```bash
# Mode selection
FOREST_MODE=local    # Use local database (default)
FOREST_MODE=client   # Connect to remote API server

# Client mode configuration
FOREST_API_URL=https://forest.company.com:3000
FOREST_API_KEY=your-api-key-here  # Optional authentication

# Local mode configuration (existing)
FOREST_DB_TYPE=sqlite
FOREST_DB_PATH=./forest.db
```

### Auto-detection

```bash
# If FOREST_API_URL is set, default to client mode
export FOREST_API_URL=https://forest.company.com
forest search "test"  # Automatically uses client mode

# Explicit local mode even with API URL set
FOREST_MODE=local forest search "test"
```

## Implementation Strategy

### 1. Create HTTP Client Adapter

```typescript
// src/lib/adapters/http-client-adapter.ts

export class HttpClientAdapter {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: { url: string; apiKey?: string }) {
    this.baseUrl = config.url.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  // Node operations
  async listNodes(params: ListNodesParams) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/api/v1/nodes?${query}`);
  }

  async getNode(id: string) {
    return this.request(`/api/v1/nodes/${id}`);
  }

  async createNode(data: CreateNodeData) {
    return this.request('/api/v1/nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNode(id: string, data: UpdateNodeData) {
    return this.request(`/api/v1/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNode(id: string) {
    return this.request(`/api/v1/nodes/${id}`, {
      method: 'DELETE',
    });
  }

  // Search operations
  async search(query: string, options: SearchOptions = {}) {
    const params = new URLSearchParams({
      q: query,
      ...options,
    } as any).toString();
    return this.request(`/api/v1/search/semantic?${params}`);
  }

  // Edge operations
  async listEdges(params: ListEdgesParams = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/api/v1/edges?${query}`);
  }

  // Stats and health
  async getStats() {
    return this.request('/api/v1/stats');
  }

  async getHealth() {
    return this.request('/api/v1/health');
  }

  // Tags
  async listTags() {
    return this.request('/api/v1/tags');
  }
}
```

### 2. Refactor Core Functions to Support Both Modes

```typescript
// src/core/nodes.ts (enhanced)

import { getAdapter } from '../lib/db-factory';
import { getHttpClient } from '../lib/http-client-factory';

export async function listNodesCore(params: ListNodesParams) {
  const mode = process.env.FOREST_MODE || 'local';

  if (mode === 'client') {
    // Use HTTP client
    const client = getHttpClient();
    const response = await client.listNodes(params);
    return response.data;
  } else {
    // Use local database (existing code)
    const adapter = getAdapter();
    // ... existing implementation ...
  }
}
```

### 3. Add Client Mode Detection

```typescript
// src/lib/http-client-factory.ts

let httpClient: HttpClientAdapter | null = null;

export function getHttpClient(): HttpClientAdapter {
  if (!httpClient) {
    const apiUrl = process.env.FOREST_API_URL;

    if (!apiUrl) {
      throw new Error(
        'FOREST_API_URL must be set when using client mode.\n' +
        'Example: export FOREST_API_URL=https://forest.company.com:3000'
      );
    }

    httpClient = new HttpClientAdapter({
      url: apiUrl,
      apiKey: process.env.FOREST_API_KEY,
    });
  }

  return httpClient;
}

export function isClientMode(): boolean {
  const mode = process.env.FOREST_MODE;
  const apiUrl = process.env.FOREST_API_URL;

  // Explicit client mode
  if (mode === 'client') return true;

  // Auto-detect: if API URL is set and mode is not explicitly local
  if (apiUrl && mode !== 'local') return true;

  return false;
}
```

### 4. Update CLI Commands

Most CLI commands work unchanged! The core functions handle the routing.

```typescript
// src/cli/commands/search.ts
// No changes needed! Core function handles mode detection

export function createSearchCommand(clerc: ClercModule) {
  return clerc.defineCommand({
    name: 'search',
    parameters: ['<query>'],
    // ... existing flags ...
  }, async (context) => {
    // This works in both modes!
    const results = await semanticSearchCore(context.parameters.query, {
      limit: context.flags.limit,
      tags: context.flags.tags,
    });

    // Format and display results (same in both modes)
    displaySearchResults(results);
  });
}
```

## Use Cases

### 1. Claude Code Environment (This Sandbox!)

**Setup:**
```bash
# In your environment, whitelist your Forest server domain
# e.g., forest.yourcompany.com

# In my environment (Claude Code):
export FOREST_API_URL=https://forest.yourcompany.com:3000
export FOREST_MODE=client

# Now I can use Forest commands!
forest search "authentication"
forest node read 7fa7acb2
forest stats
```

**Benefits:**
- ✅ I can query your team's Forest knowledge base
- ✅ No local database needed (perfect for sandboxed environment)
- ✅ Read-only access (safe, can't break anything)
- ✅ Helps you write code based on your team's actual docs

### 2. CI/CD Pipelines

**Problem:** Ephemeral containers, no persistent storage

**Solution:**
```yaml
# .github/workflows/test.yml
env:
  FOREST_MODE: client
  FOREST_API_URL: https://forest.company.com:3000
  FOREST_API_KEY: ${{ secrets.FOREST_API_KEY }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Query Forest for test data
        run: |
          forest search "test fixtures" --json > fixtures.json

      - name: Find related ADRs
        run: |
          forest search "authentication" --tags architecture --json > adrs.json
```

### 3. Read-Only Team Access

**Problem:** Want to give read-only access to Forest without giving DB credentials

**Solution:**
```bash
# Deploy Forest API server with read-only API key
forest serve --port 3000 --read-only

# Team members configure thin client
export FOREST_API_URL=https://forest-readonly.company.com
export FOREST_API_KEY=readonly-key-here

# They can search and read, but not modify
forest search "deployment"  # ✅ Works
forest node read abc123     # ✅ Works
forest capture ...          # ❌ 403 Forbidden (read-only mode)
```

### 4. Multi-Environment Workflow

**Same developer, different contexts:**

```bash
# Personal knowledge base (local)
cd ~/personal-notes
forest search "ideas"  # Uses local SQLite

# Work knowledge base (team server)
cd ~/work-projects
export FOREST_API_URL=https://forest.company.com
forest search "architecture"  # Uses team server

# Quick switch with aliases
alias forest-local='FOREST_MODE=local forest'
alias forest-team='FOREST_MODE=client FOREST_API_URL=https://team.forest.com forest'
```

### 5. Agent Integration

**Claude Code helping you with your codebase:**

```bash
# You (in your environment):
forest serve --port 3000 --host 0.0.0.0
# Opens port 3000 to Claude Code

# Me (Claude Code in Anthropic environment):
export FOREST_API_URL=https://your-forest-server.com:3000
forest search "how do we handle authentication"

# I can now:
- Query your team's actual documentation
- Understand your architecture decisions
- Reference your ADRs and designs
- Provide context-aware suggestions
```

## API Server Enhancements

### Add Authentication (Optional)

```typescript
// src/server/middleware/auth.ts

export function authMiddleware(options: { readOnly?: boolean } = {}) {
  return async (context: any) => {
    const apiKey = context.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      context.set.status = 401;
      return { error: 'API key required' };
    }

    // Validate API key
    const isValid = await validateApiKey(apiKey);
    if (!isValid) {
      context.set.status = 403;
      return { error: 'Invalid API key' };
    }

    // Check read-only mode
    if (options.readOnly && ['POST', 'PUT', 'DELETE'].includes(context.request.method)) {
      context.set.status = 403;
      return { error: 'Read-only mode: modifications not allowed' };
    }

    // Continue
    return undefined;
  };
}
```

### Add Rate Limiting

```typescript
// Prevent abuse in client mode
app.use(rateLimiter({
  max: 100,      // 100 requests
  window: 60000, // per minute
}));
```

## Updated Preflight Check

The preflight script should detect and test client mode:

```javascript
// scripts/forest-preflight.js (enhancement)

async function checkClientMode() {
  const mode = process.env.FOREST_MODE;
  const apiUrl = process.env.FOREST_API_URL;

  if (mode === 'client' || apiUrl) {
    logSection('Client Mode Configuration');

    if (!apiUrl) {
      logCheck('Client Mode', 'fail',
        'FOREST_MODE=client but FOREST_API_URL is not set',
        'Set FOREST_API_URL to your Forest server: export FOREST_API_URL=https://forest.company.com:3000'
      );
      return false;
    }

    // Test connectivity
    try {
      const url = new URL(apiUrl);
      log(`  Testing connection to: ${apiUrl}`, 'dim');

      const response = await fetch(`${apiUrl}/api/v1/health`, {
        headers: process.env.FOREST_API_KEY
          ? { 'Authorization': `Bearer ${process.env.FOREST_API_KEY}` }
          : {},
      });

      if (response.ok) {
        const health = await response.json();
        logCheck('Forest API Server', 'pass',
          `Connected to ${apiUrl} (version ${health.data?.version || 'unknown'})`
        );
        return true;
      } else {
        logCheck('Forest API Server', 'fail',
          `Server returned ${response.status}: ${response.statusText}`,
          'Check that the Forest server is running and accessible'
        );
        return false;
      }
    } catch (error) {
      logCheck('Forest API Server', 'fail',
        `Cannot connect to ${apiUrl}: ${error.message}`,
        `Check that:
  1. Forest server is running (forest serve)
  2. URL is correct
  3. Network allows HTTPS connections
  4. Domain is whitelisted (if in sandboxed environment)`
      );
      return false;
    }
  }
}
```

## Migration Path

### Phase 1: HTTP Client Adapter (Week 1)
- [ ] Create `HttpClientAdapter` class
- [ ] Add `FOREST_MODE` and `FOREST_API_URL` config
- [ ] Implement HTTP client factory

### Phase 2: Core Function Updates (Week 2)
- [ ] Update `listNodesCore` to support client mode
- [ ] Update `searchCore` to support client mode
- [ ] Update read-only operations (get, list, search)

### Phase 3: Write Operations (Week 3)
- [ ] Update `createNodeCore` to support client mode
- [ ] Update `updateNodeCore` to support client mode
- [ ] Update `deleteNodeCore` to support client mode
- [ ] Add error handling for network failures

### Phase 4: Server Enhancements (Week 4)
- [ ] Add optional API key authentication
- [ ] Add rate limiting
- [ ] Add read-only mode flag
- [ ] Add CORS configuration for client mode

### Phase 5: Testing & Documentation (Week 5)
- [ ] Update preflight script for client mode
- [ ] Test in Claude Code environment
- [ ] Test in CI/CD environment
- [ ] Document client mode setup
- [ ] Create troubleshooting guide

## Benefits Summary

### For Teams
- ✅ **Centralized knowledge base** - One source of truth
- ✅ **Instant collaboration** - All CLI users see same data
- ✅ **Access control** - API keys, read-only mode
- ✅ **Scalable** - Multiple clients, single server

### For Sandboxed Environments
- ✅ **Works in Claude Code** - Network access instead of local DB
- ✅ **Works in CI/CD** - Ephemeral containers can query team knowledge
- ✅ **No persistent storage** - Everything lives on server

### For Agents
- ✅ **Context-aware AI** - Agents query your team's actual docs
- ✅ **Safe access** - Read-only mode prevents modifications
- ✅ **Easy integration** - Simple HTTP API

### For Developers
- ✅ **Flexible workflow** - Switch between local and remote
- ✅ **Offline capable** - Local mode when no network
- ✅ **Zero config change** - Same CLI commands, different backend

## Example Workflow: Claude Code + Your Forest Server

```bash
# You run Forest server on your machine
you$ forest serve --port 3000 --host 0.0.0.0
🌲 Forest server running at http://localhost:3000

# You expose it via ngrok or similar
you$ ngrok http 3000
Forwarding https://abc123.ngrok.io -> http://localhost:3000

# You tell me the URL
you> "Claude, use my Forest server at https://abc123.ngrok.io"

# I configure thin client mode
me$ export FOREST_API_URL=https://abc123.ngrok.io
me$ export FOREST_MODE=client

# I can now query YOUR team's knowledge
me$ forest search "authentication flow"
Found 5 matches:
  7fa7acb2  "OAuth 2.0 implementation" (Alice)
  3e4f5g6h  "ADR: Use Auth0" (Bob)
  ...

me$ forest node read 7fa7acb2
[Shows your team's actual auth documentation]

# I can now write code based on your ACTUAL architecture!
me> "Based on your team's OAuth implementation (node 7fa7acb2),
     here's how to add the new endpoint..."
```

---

**This thin client mode would make Forest the first CLI knowledge base that works seamlessly across local, remote, and sandboxed environments!**
