# Next Session: Complete Forest Desktop Migration (Phases 5 & 7)

## Quick Start Prompt

Read `/Users/bwl/Developer/forest/TAURIIIIII.md` for full context, then review the commit `f1fd93c` to see what's been completed. We're 75% done with the Tauri v2 migration - Phases 1-4 and 6 are complete (database, scoring, embeddings, and core CLI commands all working!). The working directory is `/Users/bwl/Developer/forest/forest-desktop/src-tauri`. **Phase 5** needs auto-linking logic extracted from `src/cli/capture.rs` into reusable `src/core/` modules (most work is done, just refactor into library functions). **Phase 7** needs GUI wiring (React frontend exists, just connect it to the Rust IPC commands in `src/commands.rs`), plus Tier 2 CLI commands (`health`, `node edit`, `node link`, `edges list/accept/reject`). The rust-tauri-implementor agent has been crushing this project - use them for implementation. Total remaining work: ~2-3 hours to finish the entire migration. Forest Desktop is currently a working CLI application with semantic search, auto-linking, and embeddings - let's complete the GUI and polish!

## Key Files
- Plan: `TAURIIIIII.md`
- Source: `forest-desktop/src-tauri/src/`
- Frontend: `forest-desktop/src/`
- Last commit: `f1fd93c` (77 files, 23,753 insertions)
- Branch: `thinNtauri`

## What Works Right Now
```bash
cd forest-desktop/src-tauri
cargo build --release
./target/release/forest-desktop stats
echo "Test note" | ./target/release/forest-desktop capture --stdin --title "Test"
./target/release/forest-desktop search "test"
./target/release/forest-desktop node read <id>
```
