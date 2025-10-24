# Forest Desktop App

A Tauri + React desktop application for Forest knowledge base.

## Quick Start

### Prerequisites

- Rust toolchain (for Tauri)
- Bun (already installed)
- Forest server running

### Development

**Terminal 1: Start Forest Server**
```bash
cd /Users/bwl/Developer/forest
forest serve --port 3000
```

**Terminal 2: Start Desktop App**
```bash
cd /Users/bwl/Developer/forest/forest-desktop
bun run tauri dev
```

This will:
1. Start Vite dev server on port 5173
2. Build Rust backend (first time takes ~2-5 minutes)
3. Launch the desktop app window

### Features

- **Search**: Semantic search across your Forest knowledge base
- **Stats Dashboard**: View total nodes, edges, and tags at a glance
- **Real-time**: Connects to live Forest API server

### Project Structure

```
forest-desktop/
├── src/
│   ├── lib/
│   │   └── forest-api.ts      # Forest API client
│   ├── components/
│   │   └── Dashboard.tsx      # Stats dashboard component
│   ├── App.tsx                # Main application
│   ├── main.tsx               # React entry point
│   └── index.css              # Tailwind CSS
├── src-tauri/                 # Rust backend
│   ├── src/
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

### Building for Production

```bash
bun run tauri build
```

Built app will be in `src-tauri/target/release/bundle/`:
- macOS: `.dmg` file
- Windows: `.msi` file
- Linux: `.AppImage` file

### Next Steps

1. **Add node editing**: Create editor component with TipTap
2. **Graph visualization**: Use ReactFlow to show node connections
3. **Settings page**: Allow users to configure API URL
4. **Offline mode**: Cache data for offline viewing

### Troubleshooting

**"Failed to fetch" error**
- Ensure Forest server is running: `forest serve`
- Check server is accessible: `curl http://localhost:3000/api/v1/health`

**Rust compilation errors**
- Update Rust: `rustup update`
- Clean and rebuild: `cd src-tauri && cargo clean && cd .. && bun run tauri dev`

**CORS errors**
- Forest server already has CORS enabled
- Check browser console for details
