'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_CONFIG_PATH = path.join('.claude', 'sdlc.json');
const LOCAL_CONFIG_PATH = path.join('.sdlc', 'local.json');

const PROJECT_SCHEMA_URL =
  'https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-config.schema.json';
const LOCAL_SCHEMA_URL =
  'https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-local.schema.json';

const PRESET_NAMES = ['full', 'balanced', 'minimal'];
const LEGACY_PRESET_MAP = { A: 'full', B: 'balanced', C: 'minimal' };

// Current schema version of .sdlc/local.json. Incremented when a
// format-breaking change is introduced; readLocalConfig auto-migrates
// older versions in place.
const LOCAL_SCHEMA_VERSION = 2;

// Migration map (v1 → v2): legacy ship.preset values → canonical steps[].
// `balanced` omits 'version' by design (current pre-v2 default behavior).
// Legacy A/B/C aliases map to the same step lists as their modern equivalents.
const PRESET_TO_STEPS = {
  full:     ['execute', 'commit', 'review', 'version', 'pr', 'archive-openspec'],
  balanced: ['execute', 'commit', 'review',            'pr', 'archive-openspec'],
  minimal:  ['execute', 'commit',                      'pr'],
  A:        ['execute', 'commit', 'review', 'version', 'pr', 'archive-openspec'],
  B:        ['execute', 'commit', 'review',            'pr', 'archive-openspec'],
  C:        ['execute', 'commit',                      'pr'],
};

const ALL_STEPS = ['execute', 'commit', 'review', 'version', 'pr', 'archive-openspec'];

/**
 * Normalize a preset value: maps legacy A/B/C to full/balanced/minimal.
 * Unknown values pass through unchanged (validation catches them later).
 * @param {string|undefined} value
 * @returns {string|undefined}
 */
function normalizePreset(value) {
  if (typeof value !== 'string') return value;
  return LEGACY_PRESET_MAP[value.toUpperCase()] || value;
}

/**
 * Migrate a v1 ship section to v2 in place: expand legacy preset → steps[],
 * subtract legacy skip[] members, drop preset/skip keys.
 *
 * @param {object|null|undefined} rawShip — the ship section as read from disk
 * @returns {{ ship: object, changed: boolean }} — the migrated ship section
 *   and a flag indicating whether the section actually changed (used by the
 *   loader to decide whether to rewrite the file and emit the deprecation
 *   notice).
 */
function migrateShipSectionV1ToV2(rawShip) {
  if (!rawShip || typeof rawShip !== 'object') {
    // No ship section at all → nothing to migrate. Return as-is so callers
    // don't accidentally synthesize a section.
    return { ship: rawShip, changed: false };
  }

  const hasLegacyPreset = Object.prototype.hasOwnProperty.call(rawShip, 'preset');
  const hasLegacySkip   = Object.prototype.hasOwnProperty.call(rawShip, 'skip');

  if (!hasLegacyPreset && !hasLegacySkip) {
    // Already clean (v2 shape or just lacking the legacy keys) — caller
    // will leave it alone.
    return { ship: rawShip, changed: false };
  }

  const presetRaw = hasLegacyPreset ? rawShip.preset : undefined;
  const presetKey = typeof presetRaw === 'string' ? presetRaw : undefined;

  // Resolve to the canonical step list. If preset is missing or unrecognized,
  // default to all six steps (safe default — matches new-config behavior).
  let steps = PRESET_TO_STEPS[presetKey] ? PRESET_TO_STEPS[presetKey].slice() : ALL_STEPS.slice();

  // Subtract any legacy skip[] members (validating membership; unknown values
  // are dropped silently — the schema would have rejected them anyway).
  if (Array.isArray(rawShip.skip)) {
    const skipSet = new Set(rawShip.skip);
    steps = steps.filter(s => !skipSet.has(s));
  }

  // Build the migrated ship section. Preserve all non-legacy fields verbatim.
  const { preset: _droppedPreset, skip: _droppedSkip, ...rest } = rawShip;
  const migrated = { ...rest, steps };

  return { ship: migrated, changed: true };
}

/** Legacy file paths relative to projectRoot. */
const LEGACY = {
  version: path.join('.claude', 'version.json'),
  ship: path.join('.sdlc', 'ship-config.json'),
  jira: path.join('.sdlc', 'jira-config.json'),
  reviewSdlc: path.join('.sdlc', 'review.json'),
  reviewClaude: path.join('.claude', 'review.json'),
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read and parse a JSON file. Returns null if the file does not exist.
 * Throws on invalid JSON.
 */
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in "${filePath}": ${err.message}`);
  }
}

/**
 * Write content to filePath atomically: write to a .tmp sibling, then rename.
 * The tmp file is placed in the same directory so fs.renameSync works across
 * same-filesystem paths without a copy.
 * @param {string} filePath  Absolute destination path
 * @param {string} content   String content to write
 */
function atomicWriteSync(filePath, content) {
  const dir    = path.dirname(filePath);
  const suffix = crypto.randomBytes(4).toString('hex');
  const tmp    = path.join(dir, path.basename(filePath) + '.' + suffix + '.tmp');
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

/**
 * Write an object as pretty-printed JSON, creating parent directories as needed.
 */
function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  atomicWriteSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Strip keys that belong to legacy per-file schemas but not to the unified section.
 */
function stripMeta(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = { ...obj };
  for (const k of keys) delete copy[k];
  return copy;
}

// ---------------------------------------------------------------------------
// readProjectConfig
// ---------------------------------------------------------------------------

/**
 * Read the unified project config (.claude/sdlc.json).
 * Falls back to merging legacy files when the unified file is absent.
 *
 * @param {string} projectRoot
 * @returns {{ config: object|null, sources: string[] }}
 */
function readProjectConfig(projectRoot) {
  const unifiedPath = path.join(projectRoot, PROJECT_CONFIG_PATH);
  const unified = readJsonFile(unifiedPath);

  if (unified) {
    return { config: unified, sources: [PROJECT_CONFIG_PATH] };
  }

  // Legacy fallback — merge individual config files
  const sources = [];
  const config = {};

  // version (.claude/version.json)
  const versionPath = path.join(projectRoot, LEGACY.version);
  const versionData = readJsonFile(versionPath);
  if (versionData) {
    process.stderr.write(
      `Deprecation: ${LEGACY.version} detected. Run /setup-sdlc --migrate to consolidate into .claude/sdlc.json.\n`
    );
    config.version = stripMeta(versionData, '$schema');
    sources.push(LEGACY.version);
  }

  // jira (.sdlc/jira-config.json)
  const jiraPath = path.join(projectRoot, LEGACY.jira);
  const jiraData = readJsonFile(jiraPath);
  if (jiraData) {
    process.stderr.write(
      `Deprecation: ${LEGACY.jira} detected. Run /setup-sdlc --migrate to consolidate into .claude/sdlc.json.\n`
    );
    config.jira = stripMeta(jiraData, '$schema');
    sources.push(LEGACY.jira);
  }

  if (sources.length === 0) return { config: null, sources: [] };
  return { config, sources };
}

// ---------------------------------------------------------------------------
// readLocalConfig
// ---------------------------------------------------------------------------

/**
 * Read the local (gitignored) config (.sdlc/local.json).
 * Falls back to .sdlc/review.json, then .claude/review.json.
 *
 * @param {string} projectRoot
 * @returns {{ config: object|null, sources: string[] }}
 */
function readLocalConfig(projectRoot) {
  const localPath = path.join(projectRoot, LOCAL_CONFIG_PATH);
  let localData = readJsonFile(localPath);

  // v1 → v2 ship migration: when local.json exists, has a ship section with
  // legacy preset/skip keys, and lacks (or has stale) `version`, migrate in
  // place, persist, and emit a single deprecation notice. Idempotent — a v2
  // file with no legacy keys returns false from migrateShipSectionV1ToV2.
  if (localData && (localData.version == null || localData.version < LOCAL_SCHEMA_VERSION)) {
    const { ship: migratedShip, changed } = migrateShipSectionV1ToV2(localData.ship);
    if (changed) {
      const migratedFull = { ...localData, ship: migratedShip, version: LOCAL_SCHEMA_VERSION, $schema: LOCAL_SCHEMA_URL };
      writeJsonFile(localPath, migratedFull);
      process.stderr.write(
        `Deprecation: ${LOCAL_CONFIG_PATH} migrated from preset/skip to steps[] (schema v${LOCAL_SCHEMA_VERSION}). Run /setup-sdlc --migrate to silence this notice in future.\n`
      );
      // Re-read so subsequent code paths see the canonical on-disk shape.
      localData = readJsonFile(localPath);
    } else if (localData.version == null && localData.ship && Object.keys(localData.ship).length > 0) {
      // Edge case: ship section exists but has neither legacy keys nor
      // version stamp (e.g. only bump/draft were set). Stamp version: 2 so
      // future reads short-circuit and the file remains schema-valid.
      const stamped = { ...localData, version: LOCAL_SCHEMA_VERSION, $schema: LOCAL_SCHEMA_URL };
      writeJsonFile(localPath, stamped);
      localData = readJsonFile(localPath);
    }
  }

  // If local.json exists and has both review and ship, no fallbacks needed
  if (localData && localData.review && localData.ship) {
    return { config: localData, sources: [LOCAL_CONFIG_PATH] };
  }

  const sources = localData ? [LOCAL_CONFIG_PATH] : [];
  const config = localData ? { ...localData } : {};

  // Review fallback (only if review is missing from config)
  if (!config.review) {
    const sdlcReviewPath = path.join(projectRoot, LEGACY.reviewSdlc);
    const sdlcReview = readJsonFile(sdlcReviewPath);
    if (sdlcReview) {
      process.stderr.write(
        `Deprecation: ${LEGACY.reviewSdlc} detected. Run /setup-sdlc --migrate to consolidate into .sdlc/local.json.\n`
      );
      config.review = sdlcReview.defaults ? { ...sdlcReview.defaults } : stripMeta(sdlcReview, '$schema');
      sources.push(LEGACY.reviewSdlc);
    } else {
      const claudeReviewPath = path.join(projectRoot, LEGACY.reviewClaude);
      const claudeReview = readJsonFile(claudeReviewPath);
      if (claudeReview) {
        process.stderr.write(
          `Deprecation: ${LEGACY.reviewClaude} detected. Run /setup-sdlc --migrate to consolidate into .sdlc/local.json.\n`
        );
        config.review = claudeReview.defaults ? { ...claudeReview.defaults } : stripMeta(claudeReview, '$schema');
        sources.push(LEGACY.reviewClaude);
      }
    }
  }

  // Ship fallback (only if ship is missing from config)
  if (!config.ship) {
    // Legacy .sdlc/ship-config.json
    const shipPath = path.join(projectRoot, LEGACY.ship);
    const shipData = readJsonFile(shipPath);
    if (shipData) {
      process.stderr.write(
        `Deprecation: ${LEGACY.ship} detected. Run /setup-sdlc --migrate to consolidate into .sdlc/local.json.\n`
      );
      config.ship = stripMeta(shipData, '$schema', 'version');
      sources.push(LEGACY.ship);
    } else {
      // Fallback to .claude/sdlc.json ship key
      const projectConfigPath = path.join(projectRoot, PROJECT_CONFIG_PATH);
      const projectData = readJsonFile(projectConfigPath);
      if (projectData?.ship) {
        process.stderr.write(
          `Deprecation: ship section found in ${PROJECT_CONFIG_PATH}. Run /setup-sdlc --migrate to move it to .sdlc/local.json.\n`
        );
        config.ship = projectData.ship;
        sources.push(PROJECT_CONFIG_PATH);
      }
    }
  }

  if (sources.length === 0) return { config: null, sources: [] };
  return { config, sources };
}

// ---------------------------------------------------------------------------
// readSection
// ---------------------------------------------------------------------------

/** Sections that live in the project config vs local config. */
const PROJECT_SECTIONS = new Set(['version', 'jira', 'commit', 'pr', 'plan', 'execute']);

/**
 * Read a single config section by name.
 *
 * @param {string} projectRoot
 * @param {string} section — one of 'version', 'commit', 'jira', 'pr', 'ship', 'review'
 * @returns {object|null}
 */
function readSection(projectRoot, section) {
  if (PROJECT_SECTIONS.has(section)) {
    const { config } = readProjectConfig(projectRoot);
    return config?.[section] ?? null;
  }
  if (section === 'ship') {
    const { config } = readLocalConfig(projectRoot);
    return config?.ship ?? null;
  }
  if (section === 'review') {
    const { config } = readLocalConfig(projectRoot);
    return config?.review ?? null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// writeProjectConfig
// ---------------------------------------------------------------------------

/**
 * Write the unified project config (.claude/sdlc.json).
 * Uses read-merge-write to avoid clobbering sections written by other skills.
 *
 * @param {string} projectRoot
 * @param {object} config — partial or full config to merge
 */
function writeProjectConfig(projectRoot, config) {
  const filePath = path.join(projectRoot, PROJECT_CONFIG_PATH);
  let existing = readJsonFile(filePath) || {};
  const merged = { ...existing, ...config, $schema: PROJECT_SCHEMA_URL };
  writeJsonFile(filePath, merged);
}

// ---------------------------------------------------------------------------
// writeLocalConfig
// ---------------------------------------------------------------------------

/**
 * Write the local config (.sdlc/local.json).
 * Uses read-merge-write to avoid clobbering sections written by other skills.
 *
 * @param {string} projectRoot
 * @param {object} config — partial or full config to merge
 */
function writeLocalConfig(projectRoot, config) {
  const filePath = path.join(projectRoot, LOCAL_CONFIG_PATH);
  let existing = readJsonFile(filePath) || {};
  // Always stamp version: 2 at the top level. Caller-supplied overrides
  // are honored (so an explicit version: N still wins) but the default is
  // the current schema version. $schema URL is fixed.
  const merged = {
    ...existing,
    ...config,
    version: config.version != null ? config.version : LOCAL_SCHEMA_VERSION,
    $schema: LOCAL_SCHEMA_URL,
  };
  writeJsonFile(filePath, merged);
}

// ---------------------------------------------------------------------------
// writeSection
// ---------------------------------------------------------------------------

/**
 * Convenience: read config, update one section, write back.
 *
 * @param {string} projectRoot
 * @param {string} section — one of 'version', 'ship', 'jira', 'review'
 * @param {object} value
 */
function writeSection(projectRoot, section, value) {
  if (PROJECT_SECTIONS.has(section)) {
    writeProjectConfig(projectRoot, { [section]: value });
  } else if (section === 'ship') {
    writeLocalConfig(projectRoot, { ship: value });
  } else if (section === 'review') {
    writeLocalConfig(projectRoot, { review: value });
  }
}

// ---------------------------------------------------------------------------
// migrateConfig
// ---------------------------------------------------------------------------

/**
 * Read all legacy config files, merge into unified configs, and write them.
 * Does NOT delete legacy files — the caller decides.
 *
 * @param {string} projectRoot
 * @returns {{ migrated: string[], conflicts: string[] }}
 */
function migrateConfig(projectRoot) {
  const migrated = [];
  const conflicts = [];

  // --- Project config ---
  const projectConfig = {};
  const unifiedPath = path.join(projectRoot, PROJECT_CONFIG_PATH);
  const existingUnified = readJsonFile(unifiedPath);

  // version
  const versionPath = path.join(projectRoot, LEGACY.version);
  const versionData = readJsonFile(versionPath);
  if (versionData) {
    const section = stripMeta(versionData, '$schema');
    if (existingUnified?.version) {
      conflicts.push(LEGACY.version);
    } else {
      projectConfig.version = section;
      migrated.push(LEGACY.version);
    }
  }

  // jira
  const jiraPath = path.join(projectRoot, LEGACY.jira);
  const jiraData = readJsonFile(jiraPath);
  if (jiraData) {
    const section = stripMeta(jiraData, '$schema');
    if (existingUnified?.jira) {
      conflicts.push(LEGACY.jira);
    } else {
      projectConfig.jira = section;
      migrated.push(LEGACY.jira);
    }
  }

  if (Object.keys(projectConfig).length > 0) {
    writeProjectConfig(projectRoot, projectConfig);
  }

  // --- Local config ---
  const localPath = path.join(projectRoot, LOCAL_CONFIG_PATH);
  const existingLocal = readJsonFile(localPath);

  // review — prefer .sdlc/review.json over .claude/review.json
  let reviewSource = null;
  let reviewData = null;

  const sdlcReviewPath = path.join(projectRoot, LEGACY.reviewSdlc);
  const sdlcReview = readJsonFile(sdlcReviewPath);
  if (sdlcReview) {
    reviewSource = LEGACY.reviewSdlc;
    reviewData = sdlcReview;
  } else {
    const claudeReviewPath = path.join(projectRoot, LEGACY.reviewClaude);
    const claudeReview = readJsonFile(claudeReviewPath);
    if (claudeReview) {
      reviewSource = LEGACY.reviewClaude;
      reviewData = claudeReview;
    }
  }

  if (reviewData && reviewSource) {
    const review = reviewData.defaults ? { ...reviewData.defaults } : stripMeta(reviewData, '$schema');
    if (existingLocal?.review) {
      conflicts.push(reviewSource);
    } else {
      writeLocalConfig(projectRoot, { review });
      migrated.push(reviewSource);
    }
  }

  // ship — legacy .sdlc/ship-config.json → .sdlc/local.json
  let shipMigrated = false;
  const shipPath = path.join(projectRoot, LEGACY.ship);
  const shipData = readJsonFile(shipPath);
  if (shipData) {
    const section = stripMeta(shipData, '$schema', 'version');
    // Run v1→v2 ship-shape migration on the legacy file content too — a
    // legacy ship-config.json may carry preset/skip in its ship section.
    const { ship: migratedShipFromLegacy } = migrateShipSectionV1ToV2(section);
    if (existingLocal?.ship) {
      conflicts.push(LEGACY.ship);
    } else {
      writeLocalConfig(projectRoot, { ship: migratedShipFromLegacy });
      migrated.push(LEGACY.ship);
      shipMigrated = true;
    }
  }

  // v1 → v2 ship-shape migration: if the local file has version < 2 and
  // a ship section with legacy preset/skip keys, migrate it explicitly.
  // (readLocalConfig already does this on demand; running it here makes
  // /setup-sdlc --migrate cover the case explicitly with a migrated entry.)
  const localPathForV2 = path.join(projectRoot, LOCAL_CONFIG_PATH);
  const reloaded = readJsonFile(localPathForV2);
  if (reloaded && (reloaded.version == null || reloaded.version < LOCAL_SCHEMA_VERSION)) {
    const { ship: migratedShipReloaded, changed } = migrateShipSectionV1ToV2(reloaded.ship);
    if (changed) {
      const next = { ...reloaded, ship: migratedShipReloaded, version: LOCAL_SCHEMA_VERSION, $schema: LOCAL_SCHEMA_URL };
      writeJsonFile(localPathForV2, next);
      migrated.push(`${LOCAL_CONFIG_PATH}#v1->v2`);
    }
  }

  // ship — .claude/sdlc.json ship key → .sdlc/local.json
  if (existingUnified?.ship) {
    const localHasShip = existingLocal?.ship || shipMigrated;
    if (localHasShip) {
      conflicts.push(PROJECT_CONFIG_PATH + '#ship');
    } else {
      writeLocalConfig(projectRoot, { ship: existingUnified.ship });
      migrated.push(PROJECT_CONFIG_PATH + '#ship');
    }
    // Remove ship from project config regardless of conflict
    const { ship: _removed, ...rest } = existingUnified;
    writeJsonFile(unifiedPath, { ...rest, $schema: PROJECT_SCHEMA_URL });
  }

  return { migrated, conflicts };
}

// ---------------------------------------------------------------------------
// ensureSdlcGitignore
// ---------------------------------------------------------------------------

/**
 * Create .sdlc/ directory and .sdlc/.gitignore with content `*\n`.
 * Idempotent: if .gitignore already exists, returns 'existed'.
 *
 * @param {string} projectRoot
 * @returns {'created'|'existed'}
 */
function ensureSdlcGitignore(projectRoot) {
  const sdlcDir = path.join(projectRoot, '.sdlc');
  fs.mkdirSync(sdlcDir, { recursive: true });

  const gitignorePath = path.join(sdlcDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    return 'existed';
  }

  fs.writeFileSync(gitignorePath, '*\n', 'utf8');
  return 'created';
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  readProjectConfig,
  readLocalConfig,
  readSection,
  writeProjectConfig,
  writeLocalConfig,
  writeSection,
  migrateConfig,
  ensureSdlcGitignore,
  // Preset normalization
  normalizePreset,
  PRESET_NAMES,
  // v1 → v2 ship section migration
  PRESET_TO_STEPS,
  migrateShipSectionV1ToV2,
  LOCAL_SCHEMA_VERSION,
  // Exposed for testing
  PROJECT_CONFIG_PATH,
  LOCAL_CONFIG_PATH,
  LEGACY,
  PROJECT_SCHEMA_URL,
  LOCAL_SCHEMA_URL,
  PROJECT_SECTIONS,
};
