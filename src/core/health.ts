import fs from 'fs';
import path from 'path';

import { getEmbeddingProvider, embeddingsEnabled, findForestEmbedBinary } from '../lib/embeddings';

const DEFAULT_DB_PATH = 'forest.db';

export type HealthCheck = {
  status: 'ok' | 'warning' | 'error';
  message: string;
};

export type HealthReport = {
  database: HealthCheck & { path?: string; sizeBytes?: number };
  embeddingProvider: HealthCheck & { provider?: string };
  openaiKey?: HealthCheck;
  forestEmbed?: HealthCheck & { binaryPath?: string };
};

export async function getHealthReport(): Promise<HealthReport> {
  const report: HealthReport = {
    database: await checkDatabase(),
    embeddingProvider: await checkEmbeddingProvider(),
  };

  const provider = getEmbeddingProvider();
  if (provider === 'openai') {
    report.openaiKey = checkOpenAIKey();
  }

  if (provider === 'local') {
    report.forestEmbed = await checkForestEmbed();
  }

  return report;
}

export function isHealthy(report: HealthReport): boolean {
  return [
    report.database.status === 'ok',
    report.embeddingProvider.status === 'ok',
    !report.openaiKey || report.openaiKey.status === 'ok',
    !report.forestEmbed || report.forestEmbed.status === 'ok',
  ].every(Boolean);
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

async function checkForestEmbed(): Promise<HealthCheck & { binaryPath?: string }> {
  try {
    // Try to find the forest-embed binary
    const binaryPath = await findForestEmbedBinary();

    // Verify it's executable
    if (!fs.existsSync(binaryPath)) {
      return {
        status: 'error',
        message: 'forest-embed binary not found at expected location',
        binaryPath,
      };
    }

    // Check if file is executable
    try {
      fs.accessSync(binaryPath, fs.constants.X_OK);
    } catch {
      return {
        status: 'error',
        message: 'forest-embed binary found but not executable',
        binaryPath,
      };
    }

    return {
      status: 'ok',
      message: 'forest-embed binary is available and executable',
      binaryPath,
    };
  } catch (error) {
    return {
      status: 'error',
      message: `forest-embed binary not found: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
