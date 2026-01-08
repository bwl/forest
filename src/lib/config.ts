import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  DEFAULT_COLOR_SCHEME,
  isColorSchemeName,
  type ColorSchemeName,
} from './color-schemes.js';

export type WriteModelName = 'gpt-5' | 'gpt-5-mini' | 'gpt-4o';
export type SynthesizeModelName = 'gpt-5' | 'gpt-5-mini';

export interface MarkdownOutputConfig {
  width?: number;
  reflowText?: boolean;
}

export interface NodeEditConfig {
  useTui?: boolean;
}

export interface ForestConfig {
  embedProvider?: 'local' | 'openai' | 'none';
  openaiApiKey?: string;
  openaiModel?: 'text-embedding-3-small' | 'text-embedding-3-large';
  localModel?: string;
  taggingMethod?: 'lexical' | 'llm' | 'none';
  llmTaggerModel?: 'gpt-5-nano' | 'gpt-4o-mini' | 'gpt-4o';
  colorScheme?: ColorSchemeName;
  writeModel?: WriteModelName;
  synthesizeModel?: SynthesizeModelName;
  markdown?: MarkdownOutputConfig;
  nodeEdit?: NodeEditConfig;
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
  const schemeFromFile = isColorSchemeName((fileConfig as any).colorScheme)
    ? ((fileConfig as any).colorScheme as ColorSchemeName)
    : undefined;
  const schemeFromEnv = isColorSchemeName(process.env.FOREST_COLOR_SCHEME)
    ? (process.env.FOREST_COLOR_SCHEME as ColorSchemeName)
    : undefined;

  const writeModelFromFile = isWriteModelName((fileConfig as any).writeModel)
    ? ((fileConfig as any).writeModel as WriteModelName)
    : undefined;
  const synthModelFromFile = isSynthesizeModelName((fileConfig as any).synthesizeModel)
    ? ((fileConfig as any).synthesizeModel as SynthesizeModelName)
    : undefined;

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
    colorScheme: schemeFromFile || schemeFromEnv || DEFAULT_COLOR_SCHEME,
    writeModel: writeModelFromFile || 'gpt-5',
    synthesizeModel: synthModelFromFile || 'gpt-5',
    markdown: normalizeMarkdownConfig((fileConfig as any).markdown),
  };

  // Apply defaults for markdown output
  if (!config.markdown) {
    config.markdown = {
      width: 90,
      reflowText: true,
    };
  } else {
    config.markdown.width =
      typeof config.markdown.width === 'number' && Number.isFinite(config.markdown.width)
        ? config.markdown.width
        : 90;
    config.markdown.reflowText =
      typeof config.markdown.reflowText === 'boolean' ? config.markdown.reflowText : true;
  }

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

function isWriteModelName(value: unknown): value is WriteModelName {
  return value === 'gpt-5' || value === 'gpt-5-mini' || value === 'gpt-4o';
}

function isSynthesizeModelName(value: unknown): value is SynthesizeModelName {
  return value === 'gpt-5' || value === 'gpt-5-mini';
}

function normalizeMarkdownConfig(raw: unknown): MarkdownOutputConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const input = raw as Record<string, unknown>;
  const width =
    typeof input.width === 'number' && Number.isFinite(input.width) ? Math.max(20, input.width) : undefined;
  const reflowText =
    typeof input.reflowText === 'boolean' ? input.reflowText : undefined;
  const normalized: MarkdownOutputConfig = {};
  if (width !== undefined) normalized.width = width;
  if (reflowText !== undefined) normalized.reflowText = reflowText;
  return normalized;
}

/**
 * Determine if TUI editor should be used for node editing
 * Precedence: CLI flag > env var > config file > default (false)
 */
export function shouldUseTui(cliFlag?: boolean): boolean {
  // 1. Explicit CLI flag takes precedence
  if (cliFlag !== undefined) return cliFlag;

  // 2. Environment variable
  if (process.env.FOREST_NODE_EDIT_TUI === 'true') return true;
  if (process.env.FOREST_NODE_EDIT_TUI === 'false') return false;

  // 3. Config file
  const config = loadConfig();
  if (config.nodeEdit?.useTui !== undefined) {
    return config.nodeEdit.useTui;
  }

  // 4. Default: use external editor
  return false;
}
