#!/bin/bash
set -e

echo "Building Forest CLI and embedding helper..."

# Navigate to project root
cd "$(dirname "$0")/../.."

# Embed WASM file as base64 for standalone distribution
echo "Embedding sql-wasm.wasm..."
bun run scripts/embed-wasm.ts

# Build TypeScript CLI first
echo "Compiling TypeScript..."
bun run build

# Build Rust embedding helper
echo "Building forest-embed (Rust embedding helper)..."
cd forest-desktop/src-tauri
cargo build --release --bin forest-embed
cd ../..

# Copy forest-embed next to CLI
echo "Bundling forest-embed..."
cp forest-desktop/src-tauri/target/release/forest-embed \
   forest-desktop/src-tauri/binaries/forest-embed-aarch64-apple-darwin
chmod +x forest-desktop/src-tauri/binaries/forest-embed-aarch64-apple-darwin

# Create standalone binary with Bun
echo "Creating standalone CLI executable..."
bun build --compile --minify --sourcemap \
  --outfile forest-desktop/src-tauri/binaries/forest-aarch64-apple-darwin \
  src/index.ts

# Make it executable
chmod +x forest-desktop/src-tauri/binaries/forest-aarch64-apple-darwin

# Get file sizes
CLI_SIZE=$(du -h forest-desktop/src-tauri/binaries/forest-aarch64-apple-darwin | cut -f1)
EMBED_SIZE=$(du -h forest-desktop/src-tauri/binaries/forest-embed-aarch64-apple-darwin | cut -f1)

echo "✓ CLI binary created: ${CLI_SIZE}"
echo "✓ forest-embed helper: ${EMBED_SIZE}"
echo "  Both CLI and desktop app now use the same fastembed engine!"
