#!/bin/bash
set -e

# Navigate to project root
cd "$(dirname "$0")/../.."

# Read version from VERSION file (single source of truth)
export FOREST_VERSION=$(cat VERSION)
echo "Building Forest CLI v${FOREST_VERSION}..."

# Update package.json version to match VERSION file
sed -i '' "s/\"version\": \".*\"/\"version\": \"$FOREST_VERSION\"/" package.json

# Update tauri.conf.json version to match VERSION file
sed -i '' "3s/\"version\": \".*\"/\"version\": \"$FOREST_VERSION\"/" forest-desktop/src-tauri/tauri.conf.json

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
