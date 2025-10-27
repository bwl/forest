# Forest Desktop CLI Integration Bug Report

## Summary

The bundled `forest` CLI binary in the Forest Desktop app (installed via Homebrew tap) fails to execute due to hardcoded development paths in the compiled binary, causing a fatal WASM file loading error.

## Environment

- **Forest Desktop Version**: 0.3.1
- **Installation Method**: Homebrew tap
- **CLI Binary Location**: `/opt/homebrew/bin/forest` → `/Users/bwl/Applications/Forest Desktop.app/Contents/MacOS/forest`
- **Platform**: macOS (Apple Silicon)
- **Runtime**: Bun v1.3.1
- **Date Reported**: 2025-10-26

## Issue Description

When attempting to run any `forest` CLI command from the bundled binary, the process immediately crashes with a path resolution error. The CLI is trying to load `sql-wasm.wasm` from a hardcoded development path that doesn't exist on the user's system.

## Steps to Reproduce

1. Install Forest Desktop via Homebrew:
   ```bash
   brew install --cask forest-desktop
   ```

2. Verify CLI is symlinked correctly:
   ```bash
   which forest
   # Output: /opt/homebrew/bin/forest

   ls -la /opt/homebrew/bin/forest
   # Output: lrwxr-xr-x -> /Users/bwl/Applications/Forest Desktop.app/Contents/MacOS/forest
   ```

3. Attempt to run any CLI command:
   ```bash
   forest stats
   # or
   forest capture --title "Test" --body "Test"
   # or even
   FOREST_EMBED_PROVIDER=mock forest stats
   ```

## Error Output

```
failed to asynchronously prepare wasm: Error: ENOENT: no such file or directory, open '/Users/bwl/Developer/forest/src/node_modules/sql.js/dist/sql-wasm.wasm'
Aborted(Error: ENOENT: no such file or directory, open '/Users/bwl/Developer/forest/src/node_modules/sql.js/dist/sql-wasm.wasm')
✖ Error: ENOENT: no such file or directory, open '/Users/bwl/Developer/forest/src/node_modules/sql.js/dist/sql-wasm.wasm'
[Stack trace from sql-wasm.js:92-97]
RuntimeError: Aborted(Error: ENOENT: no such file or directory, open '/Users/bwl/Developer/forest/src/node_modules/sql.js/dist/sql-wasm.wasm'). Build with -sASSERTIONS for more info.
```

**Key Problem**: The path `/Users/bwl/Developer/forest/src/node_modules/sql.js/dist/sql-wasm.wasm` is from the **developer's build environment**, not a path relative to the installed app bundle.

## Expected Behavior

The bundled CLI should:
1. Look for `sql-wasm.wasm` relative to the app bundle structure:
   - `/Users/bwl/Applications/Forest Desktop.app/Contents/Resources/`
   - Or embed the WASM file directly in the binary
   - Or use runtime path resolution based on `__dirname` or similar

2. Successfully initialize the SQLite WASM module from the bundled resources

3. Execute CLI commands normally, accessing the shared `forest.db` database

## Actual Behavior

The CLI binary contains hardcoded absolute paths from the build environment, causing immediate failure on any user's system where those paths don't exist.

## Root Cause Analysis

The issue appears to stem from **build-time path resolution** in the bundled JavaScript/TypeScript code:

1. **sql.js initialization** (likely in `src/lib/db.ts`) uses a path that gets baked into the compiled binary during the build process

2. **Bun/webpack/bundler** is not properly resolving or embedding the `sql-wasm.wasm` dependency

3. The Tauri build process for the CLI binary (`src-tauri/binaries/forest`) is not:
   - Bundling the WASM file as a resource
   - Using runtime path resolution
   - Embedding the WASM inline

### Relevant Code Locations

From the stack trace, the issue originates in:
- `node_modules/sql.js/dist/sql-wasm.js:97` - Where sql.js tries to load the WASM file
- Likely `src/lib/db.ts` - Where the database is initialized with sql.js
- Build configuration that produces `src-tauri/binaries/forest`

## Technical Details

### Current App Bundle Structure
```
/Users/bwl/Applications/Forest Desktop.app/
└── Contents/
    ├── MacOS/
    │   ├── forest           # 68MB Mach-O executable (bundled CLI)
    │   └── forest-desktop   # 45MB Mach-O executable (Tauri app)
    └── Resources/
        ├── _up_/            # Empty directory
        └── icon.icns        # App icon
```

**Missing**: The `sql-wasm.wasm` file is not present anywhere in the app bundle!

### What Should Happen

The WASM file should be:
1. **Bundled as a resource**: Placed in `Resources/` or `Resources/_up_/`
2. **Referenced with dynamic path resolution**:
   ```typescript
   // Instead of compile-time resolution
   const wasmPath = path.join(__dirname, 'sql-wasm.wasm');

   // Or use app bundle path resolution
   const wasmPath = path.join(process.resourcesPath, 'sql-wasm.wasm');
   ```
3. **Or embedded directly** in the binary using base64 encoding or similar

## Impact

**Severity**: Critical - CLI is completely non-functional

**Affected Users**: All users who install Forest Desktop via Homebrew tap

**Workarounds**: None currently available. Users cannot use the CLI at all.

## Suggested Fixes

### 1. Bundle WASM File in App Resources (Recommended)

**In `src-tauri/tauri.conf.json`:**
```json
{
  "bundle": {
    "resources": [
      "node_modules/sql.js/dist/sql-wasm.wasm"
    ]
  }
}
```

**In `src/lib/db.ts`:**
```typescript
import { app } from '@tauri-apps/api';

// Determine WASM path based on runtime context
const getWasmPath = async () => {
  if (process.env.TAURI_PLATFORM) {
    // Running in Tauri app
    const resourceDir = await app.resourceDir();
    return path.join(resourceDir, 'sql-wasm.wasm');
  } else {
    // Running standalone CLI
    return path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm');
  }
};

const SQL = await initSqlJs({
  locateFile: (file) => getWasmPath()
});
```

### 2. Embed WASM Inline (Alternative)

Use a bundler plugin to inline the WASM file as base64:

```typescript
import sqlWasmBase64 from 'sql-wasm.wasm?inline';

const SQL = await initSqlJs({
  wasmBinary: Buffer.from(sqlWasmBase64, 'base64')
});
```

### 3. Fix Build Configuration

Ensure the CLI bundling process (whether using Bun, webpack, or esbuild) properly handles WASM assets:

- Add WASM file handling to bundler config
- Use `copy-webpack-plugin` or equivalent
- Set correct `publicPath` or `assetPath` for runtime resolution

## Additional Context

### Related Files in Repository

Based on the codebase structure:
- `src-tauri/src/main.rs` - Tauri app entry point
- `src-tauri/src/commands.rs` - Tauri command definitions (includes `execute_forest_command`)
- `src-tauri/binaries/` - Location of bundled CLI binary
- `src/lib/db.ts` - Database initialization (likely where sql.js is loaded)
- `src-tauri/tauri.conf.json` - Tauri configuration (needs resource bundling)

### Build Process Investigation Needed

The team should investigate:
1. How is `src-tauri/binaries/forest` currently being built?
2. Is it using Bun's standalone executable feature? (`bun build --compile`)
3. Are there any bundler configurations that need WASM asset handling?
4. Why isn't the WASM file being detected as a dependency during bundling?

## Reproduction Verification

I can verify this is not an isolated issue by checking:
```bash
# Binary is correct architecture
file "/Users/bwl/Applications/Forest Desktop.app/Contents/MacOS/forest"
# Output: Mach-O 64-bit executable arm64 ✅

# Resources directory lacks WASM
find "/Users/bwl/Applications/Forest Desktop.app" -name "*.wasm"
# Output: (empty) ❌

# Error references non-existent development path
forest stats 2>&1 | grep "ENOENT"
# Output: Error: ENOENT: no such file or directory, open '/Users/bwl/Developer/forest/src/...' ❌
```

## Recommendations

1. **Immediate**: Add WASM file to app bundle resources
2. **Short-term**: Implement runtime path resolution for bundled resources
3. **Long-term**: Consider using a different SQLite binding that doesn't require WASM files (e.g., better-sqlite3 with native bindings, though this adds platform-specific complexity)
4. **Testing**: Add automated tests that verify CLI execution in a clean environment (not just developer machines)

## Contact

This bug report was generated based on investigation of Forest Desktop v0.3.1 installed via Homebrew tap. For follow-up questions or additional diagnostic information, please contact the reporting user.

---

**Generated**: 2025-10-26
**Reporter**: Forest Desktop User (via Claude Code analysis)
