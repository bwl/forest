# Forest Homebrew Distribution

Forest is now distributed via Homebrew using the `bwl/ettio` tap.

## Installation

```bash
brew tap bwl/ettio
brew install --cask forest
```

This installs:
- **Forest Desktop.app** → `~/Applications/Forest Desktop.app`
- **forest CLI** → symlinked to `/opt/homebrew/bin/forest`

## Repository Structure

### Main Repository (bwl/forest)
- Contains Forest source code
- GitHub Releases host DMG files
- Current release: v0.4.0

### Homebrew Tap (bwl/homebrew-ettio)
- Repository: https://github.com/bwl/homebrew-ettio
- Contains `Casks/forest.rb` cask definition
- Automatically tested via GitHub Actions

## Cask Details

**File:** `Casks/forest.rb`

Key features:
- Downloads DMG from GitHub Releases
- Installs app to `~/Applications`
- Creates binary symlink automatically
- **Removes quarantine attribute** (postflight script for unsigned apps)
- Includes zap stanza for clean uninstall

```ruby
cask "forest" do
  version "0.4.0"
  sha256 "38dbfe9cc6f21d63b33705e50b9607725c874865eb47b825ba21170e8f6d840c"

  url "https://github.com/bwl/forest/releases/download/v#{version}/Forest.Desktop_0.1.0_aarch64.dmg"

  app "Forest Desktop.app"
  binary "#{appdir}/Forest Desktop.app/Contents/MacOS/forest"

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-rd", "com.apple.quarantine", "#{appdir}/Forest Desktop.app"],
                   sudo: false
  end
end
```

## Release Process

### 1. Build the App
```bash
cd forest-desktop
bun run tauri build
```

Creates:
- `src-tauri/target/release/bundle/macos/Forest Desktop.app`
- `src-tauri/target/release/bundle/dmg/Forest Desktop_0.1.0_aarch64.dmg`

### 2. Create GitHub Release
```bash
# Tag the version
git tag v0.X.Y
git push origin v0.X.Y

# Create release with DMG
gh release create v0.X.Y \
  --title "Forest v0.X.Y" \
  --notes "Release notes here" \
  "forest-desktop/src-tauri/target/release/bundle/dmg/Forest Desktop_0.1.0_aarch64.dmg#Forest-0.X.Y-darwin-aarch64.dmg"
```

### 3. Update Cask
```bash
# Calculate SHA256
shasum -a 256 forest-desktop/src-tauri/target/release/bundle/dmg/Forest\ Desktop_0.1.0_aarch64.dmg

# Update Casks/forest.rb
cd /opt/homebrew/Library/Taps/bwl/homebrew-ettio
# Edit version and sha256 in Casks/forest.rb
git add Casks/forest.rb
git commit -m "Update forest to v0.X.Y"
git push origin main
```

### 4. Test
```bash
brew uninstall --cask forest
brew install --cask bwl/ettio/forest
open "/Users/bwl/Applications/Forest Desktop.app"
forest --version
```

## CLI Integration

The bundled CLI is automatically symlinked by Homebrew:
```
/opt/homebrew/bin/forest → ~/Applications/Forest Desktop.app/Contents/MacOS/forest
```

Since `/opt/homebrew/bin` is in PATH, the `forest` command works immediately after installation.

### Alternative: In-App Installer

Users can also use the GUI installer:
1. Press `⌘K` to open command palette
2. Type `/cli-install`
3. Choose shell and click "Auto Install"

This adds the app bundle's MacOS directory directly to PATH (alternative to Homebrew symlink).

## Code Signing (Future)

Currently using postflight script to remove quarantine attribute for unsigned apps.

For production distribution with proper code signing:
1. Get Apple Developer ID ($99/year)
2. Update `tauri.conf.json`:
```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
    }
  }
}
```
3. Remove postflight script from cask

## Troubleshooting

### "App is damaged" Error
Fixed by postflight script. If you still see this:
```bash
sudo xattr -rd com.apple.quarantine "/Users/bwl/Applications/Forest Desktop.app"
```

### Binary Not Found
Ensure Homebrew's bin directory is in PATH:
```bash
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Cask Not Found
Make sure tap is added:
```bash
brew tap bwl/ettio
```

## Commands Reference

```bash
# Install
brew tap bwl/ettio
brew install --cask forest

# Update
brew upgrade forest

# Uninstall (keeps preferences)
brew uninstall --cask forest

# Completely remove (including preferences)
brew uninstall --zap --cask forest

# Check info
brew info forest

# List installed casks
brew list --cask
```

## Links

- **Homebrew Tap**: https://github.com/bwl/homebrew-ettio
- **Forest Repo**: https://github.com/bwl/forest
- **Latest Release**: https://github.com/bwl/forest/releases/latest
- **Cask File**: https://github.com/bwl/homebrew-ettio/blob/main/Casks/forest.rb
