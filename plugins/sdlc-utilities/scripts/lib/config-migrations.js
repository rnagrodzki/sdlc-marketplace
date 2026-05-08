'use strict';

// ---------------------------------------------------------------------------
// config-migrations.js — ordered registry of schema migration steps.
//
// Two arrays:
//   - PROJECT_MIGRATIONS — steps for the project config (.sdlc/config.json)
//   - LOCAL_MIGRATIONS   — steps for the local config   (.sdlc/local.json)
//
// Each step:
//   { from: <int>, to: <int>, run: <fn(ctx)>, rollback?: <fn(ctx)> }
//
// `run(ctx)` is invoked with:
//   { projectRoot, role, paths: { newPath, legacyPath, ... },
//     readJsonFile, writeJsonFile }
//
// Steps must be idempotent — re-running the same step on already-migrated
// content must not corrupt the file.
//
// Implements issue #231 (relocation step) and issue #232 (schema versioning).
// ---------------------------------------------------------------------------

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Project migrations
// ---------------------------------------------------------------------------

/**
 * v0 → v3: relocate legacy `.claude/sdlc.json` to `.sdlc/config.json`.
 *
 * Behavior:
 *   - If legacy file exists, copy contents to new path.
 *   - Stamp `schemaVersion: 3` on the new file (final stamp is applied by
 *     verifyAndMigrate after the chain completes; this step writes whatever
 *     value happens to be there from legacy).
 *   - The backup `.claude/sdlc.json.bak` is written by verifyAndMigrate
 *     before this step runs (per R-layout-6).
 *   - The legacy file is removed by cleanupLegacyClaudeFiles (R-layout-9) after relocation.
 *
 * Idempotency: if the new file already exists and has content, do nothing.
 * (verifyAndMigrate will only call this when detection found the legacy
 * file — but defence-in-depth.)
 *
 * Rollback: delete the new file (the legacy file was untouched, so nothing
 * to restore).
 */
function relocateProjectConfig(ctx) {
  const { paths, readJsonFile, writeJsonFile } = ctx;

  // Read legacy data.
  if (!paths.legacyPath || !fs.existsSync(paths.legacyPath)) {
    // Nothing to relocate. Create an empty new file so the final stamp has
    // somewhere to land.
    if (!fs.existsSync(paths.newPath)) {
      writeJsonFile(paths.newPath, {});
    }
    return;
  }

  const legacyData = readJsonFile(paths.legacyPath) || {};

  // Defence-in-depth: if new file already exists with content, prefer it.
  // (verifyAndMigrate's detection should have prevented entry to this step
  // in that case, but never overwrite real content.)
  if (fs.existsSync(paths.newPath)) {
    const existing = readJsonFile(paths.newPath);
    if (existing && Object.keys(existing).length > 0) {
      return; // Idempotent no-op.
    }
  }

  // Copy legacy → new. Drop $schema (it embeds the legacy URL; the new file
  // will have its own URL re-stamped by lib/config.js writes downstream).
  const { $schema: _droppedSchema, ...rest } = legacyData;
  writeJsonFile(paths.newPath, rest);
}

function cleanupRelocation(ctx) {
  const { paths } = ctx;
  // Only delete the new file if legacy still exists. If legacy is gone, we
  // just lost the only copy — don't delete.
  if (paths.legacyPath && fs.existsSync(paths.legacyPath) && fs.existsSync(paths.newPath)) {
    try { fs.unlinkSync(paths.newPath); } catch (_) { /* best-effort */ }
  }
}

/**
 * v3 → v4: project-config no-op. The v3→v4 LOCAL migration adds the
 * `verify-pipeline` / `await-remote-review` step entries and renames
 * `awaitReview*` tunable keys (issue #130). Project configs do not carry
 * those fields — they are local-only — but the global
 * `CURRENT_SCHEMA_VERSION` constant covers both roles, so the project
 * registry needs a v3→v4 step that simply stamps the new version.
 *
 * Idempotent: safe to call against any object shape; only mutates the
 * `schemaVersion` field.
 */
function noopProjectV3ToV4(ctx) {
  const { paths, readJsonFile, writeJsonFile } = ctx;
  if (!fs.existsSync(paths.newPath)) return;
  const data = readJsonFile(paths.newPath);
  if (!data || typeof data !== 'object') return;
  data.schemaVersion = 4;
  writeJsonFile(paths.newPath, data);
}

const PROJECT_MIGRATIONS = [
  { from: 0, to: 3, run: relocateProjectConfig, rollback: cleanupRelocation },
  { from: 3, to: 4, run: noopProjectV3ToV4 },
];

// ---------------------------------------------------------------------------
// Local migrations
// ---------------------------------------------------------------------------

// PRESET_TO_STEPS map duplicated locally to avoid pulling in lib/config.js
// (circular dependency hazard during T6). Keep in sync with lib/config.js.
const PRESET_TO_STEPS = {
  full:     ['execute', 'commit', 'review', 'version', 'archive-openspec', 'pr', 'learnings-commit'],
  balanced: ['execute', 'commit', 'review',            'archive-openspec', 'pr', 'learnings-commit'],
  minimal:  ['execute', 'commit',                                          'pr', 'learnings-commit'],
  A:        ['execute', 'commit', 'review', 'version', 'archive-openspec', 'pr', 'learnings-commit'],
  B:        ['execute', 'commit', 'review',            'archive-openspec', 'pr', 'learnings-commit'],
  C:        ['execute', 'commit',                                          'pr', 'learnings-commit'],
};

const ALL_STEPS = ['execute', 'commit', 'review', 'version', 'archive-openspec', 'pr', 'learnings-commit'];

/**
 * v1 → v2: ship.preset/skip → ship.steps[].
 *
 * Extracted verbatim from the existing `migrateShipSectionV1ToV2` in
 * `lib/config.js`. The behavior is identical: expand a legacy preset value
 * into the canonical step list, subtract any legacy `skip[]` members, and
 * delete the `preset` and `skip` keys.
 */
function shipPresetSkipToSteps(ctx) {
  const { paths, readJsonFile, writeJsonFile } = ctx;
  if (!fs.existsSync(paths.newPath)) return;

  const data = readJsonFile(paths.newPath);
  if (!data || typeof data !== 'object') return;

  const ship = data.ship;
  if (!ship || typeof ship !== 'object') {
    // No ship section — just stamp version: 2 so subsequent steps see a
    // clean shape. The final schemaVersion stamp lands later.
    data.version = 2;
    writeJsonFile(paths.newPath, data);
    return;
  }

  const hasPreset = Object.prototype.hasOwnProperty.call(ship, 'preset');
  const hasSkip   = Object.prototype.hasOwnProperty.call(ship, 'skip');

  if (!hasPreset && !hasSkip) {
    // Already clean; just stamp.
    data.version = 2;
    writeJsonFile(paths.newPath, data);
    return;
  }

  const presetKey = typeof ship.preset === 'string' ? ship.preset : undefined;
  let steps = PRESET_TO_STEPS[presetKey] ? PRESET_TO_STEPS[presetKey].slice() : ALL_STEPS.slice();

  if (Array.isArray(ship.skip)) {
    const skipSet = new Set(ship.skip);
    steps = steps.filter(s => !skipSet.has(s));
  }

  const { preset: _droppedPreset, skip: _droppedSkip, ...restShip } = ship;
  data.ship = { ...restShip, steps };
  data.version = 2;
  writeJsonFile(paths.newPath, data);
}

/**
 * v2 → v3: rename top-level `version` → `schemaVersion`.
 *
 * The rename IS the migration — there is no alias kept. Any reader that
 * sees `version: 2` after this step ran is reading a half-migrated file.
 */
function renameVersionToSchemaVersion(ctx) {
  const { paths, readJsonFile, writeJsonFile } = ctx;
  if (!fs.existsSync(paths.newPath)) return;

  const data = readJsonFile(paths.newPath);
  if (!data || typeof data !== 'object') return;

  // If schemaVersion already present, this is idempotent — drop legacy version.
  if (typeof data.schemaVersion === 'number') {
    if (typeof data.version === 'number') {
      delete data.version;
      writeJsonFile(paths.newPath, data);
    }
    return;
  }

  // Rename version → schemaVersion. Final stamp is applied by verifyAndMigrate.
  if (typeof data.version === 'number') {
    data.schemaVersion = data.version;
    delete data.version;
    writeJsonFile(paths.newPath, data);
  }
}

/**
 * v3 → v4: rewrite legacy boolean ship-config flags into entries in
 * `ship.steps[]` and rename `awaitReview*` tunable keys.
 *
 * Behavior (per docs/specs/ship-sdlc.md R-config-version):
 *   1. If ship.verifyPipeline === true and 'verify-pipeline' is not already
 *      in ship.steps[], append it. Always delete ship.verifyPipeline.
 *   2. If ship.awaitReview === true and 'await-remote-review' is not already
 *      in ship.steps[], append it. Always delete ship.awaitReview.
 *   3. Rename ship.awaitReviewTimeout → ship.awaitRemoteReviewTimeout
 *      (preserve value); same for awaitReviewInterval and awaitReviewers.
 *   4. Stamp data.schemaVersion = 4 (final stamp re-applied by
 *      verifyAndMigrate post-chain).
 *
 * Idempotent: when no legacy keys are present, the function only stamps the
 * schemaVersion (which verifyAndMigrate also writes — but a second write of
 * an unchanged value is harmless).
 */
function migrateAwaitReviewBooleansToSteps(ctx) {
  const { paths, readJsonFile, writeJsonFile } = ctx;
  if (!fs.existsSync(paths.newPath)) return;

  const data = readJsonFile(paths.newPath);
  if (!data || typeof data !== 'object') return;

  const ship = data.ship;
  if (!ship || typeof ship !== 'object') {
    data.schemaVersion = 4;
    writeJsonFile(paths.newPath, data);
    return;
  }

  const existingSteps = Array.isArray(ship.steps) ? ship.steps.slice() : [];

  if (ship.verifyPipeline === true && !existingSteps.includes('verify-pipeline')) {
    existingSteps.push('verify-pipeline');
  }
  delete ship.verifyPipeline;

  if (ship.awaitReview === true && !existingSteps.includes('await-remote-review')) {
    existingSteps.push('await-remote-review');
  }
  delete ship.awaitReview;

  if (existingSteps.length > 0 || Array.isArray(ship.steps)) {
    ship.steps = existingSteps;
  }

  // Rename awaitReview* tunables → awaitRemoteReview*. Preserve values.
  if (Object.prototype.hasOwnProperty.call(ship, 'awaitReviewTimeout')) {
    ship.awaitRemoteReviewTimeout = ship.awaitReviewTimeout;
    delete ship.awaitReviewTimeout;
  }
  if (Object.prototype.hasOwnProperty.call(ship, 'awaitReviewInterval')) {
    ship.awaitRemoteReviewInterval = ship.awaitReviewInterval;
    delete ship.awaitReviewInterval;
  }
  if (Object.prototype.hasOwnProperty.call(ship, 'awaitReviewers')) {
    ship.awaitRemoteReviewers = ship.awaitReviewers;
    delete ship.awaitReviewers;
  }

  data.schemaVersion = 4;
  writeJsonFile(paths.newPath, data);
}

const LOCAL_MIGRATIONS = [
  { from: 1, to: 2, run: shipPresetSkipToSteps },
  { from: 2, to: 3, run: renameVersionToSchemaVersion },
  { from: 3, to: 4, run: migrateAwaitReviewBooleansToSteps },
];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  PROJECT_MIGRATIONS,
  LOCAL_MIGRATIONS,
  // Exposed for tests
  PRESET_TO_STEPS,
  ALL_STEPS,
  relocateProjectConfig,
  cleanupRelocation,
  noopProjectV3ToV4,
  shipPresetSkipToSteps,
  renameVersionToSchemaVersion,
  migrateAwaitReviewBooleansToSteps,
};
