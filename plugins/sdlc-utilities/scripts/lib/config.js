'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_CONFIG_PATH = path.join('.claude', 'sdlc.json');
const LOCAL_CONFIG_PATH = path.join('.sdlc', 'local.json');

const PROJECT_SCHEMA_URL =
  'https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-config.schema.json';
const LOCAL_SCHEMA_URL =
  'https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-local.schema.json';

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
 * Write an object as pretty-printed JSON, creating parent directories as needed.
 */
function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
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
  const localData = readJsonFile(localPath);

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
const PROJECT_SECTIONS = new Set(['version', 'jira', 'commit', 'pr']);

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
  const merged = { ...existing, ...config, $schema: LOCAL_SCHEMA_URL };
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
    if (existingLocal?.ship) {
      conflicts.push(LEGACY.ship);
    } else {
      writeLocalConfig(projectRoot, { ship: section });
      migrated.push(LEGACY.ship);
      shipMigrated = true;
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
  // Exposed for testing
  PROJECT_CONFIG_PATH,
  LOCAL_CONFIG_PATH,
  LEGACY,
  PROJECT_SCHEMA_URL,
  LOCAL_SCHEMA_URL,
  PROJECT_SECTIONS,
};
