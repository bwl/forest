import fs from 'fs';
import path from 'path';

import { getEmbeddingProvider, embeddingsEnabled } from '../../lib/embeddings';
import { handleError } from '../shared/utils';

type ClercModule = typeof import('clerc');

type HealthFlags = {
  json?: boolean;
};

const DEFAULT_DB_PATH = 'forest.db';

export function createHealthCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'health',
      description: 'Check system health and configuration status',
      flags: {
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
      },
    },
    async ({ flags }) => {
      try {
        await runHealth(flags as HealthFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

type HealthCheck = {
  status: 'ok' | 'warning' | 'error';
  message: string;
};

type HealthReport = {
  database: HealthCheck & { path?: string; sizeBytes?: number };
  embeddingProvider: HealthCheck & { provider?: string };
  openaiKey?: HealthCheck;
  localTransformer?: HealthCheck;
};

async function runHealth(flags: HealthFlags) {
  const report: HealthReport = {
    database: await checkDatabase(),
    embeddingProvider: await checkEmbeddingProvider(),
  };

  const provider = getEmbeddingProvider();
  if (provider === 'openai') {
    report.openaiKey = checkOpenAIKey();
  }

  if (provider === 'local') {
    report.localTransformer = await checkLocalTransformer();
  }

  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('forest health');
  console.log('');

  printCheck('Database', report.database);
  if (report.database.path) {
    console.log(`  path: ${report.database.path}`);
  }
  if (typeof report.database.sizeBytes === 'number') {
    const sizeMB = (report.database.sizeBytes / (1024 * 1024)).toFixed(2);
    console.log(`  size: ${sizeMB} MB`);
  }
  console.log('');

  printCheck('Embedding Provider', report.embeddingProvider);
  if (report.embeddingProvider.provider) {
    console.log(`  provider: ${report.embeddingProvider.provider}`);
  }
  console.log('');

  if (report.openaiKey) {
    printCheck('OpenAI API Key', report.openaiKey);
    console.log('');
  }

  if (report.localTransformer) {
    printCheck('Local Transformer', report.localTransformer);
    console.log('');
  }

  const allOk = [
    report.database.status === 'ok',
    report.embeddingProvider.status === 'ok',
    !report.openaiKey || report.openaiKey.status === 'ok',
    !report.localTransformer || report.localTransformer.status === 'ok',
  ].every(Boolean);

  if (allOk) {
    console.log('✔ All systems operational');
  } else {
    console.log('⚠ Some checks failed. Review the output above.');
    process.exitCode = 1;
  }
}

function printCheck(label: string, check: HealthCheck) {
  const icon = check.status === 'ok' ? '✔' : check.status === 'warning' ? '⚠' : '✖';
  console.log(`${icon} ${label}: ${check.message}`);
}

async function checkDatabase(): Promise<HealthCheck & { path?: string; sizeBytes?: number }> {
  const dbPath = process.env.FOREST_DB_PATH ?? DEFAULT_DB_PATH;
  const resolvedPath = path.resolve(dbPath);

  if (!fs.existsSync(resolvedPath)) {
    return {
      status: 'warning',
      message: 'Database file does not exist yet (will be created on first capture)',
      path: resolvedPath,
    };
  }

  try {
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return {
        status: 'error',
        message: 'Database path exists but is not a file',
        path: resolvedPath,
      };
    }

    // Try to read the first few bytes to verify it's accessible
    const fd = fs.openSync(resolvedPath, 'r');
    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    // Check if it looks like a SQLite file (magic: "SQLite format 3\0")
    const magic = buffer.toString('utf-8', 0, 15);
    if (!magic.startsWith('SQLite format 3')) {
      return {
        status: 'warning',
        message: 'File exists but may not be a valid SQLite database',
        path: resolvedPath,
        sizeBytes: stats.size,
      };
    }

    return {
      status: 'ok',
      message: 'Database file is accessible and valid',
      path: resolvedPath,
      sizeBytes: stats.size,
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Cannot access database file: ${error instanceof Error ? error.message : String(error)}`,
      path: resolvedPath,
    };
  }
}

async function checkEmbeddingProvider(): Promise<HealthCheck & { provider?: string }> {
  const provider = getEmbeddingProvider();
  const enabled = embeddingsEnabled();

  if (!enabled) {
    return {
      status: 'warning',
      message: 'Embeddings are disabled (pure lexical scoring)',
      provider,
    };
  }

  if (provider === 'mock') {
    return {
      status: 'warning',
      message: 'Using mock embeddings (deterministic, non-semantic)',
      provider,
    };
  }

  if (provider === 'openai') {
    return {
      status: 'ok',
      message: 'Using OpenAI embeddings',
      provider,
    };
  }

  if (provider === 'local') {
    return {
      status: 'ok',
      message: 'Using local transformer embeddings',
      provider,
    };
  }

  return {
    status: 'ok',
    message: `Provider: ${provider}`,
    provider,
  };
}

function checkOpenAIKey(): HealthCheck {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      status: 'error',
      message: 'OPENAI_API_KEY is not set (required for OpenAI provider)',
    };
  }

  if (apiKey.trim().length === 0) {
    return {
      status: 'error',
      message: 'OPENAI_API_KEY is empty',
    };
  }

  if (!apiKey.startsWith('sk-')) {
    return {
      status: 'warning',
      message: 'OPENAI_API_KEY format looks unusual (expected to start with "sk-")',
    };
  }

  return {
    status: 'ok',
    message: 'OPENAI_API_KEY is set and format looks valid',
  };
}

async function checkLocalTransformer(): Promise<HealthCheck> {
  try {
    // Try to import the transformers module
    const mod = await import('@xenova/transformers');
    if (!mod || typeof mod.pipeline !== 'function') {
      return {
        status: 'error',
        message: '@xenova/transformers is installed but pipeline function not found',
      };
    }

    // We don't actually load the model here to avoid startup delay,
    // but we verify the package is available
    return {
      status: 'ok',
      message: '@xenova/transformers is installed and available',
    };
  } catch (error) {
    return {
      status: 'error',
      message: `@xenova/transformers is not available: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
