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
const LIB = path.join(__dirname, '..', 'lib');

const { checkGitState, getTagList, getCommitsSinceRef, getCommitsBetweenRefs, getRemoteState } = require(path.join(LIB, 'git'));
const {
  detectVersionFile, readVersion, validateSemver,
  computeNextVersions, computePreRelease, parseConventionalCommit,
  readConfig, PRE_RELEASE_LABEL_RE,
} = require(path.join(LIB, 'version'));
const { writeOutput } = require(path.join(LIB, 'output'));
const { resolveSkipConfigCheck, ensureConfigVersion } = require(path.join(LIB, 'config-version-prepare'));

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

/**
 * Parse process.argv.slice(2) into a structured args object.
 *
 * Bump value space:
 *  - `major|minor|patch` — explicit base bump
 *  - `<label>` — pre-release label matching `^[a-z][a-z0-9]*$` (sugar for `--bump patch --pre <label>`)
 *
 * When the positional bump matches a label form and the user did not also pass
 * `--pre <label>`, we set `requestedBump = 'patch'` and `preLabel = <token>`.
 * If `--pre` is also explicitly passed, that explicit value wins (the
 * positional label is treated as a duplicate intent and ignored).
 *
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
 *   errors: string[],
 * }}
 */
function parseArgs(argv) {
  const args = argv.slice(2);

  let init                = false;
  let requestedBump       = null;
  let preLabel            = null;
  // Track whether --pre was passed explicitly so a label-form positional does
  // not overwrite an explicit --pre value.
  let preLabelExplicit    = false;
  // Track whether the positional bump came from a label-form token; the
  // skill layer (version-sdlc) consults this to skip the breaking-change
  // warning (R3 reworded — pre-release source coverage).
  let bumpFromLabel       = false;
  let noPush              = false;
  let changelog           = false;
  let hotfix              = false;
  let auto                = false;
  let fileOverride        = null;
  const warnings          = [];
  const errors            = [];

  const BUMP_VALUES = new Set(['major', 'minor', 'patch']);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];

    if (BUMP_VALUES.has(a)) {
      requestedBump = a;
    } else if (a === '--init') {
      init = true;
    } else if (a === '--pre' && args[i + 1]) {
      const label = args[++i];
      if (!PRE_RELEASE_LABEL_RE.test(label)) {
        errors.push(`Invalid --pre label '${label}'. Labels must match ${PRE_RELEASE_LABEL_RE.toString()} (lowercase, start with a letter, alphanumeric).`);
      } else {
        preLabel = label;
        preLabelExplicit = true;
      }
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
    } else if (a === '--output-file') {
      // boolean flag; consumed by writeOutput in scripts/lib/output.js
    } else if (a.startsWith('-')) {
      warnings.push(`Unknown flag: ${a}`);
    } else if (PRE_RELEASE_LABEL_RE.test(a)) {
      // Label-form bump (e.g. `version-sdlc rc`). Sugar for patch + --pre <label>.
      if (requestedBump === null) {
        requestedBump = 'patch';
        bumpFromLabel = true;
      }
      if (!preLabelExplicit) {
        preLabel = a;
      }
    } else {
      // Token matched no recognized form (positional bump, label, or flag).
      errors.push(`Unrecognized argument '${a}'. Expected one of: major|minor|patch|<label> (label must match ${PRE_RELEASE_LABEL_RE.toString()}).`);
    }
  }

  return {
    init, requestedBump, preLabel, noPush, changelog, hotfix, auto,
    fileOverride, warnings, errors, bumpFromLabel, preLabelExplicit,
  };
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

  // Issue #232: verifyAndMigrate gate (CLI > env > default false).
  const skipConfigCheck = resolveSkipConfigCheck(process.argv);
  const cv = ensureConfigVersion(projectRoot, { skip: skipConfigCheck, roles: ['project', 'local'] });
  if (cv.errors.length > 0) {
    writeOutput({
      flow: 'release',
      errors: cv.errors.map(e => `config-version: ${e.role}: ${e.message}`),
      warnings: args.warnings,
      flags: { skipConfigCheck },
      migration: cv.migration,
    }, 'version-context', 1);
    return;
  }
  args.skipConfigCheck = skipConfigCheck;
  args.migration = cv.migration;

  // Fail fast on argument-parse errors (invalid --pre label, unrecognized
  // positional token). Skip in --init flow because init never accepts a bump
  // value; flag mismatches there are warnings, not errors.
  if (!args.init && args.errors.length > 0) {
    writeOutput({
      flow:     'release',
      errors:   args.errors,
      warnings: args.warnings,
    }, 'version-context', 1);
    return;
  }

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

  // Validate config.preRelease shape if present (defense in depth — schema
  // also enforces this). A misconfigured value should fail loudly, not
  // silently fall through to auto-detection.
  if (config.preRelease !== undefined && config.preRelease !== null && config.preRelease !== '') {
    if (typeof config.preRelease !== 'string' || !PRE_RELEASE_LABEL_RE.test(config.preRelease)) {
      errors.push(`config.preRelease '${config.preRelease}' is invalid. Must match ${PRE_RELEASE_LABEL_RE.toString()}.`);
      writeOutput({ flow: 'release', errors, warnings }, 'version-context', 1);
      return;
    }
  }

  // Apply config.preRelease default. Per spec R16, the precedence is:
  //   (1) explicit base bump major|minor|patch (with optional --pre)
  //   (2) explicit label-form --bump <label> OR explicit --pre <label>
  //   (3) config.preRelease
  //   (4) auto-detection from conventional commits (existing path)
  //
  // The condition below fires only when the user passed no explicit base
  // bump AND no preLabel (neither from --pre nor from a label-form bump),
  // so an explicit --bump major (graduate) or --bump rc (label) bypasses
  // this branch.
  let preLabelFromConfig = false;
  if (
    args.requestedBump === null &&
    args.preLabel === null &&
    typeof config.preRelease === 'string' &&
    config.preRelease.length > 0
  ) {
    args.requestedBump = 'patch';
    args.preLabel      = config.preRelease;
    preLabelFromConfig = true;
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
  //
  // Two operating modes:
  //
  //   (A) "Pre-release on top of an explicit base bump"
  //       Triggered by an explicit base bump combined with a pre-release
  //       label (either via `--minor --pre beta`, or via auto-injected
  //       patch from `config.preRelease`). Resolves to the next base
  //       version with the label applied.
  //         Example: 1.2.3 + --minor --pre beta → 1.3.0-beta.1
  //
  //   (B) "Label-form bump (sugar) on the current version"
  //       Triggered by a positional label-form bump like `version-sdlc rc`.
  //       The parser sets requestedBump='patch' for downstream code that
  //       always expects a base, but we delegate to computePreRelease()
  //       on the CURRENT version so that:
  //         - 1.2.3        → 1.2.4-rc.1  (no existing pre-release: patch + label)
  //         - 1.2.4-rc.1   → 1.2.4-rc.2  (same label: increment counter)
  //         - 1.2.4-beta.3 → 1.2.4-rc.1  (different label: reset counter)
  //       Note: when the current version has no pre-release, `computePreRelease`
  //       would produce `1.2.3-rc.1` (no patch). To match the acceptance
  //       criterion `1.2.3 → 1.2.4-rc.1`, fall back to the patched base in
  //       that case. This preserves the "fresh pre-release train starts on
  //       the NEXT release" intuition.
  if (args.preLabel) {
    const currentHasPreRelease = currentVersion.includes('-');
    // "Sugar mode" covers both the label-form positional bump and the
    // config.preRelease default — both express "default pre-release intent"
    // and per spec must behave identically.
    const sugarMode = args.bumpFromLabel || preLabelFromConfig;

    if (sugarMode) {
      // Sugar: prefer same-base increment / label-reset on existing
      // pre-releases; otherwise patch then label (fresh pre-release train).
      if (currentHasPreRelease) {
        bumpOptions.preRelease = computePreRelease(currentVersion, args.preLabel);
      } else {
        const nextBase = bumpOptions.patch;
        bumpOptions.preRelease = computePreRelease(nextBase, args.preLabel);
      }
    } else if (args.requestedBump) {
      // Explicit base bump with label (e.g. `--minor --pre beta`):
      // apply label on top of the bumped base.
      const nextBase = bumpOptions[args.requestedBump];
      bumpOptions.preRelease = computePreRelease(nextBase, args.preLabel);
    } else {
      // `--pre <label>` alone: increment / restart pre-release train on the
      // current version (no base bump).
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
      noPush:             args.noPush,
      changelog:          changelogEnabled, // resolved: config.changelog OR --changelog CLI flag
      preLabel:           args.preLabel,
      hotfix:             args.hotfix,
      auto:               args.auto,
      // Provenance fields (R16): downstream skill (version-sdlc SKILL.md) uses
      // these to decide whether the breaking-change warning (R3) applies.
      // Any pre-release source means "skip the warn".
      bumpFromLabel:      args.bumpFromLabel,
      preLabelExplicit:   args.preLabelExplicit,
      preLabelFromConfig,
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
