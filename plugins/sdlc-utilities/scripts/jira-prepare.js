#!/usr/bin/env node
/**
 * jira-prepare.js
 * Cache and template management for the jira-sdlc skill.
 * Stores per-project Jira metadata (cloudId, issue types, field schemas,
 * workflow graphs, user mappings) to eliminate repeated discovery calls.
 *
 * Usage:
 *   node jira-prepare.js --project <KEY> [--cache-dir <path>] [subcommand]
 *
 * Subcommands:
 *   --check          Report cache + template status (default)
 *   --load           Output full cache JSON
 *   --save           Read JSON from stdin, write as cache
 *   --save-field <n> Read JSON from stdin, merge into cache[n]
 *   --templates      Resolve templates per issue type
 *   --init-templates Copy defaults to .claude/jira-templates/
 *   --clear          Delete cache file
 *
 * Exit codes: 0 = success, 1 = user error, 2 = crash
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { writeOutput } = require('./lib/output');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let projectKey    = null;
  let cacheDir      = path.join(process.cwd(), '.sdlc', 'jira-cache');
  let templatesDir  = null;
  let subcommand    = 'check';
  let saveFieldName = null;
  let copyType      = null;
  let copyFrom      = null;
  const errors      = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--project' && args[i + 1]) {
      projectKey = args[++i].toUpperCase();
    } else if (a === '--cache-dir' && args[i + 1]) {
      cacheDir = args[++i];
    } else if (a === '--templates-dir' && args[i + 1]) {
      templatesDir = args[++i];
    } else if (a === '--check') {
      subcommand = 'check';
    } else if (a === '--load') {
      subcommand = 'load';
    } else if (a === '--save') {
      subcommand = 'save';
    } else if (a === '--save-field' && args[i + 1]) {
      subcommand    = 'save-field';
      saveFieldName = args[++i];
    } else if (a === '--templates') {
      subcommand = 'templates';
    } else if (a === '--init-templates') {
      subcommand = 'init-templates';
    } else if (a === '--clear') {
      subcommand = 'clear';
    } else if (a === '--copy-template') {
      subcommand = 'copy-template';
    } else if (a === '--type' && args[i + 1]) {
      copyType = args[++i];
    } else if (a === '--from' && args[i + 1]) {
      copyFrom = args[++i];
    }
  }

  if (!projectKey) {
    errors.push('--project <KEY> is required');
  }

  return { projectKey, cacheDir, templatesDir, subcommand, saveFieldName, copyType, copyFrom, errors };
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function getCachePath(projectKey, cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const gitignorePath = path.join(cacheDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '*\n', 'utf8');
  }
  return path.join(cacheDir, `${projectKey}.json`);
}

function findPluginInstalls() {
  const pluginsRoot = path.join(os.homedir(), '.claude', 'plugins');
  const results     = [];

  function walk(dir, depth) {
    if (depth > 6) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === 'templates' && dir.endsWith('jira-sdlc')) {
        results.push(full);
      } else {
        walk(full, depth + 1);
      }
    }
  }

  walk(pluginsRoot, 0);
  return results;
}

function resolveTemplatesDir(overridePath) {
  if (overridePath) return overridePath;

  const installs = findPluginInstalls();
  if (installs.length > 0) return installs[0];

  return path.join(process.cwd(), 'plugins', 'sdlc-utilities', 'skills', 'jira-sdlc', 'templates');
}

// ---------------------------------------------------------------------------
// Stdin reader
// ---------------------------------------------------------------------------

function readStdin() {
  try {
    return fs.readFileSync('/dev/stdin', 'utf8');
  } catch (err) {
    writeOutput({ errors: [`Failed to read stdin: ${err.message}`] }, 'jira-context', 1);
  }
}

// ---------------------------------------------------------------------------
// Template resolution
// ---------------------------------------------------------------------------

function resolveTemplateStatus(projectKey, cachePath, templatesDir) {
  let issueTypes = [];
  if (fs.existsSync(cachePath)) {
    try {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (cache.issueTypes && typeof cache.issueTypes === 'object') {
        issueTypes = Object.keys(cache.issueTypes);
      }
    } catch (_) { /* ignore parse errors */ }
  }

  const customDir = path.join(process.cwd(), '.claude', 'jira-templates');

  // Collect all available default template names (without .md)
  let defaultTemplateNames = [];
  try {
    defaultTemplateNames = fs.readdirSync(templatesDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.slice(0, -3));
  } catch (_) { /* templates dir may not exist */ }

  const customTemplates  = {};
  const resolved         = {};

  for (const issueType of issueTypes) {
    const customPath = path.join(customDir, `${issueType}.md`);
    const customExists = fs.existsSync(customPath);
    customTemplates[issueType] = { path: customPath, exists: customExists };

    if (customExists) {
      resolved[issueType] = 'custom';
    } else if (defaultTemplateNames.includes(issueType)) {
      resolved[issueType] = 'default';
    } else {
      resolved[issueType] = 'none';
    }
  }

  return {
    issueTypes,
    customTemplates,
    defaultTemplates: defaultTemplateNames,
    resolved,
  };
}

// ---------------------------------------------------------------------------
// Subcommand: --check
// ---------------------------------------------------------------------------

function checkCache(cachePath, templatesDir, projectKey) {
  if (!fs.existsSync(cachePath)) {
    const legacyPath = path.join(process.cwd(), '.claude', 'jira-cache', `${projectKey}.json`);
    if (fs.existsSync(legacyPath)) {
      process.stderr.write('Warning: .claude/jira-cache/ is deprecated. Cache will be written to .sdlc/jira-cache/ on next refresh.\n');
      cachePath = legacyPath;
    } else {
      writeOutput({
        exists:     false,
        fresh:      false,
        projectKey,
        cachePath,
        missing:    ['all'],
        errors:     [],
        warnings:   [],
      }, 'jira-context', 0);
      return;
    }
  }

  let cache;
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch (err) {
    writeOutput({
      exists:     true,
      fresh:      false,
      projectKey,
      cachePath,
      missing:    ['all'],
      errors:     [`Cache file is not valid JSON: ${err.message}`],
      warnings:   [],
    }, 'jira-context', 0);
    return;
  }

  const maxAgeHours = typeof cache.maxAgeHours === 'number' ? cache.maxAgeHours : 0;
  let ageHours      = null;
  let fresh         = false;

  if (cache.lastUpdated) {
    const updatedMs = new Date(cache.lastUpdated).getTime();
    if (!isNaN(updatedMs)) {
      ageHours = (Date.now() - updatedMs) / (1000 * 60 * 60);
      fresh    = maxAgeHours === 0 ? true : ageHours < maxAgeHours;
    }
  }

  // Section presence checks
  const issueTypes     = cache.issueTypes && typeof cache.issueTypes === 'object' ? cache.issueTypes : null;
  const fieldSchemas   = cache.fieldSchemas && typeof cache.fieldSchemas === 'object' ? cache.fieldSchemas : null;
  const workflows      = cache.workflows && typeof cache.workflows === 'object' ? cache.workflows : null;
  const linkTypes      = Array.isArray(cache.linkTypes) ? cache.linkTypes : null;
  const userMappings   = cache.userMappings && typeof cache.userMappings === 'object' ? cache.userMappings : null;

  const issueTypeNames = issueTypes ? Object.keys(issueTypes) : [];

  // Workflow completeness
  let issueTypesWithWorkflows = 0;
  const incompleteWorkflows   = [];
  if (workflows) {
    issueTypesWithWorkflows = Object.keys(workflows).length;
    for (const typeName of issueTypeNames) {
      if (!workflows[typeName]) incompleteWorkflows.push(typeName);
    }
  } else {
    incompleteWorkflows.push(...issueTypeNames);
  }

  const sections = {
    cloudId: {
      present: Boolean(cache.cloudId),
    },
    currentUser: {
      present: Boolean(cache.currentUser),
    },
    project: {
      present: Boolean(cache.project),
    },
    issueTypes: {
      present: Boolean(issueTypes),
      count:   issueTypeNames.length,
    },
    fieldSchemas: {
      present:               Boolean(fieldSchemas),
      issueTypesWithSchemas: fieldSchemas ? Object.keys(fieldSchemas).length : 0,
    },
    workflows: {
      present:                  Boolean(workflows),
      issueTypesWithWorkflows,
      incomplete:               incompleteWorkflows,
    },
    linkTypes: {
      present: Boolean(linkTypes),
      count:   linkTypes ? linkTypes.length : 0,
    },
    userMappings: {
      present: Boolean(userMappings),
      count:   userMappings ? Object.keys(userMappings).length : 0,
    },
  };

  const missing = [];
  for (const [name, info] of Object.entries(sections)) {
    if (!info.present) missing.push(name);
  }

  const templateStatus = resolveTemplateStatus(projectKey, cachePath, templatesDir);
  const customTypes    = Object.entries(templateStatus.resolved)
    .filter(([, v]) => v === 'custom')
    .map(([k]) => k);
  const uncoveredTypes = Object.entries(templateStatus.resolved)
    .filter(([, v]) => v === 'none')
    .map(([k]) => k);

  const warnings = [];
  if (ageHours === null) {
    warnings.push('Cache file has no lastUpdated field; freshness cannot be determined.');
  }
  if (incompleteWorkflows.length > 0) {
    warnings.push(`Workflow data missing for issue types: ${incompleteWorkflows.join(', ')}`);
  }

  writeOutput({
    exists: true,
    fresh,
    ageHours:    ageHours !== null ? Math.round(ageHours * 100) / 100 : null,
    maxAgeHours,
    projectKey,
    cachePath,
    sections,
    templates: {
      customCount:    customTypes.length,
      defaultCount:   templateStatus.defaultTemplates.length,
      customTypes,
      uncoveredTypes,
    },
    missing,
    errors:   [],
    warnings,
  }, 'jira-context', 0);
}

// ---------------------------------------------------------------------------
// Subcommand: --load
// ---------------------------------------------------------------------------

function loadCache(cachePath, projectKey) {
  if (!fs.existsSync(cachePath)) {
    const legacyPath = path.join(process.cwd(), '.claude', 'jira-cache', `${projectKey}.json`);
    if (fs.existsSync(legacyPath)) {
      process.stderr.write('Warning: .claude/jira-cache/ is deprecated. Cache will be written to .sdlc/jira-cache/ on next refresh.\n');
      cachePath = legacyPath;
    } else {
      writeOutput({ errors: ['No cache found for project. Run cache initialization first.'] }, 'jira-context', 1);
      return;
    }
  }
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  writeOutput(cache, 'jira-context', 0);
}

// ---------------------------------------------------------------------------
// Subcommand: --save
// ---------------------------------------------------------------------------

function saveCache(cachePath) {
  const raw = readStdin();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    writeOutput({ errors: [`Invalid JSON on stdin: ${err.message}`] }, 'jira-context', 1);
    return;
  }

  const missingFields = ['version', 'cloudId', 'project'].filter(f => !(f in data));
  if (missingFields.length > 0) {
    writeOutput({ errors: [`Cache JSON is missing required fields: ${missingFields.join(', ')}`] }, 'jira-context', 1);
    return;
  }

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  writeOutput({ saved: true, cachePath }, 'jira-context', 0);
}

// ---------------------------------------------------------------------------
// Subcommand: --save-field
// ---------------------------------------------------------------------------

function saveField(cachePath, fieldName) {
  if (!fs.existsSync(cachePath)) {
    writeOutput({ errors: ['No cache found for project. Run cache initialization first.'] }, 'jira-context', 1);
    return;
  }

  const raw = readStdin();
  let incoming;
  try {
    incoming = JSON.parse(raw);
  } catch (err) {
    writeOutput({ errors: [`Invalid JSON on stdin: ${err.message}`] }, 'jira-context', 1);
    return;
  }

  let cache;
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch (err) {
    writeOutput({ errors: [`Cache file is not valid JSON: ${err.message}`] }, 'jira-context', 1);
    return;
  }

  const existing = cache[fieldName];
  if (typeof existing === 'object' && existing !== null && !Array.isArray(existing) &&
      typeof incoming === 'object' && incoming !== null && !Array.isArray(incoming)) {
    cache[fieldName] = Object.assign({}, existing, incoming);
  } else {
    cache[fieldName] = incoming;
  }

  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  writeOutput({ saved: true, field: fieldName, cachePath }, 'jira-context', 0);
}

// ---------------------------------------------------------------------------
// Subcommand: --templates
// ---------------------------------------------------------------------------

function resolveTemplates(projectKey, cachePath, templatesDir) {
  const status = resolveTemplateStatus(projectKey, cachePath, templatesDir);
  writeOutput(status, 'jira-context', 0);
}

// ---------------------------------------------------------------------------
// Subcommand: --init-templates
// ---------------------------------------------------------------------------

function initTemplates(projectKey, cachePath, templatesDir) {
  let issueTypes = [];
  if (fs.existsSync(cachePath)) {
    try {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (cache.issueTypes && typeof cache.issueTypes === 'object') {
        issueTypes = Object.keys(cache.issueTypes);
      }
    } catch (_) { /* ignore */ }
  }

  const customDir    = path.join(process.cwd(), '.claude', 'jira-templates');
  const initialized  = [];
  const skipped      = [];
  const unavailable  = [];

  fs.mkdirSync(customDir, { recursive: true });

  for (const issueType of issueTypes) {
    const dst = path.join(customDir, `${issueType}.md`);
    if (fs.existsSync(dst)) {
      skipped.push(issueType);
      continue;
    }
    const src = path.join(templatesDir, `${issueType}.md`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      initialized.push(issueType);
    } else {
      unavailable.push(issueType);
    }
  }

  writeOutput({ initialized, skipped, unavailable }, 'jira-context', 0);
}

// ---------------------------------------------------------------------------
// Subcommand: --clear
// ---------------------------------------------------------------------------

function clearCache(cachePath) {
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
  }
  writeOutput({ cleared: true, cachePath }, 'jira-context', 0);
}

// ---------------------------------------------------------------------------
// Subcommand: --copy-template
// ---------------------------------------------------------------------------

function copyTemplate(copyType, copyFrom, templatesDir) {
  const src = path.join(templatesDir, copyFrom + '.md');
  if (!fs.existsSync(src)) {
    writeOutput({ errors: [`Template source not found: ${src}`] }, 'jira-context', 1);
    return;
  }

  const dst = path.join(process.cwd(), '.claude', 'jira-templates', copyType + '.md');
  fs.mkdirSync(path.dirname(dst), { recursive: true });

  if (fs.existsSync(dst)) {
    writeOutput({ copied: false, reason: 'exists', type: copyType, destination: dst }, 'jira-context', 0);
    return;
  }

  fs.copyFileSync(src, dst);
  writeOutput({ copied: true, type: copyType, from: copyFrom, destination: dst }, 'jira-context', 0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { projectKey, cacheDir, templatesDir: templatesOverride, subcommand, saveFieldName, copyType, copyFrom, errors } = parseArgs(process.argv);

  if (errors.length > 0) {
    writeOutput({ errors }, 'jira-context', 1);
    return;
  }

  const cachePath    = getCachePath(projectKey, cacheDir);
  const templatesDir = resolveTemplatesDir(templatesOverride);

  switch (subcommand) {
    case 'check':
      checkCache(cachePath, templatesDir, projectKey);
      break;
    case 'load':
      loadCache(cachePath, projectKey);
      break;
    case 'save':
      saveCache(cachePath);
      break;
    case 'save-field':
      saveField(cachePath, saveFieldName);
      break;
    case 'templates':
      resolveTemplates(projectKey, cachePath, templatesDir);
      break;
    case 'init-templates':
      initTemplates(projectKey, cachePath, templatesDir);
      break;
    case 'clear':
      clearCache(cachePath);
      break;
    case 'copy-template':
      copyTemplate(copyType, copyFrom, templatesDir);
      break;
    default:
      writeOutput({ errors: [`Unknown subcommand: ${subcommand}`] }, 'jira-context', 1);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`jira-prepare.js error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
  }
}

module.exports = {
  parseArgs,
  getCachePath,
  resolveTemplatesDir,
  checkCache,
  loadCache,
  saveCache,
  saveField,
  resolveTemplates,
  initTemplates,
  clearCache,
  copyTemplate,
};
