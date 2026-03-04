#!/usr/bin/env node
/**
 * retag-release.js
 * CI script: ensures the current version's git tag points to HEAD on the main branch.
 *
 * Fixes orphaned tags that result from squash-merging a release branch:
 * the tag is created on the feature branch before merge, then becomes
 * unreachable from main after squash. This script moves it to HEAD.
 *
 * Usage (GitHub Actions — runs on push to main):
 *   node .github/scripts/retag-release.js
 *
 * Reads: .claude/version.json  (sdlc versioning config)
 * Modes:
 *   "file" — version read from a version file (package.json, plugin.json, etc.)
 *   "tag"  — version derived from the latest git tag (no version file)
 *
 * Exit codes: 0 = success / no-op, 1 = error
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function exec(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', ...opts }).trim();
  } catch (_) {
    return null;
  }
}

function execOrThrow(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function readConfig(repoRoot) {
  const configPath = path.join(repoRoot, '.claude', 'version.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    process.stderr.write(`Error parsing .claude/version.json: ${err.message}\n`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Version resolution
// ---------------------------------------------------------------------------

function resolveTagFromFile(config, repoRoot) {
  const versionFilePath = path.join(repoRoot, config.versionFile);
  if (!fs.existsSync(versionFilePath)) {
    process.stderr.write(`Version file not found: ${config.versionFile}\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(versionFilePath, 'utf8');
  let version = null;

  if (config.fileType === 'package.json' || config.fileType === 'plugin.json') {
    try {
      version = JSON.parse(content).version || null;
    } catch (err) {
      process.stderr.write(`Error parsing ${config.versionFile}: ${err.message}\n`);
      process.exit(1);
    }
  } else if (config.fileType === 'cargo.toml' || config.fileType === 'pyproject.toml') {
    const match = content.match(/^\s*version\s*=\s*"([^"]+)"/m);
    version = match ? match[1] : null;
  } else if (config.fileType === 'pubspec.yaml') {
    const match = content.match(/^\s*version\s*:\s*(\S+)/m);
    version = match ? match[1] : null;
  } else {
    // version-file: plain text
    version = content.trim().split('\n')[0].trim() || null;
  }

  if (!version) {
    process.stderr.write(`Could not read version from ${config.versionFile}\n`);
    process.exit(1);
  }

  const prefix = config.tagPrefix || '';
  return `${prefix}${version}`;
}

function resolveTagFromTags(config, repoRoot) {
  const prefix = config.tagPrefix || '';
  const out = exec('git tag --list --sort=-v:refname', { cwd: repoRoot });
  if (!out) return null;

  const tags = out.split('\n').filter(t => {
    const rest = prefix ? t.startsWith(prefix) ? t.slice(prefix.length) : null : t;
    return rest && /^\d+\.\d+\.\d+/.test(rest);
  });

  return tags.length > 0 ? tags[0] : null;
}

// ---------------------------------------------------------------------------
// Tag operations
// ---------------------------------------------------------------------------

function getTagCommit(tag, repoRoot) {
  return exec(`git rev-parse "${tag}^{commit}" 2>/dev/null`, { cwd: repoRoot, shell: true });
}

function isAncestor(commit, repoRoot) {
  // Returns true if commit is an ancestor of (or equal to) HEAD
  const result = exec(`git merge-base --is-ancestor "${commit}" HEAD 2>/dev/null`, { cwd: repoRoot, shell: true });
  // exit code 0 = ancestor, 1 = not ancestor; exec returns null on non-zero
  // We need to check exit code directly
  try {
    execSync(`git merge-base --is-ancestor "${commit}" HEAD`, { cwd: repoRoot, stdio: 'pipe' });
    return true;
  } catch (_) {
    return false;
  }
}

function retagOnHead(tag, repoRoot) {
  const tagCommit = getTagCommit(tag, repoRoot);

  if (tagCommit) {
    if (isAncestor(tagCommit, repoRoot)) {
      console.log(`Tag ${tag} is already reachable from HEAD. Nothing to do.`);
      return;
    }
    console.log(`Tag ${tag} points to ${tagCommit} (not reachable from HEAD). Moving to HEAD...`);
    // Delete remote tag first, then local
    exec(`git push origin ":refs/tags/${tag}"`, { cwd: repoRoot });
    execOrThrow(`git tag -d "${tag}"`, { cwd: repoRoot });
  } else {
    console.log(`Tag ${tag} does not exist. Creating at HEAD...`);
  }

  execOrThrow(`git tag -a "${tag}" -m "Release ${tag}" HEAD`, { cwd: repoRoot });
  execOrThrow(`git push origin "refs/tags/${tag}"`, { cwd: repoRoot });

  const headSha = exec('git rev-parse --short HEAD', { cwd: repoRoot });
  console.log(`Tag ${tag} now points to HEAD (${headSha}).`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const repoRoot = process.cwd();

  const config = readConfig(repoRoot);
  if (!config) {
    console.log('No .claude/version.json found. Skipping retag.');
    process.exit(0);
  }

  let tag;
  if (config.mode === 'tag') {
    tag = resolveTagFromTags(config, repoRoot);
    if (!tag) {
      console.log('No existing tags found (tag mode). Skipping retag.');
      process.exit(0);
    }
  } else {
    // "file" mode (default)
    tag = resolveTagFromFile(config, repoRoot);
  }

  console.log(`Expected tag: ${tag}`);
  retagOnHead(tag, repoRoot);
}

main();
