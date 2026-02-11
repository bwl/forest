#!/usr/bin/env node
import { runForestCli } from './cli';
import { handleError } from './cli/shared/utils';
import { displayVersion, displayBriefInfo, getVersion } from './cli/commands/version';
import { getGlobalTldr, emitTldrAndExit, formatAllCommandsTldr } from './cli/tldr';

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

  // Check for --tldr=all (output all commands)
  if (tldrArg === '--tldr=all') {
    console.log(formatAllCommandsTldr(getVersion()));
    process.exit(0);
  }

  // Default: output global index
  const globalTldr = getGlobalTldr(getVersion());
  emitTldrAndExit(globalTldr, getVersion(), jsonMode);
}

// Show brief info when no command is given
if (rawArgs.length === 0) {
  displayBriefInfo();
  process.exit(0);
}

const normalizedArgs = normalizeArgs(rawArgs);

runForestCli(normalizedArgs).catch(handleError);

function normalizeArgs(args: string[]): string[] {
  // First pass: collect repeated --tag values and normalize flags
  const collected: string[] = [];
  const tagValues: string[] = [];
  let skipNext = false;
  for (let i = 0; i < args.length; i++) {
    if (skipNext) { skipNext = false; continue; }
    const arg = args[i];
    // --tag=value
    if (arg.startsWith('--tag=')) {
      tagValues.push(arg.slice(6));
      continue;
    }
    // --tag value
    if (arg === '--tag' && i + 1 < args.length) {
      tagValues.push(args[i + 1]);
      skipNext = true;
      continue;
    }
    if (arg === '--no-auto-link') {
      collected.push('--noAutoLink');
      continue;
    }
    if (arg === '--no-parent') {
      collected.push('--noParent');
      continue;
    }
    if (arg === '--no-sequential') {
      collected.push('--noSequential');
      continue;
    }
    collected.push(arg);
  }
  // Inject collected --tag values as a single --tags flag
  if (tagValues.length > 0) {
    collected.push('--tags', tagValues.join(','));
  }
  return collected;
}
