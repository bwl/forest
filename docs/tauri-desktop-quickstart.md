# Forest Desktop App: Quick Start Guide

Get the Forest desktop app running in 15 minutes.

## Prerequisites

```bash
# Install Rust (required for Tauri)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js 18+ (if not already installed)
# Already have it? Skip this

# Verify installations
rustc --version  # Should show: rustc 1.x.x
node --version   # Should show: v18.x.x or higher
npm --version    # Should show: 9.x.x or higher
```

## Step 1: Create Tauri App (5 minutes)

```bash
# Create new Tauri + React + TypeScript project
npm create tauri-app@latest

# Prompts:
# ✔ Project name: forest-desktop
# ✔ Choose which language to use for your frontend: TypeScript / JavaScript
# ✔ Choose your package manager: npm
# ✔ Choose your UI template: React
# ✔ Choose your UI flavor: TypeScript

cd forest-desktop
```

## Step 2: Install Dependencies (2 minutes)

```bash
# Core dependencies
npm install

# Forest-specific deps
npm install @tanstack/react-query zustand

# UI components
npm install tailwindcss @headlessui/react lucide-react
npm install react-markdown remark-gfm

# Graph visualization
npm install reactflow

# Initialize Tailwind
npx tailwindcss init -p
```

## Step 3: Setup Tailwind Config (1 minute)

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Step 4: Create Forest API Client (5 minutes)

```typescript
// src/lib/forest-api.ts

export interface Node {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  node: Node;
  similarity: number;
}

export class ForestAPI {
  constructor(private baseUrl: string) {}

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/search/semantic?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    const data = await response.json();
    return data.data.nodes;
  }

  async getNode(id: string): Promise<Node> {
    const response = await fetch(`${this.baseUrl}/api/v1/nodes/${id}`);
    const data = await response.json();
    return data.data.node;
  }

  async listNodes(params?: {
    limit?: number;
    offset?: number;
    tags?: string[];
  }): Promise<{ nodes: Node[]; total: number }> {
    const queryParams = new URLSearchParams({
      limit: (params?.limit || 20).toString(),
      offset: (params?.offset || 0).toString(),
    });

    if (params?.tags?.length) {
      queryParams.set('tags', params.tags.join(','));
    }

    const response = await fetch(
      `${this.baseUrl}/api/v1/nodes?${queryParams}`
    );
    const data = await response.json();
    return {
      nodes: data.data.nodes,
      total: data.data.pagination.total,
    };
  }

  async getStats() {
    const response = await fetch(`${this.baseUrl}/api/v1/stats`);
    const data = await response.json();
    return data.data;
  }

  async getHealth() {
    const response = await fetch(`${this.baseUrl}/api/v1/health`);
    const data = await response.json();
    return data.data;
  }
}
```

## Step 5: Create Simple UI (2 minutes)

```tsx
// src/App.tsx

import { useState } from 'react';
import { ForestAPI } from './lib/forest-api';

// Initialize API client (default to localhost)
const api = new ForestAPI('http://localhost:3000');

function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const searchResults = await api.search(query);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      alert('Make sure Forest server is running on localhost:3000');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          🌲 Forest Desktop
        </h1>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search your knowledge base..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {results.map((result) => (
            <div
              key={result.node.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  {result.node.title}
                </h2>
                <span className="text-sm text-gray-500 font-mono">
                  {(result.similarity * 100).toFixed(1)}%
                </span>
              </div>

              <p className="text-gray-700 mb-4 line-clamp-3">
                {result.node.body}
              </p>

              <div className="flex items-center gap-2">
                {result.node.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="mt-2 text-xs text-gray-400">
                {new Date(result.node.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        {results.length === 0 && !loading && (
          <div className="text-center text-gray-500 mt-12">
            <p>Search your Forest knowledge base</p>
            <p className="text-sm mt-2">
              Make sure Forest server is running: <code>forest serve</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
```

## Step 6: Run the App!

### Terminal 1: Start Forest Server
```bash
# In your forest directory
forest serve --port 3000

# Should see:
# 🌲 Forest server running at http://localhost:3000
```

### Terminal 2: Start Desktop App
```bash
# In forest-desktop directory
npm run tauri dev

# This will:
# 1. Build the Rust backend
# 2. Start the React dev server
# 3. Launch the desktop app window
```

## You Should See:

```
┌────────────────────────────────────┐
│ 🌲 Forest Desktop                  │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ Search your knowledge base...  │ │
│ │                      [Search]  │ │
│ └────────────────────────────────┘ │
│                                    │
│ Search your Forest knowledge base  │
│ Make sure Forest server is running:│
│ forest serve                       │
└────────────────────────────────────┘
```

Try searching for something in your Forest database!

## Troubleshooting

### "Failed to fetch" error
```bash
# Make sure Forest server is running
forest serve --port 3000

# Check it's accessible
curl http://localhost:3000/api/v1/health
```

### CORS errors
```bash
# Forest server already has CORS enabled
# If you still see errors, check browser console
```

### Rust compilation errors
```bash
# Make sure Rust is installed
rustc --version

# Update Rust
rustup update

# Clean and rebuild
cd src-tauri
cargo clean
cd ..
npm run tauri dev
```

## Next Steps

Now that you have the basic app running:

### 1. Add More Features
```bash
# Install graph visualization
npm install reactflow

# Create graph view component
# See docs/tauri-desktop-app.md for examples
```

### 2. Add Settings Page
```typescript
// Allow users to configure API URL
// Store in Tauri's config system
// Support switching between local and team servers
```

### 3. Add Node Editing
```bash
# Install rich text editor
npm install @tiptap/react @tiptap/starter-kit

# Create editor component
# Wire up to Forest API create/update endpoints
```

### 4. Build Production App
```bash
# Build for your platform
npm run tauri build

# Find built app in:
# src-tauri/target/release/bundle/
#
# macOS: .dmg file
# Windows: .msi file
# Linux: .AppImage file
```

## Example: Adding Stats Dashboard

```tsx
// src/components/Dashboard.tsx

import { useEffect, useState } from 'react';
import { ForestAPI } from '../lib/forest-api';

const api = new ForestAPI('http://localhost:3000');

export function Dashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.getStats().then(setStats);
  }, []);

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-3xl font-bold text-green-600">
          {stats.nodes.total}
        </div>
        <div className="text-gray-600">Total Nodes</div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-3xl font-bold text-blue-600">
          {stats.edges.accepted}
        </div>
        <div className="text-gray-600">Connections</div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-3xl font-bold text-purple-600">
          {stats.tags.total}
        </div>
        <div className="text-gray-600">Tags</div>
      </div>
    </div>
  );
}
```

## Development Tips

### Hot Reload
Both React and Tauri support hot reload:
- Frontend changes → React auto-reloads
- Rust changes → Tauri rebuilds (takes ~10s)

### Debugging
```bash
# React DevTools work normally
# Open browser DevTools: Cmd/Ctrl + Shift + I

# Rust logs
# Check terminal where you ran `npm run tauri dev`
```

### Building for Production
```bash
# Development build (fast)
npm run tauri dev

# Production build (optimized, smaller)
npm run tauri build

# First build takes ~5 minutes
# Subsequent builds: ~1-2 minutes
```

## Architecture Recap

```
Your Desktop App
    ↓ HTTP/Fetch
Forest API Server (localhost:3000 or remote)
    ↓ SQL
SQLite/PostgreSQL Database
```

**Key point:** Your desktop app is just a UI! All the heavy lifting (embeddings, scoring, database) happens in the Forest server.

This makes the desktop app:
- ✅ Lightweight (~5 MB)
- ✅ Easy to maintain
- ✅ Automatically gets new features when server updates
- ✅ Works with both local and remote servers

---

**You now have a working Forest desktop app!** 🎉

For full feature set, see `docs/tauri-desktop-app.md`
