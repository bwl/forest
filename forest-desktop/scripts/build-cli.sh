#!/bin/bash
set -e

# Navigate to project root
cd "$(dirname "$0")/../.."

# Read version from VERSION file (single source of truth)
export FOREST_VERSION=$(cat VERSION)
echo "Building Forest CLI v${FOREST_VERSION}..."

# Sync versions across configs via script (robust vs sed line edits)
echo "Syncing versions..."
bun run scripts/sync-version.ts

# Embed WASM file as base64 for standalone distribution
echo "Embedding sql-wasm.wasm..."
bun run scripts/embed-wasm.ts

# Build TypeScript CLI first
echo "Compiling TypeScript..."
bun run build

# Stage shell completions into Tauri resources (bundled under Resources/completions)
echo "Staging shell completions into Tauri resources..."
rm -rf forest-desktop/src-tauri/resources/completions
mkdir -p forest-desktop/src-tauri/resources/completions
cp -R completions/. forest-desktop/src-tauri/resources/completions/

# Build Rust embedding helper
echo "Building forest-embed (Rust embedding helper)..."
cd forest-desktop/src-tauri
cargo build --release --bin forest-embed
cd ../..

# Ensure binaries directory exists (for CI builds)
mkdir -p forest-desktop/src-tauri/binaries

# Copy forest-embed next to CLI
echo "Bundling forest-embed..."
cp forest-desktop/src-tauri/target/release/forest-embed \
   forest-desktop/src-tauri/binaries/forest-embed-aarch64-apple-darwin
chmod +x forest-desktop/src-tauri/binaries/forest-embed-aarch64-apple-darwin

# Also provide unsuffixed name expected by tauri.conf.json (externalBin)
cp -f forest-desktop/src-tauri/binaries/forest-embed-aarch64-apple-darwin \
      forest-desktop/src-tauri/binaries/forest-embed
chmod +x forest-desktop/src-tauri/binaries/forest-embed

# Create standalone binary with Bun
echo "Creating standalone CLI executable..."
bun build --compile --minify --sourcemap \
  --outfile forest-desktop/src-tauri/binaries/forest-aarch64-apple-darwin \
  src/index.ts

# Make it executable
chmod +x forest-desktop/src-tauri/binaries/forest-aarch64-apple-darwin

# Also provide unsuffixed name expected by tauri.conf.json (externalBin)
cp -f forest-desktop/src-tauri/binaries/forest-aarch64-apple-darwin \
      forest-desktop/src-tauri/binaries/forest
chmod +x forest-desktop/src-tauri/binaries/forest



# Get file sizes
CLI_SIZE=$(du -h forest-desktop/src-tauri/binaries/forest | cut -f1)
EMBED_SIZE=$(du -h forest-desktop/src-tauri/binaries/forest-embed | cut -f1)

echo "✓ CLI binary created: ${CLI_SIZE}"
echo "✓ forest-embed helper: ${EMBED_SIZE}"
echo "  Both CLI and desktop app now use the same fastembed engine!"
