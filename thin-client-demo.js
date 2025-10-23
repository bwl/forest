#!/usr/bin/env node
/**
 * Forest Thin Client Demo
 *
 * This demonstrates how Forest can work in thin client mode,
 * making HTTP calls to a remote API instead of using a local database.
 *
 * This enables Forest to work in sandboxed/restricted environments
 * where SQLite or embeddings aren't available.
 */

const https = require('https');
const { URL } = require('url');

const API_URL = process.env.FOREST_API_URL || 'https://pokingly-vaneless-josephine.ngrok-free.dev';

async function fetchAPI(endpoint) {
  const fullUrl = `${API_URL}${endpoint}`;
  const urlObj = new URL(fullUrl);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Forest-Thin-Client/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        } else {
          reject(new Error(`API request failed: ${res.statusCode} ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.end();
  });
}

async function formatTable(headers, rows) {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i] || '').length))
  );

  const line = colWidths.map(w => '-'.repeat(w + 2)).join('+');
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ');
  const dataRows = rows.map(row =>
    row.map((cell, i) => String(cell || '').padEnd(colWidths[i])).join(' | ')
  );

  console.log(headerRow);
  console.log(line);
  dataRows.forEach(row => console.log(row));
}

async function health() {
  console.log('🔍 Checking remote Forest server health...\n');
  const result = await fetchAPI('/api/v1/health');

  if (result.success) {
    const { status, database, embeddings, uptime } = result.data;
    console.log(`Status: ${status}`);
    console.log(`Database: ${database.connected ? '✓ Connected' : '✗ Disconnected'}`);
    console.log(`  Path: ${database.path}`);
    console.log(`  Size: ${(database.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Embeddings: ${embeddings.available ? '✓' : '✗'} (${embeddings.provider})`);
    console.log(`Uptime: ${Math.floor(uptime)}s`);
  }
}

async function stats() {
  console.log('📊 Fetching graph statistics...\n');
  const result = await fetchAPI('/api/v1/stats');

  if (result.success) {
    const { nodes, edges, tags, highDegreeNodes } = result.data;

    console.log(`📝 Nodes: ${nodes.total} total`);
    console.log(`🔗 Edges: ${edges.total} total (${edges.accepted} accepted, ${edges.suggested} suggested)`);
    console.log(`🏷️  Tags: ${tags.total} unique\n`);

    console.log('Recent Nodes:');
    await formatTable(
      ['ID', 'Title', 'Created'],
      nodes.recent.map(n => [n.id.slice(0, 8), n.title.slice(0, 60), new Date(n.createdAt).toLocaleDateString()])
    );

    console.log('\nTop Tags:');
    await formatTable(
      ['Tag', 'Count'],
      tags.topTags.slice(0, 10).map(t => [t.name, t.count])
    );

    console.log('\nHigh-Degree Nodes (most connected):');
    await formatTable(
      ['ID', 'Title', 'Edges'],
      highDegreeNodes.slice(0, 5).map(n => [n.id.slice(0, 8), n.title.slice(0, 50), n.edgeCount])
    );
  }
}

async function listNodes(limit = 10) {
  console.log(`📚 Fetching ${limit} most recent nodes...\n`);
  const result = await fetchAPI(`/api/v1/nodes?limit=${limit}`);

  if (result.success) {
    await formatTable(
      ['ID', 'Title', 'Tags'],
      result.data.nodes.map(n => [
        n.shortId,
        n.title.slice(0, 60),
        n.tags.slice(0, 3).join(', ')
      ])
    );
  }
}

async function listTags() {
  console.log('🏷️  Fetching tags...\n');
  const result = await fetchAPI('/api/v1/tags');

  if (result.success) {
    const tags = result.data.tags.slice(0, 20);
    await formatTable(
      ['Tag', 'Count', 'Last Used'],
      tags.map(t => [t.name, t.count, new Date(t.lastUsed).toLocaleDateString()])
    );
  }
}

async function listEdges(limit = 10) {
  console.log(`🔗 Fetching ${limit} most recent edges...\n`);
  const result = await fetchAPI(`/api/v1/edges?limit=${limit}`);

  if (result.success) {
    await formatTable(
      ['Ref', 'Source → Target', 'Score', 'Status'],
      result.data.edges.slice(0, limit).map(e => [
        e.ref,
        `${e.sourceNode.title.slice(0, 25)} → ${e.targetNode.title.slice(0, 25)}`,
        e.score.toFixed(3),
        e.status
      ])
    );
  }
}

// Command router
async function main() {
  const command = process.argv[2] || 'health';
  const args = process.argv.slice(3);

  try {
    console.log(`🌲 Forest Thin Client (API: ${API_URL})\n`);

    switch (command) {
      case 'health':
        await health();
        break;
      case 'stats':
        await stats();
        break;
      case 'nodes':
        await listNodes(parseInt(args[0]) || 10);
        break;
      case 'tags':
        await listTags();
        break;
      case 'edges':
        await listEdges(parseInt(args[0]) || 10);
        break;
      default:
        console.log('Available commands:');
        console.log('  health    - Check server health');
        console.log('  stats     - Show graph statistics');
        console.log('  nodes [N] - List N most recent nodes');
        console.log('  tags      - List all tags');
        console.log('  edges [N] - List N most recent edges');
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
