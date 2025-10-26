# Forest CLI Integration - Ghostty-Style Bundling

This document describes how the Forest CLI is bundled with the desktop app, similar to how Ghostty works.

## Architecture

```
Forest.app/
├── Contents/
│   ├── MacOS/
│   │   ├── forest-desktop          # Tauri app (Rust GUI)
│   │   └── forest                  # Standalone CLI binary (Bun-compiled, 65MB)
│   └── Resources/
│       ├── completions/
│       │   ├── forest.bash         # Bash completion
│       │   ├── forest.zsh          # Zsh completion
│       │   └── README.md
```

## Implementation Details

### 1. CLI Binary Creation (`scripts/build-cli.sh`)

The CLI is compiled into a standalone executable using `bun build --compile`:

```bash
bun build --compile --minify --sourcemap \
  --outfile forest-desktop/src-tauri/binaries/forest-aarch64-apple-darwin \
  src/index.ts
```

This creates a single 65MB binary with:
- Bun runtime embedded
- All dependencies bundled
- No need for external `node_modules`

### 2. Tauri Bundle Configuration (`tauri.conf.json`)

```json
{
  "bundle": {
    "externalBin": ["binaries/forest"],
    "resources": ["../../completions/*"]
  }
}
```

This tells Tauri to:
- Include the CLI binary in `Contents/MacOS/` (on macOS)
- Bundle shell completion scripts in `Contents/Resources/`

### 3. Shell Integration Module (`src-tauri/src/shell_integration.rs`)

Provides Tauri commands for:
- `get_cli_install_info()` - Get installation instructions
- `check_cli_in_path()` - Check if CLI is already in PATH
- `auto_install_cli_path(shell)` - Auto-add to shell RC files

### 4. Frontend Integration

**Command Palette** (`src/components/CommandPalette.tsx`):
- Type `/cli-install` to open installation dialog

**CLI Install Dialog** (`src/components/CLIInstallDialog.tsx`):
- Shows manual installation instructions
- Provides "Quick Install" button to auto-update shell RC files
- Supports Zsh, Bash, and Fish

## Usage

### For Users

1. **Install Forest.app** - Drag to Applications folder
2. **Open the app** - Launch Forest Desktop
3. **Install CLI** - Press `⌘K`, type `/cli-install`
4. **Choose installation method**:
   - **Quick Install**: Select your shell and click "Auto Install"
   - **Manual**: Copy the PATH export line to your shell config

### For Developers

**Build the app with bundled CLI:**
```bash
cd forest-desktop
bun run tauri build
```

The `beforeBuildCommand` in `tauri.conf.json` automatically:
1. Runs `scripts/build-cli.sh` to create standalone binary
2. Builds the React frontend

**Test CLI binary directly:**
```bash
forest-desktop/src-tauri/binaries/forest-aarch64-apple-darwin --version
```

**Test in development:**
```bash
cd forest-desktop
bun run tauri dev
# App launches - press ⌘K, type "/cli-install"
```

## What PATH Export Does

The auto-install or manual export adds this to your shell config:

```bash
# Added by Forest Desktop
export PATH="$PATH:/Applications/Forest.app/Contents/MacOS"
```

After restarting your terminal, `forest` command will be available globally.

## Comparison with Ghostty

| Feature | Ghostty | Forest |
|---------|---------|--------|
| Binary location | `Contents/MacOS/ghostty` | `Contents/MacOS/forest` |
| Bundle size | ~36MB | ~65MB (includes all deps) |
| Runtime | Native binary | Bun runtime |
| Shell integration | Auto on launch | Via `/cli-install` command |
| Completions | Bundled in Resources | Bundled in Resources |
| PATH setup | `$GHOSTTY_BIN_DIR` | Manual or auto-install |

## Benefits

✅ **Single installation** - Users only install Forest.app
✅ **Version sync** - CLI and GUI always match
✅ **Clean uninstall** - Delete app removes everything
✅ **No separate CLI install** - Everything in one package
✅ **Shell completions included** - Auto-bundled

## Future Enhancements

- [ ] Auto-detect shell and prompt on first launch
- [ ] Add universal binary support (Intel + Apple Silicon)
- [ ] Reduce binary size with tree-shaking optimizations
- [ ] Add CLI update notifications when app updates
