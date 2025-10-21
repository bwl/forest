#!/usr/bin/env bun
/**
 * import-md.ts - Import markdown files into Forest database
 *
 * Usage:
 *   bun run scripts/import-md.ts <file.md> [file2.md ...]
 *   bun run scripts/import-md.ts docs/*.md
 *   bun run scripts/import-md.ts --no-auto-link docs/plan.md
 *   bun run scripts/import-md.ts --tags=docs,planning docs/plan.md
 *   bun run scripts/import-md.ts --log=plan-log.txt docs/plan.md
 */

import { readFile, appendFile } from 'fs/promises';
import { basename } from 'path';
import { extractTags, tokenize } from '../src/lib/text';
import { computeEmbeddingForNode } from '../src/lib/embeddings';
import { insertNode, listNodes } from '../src/lib/db';
import { linkAgainstExisting } from '../src/cli/shared/linking';
import { formatId } from '../src/cli/shared/utils';
import { randomUUID } from 'crypto';

type ImportOptions = {
  autoLink: boolean;
  tagOverride?: string[];
  logFile?: string;
};

async function extractTitle(content: string, filename: string): Promise<string> {
  // Try to find first H1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Fallback to filename without extension
  return basename(filename, '.md');
}

async function importMarkdown(filepath: string, options: ImportOptions): Promise<void> {
  try {
    const content = await readFile(filepath, 'utf-8');
    const title = await extractTitle(content, filepath);
    const body = content;

    // Tokenize combined text for tag extraction
    const combinedText = `${title}\n${body}`;
    const tokenCounts = tokenize(combinedText);

    // Extract or override tags
    const tags = options.tagOverride ?? extractTags(combinedText, tokenCounts);

    // Create node record
    const id = randomUUID();
    const now = new Date().toISOString();

    const node = {
      id,
      title,
      body,
      tags,
      tokenCounts,
      embedding: null,
      createdAt: now,
      updatedAt: now,
    };

    // Compute embedding
    await computeEmbeddingForNode(node);

    // Insert into database
    insertNode(node);

    // Auto-link if enabled
    if (options.autoLink) {
      const existingNodes = await listNodes();
      await linkAgainstExisting(node, existingNodes);
    }

    // Output short ID and title
    const shortId = formatId(id);
    console.log(`Created node ${shortId}: ${title}`);

    // Append to log file if specified
    if (options.logFile) {
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const tagsStr = tags.join(', ');
      const logEntry = `${timestamp},${shortId},"${title}","${tagsStr}"\n`;
      await appendFile(options.logFile, logEntry, 'utf-8');
    }

  } catch (error) {
    console.error(`Error importing ${filepath}:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Import markdown files into Forest database

Usage:
  bun run scripts/import-md.ts <file.md> [file2.md ...]
  bun run scripts/import-md.ts docs/*.md

Options:
  --no-auto-link       Disable automatic linking to existing nodes
  --tags=tag1,tag2     Override auto-extracted tags
  --log=FILE           Append import records to CSV log file (default: plan-log.csv)
  --no-log             Disable logging to file
  -h, --help          Show this help

Examples:
  bun run scripts/import-md.ts docs/camper-plan.md
  bun run scripts/import-md.ts docs/*.md --no-auto-link
  bun run scripts/import-md.ts --tags=docs,planning docs/spec.md
  bun run scripts/import-md.ts --log=imports.txt docs/*.md
`);
    process.exit(0);
  }

  // Parse options
  const options: ImportOptions = {
    autoLink: true,
    logFile: 'plan-log.csv', // Default log file
  };

  const files: string[] = [];

  for (const arg of args) {
    if (arg === '--no-auto-link') {
      options.autoLink = false;
    } else if (arg === '--no-log') {
      options.logFile = undefined;
    } else if (arg.startsWith('--tags=')) {
      options.tagOverride = arg.slice(7).split(',').map(t => t.trim());
    } else if (arg.startsWith('--log=')) {
      options.logFile = arg.slice(6);
    } else if (!arg.startsWith('--')) {
      files.push(arg);
    }
  }

  if (files.length === 0) {
    console.error('Error: No files specified');
    process.exit(1);
  }

  // Import each file
  for (const file of files) {
    await importMarkdown(file, options);
  }
}

main();
