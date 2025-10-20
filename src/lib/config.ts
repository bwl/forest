import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ForestConfig {
  embedProvider?: 'local' | 'openai' | 'none';
  openaiApiKey?: string;
  openaiModel?: 'text-embedding-3-small' | 'text-embedding-3-large';
  localModel?: string;
  taggingMethod?: 'lexical' | 'llm' | 'none';
  llmTaggerModel?: 'gpt-5-nano' | 'gpt-4o-mini' | 'gpt-4o';
}

const CONFIG_FILE = path.join(os.homedir(), '.forestrc');

/**
 * Load config from ~/.forestrc, with env var fallbacks
 * Priority: config file > env vars > defaults
 */
export function loadConfig(): ForestConfig {
  let fileConfig: ForestConfig = {};

  // Try to read config file
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      fileConfig = JSON.parse(raw);
    }
  } catch (err) {
    // Ignore parse errors, fall back to env vars
  }

  // Merge with env vars (env vars take lower priority than file)
  const config: ForestConfig = {
    embedProvider: fileConfig.embedProvider || getEmbedProviderFromEnv(),
    openaiApiKey: fileConfig.openaiApiKey || process.env.OPENAI_API_KEY,
    openaiModel:
      fileConfig.openaiModel ||
      (process.env.FOREST_EMBED_MODEL as any) ||
      'text-embedding-3-small',
    localModel: fileConfig.localModel || process.env.FOREST_EMBED_LOCAL_MODEL,
    taggingMethod: fileConfig.taggingMethod || 'lexical', // Default to lexical (backward compat)
    llmTaggerModel: fileConfig.llmTaggerModel || 'gpt-5-nano',
  };

  return config;
}

/**
 * Save config to ~/.forestrc
 */
export function saveConfig(config: ForestConfig): void {
  const json = JSON.stringify(config, null, 2);
  fs.writeFileSync(CONFIG_FILE, json, 'utf-8');
}

/**
 * Get embedding provider from env var (legacy support)
 */
function getEmbedProviderFromEnv(): ForestConfig['embedProvider'] {
  const raw = (process.env.FOREST_EMBED_PROVIDER || 'local').toLowerCase();
  if (raw === 'openai') return 'openai';
  if (raw === 'none' || raw === 'off' || raw === 'disabled') return 'none';
  return 'local';
}

/**
 * Get config file path for display
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}
