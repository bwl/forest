#!/usr/bin/env node
import { runForestCli } from './cli';
import { handleError } from './cli/shared/utils';
import { displayVersion, displayBriefInfo } from './cli/commands/version';

const rawArgs = process.argv.slice(2);

// Intercept version flags to show custom ASCII art
if (rawArgs.includes('-v') || rawArgs.includes('-V') || rawArgs.includes('--version')) {
  displayVersion();
  process.exit(0);
}

// Show brief info when no command is given
if (rawArgs.length === 0) {
  displayBriefInfo();
  process.exit(0);
}

const normalizedArgs = normalizeArgs(rawArgs);

runForestCli(normalizedArgs).catch(handleError);

function normalizeArgs(args: string[]): string[] {
  const normalized: string[] = [];
  for (const arg of args) {
    if (arg === '--no-auto-link') {
      normalized.push('--auto-link=false');
      continue;
    }
    normalized.push(arg);
  }
  return normalized;
}
