# Forest Desktop App: Tauri + Thin Client Architecture

## The Perfect Match

You're absolutely right - **thin client mode makes this trivial**! Here's why this is perfect:

### Forest Already Has:
- ✅ Complete REST API (`forest serve`)
- ✅ All operations via HTTP endpoints
- ✅ Thin client architecture designed
- ✅ Document templates for structured editing
- ✅ Rich graph data (nodes, edges, tags)

### Tauri Provides:
- ✅ Lightweight desktop wrapper (Rust + Web)
- ✅ Cross-platform (macOS, Windows, Linux)
- ✅ Native performance
- ✅ Small bundle size (~3-5 MB vs Electron's 100+ MB)
- ✅ Native system integration

### The Architecture:
```
┌─────────────────────────────────────┐
│   Forest Desktop App (Tauri)       │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Frontend (React/Vite)       │  │
│  │  - Graph Visualization       │  │
│  │  - Node Editor               │  │
│  │  - Search Interface          │  │
│  │  - Template Selector         │  │
│  └────────────┬─────────────────┘  │
│               │ HTTP/Fetch         │
│  ┌────────────▼─────────────────┐  │
│  │  Tauri Backend (Rust)        │  │
│  │  - HTTP Client               │  │
│  │  - Settings Storage          │  │
│  │  - File System Access        │  │
│  └────────────┬─────────────────┘  │
└───────────────┼─────────────────────┘
                │ HTTP/HTTPS
         ┌──────▼──────┐
         │ Forest API  │  ← Local or Remote!
         │   Server    │
         └──────┬──────┘
                │
         ┌──────▼──────┐
         │  Database   │
         └─────────────┘
```

## Architecture Benefits

### 1. **Deployment Flexibility**

**Local Mode** (Default):
```bash
# User starts Forest server locally
forest serve --port 3000

# Desktop app connects to localhost
App → http://localhost:3000 → Local SQLite
```

**Team Mode**:
```bash
# Desktop app connects to team server
App → https://forest.company.com → Team PostgreSQL
```

**Hybrid Mode**:
```bash
# Switch between personal and team
Settings → "Personal" → localhost:3000
Settings → "Team" → forest.company.com
```

### 2. **Zero Backend Logic Duplication**

All business logic stays in Forest API server:
- ✅ Desktop app is just a UI shell
- ✅ No database code in Tauri
- ✅ No embedding computation in frontend
- ✅ All updates happen server-side

### 3. **Instant Collaboration**

Multiple team members can use desktop apps simultaneously:
```
Alice's Desktop App ──┐
                      ├──→ Team Forest Server → Shared Database
Bob's Desktop App ────┤
                      │
Charlie's CLI ────────┘
```

## Technology Stack

### Frontend (Recommended)

**Core:**
- **React 18** with TypeScript
- **Vite** for blazing fast dev/build
- **TailwindCSS** for styling
- **Shadcn/ui** for beautiful components

**Graph Visualization:**
- **React Flow** - Interactive node graph (drag, zoom, pan)
- Alternative: **Cytoscape.js** - More scientific viz
- Alternative: **D3.js** - Custom visualizations

**Rich Text:**
- **TipTap** - Modern Markdown editor
- Alternative: **Monaco Editor** - VSCode-like experience
- Alternative: **CodeMirror 6** - Lightweight Markdown

**State Management:**
- **Zustand** - Lightweight state (perfect for this)
- Alternative: **TanStack Query** - Server state management

### Backend (Tauri/Rust)

**Minimal Backend:**
```rust
// Tauri just needs to:
// 1. Store settings (API URL, user preferences)
// 2. Make HTTP requests to Forest API
// 3. Handle file system access (import/export)
```

**Key Tauri Commands:**
```rust
#[tauri::command]
async fn get_forest_api_url() -> Result<String, String> {
    // Load from settings
}

#[tauri::command]
async fn save_forest_api_url(url: String) -> Result<(), String> {
    // Save to settings
}

#[tauri::command]
async fn import_file(path: String) -> Result<String, String> {
    // Read file, send to Forest API
}

#[tauri::command]
async fn export_graphviz(output_path: String) -> Result<(), String> {
    // Fetch from API, write to file
}
```

## User Interface Design

### Main Layout

```
┌─────────────────────────────────────────────────────┐
│ Forest                                    ⚙️  👤      │
├─────────────────────────────────────────────────────┤
│  🏠 Home   🔍 Search   📊 Graph   📝 Templates      │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│  Sidebar │          Main Content Area              │
│          │                                          │
│  Recent  │                                          │
│  • Note1 │                                          │
│  • Note2 │                                          │
│          │                                          │
│  Tags    │                                          │
│  #arch   │                                          │
│  #api    │                                          │
│          │                                          │
│  Saved   │                                          │
│  ⭐ Fav1  │                                          │
│  ⭐ Fav2  │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

### Key Views

#### 1. **Home View** - Dashboard
```
┌─────────────────────────────────────┐
│  Quick Actions                      │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ New  │ │Search│ │Import│        │
│  └──────┘ └──────┘ └──────┘        │
│                                     │
│  Recent Activity                    │
│  • "OAuth Implementation" (5m ago)  │
│  • "API Design ADR" (1h ago)        │
│  • "Meeting Notes" (2h ago)         │
│                                     │
│  Statistics                         │
│  📝 1,526 nodes                     │
│  🔗 3,420 connections               │
│  🏷️  945 tags                       │
│                                     │
│  Top Connections                    │
│  • "System Architecture" (56 edges) │
│  • "API Guidelines" (42 edges)      │
└─────────────────────────────────────┘
```

#### 2. **Search View** - Semantic Search
```
┌─────────────────────────────────────┐
│  🔍 Search: [authentication____]    │
│                                     │
│  Filters: [All Tags ▾] [Date ▾]    │
│                                     │
│  Results (8)                        │
│  ┌─────────────────────────────┐   │
│  │ OAuth 2.0 Implementation    │   │
│  │ By Alice • 2 days ago       │   │
│  │ Score: 0.92 | #auth #api    │   │
│  │ "We implemented OAuth 2.0..." │  │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ ADR: Use Auth0 for SSO      │   │
│  │ By Bob • 1 week ago         │   │
│  │ Score: 0.88 | #architecture │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### 3. **Graph View** - Interactive Visualization
```
┌─────────────────────────────────────┐
│  Controls: [Layout ▾] [Filter ▾]   │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│                                     │
│    ●─────●                          │
│    │      \                         │
│    │       ●─────●                  │
│    │      /│\     \                 │
│    ●─────● │ ●─────●                │
│     \     \│/                       │
│      ●─────●                        │
│                                     │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                     │
│  Selected: "OAuth Implementation"   │
│  Connections: 12 edges              │
│  [View Details] [Edit]              │
└─────────────────────────────────────┘
```

#### 4. **Node Editor** - Rich Markdown
```
┌─────────────────────────────────────┐
│  OAuth 2.0 Implementation           │
│  Tags: #auth #api #implementation   │
│  ────────────────────────────────── │
│  # OAuth 2.0 Implementation         │
│                                     │
│  We use OAuth 2.0 with JWT tokens:  │
│                                     │
│  - Authorization server: Auth0      │
│  - Token expiry: 1 hour             │
│  - Refresh token rotation enabled   │
│                                     │
│  ## Code Example                    │
│  ```javascript                      │
│  const token = await getToken();    │
│  ```                                │
│                                     │
│  [B] [I] [Link] [Code] [List]       │
│  ────────────────────────────────── │
│  Connected to:                      │
│  → ADR: Use Auth0 (0.85)           │
│  → Security Guidelines (0.78)       │
│                                     │
│  [Save] [Cancel] [Delete]           │
└─────────────────────────────────────┘
```

#### 5. **Template Selector** - Create from Template
```
┌─────────────────────────────────────┐
│  Create New Document                │
│                                     │
│  Choose a template:                 │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📄 Research Paper           │   │
│  │ Academic papers (IMRaD)     │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 📝 Meeting Notes            │   │
│  │ Standups, planning          │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 📋 Project Spec             │   │
│  │ Technical specifications    │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ ✍️  Blog Post               │   │
│  │ Articles, tutorials         │   │
│  └─────────────────────────────┘   │
│                                     │
│  Or start blank: [Blank Note]       │
└─────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Basic App Structure (Week 1)
```bash
# Initialize Tauri app
npm create tauri-app@latest forest-desktop
# Choose: React + TypeScript + Vite

# Install dependencies
cd forest-desktop
npm install @tanstack/react-query zustand tailwindcss
npm install react-markdown react-syntax-highlighter

# Setup
npm run tauri dev  # Start development
```

**Deliverables:**
- ✅ Basic Tauri shell running
- ✅ Settings page (API URL configuration)
- ✅ HTTP client connecting to Forest API
- ✅ Display node list from API

### Phase 2: Core Features (Week 2-3)
- ✅ Search interface with semantic search
- ✅ Node detail view with Markdown rendering
- ✅ Tag browser and filtering
- ✅ Basic navigation (sidebar, recent, favorites)

### Phase 3: Graph Visualization (Week 4)
- ✅ Interactive graph view (React Flow)
- ✅ Node selection and highlighting
- ✅ Edge visualization with scores
- ✅ Layout algorithms (force-directed, hierarchical)

### Phase 4: Editing (Week 5)
- ✅ Markdown editor (TipTap)
- ✅ Create/update/delete nodes
- ✅ Tag editing with autocomplete
- ✅ Auto-linking preview

### Phase 5: Templates (Week 6)
- ✅ Template selector UI
- ✅ Template-driven document creation
- ✅ Chunk-aware editor for templated docs
- ✅ Validation feedback

### Phase 6: Polish & Package (Week 7-8)
- ✅ Dark mode
- ✅ Keyboard shortcuts
- ✅ Export features (Markdown, JSON, Graphviz)
- ✅ Build installers (macOS .dmg, Windows .exe, Linux .AppImage)

## Example Code

### Frontend: Forest API Client

```typescript
// src/lib/forest-api.ts

export class ForestAPIClient {
  constructor(private baseUrl: string) {}

  async search(query: string, options?: {
    tags?: string[];
    limit?: number;
  }) {
    const params = new URLSearchParams({
      q: query,
      limit: (options?.limit || 20).toString(),
    });

    if (options?.tags) {
      params.set('tags', options.tags.join(','));
    }

    const response = await fetch(
      `${this.baseUrl}/api/v1/search/semantic?${params}`
    );
    return response.json();
  }

  async getNode(id: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/nodes/${id}`);
    return response.json();
  }

  async createNode(data: {
    title: string;
    body: string;
    tags?: string[];
  }) {
    const response = await fetch(`${this.baseUrl}/api/v1/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async getStats() {
    const response = await fetch(`${this.baseUrl}/api/v1/stats`);
    return response.json();
  }
}
```

### Frontend: Search Component

```tsx
// src/components/Search.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForestAPI } from '../hooks/useForestAPI';

export function Search() {
  const [query, setQuery] = useState('');
  const api = useForestAPI();

  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.search(query),
    enabled: query.length > 0,
  });

  return (
    <div className="p-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your knowledge base..."
        className="w-full px-4 py-2 border rounded-lg"
      />

      {isLoading && <div>Searching...</div>}

      {data?.data?.nodes?.map((node: any) => (
        <div key={node.id} className="mt-4 p-4 border rounded-lg">
          <h3 className="font-bold">{node.title}</h3>
          <p className="text-sm text-gray-600">
            Score: {node.similarity.toFixed(2)} |
            Tags: {node.tags.join(', ')}
          </p>
        </div>
      ))}
    </div>
  );
}
```

### Tauri Backend: Settings

```rust
// src-tauri/src/main.rs

use tauri::State;
use std::sync::Mutex;

struct AppSettings {
    api_url: Mutex<String>,
}

#[tauri::command]
fn get_api_url(settings: State<AppSettings>) -> String {
    settings.api_url.lock().unwrap().clone()
}

#[tauri::command]
fn set_api_url(url: String, settings: State<AppSettings>) -> Result<(), String> {
    let mut api_url = settings.api_url.lock().unwrap();
    *api_url = url;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(AppSettings {
            api_url: Mutex::new("http://localhost:3000".to_string()),
        })
        .invoke_handler(tauri::generate_handler![
            get_api_url,
            set_api_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Distribution

### Build Commands

```bash
# Development
npm run tauri dev

# Production build
npm run tauri build

# Outputs:
# macOS: forest-desktop_0.1.0_x64.dmg
# Windows: forest-desktop_0.1.0_x64.msi
# Linux: forest-desktop_0.1.0_amd64.AppImage
```

### Bundle Sizes (Estimated)

- **Tauri App:** ~5-8 MB (with Rust backend)
- **Electron Alternative:** ~120 MB (for comparison)
- **Savings:** 93% smaller!

## User Experience

### First Launch

```
1. User opens Forest Desktop
2. Welcome screen: "Connect to Forest"

   ○ Use Local Server (http://localhost:3000)
     "Start forest serve in terminal first"

   ○ Use Team Server (https://forest.company.com)
     "Enter your team's Forest URL"

   ○ Don't have Forest installed?
     [Download Forest CLI]

3. User selects option, app connects
4. Dashboard loads with their knowledge base
```

### Daily Usage

```
Morning:
- Open app → Auto-connects to server
- Check recent activity
- Read yesterday's meeting notes

During work:
- Quick search for "authentication"
- Find Alice's OAuth implementation
- Copy code snippet

After meeting:
- New → Meeting Notes template
- Fill in attendees, decisions, action items
- Auto-links to related ADRs

End of day:
- Browse graph view
- See connections between today's work
- Star important nodes
```

## Why This Works Perfectly

### 1. **Separation of Concerns**
- Desktop app = **UI only**
- Forest server = **All logic**
- Clean, maintainable architecture

### 2. **Platform Native**
- Tauri = Native OS integration
- System notifications
- File system access
- Keyboard shortcuts

### 3. **Progressive Enhancement**
- Start with read-only (view, search)
- Add editing
- Add templates
- Add collaboration features

### 4. **Future-Proof**
- Forest CLI updates → Desktop app automatically gets new features (via API)
- No need to redeploy desktop app for server-side changes
- Backend improvements benefit both CLI and desktop users

## Next Steps

Want me to:
1. **Create starter project structure** for Tauri + React
2. **Build proof-of-concept** with basic search and view
3. **Design detailed mockups** for each screen
4. **Write implementation guide** step-by-step

This is **totally achievable** and the thin client architecture makes it **10x easier** than it would be otherwise! 🚀
