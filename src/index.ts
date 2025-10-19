#!/usr/bin/env node
import { runForestCli } from './cli';
import { handleError } from './cli/shared/utils';

const rawArgs = process.argv.slice(2);
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
