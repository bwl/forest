# Forest Preflight Check

A comprehensive environment validation script that ensures your system can run Forest, whether using local SQLite or remote PostgreSQL.

## What It Checks

### Core Dependencies
- ✅ **Node.js** (v16+) - Required runtime
- ✅ **Package Manager** (Bun or npm) - For dependencies
- ✅ **Git** (optional) - For version control and author tracking

### Filesystem
- ✅ **Disk Space** - Ensures adequate space for database
- ✅ **Write Permissions** - Validates current directory is writable
- ✅ **SQLite Support** - Verifies sql.js package is available

### Configuration
- ✅ **Environment Variables** - Checks FOREST_* configuration
- ✅ **Database Config** - Validates local or remote database settings
- ✅ **OpenAI API Key** - If using OpenAI embeddings

### Remote Database (Optional)
- ✅ **DNS Resolution** - Hostname resolves correctly
- ✅ **Network Connectivity** - Can reach database port
- ✅ **PostgreSQL Connection** - Can connect and authenticate
- ✅ **PostgreSQL Driver** - pg module installed

## Usage

### Basic Check (Local Development)

```bash
# Run from Forest project root
node scripts/forest-preflight.js
```

This validates:
- Node.js and package manager installed
- Filesystem permissions
- Dependencies available
- Environment configured

### Remote Database Check

```bash
# Test remote PostgreSQL connectivity
export FOREST_DB_TYPE=postgres
export FOREST_DB_URL=postgresql://user:pass@db.company.internal:5432/forest_kb
node scripts/forest-preflight.js --remote
```

This additionally validates:
- DNS resolution for database host
- Network connectivity (port reachable)
- PostgreSQL driver installed
- Database authentication works

### Verbose Mode

```bash
# Show all checks, including passing ones
node scripts/forest-preflight.js --verbose
```

### All Checks

```bash
# Run every check, even if not configured for remote
node scripts/forest-preflight.js --all
```

## Example Output

### ✅ Successful Check

```
Forest Environment Preflight Check
Validating your environment for Forest...

━━━ Core Dependencies ━━━

✓ Node.js Version
  Found Node.js 18.17.0

✓ Bun
  Found Bun 1.0.14

✓ Git
  Found Git 2.42.0

━━━ Filesystem ━━━

✓ Write Permissions
  Current directory is writable

✓ SQLite (sql.js)
  sql.js package found

━━━ Configuration ━━━

✓ Environment variables look good

━━━ Summary ━━━

✓ Passed:  6
✗ Failed:  0
⚠ Warnings: 0

✓ Environment is ready for Forest!

Next steps:
  1. Install dependencies: npm install (or bun install)
  2. Build Forest: npm run build
  3. Try it: forest health
```

### ❌ Issues Found

```
━━━ Core Dependencies ━━━

✗ Node.js
  Node.js is not installed or not in PATH
  → Solution: Install Node.js from https://nodejs.org/ (v18 or higher recommended)

⚠ Git
  Git not found (optional, but recommended for version control)
  → Solution: Install Git: https://git-scm.com/downloads

━━━ Remote Database ━━━

✗ PostgreSQL Connectivity
  Connection failed: connect ETIMEDOUT
  → Solution: Check that:
  1. PostgreSQL server is running
  2. Host and port are correct
  3. Credentials are valid
  4. Network allows connections to db.company.internal:5432
  5. Firewall allows port 5432

━━━ Summary ━━━

✓ Passed:  2
✗ Failed:  2
⚠ Warnings: 1

✗ Environment has issues that need to be fixed

Critical issues:
  • Node.js not found
  • PostgreSQL connection failed

Please address the failed checks above before using Forest.
```

## Common Issues & Solutions

### Node.js Not Found

**Problem:**
```
✗ Node.js
  Node.js is not installed or not in PATH
```

**Solution:**
1. Install Node.js from [nodejs.org](https://nodejs.org/) (v18 LTS recommended)
2. Or use a version manager:
   ```bash
   # nvm
   nvm install 18
   nvm use 18

   # Volta
   volta install node@18
   ```

### Package Manager Not Found

**Problem:**
```
✗ Package Manager
  Neither Bun nor npm found in PATH
```

**Solution:**
1. Install Bun (fastest):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Or ensure npm is installed with Node.js:
   ```bash
   node --version  # Should show Node.js version
   npm --version   # Should show npm version
   ```

### Write Permissions Issue

**Problem:**
```
✗ Write Permissions
  Cannot write to current directory
```

**Solution:**
1. Check directory ownership:
   ```bash
   ls -la
   ```

2. Change to a writable directory:
   ```bash
   cd ~/projects/forest
   ```

3. Or fix permissions:
   ```bash
   sudo chown -R $USER:$USER .
   ```

### Dependencies Not Installed

**Problem:**
```
⚠ SQLite (sql.js)
  sql.js not found in node_modules
```

**Solution:**
```bash
# Install dependencies
npm install

# Or with Bun
bun install
```

### Missing Remote Database URL

**Problem:**
```
✗ Remote Database Config
  FOREST_DB_TYPE=postgres but FOREST_DB_URL is not set
```

**Solution:**
```bash
# Set PostgreSQL connection URL
export FOREST_DB_URL=postgresql://username:password@hostname:5432/database_name

# Example for local PostgreSQL
export FOREST_DB_URL=postgresql://forest:mypassword@localhost:5432/team_knowledge

# Example for remote PostgreSQL
export FOREST_DB_URL=postgresql://forest:mypassword@db.company.internal:5432/forest_kb
```

### PostgreSQL Connection Failed

**Problem:**
```
✗ PostgreSQL Connectivity
  Connection failed: connect ECONNREFUSED
```

**Solutions:**

1. **PostgreSQL not running:**
   ```bash
   # Check if PostgreSQL is running
   pg_isready -h hostname -p 5432

   # Start PostgreSQL
   # macOS (Homebrew)
   brew services start postgresql

   # Linux (systemd)
   sudo systemctl start postgresql

   # Docker
   docker start forest-postgres
   ```

2. **Wrong hostname/port:**
   ```bash
   # Test TCP connection
   telnet db.company.internal 5432
   nc -zv db.company.internal 5432
   ```

3. **Authentication failed:**
   - Verify username and password in FOREST_DB_URL
   - Check PostgreSQL pg_hba.conf allows your connection
   - Ensure database exists: `psql -h host -U user -l`

4. **Network/Firewall:**
   ```bash
   # Check if port is reachable
   nmap -p 5432 db.company.internal

   # Or use curl
   curl -v telnet://db.company.internal:5432
   ```

### DNS Resolution Failed

**Problem:**
```
✗ DNS Resolution
  Cannot resolve hostname: getaddrinfo ENOTFOUND
```

**Solution:**
1. Check hostname is correct:
   ```bash
   nslookup db.company.internal
   dig db.company.internal
   ```

2. Check DNS servers:
   ```bash
   cat /etc/resolv.conf
   ```

3. If using VPN, ensure VPN is connected:
   ```bash
   # Company VPN may provide DNS for internal hostnames
   vpn-client status
   ```

4. Try IP address instead:
   ```bash
   export FOREST_DB_URL=postgresql://user:pass@192.168.1.100:5432/forest_kb
   ```

### PostgreSQL Driver Missing

**Problem:**
```
⚠ PostgreSQL Driver
  pg module not found (needed for remote PostgreSQL)
```

**Solution:**
```bash
# Install PostgreSQL driver
npm install pg

# Or with Bun
bun add pg
```

### OpenAI API Key Issues

**Problem:**
```
✗ OpenAI API Key
  FOREST_EMBED_PROVIDER=openai but OPENAI_API_KEY is not set
```

**Solution:**
1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)

2. Set environment variable:
   ```bash
   export OPENAI_API_KEY=sk-proj-...
   ```

3. Or use local embeddings instead:
   ```bash
   export FOREST_EMBED_PROVIDER=local
   ```

## Integration with Forest CLI

The preflight check can be run standalone or integrated into Forest CLI:

### Standalone
```bash
node scripts/forest-preflight.js
```

### Via Forest CLI (Future)
```bash
forest doctor
forest doctor --remote
forest doctor --fix  # Attempt automatic fixes
```

## CI/CD Integration

Use preflight check in your CI pipeline:

```yaml
# .github/workflows/test.yml
jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Run preflight check
        run: node scripts/forest-preflight.js
```

## Docker Integration

For containerized environments:

```dockerfile
# Dockerfile
FROM node:18-alpine

# Copy preflight script
COPY scripts/forest-preflight.js /usr/local/bin/forest-preflight
RUN chmod +x /usr/local/bin/forest-preflight

# Run preflight on container start
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node /usr/local/bin/forest-preflight || exit 1
```

## Team Onboarding Workflow

1. **Clone repository:**
   ```bash
   git clone git@github.com:company/forest-team-kb.git
   cd forest-team-kb
   ```

2. **Run preflight check:**
   ```bash
   node scripts/forest-preflight.js --verbose
   ```

3. **Fix any issues** following the solutions provided

4. **Configure for team database:**
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   export FOREST_DB_TYPE=postgres
   export FOREST_DB_URL=postgresql://forest:password@db.company.internal:5432/team_kb
   export FOREST_USER=$(git config user.name)
   export FOREST_EMAIL=$(git config user.email)
   ```

5. **Re-run preflight with remote check:**
   ```bash
   node scripts/forest-preflight.js --remote
   ```

6. **Install and build:**
   ```bash
   npm install
   npm run build
   ```

7. **Verify:**
   ```bash
   forest health
   forest stats
   ```

## Exit Codes

- `0` - All checks passed (warnings are OK)
- `1` - One or more critical checks failed

Use in scripts:
```bash
if node scripts/forest-preflight.js; then
  echo "Environment is ready!"
  npm run build
else
  echo "Fix issues before continuing"
  exit 1
fi
```

## Extending the Script

Add custom checks for your environment:

```javascript
// scripts/forest-preflight.js

async function checkCustomRequirement() {
  // Your custom check logic
  const result = await checkCommand('your-tool', ['--version']);

  if (result.success) {
    logCheck('Custom Tool', 'pass', `Found version ${result.output}`);
    results.passed.push('Custom tool');
  } else {
    logCheck('Custom Tool', 'fail',
      'Custom tool not found',
      'Install from: https://example.com'
    );
    results.failed.push('Custom tool');
  }
}

// Add to main()
async function main() {
  // ... existing checks ...

  logSection('Custom Checks');
  await checkCustomRequirement();

  // ... rest of main ...
}
```

## Automated Fixes (Future)

Future versions may support `--fix` flag for automatic remediation:

```bash
# Hypothetical future feature
forest doctor --fix

✓ Installed missing dependencies
✓ Created database if not exists
✓ Ran migrations
✓ Configured environment
```

## Troubleshooting

If preflight check itself fails:

1. **Ensure Node.js works:**
   ```bash
   node --version
   ```

2. **Run with full path:**
   ```bash
   node /full/path/to/scripts/forest-preflight.js
   ```

3. **Check script permissions:**
   ```bash
   ls -la scripts/forest-preflight.js
   chmod +x scripts/forest-preflight.js
   ```

4. **Enable debugging:**
   ```bash
   NODE_DEBUG=* node scripts/forest-preflight.js --verbose
   ```

## Support

If preflight check reports issues you can't resolve:

1. Check [Forest documentation](../README.md)
2. Search [GitHub issues](https://github.com/bwl/forest/issues)
3. Ask in team Slack/Discord
4. Open a new issue with preflight output

---

**Run this script before setting up Forest to catch issues early and get helpful guidance for fixing them!**
