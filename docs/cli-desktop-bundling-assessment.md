# Forest CLI bundling with Forest Desktop

This document reviews the current setup for bundling the Forest CLI with Forest Desktop and recommends improvements to make the integration more robust across platforms and releases.

> Note: This repository’s CLI now uses `FOREST_EMBED_PROVIDER` (`openrouter|openai|mock|none`) and does not ship a `forest-embed` helper binary. Sections below that mention `forest-embed` reflect an older Desktop integration plan and may be stale.

## What’s Good

- Single‑binary CLI: `scripts/build-cli.sh` compiles a standalone executable with `bun build --compile` and embeds `sql.js`’s WASM via `scripts/embed-wasm.ts` so the CLI runs without `node_modules`.
- Shared DB location: `src/lib/db.ts` defaults to a platform‑appropriate app data path (overridable with `FOREST_DB_PATH`) so Desktop and CLI share data.
- Embeddings parity: CLI uses `FOREST_EMBED_PROVIDER` to select embeddings (or disable them); Desktop bundling can choose its own embedding strategy independently.
- Tauri hooks: `forest-desktop/src-tauri/tauri.conf.json` includes `bundle.externalBin` and a `beforeBuildCommand` to produce the CLI binary, plus `plugins.cli` so the Desktop binary supports CLI subcommands.

## Gaps and concrete fixes

### 1) External binary naming mismatch (fixed)

- Current: `forest-desktop/scripts/build-cli.sh` outputs:
  - `forest-desktop/src-tauri/binaries/forest-aarch64-apple-darwin`
  - `forest-desktop/src-tauri/binaries/forest-embed-aarch64-apple-darwin`
- Expected by Tauri: unsuffixed names listed in `externalBin` (macOS ends up at `Contents/MacOS/forest` and `forest-embed`).
  - `forest-desktop/src-tauri/tauri.conf.json` → `bundle.externalBin: ["binaries/forest", "binaries/forest-embed"]`
  - `shell_integration.rs` expects `Contents/MacOS/forest`.

Status: Implemented.
- `forest-desktop/scripts/build-cli.sh` now copies arch‑suffixed artifacts to unsuffixed names `binaries/forest` and `binaries/forest-embed` and marks them executable. Tauri bundling and the in‑app installer now reference the same paths.

### 2) Completions path in in‑app installer (fixed)

- Bundling: `tauri.conf.json` places completions under `Resources/` via `resources: ["../../completions/*"]`.
- Installer instructions: `shell_integration.rs` tells users to source completions from the binary directory (`MacOS/`), which is incorrect on macOS (and possibly elsewhere).

Status: Implemented.
- `forest-desktop/src-tauri/src/shell_integration.rs` now uses the app `resource_dir`. It searches for completions in this order:
  - `Resources/completions/` (ideal)
  - `Resources/resources/completions/` (when staging `src-tauri/resources/completions`)
  - falls back to `Resources/` as a last resort
  PATH export still points to the binary directory.

### 3) Cross‑platform external bins

- Script only builds macOS aarch64. `bundle.targets` is `"all"`, but matching external binaries for each target/arch won’t exist if you build on a single machine.

Options:
- Build per‑platform in CI (macOS arm64/x64, Windows x64, Linux x64). On each runner, produce the platform‑specific `binaries/forest` and `binaries/forest-embed`, then build the Tauri bundle for that platform and upload to Releases.
- On macOS, consider universal binaries (arm64 + x86_64 via `lipo`) for simpler user installs.

### 4) PATH integration on non‑macOS

- Current code assumes `resource_dir` or a parent path is suitable as a PATH target and appends to shell RC files. This ignores PowerShell/CMD on Windows.

Options:
- Add a Windows pathway that amends the user PATH in the registry (or provide explicit instructions/one‑click via Tauri)
- Keep shell‑RC approach for Linux/macOS; for fish, consider adding a file under `~/.config/fish/conf.d/` instead of editing `config.fish`.

### 5) VERSION syncing robustness (fixed)

- `VERSION` is the source of truth, but `build-cli.sh` uses line‑numbered `sed` to update `tauri.conf.json`, which is brittle.

Status: Implemented.
- Added `scripts/sync-version.ts` which updates top‑level `package.json`, `forest-desktop/src-tauri/tauri.conf.json`, and `forest-desktop/package.json` from `VERSION`.
- `forest-desktop/scripts/build-cli.sh` now runs this script instead of brittle `sed` edits.

### 6) `sql.js` WASM diagnostics

- Embedded base64 works; error messaging could be more explicit when running from source without having generated `embedded-wasm.ts`.

Enhancement:
- Improve the thrown error in `src/lib/db.ts` with a concise remediation hint and optionally a detection of `Bun.compile` context vs. dev.

### 7) npm bin entry (FYI)

- `package.json` correctly publishes `bin.forest` → `dist/index.js` for npm installs; this is orthogonal to Desktop bundling as long as `bun run build` generates `dist/`.

## Stronger options going forward

- CI matrix builds per OS/arch to deliver truly cross‑platform Desktop + bundled CLI.
- macOS universal binaries to simplify distribution (and Homebrew cask logic).
- Tighten installer UX:
  - macOS: Prefer symlink approach (as in your Homebrew cask) or keep `/cli-install` with accurate paths.
  - Windows: Add PowerShell/CMD PATH integration.
- Harden `findForestEmbedBinary`:
  - With unsuffixed copies created at build time the first path checks will succeed quickly; keep suffixed fallbacks as a safety net.
- Code signing/notarization:
  - When enabled, drop the quarantine workaround in your cask and improve first‑run experience.

## Suggested immediate patches

1) Update `forest-desktop/scripts/build-cli.sh` to copy/symlink suffixed files to unsuffixed names (`forest`, `forest-embed`) after build.
2) Update `forest-desktop/src-tauri/src/shell_integration.rs`:
   - Keep PATH export pointing at the binary directory.
   - Reference completions from `resource_dir` paths instead of `bin_dir`.
3) Replace version bump `sed` with a small script that sets both `package.json` and `tauri.conf.json` from `VERSION` via proper JSON parsing.

## Verification checklist

- Build Desktop:
  - `cd forest-desktop && bun run tauri build`
  - Confirm app contains `Contents/MacOS/forest` and `Contents/MacOS/forest-embed`
  - Confirm completions under `Contents/Resources/resources/completions/…` (or `Contents/Resources/completions/` depending on bundling)
  - If DMG packaging fails due to `hdiutil` or AppleScript restrictions, use `bun run release:nodmg` (app-only bundle) and run DMG packaging on a macOS host with the proper permissions and Xcode CLT installed.
- Check CLI inside app:
  - `"/Applications/Forest.app/Contents/MacOS/forest" --version`
- In‑app installer:
  - Open Desktop → Command Palette `/cli-install` → Auto install for zsh/bash/fish.
  - New terminals should resolve `forest`.
- Embeddings:
  - `forest health` should report local embedding provider OK (with `forest-embed` found and executable).

---

If desired, I can apply the build‑script and installer patches now and add a version‑sync script.
