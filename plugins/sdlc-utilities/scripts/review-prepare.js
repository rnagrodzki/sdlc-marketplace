#!/usr/bin/env node
/**
 * review-prepare.js
 * Pre-computes all data needed for the sdlc-reviewing-changes skill:
 * git state, changed files, dimension matching, diff splitting,
 * commit context, PR metadata. Outputs JSON manifest + per-dimension
 * .diff files to a temp directory.
 *
 * Usage:
 *   node review-prepare.js [options]
 *
 * Options:
 *   --project-root <path>     Project root (default: cwd)
 *   --base <branch>           Base branch (auto-detect if omitted)
 *   --dimensions <name,...>   Filter to named dimensions only
 *   --json                    JSON output to stdout (default)
 *
 * Exit codes: 0 = success, 1 = no dimensions or no changes, 2 = script error
 * Stdout: JSON manifest
 * Stderr: warnings/progress
 * Side effect: writes .diff files to OS temp dir
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

const { validateAll, extractFrontmatter, extractBody, parseSimpleYaml } = require('./lib/dimensions');
const {
  exec,
  checkGitState,
  detectBaseBranch,
  getChangedFiles,
  getCommitLog,
  getCommitCount,
  fetchPrMetadata,
} = require('./lib/git');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let projectRoot = process.cwd();
  let baseBranch = null;
  let dimensionFilter = null;
  let scope = 'all';

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--project-root' && args[i + 1]) projectRoot = path.resolve(args[++i]);
    else if (a === '--base' && args[i + 1]) baseBranch = args[++i];
    else if (a === '--dimensions' && args[i + 1]) dimensionFilter = args[++i].split(',').map(s => s.trim());
    else if (a === '--committed') scope = 'committed';
    else if (a === '--staged')    scope = 'staged';
    else if (a === '--working')   scope = 'working';
  }

  return { projectRoot, baseBranch, dimensionFilter, scope };
}

// ---------------------------------------------------------------------------
// Glob matching
// ---------------------------------------------------------------------------

/**
 * Convert a glob pattern to a RegExp.
 * Handles the patterns used in review dimension files:
 *   **\/   — zero or more directory segments
 *   **     — any sequence of characters (including slashes)
 *   *      — any chars within a single path segment (no slash)
 *   ?      — single char (no slash)
 *   [...]  — character class
 *   .      — literal dot (escaped)
 */
function globToRegex(pattern) {
  let re = '';
  let i = 0;
  const len = pattern.length;

  while (i < len) {
    const ch = pattern[i];

    if (ch === '*') {
      if (i + 1 < len && pattern[i + 1] === '*') {
        if (i + 2 < len && pattern[i + 2] === '/') {
          re += '(?:[^/]+/)*';
          i += 3;
        } else {
          re += '.*';
          i += 2;
        }
      } else {
        re += '[^/]*';
        i++;
      }
    } else if (ch === '?') {
      re += '[^/]';
      i++;
    } else if (ch === '[') {
      const close = pattern.indexOf(']', i + 1);
      if (close === -1) {
        re += '\\[';
        i++;
      } else {
        re += pattern.slice(i, close + 1);
        i = close + 1;
      }
    } else if ('.+^${}()|\\'.includes(ch)) {
      re += '\\' + ch;
      i++;
    } else {
      re += ch;
      i++;
    }
  }

  return new RegExp('^' + re + '$');
}

/**
 * Match a list of changed files against a dimension's trigger/skip-when globs.
 * Returns { matched: string[], truncated: boolean }
 */
function matchFiles(dimension, changedFiles) {
  const triggers = (dimension.triggers    || []).map(globToRegex);
  const skipWhen = (dimension['skip-when'] || []).map(globToRegex);
  const maxFiles = dimension['max-files'] || 100;

  let matched = changedFiles.filter(f =>
    triggers.some(re => re.test(f)) && !skipWhen.some(re => re.test(f))
  );

  const truncated = matched.length > maxFiles;
  if (truncated) matched = matched.slice(0, maxFiles);

  return { matched, truncated };
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

const MAX_COMMITS_PER_FILE = 5;

/**
 * Returns Map<filePath, [{hash, subject}]> capped at MAX_COMMITS_PER_FILE commits per file.
 */
function getCommitFileMap(base, projectRoot) {
  const raw = exec(
    `git log --format="COMMIT:%H %s" --name-only ${base}..HEAD`,
    { cwd: projectRoot }
  );
  if (!raw) return new Map();

  const fileCommits = new Map();
  let current = null;

  for (const line of raw.split('\n')) {
    if (line.startsWith('COMMIT:')) {
      const rest     = line.slice(7);
      const spaceIdx = rest.indexOf(' ');
      const hash     = rest.slice(0, 8);
      const subject  = spaceIdx >= 0 ? rest.slice(spaceIdx + 1) : '';
      current = { hash, subject };
    } else if (line.trim() && current) {
      const file = line.trim();
      if (!fileCommits.has(file)) fileCommits.set(file, []);
      const commits = fileCommits.get(file);
      if (commits.length < MAX_COMMITS_PER_FILE) commits.push(current);
    }
  }

  return fileCommits;
}

// ---------------------------------------------------------------------------
// Diff splitting
// ---------------------------------------------------------------------------

/**
 * Fetch the full diff and split into per-file chunks.
 * Returns Map<filePath, rawDiffChunk>
 */
function fetchAndSplitDiff(base, projectRoot, scope = 'all') {
  let cmd;
  switch (scope) {
    case 'committed': cmd = `git diff ${base}..HEAD`; break;
    case 'staged':    cmd = 'git diff --cached';      break;
    case 'working':   cmd = 'git diff HEAD';          break;
    default:          cmd = `git diff --cached ${base}`; break; // 'all'
  }
  const raw = exec(cmd, { cwd: projectRoot });
  if (!raw) return new Map();

  const fileDiffs = new Map();
  const chunks    = raw.split(/(?=^diff --git )/m);

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const m = chunk.match(/^diff --git a\/.+ b\/(.+)/m);
    if (m) fileDiffs.set(m[1].trim(), chunk);
  }

  return fileDiffs;
}

/**
 * Write one .diff file per active dimension to tmpDir.
 * Mutates dim.diff_file on each active dimension.
 * Returns tmpDir path.
 */
function writeDimensionDiffs(activeDimensions, fileDiffs, projectRoot) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-review-'));

  for (const dim of activeDimensions) {
    const filesWithNoDiff = dim.matched_files.filter(f => !fileDiffs.has(f));
    if (filesWithNoDiff.length > 0) {
      process.stderr.write(`Warning: ${dim.name}: ${filesWithNoDiff.length} matched file(s) have no diff content (renamed, mode-only, or binary): ${filesWithNoDiff.join(', ')}\n`);
      dim.warnings.push(`No diff content for: ${filesWithNoDiff.join(', ')}`);
    }
    const parts = dim.matched_files
      .map(f => fileDiffs.get(f))
      .filter(Boolean);
    fs.writeFileSync(path.join(tmpDir, `${dim.name}.diff`), parts.join('\n'), 'utf8');
    dim.diff_file = path.join(tmpDir, `${dim.name}.diff`);
  }

  return tmpDir;
}

// ---------------------------------------------------------------------------
// Plan critique and refinement
// ---------------------------------------------------------------------------

const SEVERITY_RANK = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

function critiquePlan(dimensions, changedFiles) {
  const allMatched     = new Set(dimensions.flatMap(d => d.matched_files));
  const uncoveredFiles = changedFiles.filter(f => !allMatched.has(f));
  const totalCount     = changedFiles.length;

  const overBroad = dimensions
    .filter(d => d.status === 'ACTIVE' && totalCount > 0 && d.matched_files.length / totalCount > 0.8)
    .map(d => d.name);

  const overlappingPairs = [];
  const active = dimensions.filter(d => d.status === 'ACTIVE');
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = new Set(active[i].matched_files);
      const b = new Set(active[j].matched_files);
      if (a.size === b.size && [...a].every(f => b.has(f))) {
        overlappingPairs.push([active[i].name, active[j].name]);
      }
    }
  }

  return {
    uncoveredFiles,
    overBroad,
    overlappingPairs,
    dimensionCapApplied: active.length > 8,
  };
}

/**
 * If more than 8 dimensions are ACTIVE, cap to top 8 by priority.
 * Priority: severity descending, then matched_files count ascending.
 * Returns list of queued dimension names.
 */
function refinePlan(dimensions) {
  const active = dimensions.filter(d => d.status === 'ACTIVE');
  if (active.length <= 8) return [];

  active.sort((a, b) => {
    const diff = (SEVERITY_RANK[b.severity] || 3) - (SEVERITY_RANK[a.severity] || 3);
    return diff !== 0 ? diff : a.matched_files.length - b.matched_files.length;
  });

  const keep   = new Set(active.slice(0, 8).map(d => d.name));
  const queued = [];

  for (const dim of dimensions) {
    if (dim.status === 'ACTIVE' && !keep.has(dim.name)) {
      dim.status = 'QUEUED';
      queued.push(dim.name);
    }
  }

  return queued;
}

// ---------------------------------------------------------------------------
// Dimension loading and matching
// ---------------------------------------------------------------------------

function loadAndMatchDimensions(projectRoot, changedFiles, dimensionFilter) {
  const report = validateAll(projectRoot);
  const dims   = [];

  for (const result of report.dimensions) {
    if (result.status === 'FAIL') continue;

    const filePath = path.join(projectRoot, '.claude', 'review-dimensions', result.file);
    let content;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch (_) { continue; }

    const fm   = parseSimpleYaml(extractFrontmatter(content) || '');
    const body = extractBody(content);

    if (dimensionFilter && !dimensionFilter.includes(fm.name)) continue;

    const { matched, truncated } = matchFiles(fm, changedFiles);

    dims.push({
      name:              fm.name,
      description:       fm.description || '',
      severity:          fm.severity || 'medium',
      requires_full_diff: fm['requires-full-diff'] || false,
      status:            matched.length === 0 ? 'SKIPPED' : (truncated ? 'TRUNCATED' : 'ACTIVE'),
      matched_files:     matched,
      matched_count:     matched.length,
      truncated,
      diff_file:         null,
      body,
      file_context:      [],
      warnings:          result.warnings,
    });
  }

  return dims;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { projectRoot, baseBranch, dimensionFilter, scope } = parseArgs(process.argv);

  // Validate mutual exclusivity
  const isLocalScope = scope === 'staged' || scope === 'working';
  if (isLocalScope && baseBranch) {
    process.stderr.write(`Error: --${scope} and --base are mutually exclusive.\n`);
    process.exit(2);
  }
  if (isLocalScope && scope !== scope) { /* unreachable, kept for clarity */ }

  let gitState;
  try {
    gitState = checkGitState(projectRoot);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(2);
  }

  // Base branch only needed for 'all' and 'committed' scopes
  let base = baseBranch;
  if (!isLocalScope && !base) {
    try {
      base = detectBaseBranch(projectRoot);
    } catch (err) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(2);
    }
  }

  const changedFiles = getChangedFiles(base, projectRoot, scope);
  if (changedFiles.length === 0) {
    const scopeLabel = {
      all:       `committed + staged changes vs "${base}"`,
      committed: `committed changes vs "${base}"`,
      staged:    'staged changes',
      working:   'working tree changes vs HEAD',
    }[scope] || scope;
    process.stderr.write(`No changed files found in ${scopeLabel}.\n`);
    process.exit(1);
  }

  const dims = loadAndMatchDimensions(projectRoot, changedFiles, dimensionFilter);
  if (dims.length === 0) {
    process.stderr.write('No review dimensions found in .claude/review-dimensions/.\nRun /sdlc:review-init to create tailored review dimensions.\n');
    process.exit(1);
  }

  // Commit context only available for branch-based scopes
  if (!isLocalScope) {
    const commitFileMap = getCommitFileMap(base, projectRoot);
    for (const dim of dims) {
      dim.file_context = dim.matched_files.map(file => ({
        file,
        commits: commitFileMap.get(file) || [],
      }));
    }
  }

  // Diffs
  const fileDiffs  = fetchAndSplitDiff(base, projectRoot, scope);
  const activeDims = dims.filter(d => d.status === 'ACTIVE' || d.status === 'TRUNCATED');
  const tmpDir     = writeDimensionDiffs(activeDims, fileDiffs, projectRoot);

  // Plan critique and refinement
  const critique = critiquePlan(dims, changedFiles);
  const queued   = refinePlan(dims);

  // PR metadata only relevant for branch-based scopes
  const pr = !isLocalScope ? fetchPrMetadata() : { exists: false };

  const manifest = {
    version:        1,
    timestamp:      new Date().toISOString(),
    scope,
    base_branch:    base || null,
    current_branch: gitState.currentBranch,
    uncommitted_changes: gitState.uncommittedChanges,
    dirty_files:    gitState.dirtyFiles,
    git: {
      commit_count:  !isLocalScope ? getCommitCount(base, projectRoot) : 0,
      commit_log:    !isLocalScope ? getCommitLog(base, projectRoot)   : '',
      changed_files: changedFiles,
    },
    pr,
    dimensions: dims,
    plan_critique: {
      uncovered_files:       critique.uncoveredFiles,
      over_broad_dimensions: critique.overBroad,
      overlapping_pairs:     critique.overlappingPairs,
      dimension_cap_applied: critique.dimensionCapApplied,
      queued_dimensions:     queued,
    },
    summary: {
      total_dimensions:     dims.length,
      active_dimensions:    dims.filter(d => d.status === 'ACTIVE' || d.status === 'TRUNCATED').length,
      skipped_dimensions:   dims.filter(d => d.status === 'SKIPPED').length,
      queued_dimensions:    queued.length,
      total_changed_files:  changedFiles.length,
      uncovered_file_count: critique.uncoveredFiles.length,
    },
    diff_dir: tmpDir,
  };

  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`review-prepare.js error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
  }
}

module.exports = { globToRegex, matchFiles };
