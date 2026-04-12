#!/usr/bin/env node
/**
 * check-version-bump.cjs
 * CI script: verifies that modified plugins have their version bumped.
 *
 * Usage:
 *   node check-version-bump.cjs [--base <ref>]
 *
 * Environment variables (set by GitHub Actions):
 *   BASE_REF  — base commit SHA (from PR base)
 *
 * Exit codes: 0 = pass, 1 = version bump required, 2 = script error
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let base = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) {
      base = args[++i];
    }
  }

  return { base };
}

// ---------------------------------------------------------------------------
// Plugin discovery
// ---------------------------------------------------------------------------

function discoverPlugins(repoRoot) {
  const marketplacePath = path.join(repoRoot, '.claude-plugin', 'marketplace.json');
  const marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf-8'));

  return marketplace.plugins.map(p => {
    const sourcePath = p.source.replace(/^\.\//, '');
    return {
      name: p.name,
      sourcePath,
      versionFilePath: path.join(sourcePath, '.claude-plugin', 'plugin.json'),
    };
  });
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function getChangedFiles(baseRef, repoRoot) {
  const output = execSync(`git diff --name-only ${baseRef}...HEAD`, {
    encoding: 'utf-8',
    cwd: repoRoot,
  });
  return output.trim().split('\n').filter(Boolean);
}

function getVersionFromRef(ref, filePath, repoRoot) {
  try {
    const content = execSync(`git show ${ref}:${filePath}`, {
      encoding: 'utf-8',
      cwd: repoRoot,
    });
    return JSON.parse(content).version || null;
  } catch {
    // File doesn't exist in base branch (new plugin) or other git error
    return null;
  }
}

// ---------------------------------------------------------------------------
// Version comparison
// ---------------------------------------------------------------------------

function isVersionBumped(baseVersion, headVersion) {
  if (!baseVersion) return true;  // New plugin — any version is valid
  if (!headVersion) return false; // Version removed — invalid
  if (baseVersion === headVersion) return false; // Same — not bumped

  const base = baseVersion.split('.').map(Number);
  const head = headVersion.split('.').map(Number);

  for (let i = 0; i < Math.max(base.length, head.length); i++) {
    const b = base[i] || 0;
    const h = head[i] || 0;
    if (h > b) return true;
    if (h < b) return false;
  }
  return false; // Equal after normalization
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const repoRoot = process.cwd();
  const { base: argBase } = parseArgs(process.argv);
  const baseRef = process.env.BASE_REF || argBase;

  if (!baseRef) {
    process.stderr.write('Error: BASE_REF environment variable or --base argument required\n');
    process.stderr.write('Usage: node check-version-bump.cjs --base <ref>\n');
    process.exit(2);
  }

  let plugins;
  try {
    plugins = discoverPlugins(repoRoot);
  } catch (err) {
    process.stderr.write(`Error reading marketplace.json: ${err.message}\n`);
    process.exit(2);
  }

  let changedFiles;
  try {
    changedFiles = getChangedFiles(baseRef, repoRoot);
  } catch (err) {
    process.stderr.write(`Error running git diff: ${err.message}\n`);
    process.exit(2);
  }

  // Identify which plugins have changed files
  const affectedPlugins = plugins.filter(plugin => {
    const prefix = plugin.sourcePath + '/';
    return changedFiles.some(f => f.startsWith(prefix));
  });

  if (affectedPlugins.length === 0) {
    console.log('No plugin files changed — version check not required.');
    process.exit(0);
  }

  let failures = 0;

  for (const plugin of affectedPlugins) {
    const baseVersion = getVersionFromRef(baseRef, plugin.versionFilePath, repoRoot);

    let headVersion = null;
    const absVersionFile = path.join(repoRoot, plugin.versionFilePath);
    try {
      headVersion = JSON.parse(fs.readFileSync(absVersionFile, 'utf-8')).version || null;
    } catch {
      // Plugin directory deleted in this PR — treat as pass (deletion is valid)
      console.log(`PASS: ${plugin.name} — plugin removed (no version file on disk)`);
      continue;
    }

    const bumped = isVersionBumped(baseVersion, headVersion);

    if (bumped) {
      const from = baseVersion ? baseVersion : '(new)';
      console.log(`PASS: ${plugin.name} — ${from} -> ${headVersion}`);
    } else {
      console.log(`FAIL: ${plugin.name} — version not bumped (${baseVersion} -> ${headVersion})`);
      console.log(
        `::error file=${plugin.versionFilePath}::` +
        `Plugin "${plugin.name}" has modified files but version was not bumped ` +
        `(still ${headVersion}). Update the version in ${plugin.versionFilePath}.`
      );
      failures++;
    }
  }

  console.log(`\n${affectedPlugins.length} plugin(s) checked, ${failures} failure(s).`);
  process.exit(failures > 0 ? 1 : 0);
}

main();
