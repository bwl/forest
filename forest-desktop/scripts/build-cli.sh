#!/bin/bash
set -e

echo "Building Forest CLI standalone binary..."

# Navigate to project root
cd "$(dirname "$0")/../.."

# Build TypeScript CLI first
echo "Compiling TypeScript..."
bun run build

# Create standalone binary with Bun
echo "Creating standalone executable..."
bun build --compile --minify --sourcemap \
  --outfile forest-desktop/src-tauri/binaries/forest-aarch64-apple-darwin \
  src/index.ts

# Make it executable
chmod +x forest-desktop/src-tauri/binaries/forest-aarch64-apple-darwin

# Get file size
SIZE=$(du -h forest-desktop/src-tauri/binaries/forest-aarch64-apple-darwin | cut -f1)
echo "✓ CLI binary created: ${SIZE}"
