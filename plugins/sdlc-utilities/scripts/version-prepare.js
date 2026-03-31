#!/usr/bin/env node
/**
 * version-prepare.js
 *
 * Pre-processing script for the /version-sdlc command.
 * Collects version source, git tags, commits since last tag, and remote state
 * into a single JSON blob consumed by the version-sdlc skill.
 *
 * Usage:
 *   node version-prepare.js [major|minor|patch] [--init] [--pre <label>]
 *                           [--no-push] [--changelog] [--hotfix] [--file <path>]
 *
 * Flags:
 *   major|minor|patch   Requested bump type (positional, optional)
 *   --init              Run setup detection (outputs init JSON, not release JSON)
 *   --pre <label>       Pre-release label (e.g., beta, rc)
 *   --no-push           Skip push to remote
 *   --changelog         Enable changelog generation for this run
 *   --hotfix            Mark this release as a hotfix (DORA metrics)
 *   --file <path>       Override version file path (used with --init)
 *
 * Exit codes:
 *   0  Success — JSON written to stdout
 *   1  User-facing error — JSON with errors[] written to stdout
 *   2  Unexpected script error
 *
 * @module version-prepare
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const { checkGitState, getTagList, getCommitsSinceRef, getCommitsBetweenRefs, getRemoteState } = require('./lib/git');
const {
  detectVersionFile, readVersion, validateSemver,
  computeNextVersions, computePreRelease, parseConventionalCommit,
  readConfig,
} = require('./lib/version');
const { writeOutput } = require('./lib/output');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

/**
 * Parse process.argv.slice(2) into a structured args object.
 * @param {string[]} argv  process.argv
 * @returns {{
 *   init: boolean,
 *   requestedBump: 'major'|'minor'|'patch'|null,
 *   preLabel: string|null,
 *   noPush: boolean,
 *   changelog: boolean,
 *   hotfix: boolean,
 *   auto: boolean,
 *   fileOverride: string|null,
 *   warnings: string[],
 * }}
 */
function parseArgs(argv) {
  const args = argv.slice(2);

  let init           = false;
  let requestedBump  = null;
  let preLabel       = null;
  let noPush         = false;
  let changelog      = false;
  let hotfix         = false;
  let auto           = false;
  let fileOverride   = null;
  const warnings     = [];

  const BUMP_VALUES = new Set(['major', 'minor', 'patch']);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];

    if (BUMP_VALUES.has(a)) {
      requestedBump = a;
    } else if (a === '--init') {
      init = true;
    } else if (a === '--pre' && args[i + 1]) {
      preLabel = args[++i];
    } else if (a === '--no-push') {
      noPush = true;
    } else if (a === '--changelog') {
      changelog = true;
    } else if (a === '--hotfix') {
      hotfix = true;
    } else if (a === '--auto') {
      auto = true;
    } else if (a === '--file' && args[i + 1]) {
      fileOverride = args[++i];
    } else if (a.startsWith('-')) {
      warnings.push(`Unknown flag: ${a}`);
    }
  }

  return { init, requestedBump, preLabel, noPush, changelog, hotfix, auto, fileOverride, warnings };
}

// ---------------------------------------------------------------------------
// File type detection from filename
// ---------------------------------------------------------------------------

/**
 * Infer a fileType string from a file path's basename.
 * @param {string} filePath
 * @returns {string}
 */
function fileTypeFromPath(filePath) {
  const base = path.basename(filePath);
  const MAP  = {
    'package.json':  'package.json',
    'Cargo.toml':    'cargo.toml',
    'pyproject.toml':'pyproject.toml',
    'pubspec.yaml':  'pubspec.yaml',
    'plugin.json':   'plugin.json',
    'VERSION':       'version-file',
    'version.txt':   'version-file',
  };
  return MAP[base] || 'version-file';
}

// ---------------------------------------------------------------------------
// Output helper
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const projectRoot = process.cwd();
  const args        = parseArgs(process.argv);

  // -------------------------------------------------------------------------
  // Init flow
  // -------------------------------------------------------------------------

  if (args.init) {
    const errors   = [...args.warnings.map(w => null).filter(Boolean)]; // kept for symmetry
    const warnings = [...args.warnings];

    // 1. Verify git repo
    let gitState;
    try {
      gitState = checkGitState(projectRoot);
    } catch (err) {
      writeOutput({ flow: 'init', errors: [err.message], warnings }, 'version-context', 1);
      return;
    }

    // 2. Detect version file
    let detectedVersionFile = null;

    if (args.fileOverride) {
      const absPath  = path.isAbsolute(args.fileOverride)
        ? args.fileOverride
        : path.join(projectRoot, args.fileOverride);
      const fileType = fileTypeFromPath(absPath);
      const relPath  = path.relative(projectRoot, absPath);
      detectedVersionFile = { filePath: absPath, fileType, relativePath: relPath };
    } else {
      const detected = detectVersionFile(projectRoot);
      if (detected) {
        detectedVersionFile = {
          filePath:     detected.filePath,
          fileType:     detected.fileType,
          relativePath: path.relative(projectRoot, detected.filePath),
        };
      }
    }

    // 3. Read current version
    let currentVersion = null;
    if (detectedVersionFile) {
      try {
        currentVersion = readVersion(detectedVersionFile.filePath, detectedVersionFile.fileType);
      } catch (_) {
        currentVersion = null;
      }
    }

    // 4. Get existing tags
    const existingTags = getTagList(projectRoot);

    // 5. Detect tag convention
    const usesVPrefix = existingTags.length > 0
      ? existingTags.some(t => t.startsWith('v'))
      : true;
    const tagPrefix = usesVPrefix ? 'v' : '';

    // 6. Build suggested config
    const suggestedConfig = {
      mode:          detectedVersionFile ? 'file' : 'tag',
      versionFile:   detectedVersionFile ? detectedVersionFile.relativePath : null,
      fileType:      detectedVersionFile ? detectedVersionFile.fileType     : null,
      tagPrefix:     'v',
      changelog:     false,
      changelogFile: 'CHANGELOG.md',
    };

    // 7. Output
    writeOutput({
      flow:                 'init',
      errors:               [],
      warnings,
      detectedVersionFile,
      currentVersion,
      existingTags,
      tagConvention:        { usesVPrefix, tagPrefix },
      suggestedConfig,
    }, 'version-context', 0);
    return;
  }

  // -------------------------------------------------------------------------
  // Changelog-update flow (--changelog without a bump type)
  // -------------------------------------------------------------------------

  if (args.changelog && !args.requestedBump) {
    const errors   = [...args.warnings.map(() => null).filter(Boolean)];
    const warnings = [...args.warnings];

    // 1. Read config
    let config;
    try {
      config = readConfig(projectRoot);
    } catch (err) {
      errors.push(err.message);
      writeOutput({ flow: 'changelog-update', errors, warnings }, 'version-context', 1);
      return;
    }

    if (!config) {
      errors.push('No version config found. Run /version-sdlc --init to set up versioning for this project.');
      writeOutput({ flow: 'changelog-update', errors, warnings }, 'version-context', 1);
      return;
    }

    // 2. Verify git repo
    try {
      checkGitState(projectRoot);
    } catch (err) {
      errors.push(err.message);
      writeOutput({ flow: 'changelog-update', errors, warnings }, 'version-context', 1);
      return;
    }

    // 3. Resolve current version
    let currentVersion = null;

    if (config.mode === 'file') {
      const absFilePath = path.join(projectRoot, config.versionFile);
      try {
        currentVersion = readVersion(absFilePath, config.fileType);
      } catch (_) {
        currentVersion = null;
      }
      if (currentVersion === null) {
        errors.push(`Could not read version from ${config.versionFile}`);
        writeOutput({ flow: 'changelog-update', errors, warnings }, 'version-context', 1);
        return;
      }
    } else {
      // tag mode
      const tags = getTagList(projectRoot);
      if (!tags[0]) {
        errors.push('No version tags found.');
        writeOutput({ flow: 'changelog-update', errors, warnings }, 'version-context', 1);
        return;
      }
      currentVersion = tags[0].startsWith('v') ? tags[0].slice(1) : tags[0];
    }

    if (!validateSemver(currentVersion)) {
      errors.push(`Current version '${currentVersion}' is not valid semver.`);
      writeOutput({ flow: 'changelog-update', errors, warnings }, 'version-context', 1);
      return;
    }

    // 4. Build current tag and find previous tag
    const tagPrefix  = config.tagPrefix || 'v';
    const currentTag = `${tagPrefix}${currentVersion}`;
    const allTags    = getTagList(projectRoot);

    if (!allTags.includes(currentTag)) {
      errors.push(`Tag '${currentTag}' not found. Has the release been tagged yet?`);
      writeOutput({ flow: 'changelog-update', errors, warnings }, 'version-context', 1);
      return;
    }

    const currentTagIndex = allTags.indexOf(currentTag);
    const previousTag     = currentTagIndex < allTags.length - 1
      ? allTags[currentTagIndex + 1]
      : null;  // no previous tag — first release

    // 5. Get commits between tags (previousTag..currentTag)
    const rawCommits = getCommitsBetweenRefs(previousTag, currentTag, projectRoot);

    if (rawCommits.length === 0) {
      warnings.push('No commits found between the previous tag and current tag.');
    }

    const commits = rawCommits.map(commit => {
      const parsed = parseConventionalCommit(commit.subject, commit.body, config.ticketPrefix || null);
      return {
        hash:        commit.hash,
        subject:     commit.subject,
        body:        commit.body,
        coAuthors:   commit.coAuthors,
        type:        parsed.type,
        scope:       parsed.scope,
        breaking:    parsed.breaking,
        description: parsed.description,
        ticketIds:   parsed.ticketIds,
      };
    });

    // 6. Read existing changelog
    const changelogFile = config.changelogFile || 'CHANGELOG.md';
    const changelogPath = path.join(projectRoot, changelogFile);
    const changelogExists = fs.existsSync(changelogPath);
    let changelogContent  = null;

    if (changelogExists) {
      const raw = fs.readFileSync(changelogPath, 'utf8');
      changelogContent = raw.length > 5000 ? raw.slice(0, 5000) : raw;
    }

    // 7. Output
    writeOutput({
      flow:         'changelog-update',
      errors:       [],
      warnings,
      config,
      currentVersion,
      currentTag,
      previousTag,
      commits,
      flags: {
        noPush: args.noPush,
        auto:   args.auto,
      },
      changelog: {
        exists:         changelogExists,
        filePath:       changelogFile,
        currentContent: changelogContent,
      },
    }, 'version-context', 0);
    return;
  }

  // -------------------------------------------------------------------------
  // Release flow
  // -------------------------------------------------------------------------

  const errors   = [...args.warnings.map(w => null).filter(Boolean)]; // kept for symmetry
  const warnings = [...args.warnings];

  // 2. Read config
  let config;
  try {
    config = readConfig(projectRoot);
  } catch (err) {
    errors.push(err.message);
    writeOutput({ flow: 'release', errors, warnings }, 'version-context', 1);
    return;
  }

  if (!config) {
    errors.push('No version config found. Run /version-sdlc --init to set up versioning for this project.');
    writeOutput({ flow: 'release', errors, warnings }, 'version-context', 1);
    return;
  }

  // 3. Verify git repo
  let gitState;
  try {
    gitState = checkGitState(projectRoot);
  } catch (err) {
    errors.push(err.message);
    writeOutput({ flow: 'release', errors, warnings }, 'version-context', 1);
    return;
  }

  const { currentBranch, uncommittedChanges } = gitState;

  // 4. Warn about uncommitted changes
  if (uncommittedChanges) {
    warnings.push('You have uncommitted changes. The release commit will not include them.');
  }

  // 5. Determine version source
  let currentVersion = null;
  let versionSource  = null;

  if (config.mode === 'file') {
    const absFilePath = path.join(projectRoot, config.versionFile);
    let version;
    try {
      version = readVersion(absFilePath, config.fileType);
    } catch (_) {
      version = null;
    }

    if (version === null) {
      errors.push(`Could not read version from ${config.versionFile}`);
      writeOutput({ flow: 'release', errors, warnings }, 'version-context', 1);
      return;
    }

    currentVersion = version;
    versionSource  = {
      filePath:       absFilePath,
      fileType:       config.fileType,
      relativePath:   config.versionFile,
      currentVersion: version,
      isValid:        validateSemver(version),
    };
  } else {
    // tag mode
    const tags      = getTagList(projectRoot);
    const latestTag = tags[0] || null;

    if (!latestTag) {
      errors.push('No version tags found. Create an initial tag (e.g., git tag v0.0.0) and try again.');
      writeOutput({ flow: 'release', errors, warnings }, 'version-context', 1);
      return;
    }

    const stripped     = latestTag.startsWith('v') ? latestTag.slice(1) : latestTag;
    currentVersion     = stripped;
    versionSource      = {
      filePath:       null,
      fileType:       null,
      relativePath:   null,
      currentVersion: stripped,
      isValid:        validateSemver(stripped),
    };
  }

  // 6. Validate semver
  if (!validateSemver(currentVersion)) {
    errors.push(`Current version '${currentVersion}' is not valid semver.`);
    writeOutput({ flow: 'release', errors, warnings }, 'version-context', 1);
    return;
  }

  // If we accumulated any errors so far, stop before going further
  if (errors.length > 0) {
    writeOutput({ flow: 'release', errors, warnings }, 'version-context', 1);
    return;
  }

  // 7. Compute next versions
  const bumpOptions = computeNextVersions(currentVersion);

  // 8. Pre-release handling
  if (args.preLabel) {
    if (args.requestedBump) {
      // Pre-release on top of the next bump, e.g. --minor --pre beta on 1.2.3 → 1.3.0-beta.1
      const nextBase  = bumpOptions[args.requestedBump]; // e.g. "1.3.0"
      bumpOptions.preRelease = computePreRelease(nextBase, args.preLabel);
    } else {
      bumpOptions.preRelease = computePreRelease(currentVersion, args.preLabel);
    }
  }

  // 9. Tags
  const allTags     = getTagList(projectRoot);
  const latestTag   = allTags[0] || null;
  const latestVersion = latestTag
    ? (latestTag.startsWith('v') ? latestTag.slice(1) : latestTag)
    : null;

  const tagPrefix = config.tagPrefix || (latestTag && latestTag.startsWith('v') ? 'v' : '');
  const usesVPrefix = tagPrefix === 'v';

  const conflictsWithNext = {
    major:      allTags.includes(`${tagPrefix}${bumpOptions.major}`),
    minor:      allTags.includes(`${tagPrefix}${bumpOptions.minor}`),
    patch:      allTags.includes(`${tagPrefix}${bumpOptions.patch}`),
    preRelease: bumpOptions.preRelease
      ? allTags.includes(`${tagPrefix}${bumpOptions.preRelease}`)
      : false,
  };

  const tagsOutput = {
    all:            allTags,
    latest:         latestTag,
    latestVersion,
    usesVPrefix,
    tagPrefix,
    conflictsWithNext,
  };

  // 10. Commits since last tag
  const rawCommits = getCommitsSinceRef(latestTag || null, projectRoot);

  if (rawCommits.length === 0 && !args.preLabel) {
    warnings.push('No commits since last tag. Nothing to release.');
  }

  const commits = rawCommits.map(commit => {
    const parsed = parseConventionalCommit(commit.subject, commit.body, config.ticketPrefix || null);
    return {
      hash:        commit.hash,
      subject:     commit.subject,
      body:        commit.body,
      coAuthors:   commit.coAuthors,
      type:        parsed.type,
      scope:       parsed.scope,
      breaking:    parsed.breaking,
      description: parsed.description,
      ticketIds:   parsed.ticketIds,
    };
  });

  // 11. Build conventional summary
  const TRACKED_TYPES = ['feat', 'fix', 'refactor', 'docs', 'chore', 'test', 'perf'];
  const typeCounts    = Object.fromEntries(TRACKED_TYPES.map(t => [t, 0]));
  typeCounts.other    = 0;

  let hasBreakingChanges = false;

  for (const commit of commits) {
    if (commit.breaking || (commit.body && commit.body.includes('BREAKING CHANGE'))) {
      hasBreakingChanges = true;
    }
    if (TRACKED_TYPES.includes(commit.type)) {
      typeCounts[commit.type]++;
    } else {
      typeCounts.other++;
    }
  }

  let suggestedBump;
  if (hasBreakingChanges) {
    suggestedBump = 'major';
  } else if (typeCounts.feat > 0) {
    suggestedBump = 'minor';
  } else {
    suggestedBump = 'patch';
  }

  const conventionalSummary = { ...typeCounts, hasBreakingChanges, suggestedBump };

  // 12. Changelog
  const changelogEnabled = config.changelog === true || args.changelog === true;
  let changelogOutput    = null;

  if (changelogEnabled) {
    const changelogFile = config.changelogFile || 'CHANGELOG.md';
    const changelogPath = path.join(projectRoot, changelogFile);
    const exists        = fs.existsSync(changelogPath);
    let currentContent  = null;

    if (exists) {
      const raw      = fs.readFileSync(changelogPath, 'utf8');
      currentContent = raw.length > 5000 ? raw.slice(0, 5000) : raw;
    }

    changelogOutput = { exists, filePath: changelogFile, currentContent };
  }

  // 13. Remote state
  let remoteState;
  try {
    const raw = getRemoteState(projectRoot);
    remoteState = raw
      ? { hasUpstream: raw.hasUpstream, remoteBranch: raw.remoteBranch, isAhead: raw.isAhead }
      : { hasUpstream: false, remoteBranch: null, isAhead: false };
  } catch (_) {
    remoteState = { hasUpstream: false, remoteBranch: null, isAhead: false };
  }

  // 14. Build and output final JSON
  writeOutput({
    flow:    'release',
    errors:  [],
    warnings,
    config,
    currentBranch,
    versionSource,
    bumpOptions,
    requestedBump: args.requestedBump,
    flags: {
      noPush:    args.noPush,
      changelog: args.changelog,
      preLabel:  args.preLabel,
      hotfix:    args.hotfix,
      auto:      args.auto,
    },
    tags:               tagsOutput,
    commits,
    conventionalSummary,
    changelog:          changelogOutput,
    remoteState,
  }, 'version-context', 0);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  main().catch(err => {
    process.stderr.write(`Script error: ${err.message}\n`);
    process.exit(2);
  });
}

module.exports = { parseArgs };
