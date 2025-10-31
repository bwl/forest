#!/usr/bin/env bun
/**
 * Sync versions across package.json and tauri.conf.json using the VERSION file.
 * More robust than sed-by-line-number and easier to maintain.
 */

import fs from 'fs';
import path from 'path';

function readJson(p: string) {
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

function writeJson(p: string, data: unknown) {
  const content = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(p, content, 'utf8');
}

const repoRoot = path.resolve(__dirname, '..');
const versionFile = path.join(repoRoot, 'VERSION');

if (!fs.existsSync(versionFile)) {
  console.error(`VERSION file not found at ${versionFile}`);
  process.exit(1);
}

const version = fs.readFileSync(versionFile, 'utf8').trim();
if (!version) {
  console.error('VERSION is empty');
  process.exit(1);
}

// Update top-level package.json
const pkgPath = path.join(repoRoot, 'package.json');
const pkg = readJson(pkgPath);
pkg.version = version;
writeJson(pkgPath, pkg);
console.log(`Updated ${pkgPath} → ${version}`);

// Update Tauri conf version
const tauriConfPath = path.join(repoRoot, 'forest-desktop', 'src-tauri', 'tauri.conf.json');
const tauri = readJson(tauriConfPath);
tauri.version = version;
writeJson(tauriConfPath, tauri);
console.log(`Updated ${tauriConfPath} → ${version}`);

// Optional: keep forest-desktop package.json in sync too (non-critical)
const desktopPkgPath = path.join(repoRoot, 'forest-desktop', 'package.json');
if (fs.existsSync(desktopPkgPath)) {
  const desktopPkg = readJson(desktopPkgPath);
  desktopPkg.version = version;
  writeJson(desktopPkgPath, desktopPkg);
  console.log(`Updated ${desktopPkgPath} → ${version}`);
}

