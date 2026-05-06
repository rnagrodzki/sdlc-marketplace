#!/usr/bin/env node
/**
 * @file skill/setup.js
 * @description Pre-computes project state for the setup-sdlc skill: detects version
 *   files, existing config, legacy settings, and outputs a JSON manifest.
 * @skill setup-sdlc
 * @exit 0 success (JSON on stdout), 1 error
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const LIB = path.join(__dirname, '..', 'lib');

const { detectVersionFile } = require(path.join(LIB, 'version'));
const { LEGACY, PROJECT_CONFIG_PATH, LOCAL_CONFIG_PATH, PROJECT_SECTIONS } = require(path.join(LIB, 'config'));
const { writeOutput } = require(path.join(LIB, 'output'));
const { SHIP_FIELDS } = require(path.join(LIB, 'ship-fields'));
const { SETUP_SECTIONS } = require(path.join(LIB, 'setup-sections'));
const { OPENSPEC_ENRICH_VERSION } = require(path.join(__dirname, '..', 'util', 'openspec-enrich'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countFiles(dirPath, ext) {
  if (!fs.existsSync(dirPath)) return 0;
  return fs.readdirSync(dirPath).filter(f => f.endsWith(ext)).length;
}

function execSafe(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (_) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Detection logic
// ---------------------------------------------------------------------------

function detect(projectRoot) {
  // --- Project config (.sdlc/config.json — issue #231; legacy .claude/sdlc.json
  // read via lib/config.js fallback if PROJECT_CONFIG_PATH points to the new location). ---
  const unifiedPath = path.join(projectRoot, PROJECT_CONFIG_PATH);
  const unifiedExists = fs.existsSync(unifiedPath);
  let projectConfigSections = [];
  let parsedProjectConfig = null;
  if (unifiedExists) {
    try {
      parsedProjectConfig = JSON.parse(fs.readFileSync(unifiedPath, 'utf8'));
      projectConfigSections = Object.keys(parsedProjectConfig).filter(k => k !== '$schema');
    } catch (_) {
      // file exists but is not valid JSON — report it as existing with no sections
    }
  }

  // --- Local config (.sdlc/local.json) ---
  const localPath = path.join(projectRoot, LOCAL_CONFIG_PATH);
  const localExists = fs.existsSync(localPath);

  // Detect v1 ship-section shape (legacy preset/skip keys, or missing
  // top-level version stamp). Drives needsMigration so `/setup-sdlc` reports
  // the migration to the user even though readLocalConfig will run it
  // automatically on next read.
  let localIsV1 = false;
  if (localExists) {
    try {
      const parsed = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      const hasLegacyShipKeys =
        parsed.ship && (
          Object.prototype.hasOwnProperty.call(parsed.ship, 'preset') ||
          Object.prototype.hasOwnProperty.call(parsed.ship, 'skip')
        );
      const noVersion = parsed.version == null;
      localIsV1 = hasLegacyShipKeys || (noVersion && !!parsed.ship);
    } catch (_) {
      // unreadable JSON — leave localIsV1 false; downstream tooling handles errors
    }
  }

  // --- Legacy files ---
  const legacyVersionPath = path.join(projectRoot, LEGACY.version);
  const legacyShipPath = path.join(projectRoot, LEGACY.ship);
  const legacyJiraPath = path.join(projectRoot, LEGACY.jira);
  const legacyReviewSdlcPath = path.join(projectRoot, LEGACY.reviewSdlc);
  const legacyReviewClaudePath = path.join(projectRoot, LEGACY.reviewClaude);

  // --- Content files ---
  const reviewDimensionsDir = path.join(projectRoot, '.sdlc', 'review-dimensions');
  const prTemplatePath = path.join(projectRoot, '.claude', 'pr-template.md');
  const jiraTemplatesDir = path.join(projectRoot, '.claude', 'jira-templates');

  // --- OpenSpec config detection ---
  const openspecConfigPath = path.join(projectRoot, 'openspec', 'config.yaml');
  const openspecConfigExists = fs.existsSync(openspecConfigPath);
  let openspecManagedBlockVersion = null;
  if (openspecConfigExists) {
    try {
      const configContent = fs.readFileSync(openspecConfigPath, 'utf8');
      const beginMatch = /^# BEGIN MANAGED BY sdlc-utilities \(v(\d+)\)$/m.exec(configContent);
      if (beginMatch) {
        openspecManagedBlockVersion = parseInt(beginMatch[1], 10);
      }
    } catch (_) {
      // file exists but unreadable — report exists with null version
    }
  }

  // --- Version file detection ---
  const versionResult = detectVersionFile(projectRoot);
  let detectedVersionFile = null;
  let detectedFileType = null;
  if (versionResult) {
    // filePath is absolute; compute relative path for display
    detectedVersionFile = path.relative(projectRoot, versionResult.filePath);
    detectedFileType = versionResult.fileType;
  }

  // --- Tag prefix detection ---
  let tagPrefix = 'v';
  const latestTag = execSafe('git tag --list --sort=-version:refname | head -1');
  if (latestTag) {
    const prefixMatch = latestTag.match(/^([^0-9]*)/);
    tagPrefix = prefixMatch ? prefixMatch[1] : '';
  }

  // --- Default branch detection ---
  let defaultBranch = execSafe(
    "git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'"
  );
  if (!defaultBranch) {
    defaultBranch = 'main';
  }

  // ---------------------------------------------------------------------------
  // Assemble output
  // ---------------------------------------------------------------------------

  const misplacedSections = projectConfigSections.filter(s => !PROJECT_SECTIONS.has(s));

  const result = {
    projectConfig: {
      exists: unifiedExists,
      sections: projectConfigSections,
      misplaced: misplacedSections,
      path: PROJECT_CONFIG_PATH,
    },
    localConfig: {
      exists: localExists,
      path: LOCAL_CONFIG_PATH,
    },
    legacy: {
      version: { exists: fs.existsSync(legacyVersionPath), path: LEGACY.version },
      ship:    { exists: fs.existsSync(legacyShipPath),    path: LEGACY.ship    },
      review:  { exists: fs.existsSync(legacyReviewSdlcPath),   path: LEGACY.reviewSdlc   },
      reviewLegacy: { exists: fs.existsSync(legacyReviewClaudePath), path: LEGACY.reviewClaude },
      jira:    { exists: fs.existsSync(legacyJiraPath),    path: LEGACY.jira    },
    },
    content: {
      reviewDimensions: {
        count: countFiles(reviewDimensionsDir, '.md'),
        path: path.join('.sdlc', 'review-dimensions') + path.sep,
      },
      prTemplate: {
        exists: fs.existsSync(prTemplatePath),
        path: path.join('.claude', 'pr-template.md'),
      },
      jiraTemplates: {
        count: countFiles(jiraTemplatesDir, '.md'),
        path: path.join('.claude', 'jira-templates') + path.sep,
      },
      planGuardrails: {
        count: Array.isArray(parsedProjectConfig?.plan?.guardrails)
          ? parsedProjectConfig.plan.guardrails.length
          : 0,
      },
    },
    detected: {
      versionFile: detectedVersionFile,
      fileType: detectedFileType,
      tagPrefix,
      defaultBranch,
    },
    openspecConfig: {
      exists: openspecConfigExists,
      path: path.join('openspec', 'config.yaml'),
      managedBlockVersion: openspecManagedBlockVersion,
    },
    shipFields: SHIP_FIELDS,
  };

  result.needsMigration =
    Object.values(result.legacy).some(l => l.exists) ||
    misplacedSections.length > 0 ||
    localIsV1;
  result.localIsV1 = localIsV1;

  // ---------------------------------------------------------------------------
  // sections[] — joined view of SETUP_SECTIONS × detect() state. Drives the
  // selective-section menu in setup-sdlc/SKILL.md Step 1 and the verbose
  // dispatch loop in Step 3. See lib/setup-sections.js for the manifest.
  // Existing top-level keys above are preserved for back-compat.
  // ---------------------------------------------------------------------------

  // Read local config once (parsed) so summarize() can render set-state rows.
  let parsedLocalConfig = null;
  if (localExists) {
    try {
      parsedLocalConfig = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    } catch (_) { /* unreadable — leave null */ }
  }

  // Build a detected-context object for summarize() consumers. The leading
  // underscore on _parsedProjectConfig signals "internal — not part of the
  // P-field contract" but it is still serialized in the JSON output, which is
  // fine because summarize() runs server-side here, not in the LLM.
  const detectedContext = {
    versionFile: detectedVersionFile,
    fileType: detectedFileType,
    tagPrefix,
    defaultBranch,
    content: result.content,
    openspecConfig: result.openspecConfig,
    _parsedProjectConfig: parsedProjectConfig,
  };

  // Resolve current config slice for a given section, used as `summarize(cfg, detected)`.
  function currentCfgFor(section) {
    if (section.configFile === '.sdlc/config.json' && section.configPath) {
      // Walk dot-path. `plan.guardrails`, `execute.guardrails` need split.
      let cfg = parsedProjectConfig;
      if (!cfg) return null;
      for (const key of section.configPath.split('.')) {
        cfg = cfg?.[key];
        if (cfg == null) return null;
      }
      return cfg;
    }
    if (section.configFile === '.sdlc/local.json' && section.configPath) {
      return parsedLocalConfig?.[section.configPath] ?? null;
    }
    // Delegated/content sections — no direct config slice; summarize reads detected
    return null;
  }

  // Compute state: 'set' | 'not-set' | 'legacy'
  function computeState(section) {
    // Legacy detection per section
    if (section.id === 'version' && result.legacy.version.exists) return 'legacy';
    if (section.id === 'ship') {
      if (result.legacy.ship.exists) return 'legacy';
      if (localIsV1) return 'legacy';
    }
    if (section.id === 'review') {
      if (result.legacy.review.exists || result.legacy.reviewLegacy.exists) return 'legacy';
      if (localIsV1) return 'legacy';
    }
    if (section.id === 'jira' && result.legacy.jira.exists) return 'legacy';
    if (section.id === 'openspec-block') {
      // Legacy when managed block version is set but below the current plugin-shipped
      // version (OPENSPEC_ENRICH_VERSION from util/openspec-enrich.js). Keep this
      // conservative — a false 'set' is safer than a false 'legacy'; the user can
      // re-run with --force anyway.
      const v = result.openspecConfig.managedBlockVersion;
      if (v != null && v < OPENSPEC_ENRICH_VERSION) return 'legacy';
    }
    // Misplaced section in project config (e.g., `ship` keyed at project level)
    if (misplacedSections.includes(section.id)) return 'legacy';

    // Set detection
    if (section.configFile === '.sdlc/config.json') {
      // Top-level key for simple sections (version, jira, commit, pr); nested
      // for plan-guardrails (plan.guardrails) and execution-guardrails
      // (execute.guardrails).
      if (section.configPath) {
        const slice = currentCfgFor(section);
        if (slice != null) {
          // For arrays (guardrails), require length > 0 to count as set
          if (Array.isArray(slice)) return slice.length > 0 ? 'set' : 'not-set';
          return 'set';
        }
      }
    }
    if (section.configFile === '.sdlc/local.json') {
      if (parsedLocalConfig?.[section.configPath] != null) return 'set';
    }
    // Content/delegated sections
    if (section.id === 'review-dimensions') {
      return result.content.reviewDimensions.count > 0 ? 'set' : 'not-set';
    }
    if (section.id === 'pr-template') {
      return result.content.prTemplate.exists ? 'set' : 'not-set';
    }
    if (section.id === 'openspec-block') {
      return result.openspecConfig.managedBlockVersion != null ? 'set' : 'not-set';
    }
    return 'not-set';
  }

  // Locked: row cannot be unchecked when migration applies and this section is
  // a migration trigger. The user must run migration; the menu auto-selects it.
  function computeLocked(section, state) {
    if (!result.needsMigration) return false;
    return state === 'legacy';
  }

  result.sections = SETUP_SECTIONS.map(section => {
    const state = computeState(section);
    const cfg = currentCfgFor(section);
    let summary = '';
    try {
      summary = section.summarize(cfg, detectedContext) || '';
    } catch (err) {
      process.stderr.write(`[setup.js] summarize() failed for section "${section.id}": ${err.message}\n`);
      summary = '';
    }
    return {
      id: section.id,
      label: section.label,
      state,
      summary,
      locked: computeLocked(section, state),
      purpose: section.purpose,
      configFile: section.configFile,
      configPath: section.configPath,
      consumedBy: section.consumedBy,
      filesModified: section.filesModified,
      optional: section.optional,
      delegatedTo: section.delegatedTo,
      confirmDetected: section.confirmDetected || false,
      fields: section.fields,
    };
  });

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (require.main === module) {
  try {
    const projectRoot = process.cwd();
    const result = detect(projectRoot);
    writeOutput(result, 'setup-prepare', 0);
  } catch (err) {
    process.stderr.write(`setup-prepare: unexpected error: ${err.message}\n`);
    process.exit(2);
  }
}

module.exports = { detect };
