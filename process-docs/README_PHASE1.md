# Forest Desktop - Phase 1 Implementation Guide

## Quick Start

```bash
# Build the Rust backend
cd forest-desktop/src-tauri
cargo build

# Test CLI mode (headless)
./target/debug/forest-desktop stats
./target/debug/forest-desktop stats --json

# Run automated tests
cd ..
./TEST_PHASE1.sh

# Test GUI mode (requires graphical environment)
bun install
bun run tauri dev
```

## Architecture Overview

Forest Desktop is a unified Tauri v2 application that supports both CLI and GUI modes:

```
┌─────────────────────────────────────────────────┐
│  Entry Point: main.rs                           │
│  ┌───────────────────────────────────────────┐  │
│  │ Tauri Builder with Plugins:               │  │
│  │  - tauri-plugin-cli (CLI parsing)         │  │
│  │  - tauri-plugin-sql (SQLite)              │  │
│  │  - tauri-plugin-store (Settings)          │  │
│  │  - tauri-plugin-shell (Shell commands)    │  │
│  └───────────────────────────────────────────┘  │
│                      │                           │
│                      ▼                           │
│         ┌────────────────────────┐               │
│         │ Mode Detection         │               │
│         │ (cli::handle_cli)      │               │
│         └────────────────────────┘               │
│                 │                                 │
│        ┌────────┴────────┐                       │
│        ▼                 ▼                        │
│  ┌──────────┐      ┌──────────┐                 │
│  │ CLI Mode │      │ GUI Mode │                  │
│  │ (headless)│     │ (window) │                  │
│  └──────────┘      └──────────┘                 │
│        │                 │                        │
│        ▼                 ▼                        │
│  ┌──────────┐      ┌──────────┐                 │
│  │ Commands │      │ React    │                  │
│  │ Handler  │      │ Frontend │                  │
│  └──────────┘      └──────────┘                 │
│        │                                          │
│        ▼                                          │
│  ┌──────────────────────────────────┐            │
│  │ Database Layer (db/mod.rs)       │            │
│  │  - SQLite connection pool         │           │
│  │  - Database::get_stats()          │           │
│  │  - FOREST_DB_PATH support          │          │
│  └──────────────────────────────────┘            │
└─────────────────────────────────────────────────┘
```

## File Structure

```
forest-desktop/
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Entry point + mode routing
│   │   ├── lib.rs                # Public API exports
│   │   ├── cli/
│   │   │   ├── mod.rs            # CLI router (handle_cli)
│   │   │   └── stats.rs          # Stats command implementation
│   │   └── db/
│   │       └── mod.rs            # Database layer (Database struct)
│   ├── Cargo.toml                # Rust dependencies (Tauri v2)
│   ├── tauri.conf.json           # Tauri v2 configuration
│   └── build.rs                  # Build script
├── src/                          # React frontend (GUI mode)
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Main app component
│   └── components/               # React components
├── package.json                  # Node dependencies
├── TEST_PHASE1.sh                # Automated test suite
├── PHASE1_COMPLETE.md            # Completion report
└── README_PHASE1.md              # This file
```

## Key Implementation Details

### Mode Routing Logic (main.rs)

```rust
// 1. Build Tauri app with all plugins
let app = tauri::Builder::default()
    .plugin(tauri_plugin_cli::init())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_shell::init())
    .build(tauri::generate_context!())?;

// 2. Check for CLI subcommands
match cli::handle_cli(&app.handle()).await {
    Ok(true) => {
        // CLI command executed - exit without GUI
        std::process::exit(0);
    }
    Ok(false) => {
        // No CLI command - launch GUI mode
        app.run(|_app_handle, event| { ... });
    }
    Err(e) => {
        eprintln!("Error: {:#}", e);
        std::process::exit(1);
    }
}
```

**Key Points:**
- CLI detection happens AFTER Tauri app is built (required for plugin-cli)
- CLI mode exits early to prevent window creation
- GUI mode runs the event loop normally

### CLI Command Routing (cli/mod.rs)

```rust
pub async fn handle_cli(app: &tauri::AppHandle) -> Result<bool> {
    let cli_matches = app.cli().matches()?;

    if let Some(subcommand) = cli_matches.subcommand {
        match subcommand.name.as_str() {
            "stats" => {
                stats::handle_stats_command(&subcommand).await?;
                return Ok(true);  // CLI command executed
            }
            _ => {
                eprintln!("Unknown command: {}", subcommand.name);
                std::process::exit(1);
            }
        }
    }

    Ok(false)  // No subcommand = GUI mode
}
```

### Database Connection (db/mod.rs)

```rust
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new() -> Result<Self> {
        let db_path = get_database_path();  // Reads FOREST_DB_PATH env

        let options = SqliteConnectOptions::from_str(&format!("sqlite:{}", db_path.display()))?
            .create_if_missing(true)
            .busy_timeout(std::time::Duration::from_secs(30));

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await?;

        Ok(Self { pool })
    }

    pub async fn get_stats(&self) -> Result<DatabaseStats> {
        // Gracefully handles missing tables by returning zeros
        let nodes_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM nodes WHERE 1=1")
            .fetch_optional(&self.pool)
            .await
            .unwrap_or(None)
            .unwrap_or(0);
        // ... (edges, suggested edges)
    }
}
```

**Key Points:**
- Connection pooling for concurrent access
- Reads FOREST_DB_PATH environment variable
- Creates database file if missing
- Graceful error handling for missing schema

### Stats Command (cli/stats.rs)

```rust
pub async fn handle_stats_command(matches: &SubcommandMatches) -> Result<()> {
    // Parse flags
    let json_output = matches.matches.args.get("json")
        .map_or(false, |arg| arg.value.as_bool().unwrap_or(false));

    // Connect to database
    let db = Database::new().await?;
    let stats = db.get_stats().await?;
    db.close().await;

    // Output in requested format
    if json_output {
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("forest stats");
        println!("Nodes: {}", stats.nodes);
        println!("Accepted edges: {}", stats.edges);
        // ...
    }

    Ok(())
}
```

## Configuration Files

### Cargo.toml (Key Dependencies)

```toml
[dependencies]
# Tauri v2 core
tauri = { version = "2.0", features = [] }
tauri-plugin-shell = "2.0"
tauri-plugin-cli = "2.0"
tauri-plugin-sql = { version = "2.0", features = ["sqlite"] }
tauri-plugin-store = "2.0"

# Database
sqlx = { version = "0.8", features = ["runtime-tokio-native-tls", "sqlite"] }

# Async runtime
tokio = { version = "1.35", features = ["full"] }

# Error handling
anyhow = "1.0"
thiserror = "1.0"

# CLI parsing
clap = { version = "4.4", features = ["derive"] }
```

### tauri.conf.json (CLI Plugin)

```json
{
  "plugins": {
    "cli": {
      "description": "Forest knowledge base - graph-native note capture and linking",
      "subcommands": {
        "stats": {
          "description": "Show graph statistics (nodes, edges, tags, degree distribution)",
          "args": [
            {
              "name": "json",
              "description": "Output JSON format",
              "takesValue": false,
              "short": "j"
            },
            {
              "name": "top",
              "description": "Number of top items to show",
              "takesValue": true,
              "short": "t"
            }
          ]
        }
      }
    },
    "sql": {
      "preload": ["sqlite:forest.db"]
    }
  }
}
```

## Environment Variables

- `FOREST_DB_PATH`: Database file path (default: `forest.db` in cwd)
- `RUST_LOG`: Logging level (e.g., `debug`, `info`, `error`)
- `RUST_BACKTRACE`: Enable backtrace on panic (`1` or `full`)

## Development Workflow

### Building

```bash
cd forest-desktop/src-tauri

# Debug build (fast, large binary)
cargo build

# Release build (slow, optimized)
cargo build --release

# Check without building (fast)
cargo check
```

### Testing

```bash
# Run automated test suite
cd forest-desktop
./TEST_PHASE1.sh

# Manual CLI tests
cd src-tauri
./target/debug/forest-desktop stats
./target/debug/forest-desktop stats --json

# With custom database path
FOREST_DB_PATH=/tmp/test.db ./target/debug/forest-desktop stats

# Enable debug logging
RUST_LOG=debug ./target/debug/forest-desktop stats
```

### GUI Development

```bash
cd forest-desktop

# Install frontend dependencies
bun install

# Start dev server (GUI mode)
bun run tauri dev

# Build production bundle
bun run tauri build
```

## Troubleshooting

### Problem: "error while building tauri application: PluginInitialization..."
**Solution**: Check tauri.conf.json syntax - plugin configs must match plugin schema

### Problem: CLI command opens a window
**Solution**: Ensure `cli::handle_cli()` returns `Ok(true)` and calls `std::process::exit(0)`

### Problem: Database connection fails
**Solution**:
1. Check `FOREST_DB_PATH` is writable
2. Verify parent directory exists
3. Check SQLite version compatibility

### Problem: Cargo build fails with "conflicting versions"
**Solution**: Ensure all dependencies use compatible versions (e.g., sqlx 0.8 matches tauri-plugin-sql)

## Phase 1 Success Criteria (Verified)

✅ Tauri v2 upgrade complete
✅ All required plugins initialized (cli, sql, store, shell)
✅ CLI mode works headless (no window)
✅ GUI mode configured (manual test required)
✅ `stats` command functional with JSON output
✅ Database connection established
✅ Clean build with no warnings
✅ All tests pass in `TEST_PHASE1.sh`

## What's Next: Phase 2

Phase 2 will implement the full database schema migration:

1. Create SQLx migrations for all tables (nodes, edges, documents, etc.)
2. Port schema from TypeScript (`src/lib/db.ts`)
3. Implement CRUD operations for nodes and edges
4. Add database health checks
5. Create migration tooling

**Estimated Duration**: 2-3 days
**Complexity**: Medium (schema translation + migration system)

## References

- [Tauri v2 Documentation](https://v2.tauri.app/)
- [Tauri Plugin CLI](https://github.com/tauri-apps/tauri-plugin-cli)
- [SQLx Documentation](https://docs.rs/sqlx/)
- [Tokio Async Runtime](https://tokio.rs/)

---

**Author**: Claude (Rust + Tauri Implementation Specialist)
**Date**: 2025-10-23
**Status**: Phase 1 Complete ✅
