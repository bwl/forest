# Next Session: Frontend Polish & Bug Fixes

## Quick Start

```bash
cd forest-desktop
bun run tauri dev
```

**Watch terminal for**: `[FRONTEND ERROR]`, `[FRONTEND WARN]` - all console logs now pipe to terminal!

## Primary Agent: `react-tauri-frontend`

Use this agent for all frontend work now that backend is solid.

## Immediate Tasks

### 1. Fix React Console Errors
- **Status**: Errors visible in browser DevTools, now also piped to terminal
- **Action**: Use `react-tauri-frontend` agent to debug and fix
- **Tools**: Browser DevTools (Cmd+Option+I), terminal logs with `[FRONTEND ERROR]` prefix

### 2. Complete Feature Testing
Test checklist from DEVELOPMENT.md:
- [ ] Graph visualization loads all nodes
- [ ] Command palette opens with Cmd+K
- [ ] Plain text creates nodes
- [ ] Clicking nodes opens detail panel
- [ ] Search command logs to console
- [ ] Position persistence works across reloads

### 3. Implement Search Highlighting
- **Backend**: Already complete (semantic search working)
- **Frontend**: Need to update `highlightedNodes` state when `/search` is used
- **File**: `src/App.tsx` and `src/components/GraphCanvas.tsx`
- **Agent**: `react-tauri-frontend`

### 4. Add Node Editing
- **Current**: Detail panel shows content (read-only)
- **Goal**: Make title/body editable with save button
- **Calls**: Existing `update_node()` Tauri command
- **File**: `src/components/NodeDetailPanel.tsx`
- **Agent**: `react-tauri-frontend`

## Agent Workflow Reference

### Use `react-tauri-frontend` for:
- React component changes (`src/components/`)
- TypeScript fixes (`src/lib/`)
- CSS/styling updates (`src/index.css`)
- UI/UX improvements
- Debugging console errors
- Component performance optimization

### Use `rust-tauri-implementor` for:
- New Tauri commands (`src-tauri/src/commands.rs`)
- Database changes (`src-tauri/migrations/`)
- Core algorithm updates (`src-tauri/src/core/`)
- Rust performance optimization
- CLI implementation (`src-tauri/src/cli/`)

## Current State

✅ **Backend**: Fully implemented with all Tauri commands working
✅ **Graph UI**: Rendering with ReactFlow, dragre layout, position persistence
✅ **Command Palette**: Floating, draggable, keyboard shortcuts
✅ **Node Details**: Click-to-view panel with slide animation
✅ **Console Logging**: All browser logs pipe to terminal

🚧 **Needs Work**: React errors, search highlighting, node editing

## Files to Know

**Frontend (Most Active)**:
- `src/components/GraphCanvas.tsx` - Main graph visualization
- `src/components/CommandPalette.tsx` - Command interface
- `src/components/NodeDetailPanel.tsx` - Node detail view
- `src/App.tsx` - Root component with state management
- `src/lib/console-logger.ts` - Terminal logging utility
- `src/lib/tauri-commands.ts` - TypeScript wrappers for Tauri commands

**Backend (Stable, Modify Only When Needed)**:
- `src-tauri/src/commands.rs` - All Tauri IPC commands
- `src-tauri/src/main.rs` - App entry and command registration
- `src-tauri/src/core/` - Core algorithms (linking, search, scoring)

## Documentation

- `DEVELOPMENT.md` - Full dev guide with troubleshooting
- `GRAPH_UI_COMPLETE.md` - Graph UI implementation details
- `PHASES_5_7_COMPLETE.md` - Backend/CLI completion summary
- `CLAUDE.md` (parent dir) - Project overview and agent workflow

## Success Criteria

**Next session complete when**:
1. No React errors in console
2. All features tested and working
3. Search highlighting implemented
4. Node editing functional

Then move to **frontend enhancements phase**: settings panel, keyboard shortcuts, advanced graph features, etc.

---

*Last updated: 2025-10-24*
*Current phase: Frontend Polish with `react-tauri-frontend` agent*
