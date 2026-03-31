#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { detectVersionFile } = require('./lib/version');
const { LEGACY, PROJECT_CONFIG_PATH, LOCAL_CONFIG_PATH, PROJECT_SECTIONS } = require('./lib/config');
const { writeOutput } = require('./lib/output');

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
  // --- Project config (.claude/sdlc.json) ---
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

  // --- Legacy files ---
  const legacyVersionPath = path.join(projectRoot, LEGACY.version);
  const legacyShipPath = path.join(projectRoot, LEGACY.ship);
  const legacyJiraPath = path.join(projectRoot, LEGACY.jira);
  const legacyReviewSdlcPath = path.join(projectRoot, LEGACY.reviewSdlc);
  const legacyReviewClaudePath = path.join(projectRoot, LEGACY.reviewClaude);

  // --- Content files ---
  const reviewDimensionsDir = path.join(projectRoot, '.claude', 'review-dimensions');
  const prTemplatePath = path.join(projectRoot, '.claude', 'pr-template.md');
  const jiraTemplatesDir = path.join(projectRoot, '.claude', 'jira-templates');

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
        count: countFiles(reviewDimensionsDir, '.yaml') + countFiles(reviewDimensionsDir, '.yml'),
        path: path.join('.claude', 'review-dimensions') + path.sep,
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
  };

  result.needsMigration =
    Object.values(result.legacy).some(l => l.exists) || misplacedSections.length > 0;

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
