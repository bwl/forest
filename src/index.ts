#!/usr/bin/env node
import { runForestCli } from './cli/index.js';
import { handleError } from './cli/shared/utils.js';
import { displayVersion, displayBriefInfo, getVersion } from './cli/commands/version.js';
import { getGlobalTldr, emitTldrAndExit, formatAllCommandsTldr } from './cli/tldr.js';

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

  // Check for --tldr=all (output all commands)
  if (tldrArg === '--tldr=all') {
    console.log(formatAllCommandsTldr(getVersion()));
    process.exit(0);
  }

  // Default: output global index
  const globalTldr = getGlobalTldr(getVersion());
  emitTldrAndExit(globalTldr, getVersion());
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
      normalized.push('--noAutoLink');
      continue;
    }
    if (arg === '--no-parent') {
      normalized.push('--noParent');
      continue;
    }
    if (arg === '--no-sequential') {
      normalized.push('--noSequential');
      continue;
    }
    normalized.push(arg);
  }
  return normalized;
}
