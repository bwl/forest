/**
 * Console logger that pipes browser console to terminal via Tauri
 * Usage: Import this file in main.tsx to enable terminal logging
 */

import { invoke } from '@tauri-apps/api/core';

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
};

// Helper to format error objects
function formatError(err: any): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}\n${err.stack || ''}`;
  }
  return String(err);
}

// Override console methods to also print to terminal
export function enableTerminalLogging() {
  console.log = (...args: any[]) => {
    originalConsole.log(...args);
    const message = args.map(arg =>
      arg instanceof Error ? formatError(arg) :
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    invoke('log_to_terminal', { level: 'log', message }).catch(() => {});
  };

  console.error = (...args: any[]) => {
    originalConsole.error(...args);
    const message = args.map(arg =>
      arg instanceof Error ? formatError(arg) :
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    invoke('log_to_terminal', { level: 'error', message }).catch(() => {});
  };

  console.warn = (...args: any[]) => {
    originalConsole.warn(...args);
    const message = args.map(arg =>
      arg instanceof Error ? formatError(arg) :
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    invoke('log_to_terminal', { level: 'warn', message }).catch(() => {});
  };

  // Catch unhandled errors
  window.addEventListener('error', (event) => {
    const message = `Unhandled error: ${formatError(event.error)}`;
    invoke('log_to_terminal', { level: 'error', message }).catch(() => {});
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const message = `Unhandled promise rejection: ${formatError(event.reason)}`;
    invoke('log_to_terminal', { level: 'error', message }).catch(() => {});
  });

  // Log that logging is enabled
  originalConsole.log('[Console Logger] Terminal logging enabled');
}
