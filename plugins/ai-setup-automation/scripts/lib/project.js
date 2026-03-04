'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { hashBuffer, hashString, safeHashFile } = require('./hashing');

function walkDirMaxDepth(dir, maxDepth, depth = 0) {
  const results = [];
  if (depth >= maxDepth) return results;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    results.push(full);
    if (entry.isDirectory()) {
      results.push(...walkDirMaxDepth(full, maxDepth, depth + 1));
    }
  }
  return results;
}

function hashDirectoryListing(dirs) {
  const entries = [];
  for (const dir of dirs) {
    try {
      const names = fs.readdirSync(dir).sort();
      entries.push(...names.map(n => path.join(dir, n)));
    } catch (e) {
      // directory does not exist — skip
    }
  }
  if (entries.length === 0) return null;
  return hashString(entries.sort().join('\n'));
}

function hashSrcListing(projectRoot) {
  const srcDir = path.join(projectRoot, 'src');
  if (!fs.existsSync(srcDir)) return null;
  const files = walkDirMaxDepth(srcDir, 2).sort();
  if (files.length === 0) return null;
  return hashString(files.join('\n'));
}

function hashProjectIndicators(projectRoot) {
  return {
    go_mod_hash: safeHashFile(path.join(projectRoot, 'go.mod')),
    package_json_hash: safeHashFile(path.join(projectRoot, 'package.json')),
    spec_dir_hash: hashDirectoryListing([
      path.join(projectRoot, 'specs'),
      path.join(projectRoot, 'openspec'),
    ]),
    src_dir_listing_hash: hashSrcListing(projectRoot),
  };
}

function projectRootHash(projectRoot) {
  try {
    const output = execSync('ls -la', { cwd: projectRoot, encoding: 'utf-8' });
    const sorted = output.split('\n').sort().join('\n');
    return hashString(sorted);
  } catch (e) {
    const entries = fs.readdirSync(projectRoot).sort().join('\n');
    return hashString(entries);
  }
}

module.exports = {
  walkDirMaxDepth,
  hashDirectoryListing,
  hashSrcListing,
  hashProjectIndicators,
  projectRootHash,
};
