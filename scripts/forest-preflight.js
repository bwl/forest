#!/usr/bin/env node

/**
 * Forest Preflight Check
 *
 * Validates your environment can run Forest with local or remote databases.
 * Run this script before setting up Forest to catch issues early.
 *
 * Usage:
 *   node scripts/forest-preflight.js
 *   node scripts/forest-preflight.js --remote  # Test remote DB connectivity
 *   node scripts/forest-preflight.js --verbose # Show detailed output
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const symbols = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  arrow: '→',
};

// Configuration
const config = {
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  testRemote: process.argv.includes('--remote') || process.argv.includes('-r'),
  testAll: process.argv.includes('--all') || process.argv.includes('-a'),
};

// Results tracking
const results = {
  passed: [],
  failed: [],
  warnings: [],
  info: [],
};

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logCheck(name, status, message = '', solution = '') {
  const symbol = status === 'pass' ? symbols.success : status === 'fail' ? symbols.error : symbols.warning;
  const color = status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'yellow';

  console.log(`${colors[color]}${symbol}${colors.reset} ${name}`);

  if (message) {
    console.log(`  ${colors.dim}${message}${colors.reset}`);
  }

  if (solution) {
    console.log(`  ${colors.cyan}${symbols.arrow} Solution: ${solution}${colors.reset}`);
  }

  console.log('');
}

function logSection(title) {
  console.log('');
  console.log(`${colors.bright}${colors.blue}━━━ ${title} ━━━${colors.reset}`);
  console.log('');
}

async function checkCommand(command, args = []) {
  try {
    const { stdout } = await execAsync(`${command} ${args.join(' ')}`, {
      timeout: 5000,
      encoding: 'utf-8',
    });
    return { success: true, output: stdout.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function checkNodeVersion() {
  const result = await checkCommand('node', ['--version']);

  if (!result.success) {
    logCheck('Node.js', 'fail',
      'Node.js is not installed or not in PATH',
      'Install Node.js from https://nodejs.org/ (v18 or higher recommended)'
    );
    results.failed.push('Node.js not found');
    return false;
  }

  const version = result.output.replace('v', '');
  const major = parseInt(version.split('.')[0]);

  if (major < 16) {
    logCheck('Node.js Version', 'warning',
      `Found Node.js ${version}, but v16+ is recommended`,
      'Update Node.js to v18 LTS or higher for best compatibility'
    );
    results.warnings.push(`Node.js ${version} (v16+ recommended)`);
  } else {
    logCheck('Node.js Version', 'pass', `Found Node.js ${version}`);
    results.passed.push('Node.js');
  }

  return true;
}

async function checkPackageManager() {
  // Check for Bun (preferred)
  const bunResult = await checkCommand('bun', ['--version']);

  if (bunResult.success) {
    logCheck('Bun', 'pass', `Found Bun ${bunResult.output}`);
    results.passed.push('Bun');
    return 'bun';
  }

  // Check for npm (fallback)
  const npmResult = await checkCommand('npm', ['--version']);

  if (npmResult.success) {
    logCheck('npm', 'pass', `Found npm ${npmResult.output}`);
    results.passed.push('npm');
    results.info.push('Consider installing Bun for faster performance: curl -fsSL https://bun.sh/install | bash');
    return 'npm';
  }

  logCheck('Package Manager', 'fail',
    'Neither Bun nor npm found in PATH',
    'Install Bun (https://bun.sh) or ensure npm is installed with Node.js'
  );
  results.failed.push('Package manager not found');
  return null;
}

async function checkGit() {
  const result = await checkCommand('git', ['--version']);

  if (result.success) {
    const version = result.output.replace('git version ', '');
    logCheck('Git', 'pass', `Found Git ${version}`);
    results.passed.push('Git');

    // Check git user config for author tracking
    const nameResult = await checkCommand('git', ['config', 'user.name']);
    const emailResult = await checkCommand('git', ['config', 'user.email']);

    if (!nameResult.success || !emailResult.success) {
      logCheck('Git User Config', 'warning',
        'Git user.name or user.email not configured',
        'Run: git config --global user.name "Your Name" && git config --global user.email "you@example.com"'
      );
      results.warnings.push('Git user config incomplete');
    } else {
      if (config.verbose) {
        logCheck('Git User Config', 'pass',
          `Author: ${nameResult.output} <${emailResult.output}>`
        );
      }
      results.passed.push('Git config');
    }
  } else {
    logCheck('Git', 'warning',
      'Git not found (optional, but recommended for version control)',
      'Install Git: https://git-scm.com/downloads'
    );
    results.warnings.push('Git not found');
  }
}

async function checkDiskSpace() {
  try {
    const { stdout } = await execAsync('df -h . 2>/dev/null || df -H .', {
      timeout: 3000,
      encoding: 'utf-8',
    });

    const lines = stdout.trim().split('\n');
    if (lines.length > 1) {
      const parts = lines[1].split(/\s+/);
      const available = parts[3];
      const availableNum = parseFloat(available);

      if (availableNum < 1) {
        logCheck('Disk Space', 'warning',
          `Low disk space: ${available} available`,
          'Free up disk space to ensure room for database growth'
        );
        results.warnings.push('Low disk space');
      } else {
        if (config.verbose) {
          logCheck('Disk Space', 'pass', `${available} available`);
        }
        results.passed.push('Disk space');
      }
    }
  } catch (error) {
    // Disk check failed, not critical
    if (config.verbose) {
      log('  Could not check disk space (non-critical)', 'dim');
    }
  }
}

async function checkWritePermissions() {
  const testFile = path.join(process.cwd(), '.forest-preflight-test');

  try {
    fs.writeFileSync(testFile, 'test', 'utf-8');
    fs.unlinkSync(testFile);

    if (config.verbose) {
      logCheck('Write Permissions', 'pass', 'Current directory is writable');
    }
    results.passed.push('Write permissions');
    return true;
  } catch (error) {
    logCheck('Write Permissions', 'fail',
      'Cannot write to current directory',
      'Ensure you have write permissions or change to a writable directory'
    );
    results.failed.push('Write permissions');
    return false;
  }
}

async function checkSQLiteSupport() {
  try {
    // Try to load sql.js (Forest's SQLite implementation)
    const sqlJsPath = path.join(process.cwd(), 'node_modules', 'sql.js');

    if (!fs.existsSync(sqlJsPath)) {
      logCheck('SQLite (sql.js)', 'warning',
        'sql.js not found in node_modules',
        'Run: npm install (or bun install) to install dependencies'
      );
      results.warnings.push('Dependencies not installed');
      return false;
    }

    logCheck('SQLite (sql.js)', 'pass', 'sql.js package found');
    results.passed.push('SQLite support');
    return true;
  } catch (error) {
    logCheck('SQLite (sql.js)', 'warning',
      'Could not verify SQLite support',
      'Run: npm install to ensure dependencies are installed'
    );
    results.warnings.push('SQLite support unclear');
    return false;
  }
}

async function checkEnvironmentVariables() {
  const envVars = {
    'FOREST_DB_PATH': {
      value: process.env.FOREST_DB_PATH,
      required: false,
      default: './forest.db',
      description: 'Path to SQLite database file',
    },
    'FOREST_DB_TYPE': {
      value: process.env.FOREST_DB_TYPE,
      required: false,
      default: 'sqlite',
      description: 'Database type (sqlite or postgres)',
    },
    'FOREST_DB_URL': {
      value: process.env.FOREST_DB_URL,
      required: false,
      description: 'Remote database connection URL (required if FOREST_DB_TYPE=postgres)',
    },
    'FOREST_USER': {
      value: process.env.FOREST_USER || process.env.USER,
      required: false,
      description: 'Your username for author tracking',
    },
    'FOREST_EMBED_PROVIDER': {
      value: process.env.FOREST_EMBED_PROVIDER,
      required: false,
      default: 'local',
      description: 'Embedding provider (local, openai, none)',
    },
  };

  let hasIssues = false;

  for (const [key, info] of Object.entries(envVars)) {
    if (info.value) {
      if (config.verbose) {
        logCheck(`Environment: ${key}`, 'pass', `Set to: ${info.value}`);
      }
    } else if (info.required) {
      logCheck(`Environment: ${key}`, 'fail',
        `Required variable not set: ${info.description}`,
        `Set with: export ${key}=<value>`
      );
      results.failed.push(`${key} not set`);
      hasIssues = true;
    } else if (config.verbose) {
      log(`  ${colors.dim}${key}: not set (default: ${info.default || 'none'})${colors.reset}`);
    }
  }

  // Check for remote database configuration
  if (process.env.FOREST_DB_TYPE === 'postgres') {
    if (!process.env.FOREST_DB_URL) {
      logCheck('Remote Database Config', 'fail',
        'FOREST_DB_TYPE=postgres but FOREST_DB_URL is not set',
        'Set FOREST_DB_URL to your PostgreSQL connection string: postgresql://user:pass@host:port/db'
      );
      results.failed.push('Missing FOREST_DB_URL');
      hasIssues = true;
    } else {
      logCheck('Remote Database Config', 'pass', 'PostgreSQL configuration detected');
      results.passed.push('Remote DB config');
    }
  }

  if (!hasIssues && config.verbose) {
    log(`  ${colors.green}Environment variables look good${colors.reset}`);
  }
}

async function checkPostgresConnectivity() {
  const dbUrl = process.env.FOREST_DB_URL;

  if (!dbUrl) {
    logCheck('PostgreSQL Connectivity', 'skip',
      'FOREST_DB_URL not set, skipping remote database test',
      'To test remote connectivity, set FOREST_DB_URL and run with --remote flag'
    );
    return;
  }

  log(`  Testing connection to: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`, 'dim');

  try {
    // Parse connection URL
    const url = new URL(dbUrl);
    const host = url.hostname;
    const port = url.port || 5432;

    // Check if pg module is available
    try {
      const pg = require('pg');
      const client = new pg.Client(dbUrl);

      await client.connect();
      await client.query('SELECT version()');
      await client.end();

      logCheck('PostgreSQL Connectivity', 'pass',
        `Successfully connected to PostgreSQL at ${host}:${port}`
      );
      results.passed.push('PostgreSQL connection');
      return true;
    } catch (requireError) {
      logCheck('PostgreSQL Driver', 'warning',
        'pg module not found (needed for remote PostgreSQL)',
        'Install with: npm install pg (or bun add pg)'
      );
      results.warnings.push('PostgreSQL driver not installed');
      return false;
    }
  } catch (error) {
    logCheck('PostgreSQL Connectivity', 'fail',
      `Connection failed: ${error.message}`,
      `Check that:
  1. PostgreSQL server is running
  2. Host and port are correct
  3. Credentials are valid
  4. Network allows connections to ${dbUrl.split('@')[1]?.split('/')[0]}
  5. Firewall allows port ${new URL(dbUrl).port || 5432}`
    );
    results.failed.push('PostgreSQL connection failed');
    return false;
  }
}

async function checkNetworkConnectivity(host, port) {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    const timeout = 3000;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function checkDNSResolution() {
  const dbUrl = process.env.FOREST_DB_URL;

  if (!dbUrl || !config.testRemote) {
    return;
  }

  try {
    const url = new URL(dbUrl);
    const host = url.hostname;

    const dns = require('dns').promises;
    const addresses = await dns.resolve4(host);

    if (config.verbose) {
      logCheck('DNS Resolution', 'pass',
        `${host} resolves to ${addresses.join(', ')}`
      );
    }
    results.passed.push('DNS resolution');

    // Check network connectivity to first IP
    const port = parseInt(url.port) || 5432;
    log(`  Testing TCP connection to ${host}:${port}...`, 'dim');

    const canConnect = await checkNetworkConnectivity(host, port);

    if (canConnect) {
      logCheck('Network Connectivity', 'pass',
        `Port ${port} is reachable on ${host}`
      );
      results.passed.push('Network connectivity');
    } else {
      logCheck('Network Connectivity', 'warning',
        `Cannot connect to ${host}:${port}`,
        `Check firewall rules or VPN connection. Try: telnet ${host} ${port}`
      );
      results.warnings.push('Network connectivity issues');
    }
  } catch (error) {
    logCheck('DNS Resolution', 'fail',
      `Cannot resolve hostname: ${error.message}`,
      'Check that the hostname in FOREST_DB_URL is correct and DNS is working'
    );
    results.failed.push('DNS resolution failed');
  }
}

async function checkOpenAIKey() {
  if (process.env.FOREST_EMBED_PROVIDER === 'openai') {
    if (process.env.OPENAI_API_KEY) {
      // Don't show the key, just validate format
      const key = process.env.OPENAI_API_KEY;
      if (key.startsWith('sk-')) {
        logCheck('OpenAI API Key', 'pass', 'API key is set and formatted correctly');
        results.passed.push('OpenAI API key');
      } else {
        logCheck('OpenAI API Key', 'warning',
          'API key is set but does not start with "sk-"',
          'Verify your OpenAI API key from https://platform.openai.com/api-keys'
        );
        results.warnings.push('OpenAI API key format');
      }
    } else {
      logCheck('OpenAI API Key', 'fail',
        'FOREST_EMBED_PROVIDER=openai but OPENAI_API_KEY is not set',
        'Get an API key from https://platform.openai.com/api-keys and set: export OPENAI_API_KEY=sk-...'
      );
      results.failed.push('OpenAI API key missing');
    }
  }
}

function printSummary() {
  console.log('');
  logSection('Summary');

  const total = results.passed.length + results.failed.length + results.warnings.length;

  console.log(`${colors.green}${symbols.success} Passed:  ${results.passed.length}${colors.reset}`);
  console.log(`${colors.red}${symbols.error} Failed:  ${results.failed.length}${colors.reset}`);
  console.log(`${colors.yellow}${symbols.warning} Warnings: ${results.warnings.length}${colors.reset}`);
  console.log('');

  if (results.failed.length === 0) {
    log(`${symbols.success} Environment is ready for Forest!`, 'green');

    if (results.warnings.length > 0) {
      console.log('');
      log(`Note: ${results.warnings.length} warning(s) found. Forest will work, but consider addressing them.`, 'yellow');
    }

    console.log('');
    log('Next steps:', 'bright');
    log('  1. Install dependencies: npm install (or bun install)', 'cyan');
    log('  2. Build Forest: npm run build', 'cyan');
    log('  3. Try it: forest health', 'cyan');

    if (process.env.FOREST_DB_TYPE === 'postgres') {
      console.log('');
      log('For remote database:', 'bright');
      log('  1. Ensure your PostgreSQL server is running', 'cyan');
      log('  2. Run migrations: forest admin:migrate', 'cyan');
      log('  3. Test connection: forest health', 'cyan');
    }
  } else {
    log(`${symbols.error} Environment has issues that need to be fixed`, 'red');
    console.log('');
    log('Critical issues:', 'bright');
    results.failed.forEach(issue => {
      log(`  • ${issue}`, 'red');
    });
    console.log('');
    log('Please address the failed checks above before using Forest.', 'yellow');
  }

  if (results.info.length > 0) {
    console.log('');
    log('Tips:', 'bright');
    results.info.forEach(info => {
      log(`  ${symbols.info} ${info}`, 'dim');
    });
  }

  console.log('');

  // Exit code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

async function main() {
  console.log('');
  log(`${colors.bright}Forest Environment Preflight Check${colors.reset}`, 'cyan');
  log('Validating your environment for Forest...', 'dim');

  // Core checks
  logSection('Core Dependencies');
  await checkNodeVersion();
  await checkPackageManager();
  await checkGit();

  // Filesystem checks
  logSection('Filesystem');
  await checkDiskSpace();
  await checkWritePermissions();
  await checkSQLiteSupport();

  // Environment configuration
  logSection('Configuration');
  await checkEnvironmentVariables();
  await checkOpenAIKey();

  // Remote database checks
  if (config.testRemote || process.env.FOREST_DB_TYPE === 'postgres') {
    logSection('Remote Database');
    await checkDNSResolution();
    await checkPostgresConnectivity();
  }

  // Print summary
  printSummary();
}

// Run the checks
main().catch(error => {
  console.error('');
  log(`${symbols.error} Preflight check crashed: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});
