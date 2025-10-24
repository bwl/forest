# Forest Desktop - Development Guide

## Quick Start

### Running the App

**IMPORTANT**: Always run from the `forest-desktop` directory:

```bash
cd forest-desktop
bun run tauri dev
```

**Do NOT run from the parent directory** (`~/Developer/forest/`) as it will execute the wrong package.json scripts.

### What You'll See

When running correctly, you should see:
1. Vite dev server starts: `Local: http://localhost:5173/`
2. Rust backend compiles: `Compiling forest-desktop...`
3. App launches: `Running target/debug/forest-desktop`
4. Desktop window opens with graph visualization

### Console Logging

All browser console logs (including errors) are piped to your terminal with prefixes:
- `[FRONTEND]` - Regular console.log
- `[FRONTEND ERROR]` - console.error
- `[FRONTEND WARN]` - console.warn
- `Unhandled error:` - Uncaught exceptions
- `Unhandled promise rejection:` - Promise rejections

This means **you get immediate feedback in your terminal** when there are React errors or any JavaScript issues.

## Current Status (2025-10-24)

### ✅ What's Working

1. **Graph Visualization**
   - ReactFlow integration displaying all nodes
   - Force-directed layout using dagre
   - Edges with similarity scores
   - Zoom/pan controls

2. **Command Palette**
   - Floating, draggable interface
   - Keyboard shortcut: `Cmd+K` to open
   - Plain text creates nodes instantly
   - Command syntax: `/search`, `/settings`

3. **Node Details**
   - Click nodes to see full content
   - Slide-out panel from right
   - Shows connections and metadata

4. **Position Persistence**
   - Drag nodes, positions save to database
   - Reload maintains positions

5. **Backend**
   - All Tauri commands implemented
   - Database migrations complete
   - Auto-linking and embedding working

6. **Developer Experience**
   - Console logging to terminal
   - Hot module reload (HMR)
   - Type-safe Rust ↔ TypeScript communication

### 🚧 Known Issues

**React Errors**: There are some React-related console errors visible in the browser DevTools. These should now appear in the terminal with the improved logging system.

To debug:
1. Watch terminal for `[FRONTEND ERROR]` messages
2. Open DevTools (Cmd+Option+I) to see full React stack traces
3. Check for component rendering issues or prop type mismatches

### 📁 Key Files

**Frontend:**
- `src/components/GraphCanvas.tsx` - Main graph visualization
- `src/components/CommandPalette.tsx` - Command interface
- `src/components/NodeDetailPanel.tsx` - Node detail view
- `src/lib/console-logger.ts` - Terminal logging utility
- `src/App.tsx` - Root component

**Backend:**
- `src-tauri/src/commands.rs` - All Tauri IPC commands
- `src-tauri/src/main.rs` - App entry point and command registration
- `src-tauri/src/core/linking.rs` - Auto-linking algorithm
- `src-tauri/src/core/search.rs` - Semantic search
- `src-tauri/migrations/` - Database schema changes

## Testing Features

### 1. Graph Visualization
```bash
# Should see all nodes in force-directed layout
# Try zooming with mouse wheel
# Try panning by dragging background
```

### 2. Command Palette
```bash
# Click the palette in center or press Cmd+K
# Type: "Test note" and press Enter
# Should create a new node and refresh graph
```

### 3. Node Details
```bash
# Click any node in the graph
# Panel should slide in from right
# Press Esc to close
```

### 4. Search (Partially Implemented)
```bash
# Type: /search rust
# Check terminal for log output
# Full highlighting not yet implemented
```

### 5. Position Persistence
```bash
# Drag a node to new position
# Reload app (Cmd+R)
# Node should stay in same position
```

## Agent Workflow

### Primary Agent: `react-tauri-frontend`

**Use this agent for all frontend work** (the current phase):
- Fixing React console errors and rendering issues
- Implementing UI features (search highlighting, node editing, settings panel)
- Enhancing command palette UX and keyboard shortcuts
- Improving graph visualization (controls, animations, clustering)
- Debugging with browser DevTools
- Component performance optimization
- Accessibility improvements

**This agent works in**: `src/` directory (React components, TypeScript, CSS)

### Secondary Agent: `rust-tauri-implementor`

**Reserve for backend/core improvements**:
- New Tauri commands or IPC endpoints
- Database schema changes and migrations
- Core algorithm updates (scoring, linking, search)
- Performance-critical Rust optimizations
- CLI command implementation

**This agent works in**: `src-tauri/` directory (Rust code, migrations)

## Next Steps

### Immediate (Next Session - Use `react-tauri-frontend`)

1. **Fix React Errors**: Debug and resolve console errors now visible in terminal
2. **Test All Features**: Complete testing checklist above
3. **Search Highlighting**: Implement visual highlighting for search results
4. **Node Editing**: Add inline edit mode in detail panel

### Frontend Enhancements (Use `react-tauri-frontend`)

- Settings panel UI with theme toggle, embedding provider selection
- Advanced graph features (filtering by score, visual clustering, minimap)
- Additional command palette commands (`/link`, `/delete`, `/export`)
- Keyboard shortcuts (arrow keys for node navigation, hotkeys for common actions)
- Loading states and skeleton screens
- Drag-and-drop file import
- Graph export as image/SVG

### Backend Features (Use `rust-tauri-implementor` when needed)

- Batch node operations (bulk delete, bulk tag)
- Full-text search alongside semantic search
- Graph analytics (centrality, communities, recommendations)
- Export formats (Markdown, JSON, GraphML)
- Import from other tools (Obsidian, Roam, etc.)

## Architecture

### Data Flow

```
GraphCanvas (loads all nodes/edges)
     ↓
App State (selectedNode, highlightedNodes)
     ↓
CommandPalette (creates nodes, triggers search)
     ↓
NodeDetailPanel (shows node details)
```

### Console Logging Flow

```
Browser Console → console-logger.ts → Tauri IPC → Rust println! → Terminal
```

All logs appear in your terminal with prefixes for easy filtering.

## Troubleshooting

### "Waiting for frontend dev server"
- Make sure you're in `forest-desktop` directory
- Check port 5173 is free: `lsof -ti:5173`
- Kill stale processes: `pkill -f vite`

### Import Errors
- Check ReactFlow imports use `type` keyword: `import { type Node, type Edge }`
- Ensure all dependencies installed: `bun install`

### Rust Compilation Errors
- Clean build: `cd src-tauri && cargo clean`
- Check migrations applied: Verify `forest.db` exists

### Console Logs Not Showing
- Verify console-logger imported in `main.tsx`
- Check `log_to_terminal` command registered in `main.rs`
- Look for `[Console Logger] Terminal logging enabled` message

## Build Commands

```bash
# Development mode
cd forest-desktop
bun run tauri dev

# Production build
bun run tauri build

# Type checking
bun run lint

# Rust tests
cd src-tauri
cargo test
```

## Success! 🎉

Forest Desktop is now functional with a graph-native UI! The command palette interface provides a powerful way to interact with your knowledge graph.

**Key Achievement**: Console logging to terminal means you now have **immediate visibility** into any frontend issues during development.

---

*Last updated: 2025-10-24*
*Session: Graph UI v2.0 Complete*
