## Scripts

- `release.sh`: Wrapper around `bunx tauri build`. Run `bun run release` for full app + DMG, or `SKIP_DMG=1 bun run release` to skip DMG packaging when tools like `hdiutil` are unavailable.
