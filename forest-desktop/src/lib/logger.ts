/**
 * Structured logging utility for Forest Desktop
 *
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Conditional logging based on environment
 * - Tauri backend logging integration
 * - Color-coded console output
 */

import { invoke } from '@tauri-apps/api/core'

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogConfig {
  minLevel: LogLevel
  enableTauriLogging: boolean
  enableConsole: boolean
}

const isDev = import.meta.env.DEV !== undefined

const config: LogConfig = {
  minLevel: isDev ? LogLevel.DEBUG : LogLevel.INFO,
  enableTauriLogging: true,
  enableConsole: isDev,
}

const COLORS = {
  [LogLevel.DEBUG]: '#9ca3af',
  [LogLevel.INFO]: '#3b82f6',
  [LogLevel.WARN]: '#f59e0b',
  [LogLevel.ERROR]: '#ef4444',
}

const LABELS = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
}

/**
 * Core logging function
 */
function log(level: LogLevel, category: string, message: string, data?: unknown) {
  if (level < config.minLevel) return

  const timestamp = new Date().toISOString().split('T')[1]?.slice(0, 12) ?? ''
  const label = LABELS[level]
  const color = COLORS[level]

  if (config.enableConsole) {
    const prefix = `%c[${timestamp}] ${label} %c[${category}]%c`
    const styles = [
      `color: ${color}; font-weight: bold`,
      'color: #8b5cf6; font-weight: normal',
      'color: inherit',
    ]

    if (data !== undefined) {
      console.log(prefix, ...styles, message, data)
    } else {
      console.log(prefix, ...styles, message)
    }
  }

  // Send to Tauri backend (for file logging, metrics, etc.)
  if (config.enableTauriLogging && level >= LogLevel.INFO) {
    // Use invoke to log to Tauri backend (fire and forget)
    invoke('log_to_terminal', {
      level: label.toLowerCase(),
      message: `[${category}] ${message}`,
    }).catch(() => {
      // Ignore logging errors to prevent infinite loops
    })
  }
}

/**
 * Logger instance with category
 */
export class Logger {
  constructor(private category: string) {}

  debug(message: string, data?: unknown) {
    log(LogLevel.DEBUG, this.category, message, data)
  }

  info(message: string, data?: unknown) {
    log(LogLevel.INFO, this.category, message, data)
  }

  warn(message: string, data?: unknown) {
    log(LogLevel.WARN, this.category, message, data)
  }

  error(message: string, error?: unknown) {
    log(LogLevel.ERROR, this.category, message, error)
  }
}

/**
 * Create a logger for a specific category
 *
 * @example
 * ```ts
 * const logger = createLogger('GraphView');
 * logger.info('Graph loaded', { nodeCount: 42 });
 * logger.error('Failed to load graph', error);
 * ```
 */
export function createLogger(category: string): Logger {
  return new Logger(category)
}

/**
 * Configure logging behavior
 */
export function configureLogging(newConfig: Partial<LogConfig>) {
  Object.assign(config, newConfig)
}
