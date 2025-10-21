#!/usr/bin/env bun
/**
 * backfill-log-tags.ts - Convert plan-log.txt to CSV with tags
 *
 * Reads existing plan-log.txt, fetches tags from database for each node,
 * and outputs plan-log.csv with proper CSV format.
 */

import { readFile, writeFile } from 'fs/promises';
import { getNodeById } from '../src/lib/db';

async function backfillTags(inputFile: string, outputFile: string) {
  try {
    const content = await readFile(inputFile, 'utf-8');
    const lines = content.trim().split('\n');

    // CSV header
    const csvLines = ['timestamp,node_id,title,tags'];

    for (const line of lines) {
      // Parse: "2025-10-19 23:45  d9f5f10a  Forest API Performance Considerations"
      const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+(\w+)\s+(.+)$/);

      if (!match) {
        console.warn(`Skipping malformed line: ${line}`);
        continue;
      }

      const [, timestamp, nodeId, title] = match;

      // Fetch node from database
      const node = await getNodeById(nodeId);

      if (!node) {
        console.warn(`Node ${nodeId} not found in database, skipping`);
        continue;
      }

      const tagsStr = node.tags.join(', ');
      csvLines.push(`${timestamp},${nodeId},"${title}","${tagsStr}"`);
      console.log(`✓ ${nodeId}: ${title}`);
    }

    // Write CSV file
    await writeFile(outputFile, csvLines.join('\n') + '\n', 'utf-8');
    console.log(`\n✅ Created ${outputFile} with ${csvLines.length - 1} entries`);

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const inputFile = process.argv[2] || 'plan-log.txt';
const outputFile = process.argv[3] || 'plan-log.csv';

backfillTags(inputFile, outputFile);
