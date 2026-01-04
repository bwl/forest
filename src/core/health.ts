import fs from 'fs';

import { getEmbeddingProvider, getEmbeddingModel, embeddingsEnabled } from '../lib/embeddings';
import { getDbPath } from '../lib/db';

export type HealthCheck = {
  status: 'ok' | 'warning' | 'error';
  message: string;
};

export type HealthReport = {
  database: HealthCheck & { path?: string; sizeBytes?: number };
  embeddingProvider: HealthCheck & { provider?: string; model?: string };
  openaiKey?: HealthCheck;
  openrouterKey?: HealthCheck;
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

  if (provider === 'openrouter') {
    report.openrouterKey = checkOpenRouterKey();
  }

  return report;
}

export function isHealthy(report: HealthReport): boolean {
  return [
    report.database.status === 'ok',
    report.embeddingProvider.status === 'ok',
    !report.openaiKey || report.openaiKey.status === 'ok',
    !report.openrouterKey || report.openrouterKey.status === 'ok',
  ].every(Boolean);
}

async function checkDatabase(): Promise<HealthCheck & { path?: string; sizeBytes?: number }> {
  const resolvedPath = getDbPath();

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

async function checkEmbeddingProvider(): Promise<HealthCheck & { provider?: string; model?: string }> {
  const provider = getEmbeddingProvider();
  const model = getEmbeddingModel();
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

  if (provider === 'openrouter') {
    return {
      status: 'ok',
      message: `Using OpenRouter embeddings (${model})`,
      provider,
      model,
    };
  }

  if (provider === 'openai') {
    return {
      status: 'ok',
      message: `Using OpenAI embeddings (${model})`,
      provider,
      model,
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

function checkOpenRouterKey(): HealthCheck {
  const apiKey = process.env.FOREST_OR_KEY;

  if (!apiKey) {
    return {
      status: 'error',
      message: 'FOREST_OR_KEY is not set (required for OpenRouter provider)',
    };
  }

  if (apiKey.trim().length === 0) {
    return {
      status: 'error',
      message: 'FOREST_OR_KEY is empty',
    };
  }

  if (!apiKey.startsWith('sk-or-')) {
    return {
      status: 'warning',
      message: 'FOREST_OR_KEY format looks unusual (expected to start with "sk-or-")',
    };
  }

  return {
    status: 'ok',
    message: 'FOREST_OR_KEY is set and format looks valid',
  };
}
