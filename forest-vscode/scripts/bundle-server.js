#!/usr/bin/env node
/**
 * Bundle forest-language-server into VS Code extension dist/
 * This allows the extension to be self-contained for publishing
 */

const fs = require('fs');
const path = require('path');

const serverSrc = path.join(__dirname, '../../forest-language-server/dist/server.js');
const serverDest = path.join(__dirname, '../dist/server.js');

// Ensure dist directory exists
const distDir = path.dirname(serverDest);
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy server
if (fs.existsSync(serverSrc)) {
  fs.copyFileSync(serverSrc, serverDest);
  console.log(`✔ Bundled language server: ${serverDest}`);
} else {
  console.error(`✖ Language server not found: ${serverSrc}`);
  console.error('  Run: cd ../forest-language-server && bun run build');
  process.exit(1);
}

// Also copy parser.js (server depends on it)
const parserSrc = path.join(__dirname, '../../forest-language-server/dist/parser.js');
const parserDest = path.join(__dirname, '../dist/parser.js');

if (fs.existsSync(parserSrc)) {
  fs.copyFileSync(parserSrc, parserDest);
  console.log(`✔ Bundled parser: ${parserDest}`);
}
