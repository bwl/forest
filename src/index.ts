#!/usr/bin/env node
import { runForestCli } from './cli';
import { handleError } from './cli/shared/utils';
import { displayVersion, displayBriefInfo, getVersion } from './cli/commands/version';
import { getGlobalTldr, emitTldrAndExit } from './cli/tldr';

const rawArgs = process.argv.slice(2);

// Intercept version flags to show custom ASCII art
if (rawArgs.includes('-v') || rawArgs.includes('-V') || rawArgs.includes('--version')) {
  displayVersion();
  process.exit(0);
}

// Intercept root-level TLDR flags
const tldrIndex = rawArgs.findIndex((arg) => arg === '--tldr' || arg.startsWith('--tldr='));
if (tldrIndex !== -1 && tldrIndex === 0) {
  // --tldr at position 0 means root-level TLDR request
  const tldrArg = rawArgs[tldrIndex];
  const jsonMode = tldrArg === '--tldr=json';
  const globalTldr = getGlobalTldr(getVersion());
  emitTldrAndExit(globalTldr, jsonMode);
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
