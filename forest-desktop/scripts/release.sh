#!/usr/bin/env bash
set -euo pipefail

# Wrapper to build Forest Desktop, optionally skipping DMG bundling in restricted environments.
# Usage:
#   bun run release             # full build (app + dmg)
#   SKIP_DMG=1 bun run release  # app bundle only (no DMG)

cd "$(dirname "$0")/.."

if [[ "${SKIP_DMG:-0}" == "1" ]]; then
  echo "Building Forest Desktop (app only, skipping DMG)..."
  bunx tauri build -b app
else
  echo "Building Forest Desktop (app + dmg)..."
  bunx tauri build
fi

