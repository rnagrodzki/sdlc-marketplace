#!/usr/bin/env node
/**
 * guardrails-prepare.js
 * Scans a project codebase and proposes plan guardrails based on detected signals.
 * Guardrails are constraints that plan-sdlc evaluates during its critique phases.
 *
 * Usage:
 *   node guardrails-prepare.js --project-root <path> [--mode init|add] [--json]
 *
 * Options:
 *   --project-root <path>   Project root (default: cwd)
 *   --mode init|add         init = propose all; add = filter out existing (default: init)
 *   --json                  Output JSON (always on; flag is for convention consistency)
 *
 * Exit codes: 0 = success, 1 = expected/config error, 2 = unexpected crash
 * Stdout: JSON
 * Stderr: warnings/progress
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const { readSection } = require('./lib/config');
const { writeOutput } = require('./lib/output');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let projectRoot = process.cwd();
  let mode = 'init';

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--project-root' && args[i + 1]) {
      projectRoot = path.resolve(args[++i]);
    } else if (a === '--mode' && args[i + 1]) {
      mode = args[++i];
    }
    // --json is accepted for convention; no action needed
  }

  if (mode !== 'init' && mode !== 'add') {
    process.stderr.write(`guardrails-prepare: invalid --mode "${mode}". Valid: init, add\n`);
    process.exit(1);
  }

  return { projectRoot, mode };
}

// ---------------------------------------------------------------------------
// Existing guardrails
// ---------------------------------------------------------------------------

function readExisting(projectRoot) {
  let planSection = null;
  try {
    planSection = readSection(projectRoot, 'plan');
  } catch (err) {
    return { error: `Failed to read plan config: ${err.message}`, count: 0, guardrails: [], ids: [] };
  }

  const guardrails = (planSection && Array.isArray(planSection.guardrails))
    ? planSection.guardrails
    : [];

  return {
    error: null,
    count: guardrails.length,
    guardrails,
    ids: guardrails.map(g => g.id).filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Signal detection helpers
// ---------------------------------------------------------------------------

function existsRel(projectRoot, ...parts) {
  return fs.existsSync(path.join(projectRoot, ...parts));
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return null;
  }
}

function parseJsonSafe(filePath) {
  const raw = readFileSafe(filePath);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Find first existing directory path from a list of candidates (relative to root).
 * Returns the relative path (e.g. "src/repositories/") or null.
 */
function findDir(projectRoot, ...candidates) {
  for (const rel of candidates) {
    if (existsRel(projectRoot, rel)) return rel + '/';
  }
  return null;
}

/**
 * Check whether any file at the top level of dir matches a predicate (non-recursive).
 */
function anyFileMatches(dirPath, predicate) {
  if (!fs.existsSync(dirPath)) return false;
  try {
    return fs.readdirSync(dirPath).some(predicate);
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Language & framework detection
// ---------------------------------------------------------------------------

function detectLanguagesAndFrameworks(projectRoot, signals) {
  // JavaScript / TypeScript
  const pkgPath = path.join(projectRoot, 'package.json');
  const pkg = parseJsonSafe(pkgPath);
  if (pkg) {
    const allDeps = {
      ...((pkg.dependencies) || {}),
      ...((pkg.devDependencies) || {}),
    };
    const hasTsConfig = existsRel(projectRoot, 'tsconfig.json');
    const hasTypeScriptDep = 'typescript' in allDeps;
    signals.languages.push(hasTsConfig || hasTypeScriptDep ? 'typescript' : 'javascript');

    const frameworkMap = {
      express:  'express',
      fastify:  'fastify',
      nestjs:   'nestjs',
      '@nestjs/core': 'nestjs',
      react:    'react',
      next:     'next',
      'next.js': 'next',
      nuxt:     'nuxt',
      vue:      'vue',
      angular:  'angular',
      '@angular/core': 'angular',
      svelte:   'svelte',
      hapi:     'hapi',
      koa:      'koa',
    };
    for (const [dep, framework] of Object.entries(frameworkMap)) {
      if (dep in allDeps && !signals.frameworks.includes(framework)) {
        signals.frameworks.push(framework);
      }
    }
  }

  // Go
  if (existsRel(projectRoot, 'go.mod')) {
    signals.languages.push('go');
    const goMod = readFileSafe(path.join(projectRoot, 'go.mod')) || '';
    for (const fw of ['gin', 'echo', 'fiber']) {
      if (goMod.includes(fw)) signals.frameworks.push(fw);
    }
  }

  // Rust
  if (existsRel(projectRoot, 'Cargo.toml')) {
    signals.languages.push('rust');
  }

  // Python
  if (existsRel(projectRoot, 'pyproject.toml') || existsRel(projectRoot, 'requirements.txt')) {
    signals.languages.push('python');
    const pyFiles = [
      readFileSafe(path.join(projectRoot, 'pyproject.toml')) || '',
      readFileSafe(path.join(projectRoot, 'requirements.txt')) || '',
    ].join('\n');
    for (const fw of ['django', 'flask', 'fastapi']) {
      if (pyFiles.toLowerCase().includes(fw)) signals.frameworks.push(fw);
    }
  }

  // Java
  if (existsRel(projectRoot, 'pom.xml') || existsRel(projectRoot, 'build.gradle')) {
    signals.languages.push('java');
  }
}

// ---------------------------------------------------------------------------
// Structural signal detection
// ---------------------------------------------------------------------------

function detectStructure(projectRoot, signals) {
  const dirs = signals.directories;

  // Key directories — check both root and src/
  const structuralDirs = ['controllers', 'services', 'repositories', 'middleware', 'models', 'migrations'];
  for (const d of structuralDirs) {
    const found = findDir(projectRoot, d, path.join('src', d));
    if (found) dirs[d] = found;
  }

  // ORM / database
  if (existsRel(projectRoot, 'prisma')) {
    signals.hasDatabase = true;
    signals.dbType = 'prisma';
  } else if (existsRel(projectRoot, 'alembic')) {
    signals.hasDatabase = true;
    signals.dbType = 'alembic';
  } else if (
    existsRel(projectRoot, 'knexfile.js') ||
    existsRel(projectRoot, 'knexfile.ts') ||
    existsRel(projectRoot, 'knexfile.cjs')
  ) {
    signals.hasDatabase = true;
    signals.dbType = 'knex';
  } else {
    // Check for typeorm in package.json deps
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = parseJsonSafe(pkgPath);
    if (pkg) {
      const allDeps = { ...((pkg.dependencies) || {}), ...((pkg.devDependencies) || {}) };
      if ('typeorm' in allDeps) {
        signals.hasDatabase = true;
        signals.dbType = 'typeorm';
      }
    }
  }
  // Migrations dir also implies database
  if ('migrations' in dirs && !signals.hasDatabase) {
    signals.hasDatabase = true;
    signals.dbType = 'migrations';
  }

  // API signals
  if (existsRel(projectRoot, 'openapi.yaml') || existsRel(projectRoot, 'openapi.json')) {
    signals.hasApi = true;
    signals.apiFormat = 'openapi';
  } else if (
    anyFileMatches(projectRoot, f => f.endsWith('.graphql') || f.endsWith('.gql')) ||
    existsRel(projectRoot, 'schema.graphql') ||
    existsRel(projectRoot, 'schema.gql')
  ) {
    signals.hasApi = true;
    signals.apiFormat = 'graphql';
  } else if (existsRel(projectRoot, 'routes') || existsRel(projectRoot, 'src', 'routes')) {
    signals.hasApi = true;
    signals.apiFormat = 'rest';
  }

  // Tests
  if (
    existsRel(projectRoot, 'test') ||
    existsRel(projectRoot, 'tests') ||
    existsRel(projectRoot, '__tests__')
  ) {
    signals.hasTests = true;
  }
  // Check test framework in package.json devDeps
  if (!signals.hasTests || !signals.testFramework) {
    const pkg = parseJsonSafe(path.join(projectRoot, 'package.json'));
    if (pkg) {
      const devDeps = (pkg.devDependencies) || {};
      const deps = (pkg.dependencies) || {};
      const all = { ...deps, ...devDeps };
      if ('jest' in all) { signals.hasTests = true; signals.testFramework = 'jest'; }
      else if ('vitest' in all) { signals.hasTests = true; signals.testFramework = 'vitest'; }
      else if ('mocha' in all) { signals.hasTests = true; signals.testFramework = 'mocha'; }
    }
  }
  // Go test files
  if (!signals.hasTests && signals.languages.includes('go')) {
    const hasGoTests = anyFileMatches(projectRoot, f => f.endsWith('_test.go'));
    if (hasGoTests) { signals.hasTests = true; signals.testFramework = 'go-test'; }
  }

  // CI
  const ghWorkflowsDir = path.join(projectRoot, '.github', 'workflows');
  if (
    fs.existsSync(ghWorkflowsDir) &&
    anyFileMatches(ghWorkflowsDir, f => f.endsWith('.yml') || f.endsWith('.yaml'))
  ) {
    signals.hasCi = true;
    signals.ciPlatform = 'github-actions';
  } else if (existsRel(projectRoot, 'Jenkinsfile')) {
    signals.hasCi = true;
    signals.ciPlatform = 'jenkins';
  } else if (existsRel(projectRoot, '.gitlab-ci.yml')) {
    signals.hasCi = true;
    signals.ciPlatform = 'gitlab';
  }

  // Monorepo
  if (
    existsRel(projectRoot, 'lerna.json') ||
    existsRel(projectRoot, 'pnpm-workspace.yaml') ||
    existsRel(projectRoot, 'nx.json')
  ) {
    signals.hasMonorepo = true;
  }

  // OpenSpec
  if (existsRel(projectRoot, 'openspec', 'config.yaml')) {
    signals.hasOpenSpec = true;
  }
}

// ---------------------------------------------------------------------------
// Review dimensions
// ---------------------------------------------------------------------------

function detectReviewDimensions(projectRoot, signals) {
  const dimDir = path.join(projectRoot, '.claude', 'review-dimensions');
  if (!fs.existsSync(dimDir)) return;
  try {
    const files = fs.readdirSync(dimDir);
    for (const f of files) {
      if (f.endsWith('.md')) {
        signals.reviewDimensions.push(f.replace(/\.md$/, ''));
      }
    }
  } catch (_) {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// CLAUDE.md / AGENTS.md rule extraction
// ---------------------------------------------------------------------------

const CONSTRAINT_REGEX = /\b(must|never|always|require[sd]?|forbidden|prohibited)\b/i;

function extractClaudeMdRules(projectRoot, signals) {
  const candidates = ['CLAUDE.md', 'AGENTS.md'];
  const seen = new Set();
  const rules = [];

  for (const filename of candidates) {
    const filePath = path.join(projectRoot, filename);
    const content = readFileSafe(filePath);
    if (!content) continue;
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (CONSTRAINT_REGEX.test(trimmed) && !seen.has(trimmed)) {
        seen.add(trimmed);
        rules.push(trimmed);
        if (rules.length >= 20) break;
      }
    }
    if (rules.length >= 20) break;
  }

  signals.claudeMdRules = rules;
}

// ---------------------------------------------------------------------------
// Proposal catalog
// ---------------------------------------------------------------------------

/**
 * Build proposals from detected signals.
 * @param {object} signals
 * @returns {Array<{id, description, severity, category, evidence}>}
 */
function buildProposals(signals) {
  const proposals = [];
  const dirs = signals.directories;

  const repoPath = dirs.repositories;
  const repoLabel = repoPath
    ? `the repository layer (${repoPath})`
    : 'the repository layer';

  if (signals.hasDatabase && repoPath) {
    proposals.push({
      id: 'no-direct-db-access',
      description: `All database access must go through ${repoLabel}. No direct SQL or ORM calls in controllers/handlers.`,
      severity: 'error',
      category: 'architecture',
      evidence: `Detected ${signals.dbType || 'database'} with repositories/ directory at "${repoPath}".`,
    });
  }

  if (signals.hasApi) {
    proposals.push({
      id: 'api-backward-compatibility',
      description: 'API changes must maintain backward compatibility or document breaking changes in Key Decisions.',
      severity: 'error',
      category: 'architecture',
      evidence: `Detected API (format: ${signals.apiFormat || 'unknown'}).`,
    });
  }

  if (signals.hasTests) {
    proposals.push({
      id: 'test-coverage-required',
      description: 'Every task that creates or modifies source code must include corresponding tests.',
      severity: 'error',
      category: 'testing',
      evidence: `Detected test infrastructure${signals.testFramework ? ` (${signals.testFramework})` : ''}.`,
    });
  }

  if (signals.hasDatabase) {
    proposals.push({
      id: 'database-migration-review',
      description: 'Tasks modifying database schema must be flagged as High risk.',
      severity: 'warning',
      category: 'architecture',
      evidence: `Detected ${signals.dbType || 'database'} integration.`,
    });
  }

  if (signals.hasCi) {
    proposals.push({
      id: 'no-ci-bypass',
      description: 'Plans must not include steps that skip or disable CI checks.',
      severity: 'error',
      category: 'security',
      evidence: `Detected CI platform: ${signals.ciPlatform}.`,
    });
  }

  if (signals.hasMonorepo) {
    proposals.push({
      id: 'monorepo-boundary-respect',
      description: 'Tasks must not create cross-package dependencies without explicit justification.',
      severity: 'warning',
      category: 'architecture',
      evidence: 'Detected monorepo configuration (lerna.json / pnpm-workspace.yaml / nx.json).',
    });
  }

  if (signals.hasOpenSpec) {
    proposals.push({
      id: 'spec-compliance',
      description: 'Functional changes must reference an OpenSpec change for traceability.',
      severity: 'warning',
      category: 'architecture',
      evidence: 'Detected openspec/config.yaml.',
    });
  }

  // Always-on guardrails
  proposals.push({
    id: 'no-scope-creep',
    description: 'Tasks must only address stated requirements; no gold-plating.',
    severity: 'warning',
    category: 'scope',
    evidence: 'Universal guardrail — always applicable.',
  });

  proposals.push({
    id: 'single-responsibility-tasks',
    description: 'Each task must have exactly one clear deliverable.',
    severity: 'warning',
    category: 'scope',
    evidence: 'Universal guardrail — always applicable.',
  });

  return proposals;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { projectRoot, mode } = parseArgs(process.argv);

  const errors = [];
  const warnings = [];

  // 1. Read existing guardrails
  const existingResult = readExisting(projectRoot);
  if (existingResult.error) {
    errors.push(existingResult.error);
  }
  const existing = {
    count: existingResult.count,
    guardrails: existingResult.guardrails,
    ids: existingResult.ids,
  };

  // 2. Detect signals
  const signals = {
    languages: [],
    frameworks: [],
    hasDatabase: false,
    dbType: null,
    hasApi: false,
    apiFormat: null,
    hasTests: false,
    testFramework: null,
    hasCi: false,
    ciPlatform: null,
    hasMonorepo: false,
    hasOpenSpec: false,
    directories: {},
    reviewDimensions: [],
    claudeMdRules: [],
  };

  detectLanguagesAndFrameworks(projectRoot, signals);
  detectStructure(projectRoot, signals);
  detectReviewDimensions(projectRoot, signals);
  extractClaudeMdRules(projectRoot, signals);

  // 3. Build proposals
  let proposals = buildProposals(signals);

  // 4. In add mode, filter out already-existing ids
  if (mode === 'add' && existing.ids.length > 0) {
    const existingSet = new Set(existing.ids);
    proposals = proposals.filter(p => !existingSet.has(p.id));
  }

  const output = {
    errors,
    warnings,
    existing,
    signals,
    proposals,
  };

  writeOutput(output, 'guardrails-prepare', errors.length > 0 ? 1 : 0);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`guardrails-prepare.js error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
  }
}

module.exports = { buildProposals, detectLanguagesAndFrameworks, detectStructure };
