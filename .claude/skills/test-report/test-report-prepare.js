#!/usr/bin/env node
/**
 * test-report-prepare.js
 * Pre-computes all data needed for the test-report skill:
 * queries the promptfoo SQLite DB via sqlite3 CLI, categorizes test results,
 * and outputs structured JSON so the LLM can focus on report generation.
 *
 * Usage:
 *   node test-report-prepare.js [options]
 *
 * Options:
 *   --eval-id <id>              Query a specific eval (default: latest)
 *   --type behavioral|exec|all  Filter by config type (default: all)
 *   --compare                   Include comparison with previous run of same type
 *
 * Exit codes:
 *   0 = success, JSON on stdout
 *   1 = fatal error, JSON with non-empty errors[] on stdout
 *   2 = unexpected script crash, message on stderr
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs              = require('fs');
const path            = require('path');
const { execSync }    = require('child_process');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let evalId   = null;
  let type     = 'all';
  let compare  = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--eval-id' && args[i + 1]) {
      evalId = args[++i];
    } else if (a === '--type' && args[i + 1]) {
      type = args[++i];
    } else if (a === '--compare') {
      compare = true;
    }
  }

  if (!['behavioral', 'exec', 'all'].includes(type)) {
    return { error: `Invalid --type "${type}". Must be behavioral, exec, or all.` };
  }

  return { evalId, type, compare };
}

// ---------------------------------------------------------------------------
// SQLite helpers
// ---------------------------------------------------------------------------

/**
 * Detect whether sqlite3 supports the -json flag (added in SQLite 3.33.0).
 */
function supportsJsonFlag(dbPath) {
  try {
    execSync(`sqlite3 -json "${dbPath}" "SELECT 1"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Execute a SQL query against the DB and return parsed rows.
 * Uses -json output mode; falls back to pipe-separated if unsupported.
 */
function queryDb(dbPath, sql, useJson) {
  if (useJson) {
    const raw = execSync(`sqlite3 -json "${dbPath}" ${shellEscape(sql)}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (!raw || raw === '[]') return [];
    return JSON.parse(raw);
  } else {
    // Fallback: use pipe-separated output — caller must parse manually
    const raw = execSync(`sqlite3 -separator '|' "${dbPath}" ${shellEscape(sql)}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return raw ? raw.split('\n').map(line => line.split('|')) : [];
  }
}

function shellEscape(sql) {
  // Wrap in single quotes, escape internal single quotes
  return `'${sql.replace(/'/g, "'\"'\"'")}'`;
}

// ---------------------------------------------------------------------------
// Type detection
// ---------------------------------------------------------------------------

/**
 * Map eval description to a config type string.
 * "Behavioral regression tests..." -> "behavioral"
 * "Script execution tests..."      -> "exec"
 */
function descriptionToType(description) {
  if (!description) return 'unknown';
  const lower = description.toLowerCase();
  if (lower.includes('behavioral')) return 'behavioral';
  if (lower.includes('script execution')) return 'exec';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Core data fetching
// ---------------------------------------------------------------------------

function resolveEval(dbPath, requestedEvalId, type, useJson) {
  // List evals ordered by most recent
  const rows = queryDb(dbPath, `
    SELECT id,
           datetime(created_at/1000, 'unixepoch', 'localtime') AS created_at_str,
           json_extract(config, '$.description') AS description
    FROM evals
    ORDER BY created_at DESC
  `, useJson);

  if (!rows.length) return { error: 'No eval runs found in the database.' };

  if (requestedEvalId) {
    const found = rows.find(r => r.id === requestedEvalId);
    if (!found) return { error: `Eval ID "${requestedEvalId}" not found in database.` };
    return { eval: found };
  }

  // Filter by type
  if (type !== 'all') {
    const filtered = rows.filter(r => descriptionToType(r.description) === type);
    if (!filtered.length) return { error: `No eval runs of type "${type}" found.` };
    return { eval: filtered[0] };
  }

  return { eval: rows[0] };
}

function fetchResults(dbPath, evalId, useJson) {
  return queryDb(dbPath, `
    SELECT id,
           test_idx,
           json_extract(test_case, '$.description') AS description,
           json_extract(test_case, '$.vars.skill_path') AS skill_path,
           success,
           score,
           latency_ms,
           cost,
           substr(response, 1, 500) AS response_preview,
           json_extract(grading_result, '$.reason') AS grading_reason,
           json_extract(grading_result, '$.componentResults') AS component_results_raw
    FROM eval_results
    WHERE eval_id = '${evalId}'
    ORDER BY test_idx ASC
  `, useJson);
}

function buildSummary(results, expectedCount) {
  const executed  = results.length;
  const passed    = results.filter(r => Number(r.success) === 1).length;
  const failed    = executed - passed;
  const missing   = Math.max(0, expectedCount - executed);
  const avgLat    = executed > 0
    ? Math.round(results.reduce((s, r) => s + Number(r.latency_ms || 0), 0) / executed)
    : 0;
  const totalCost = results.reduce((s, r) => s + Number(r.cost || 0), 0);

  return {
    totalTests:   expectedCount,
    executed,
    passed,
    failed,
    missing,
    passRate:     executed > 0 ? Math.round((passed / executed) * 100) : 0,
    avgLatencyMs: avgLat,
    totalCost:    Math.round(totalCost * 10000) / 10000,
  };
}

function parseComponentResults(raw) {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return arr.map(c => ({
      type:   c.assertion && c.assertion.type  ? c.assertion.type  : 'unknown',
      value:  c.assertion && c.assertion.value ? c.assertion.value : '',
      pass:   Boolean(c.pass),
      reason: c.reason || '',
    }));
  } catch (_) {
    return [];
  }
}

function categorizeResults(results) {
  const passing = [];
  const failing = [];

  for (const r of results) {
    const assertions = parseComponentResults(r.component_results_raw);
    if (Number(r.success) === 1) {
      passing.push({
        description:    r.description || '(unnamed)',
        skillPath:      r.skill_path  || null,
        score:          Number(r.score),
        latencyMs:      Number(r.latency_ms),
      });
    } else {
      failing.push({
        description:    r.description || '(unnamed)',
        skillPath:      r.skill_path  || null,
        score:          Number(r.score),
        latencyMs:      Number(r.latency_ms),
        responsePreview: r.response_preview || '',
        gradingReason:  r.grading_reason   || '',
        assertions,
      });
    }
  }

  return { passing, failing };
}

// ---------------------------------------------------------------------------
// Missing test detection
// ---------------------------------------------------------------------------

/**
 * Approximate expected test count by scanning dataset YAML files.
 * Counts lines matching "- description:" in each dataset file referenced by the config.
 */
function detectExpectedCount(dbPath, evalId, useJson, warnings) {
  // Get the config JSON for this eval
  const rows = queryDb(dbPath, `SELECT config FROM evals WHERE id = '${evalId}'`, useJson);
  if (!rows.length || !rows[0].config) return { count: 0, missingTests: [] };

  let config;
  try {
    config = JSON.parse(rows[0].config);
  } catch (_) {
    warnings.push('Could not parse eval config JSON — missing test detection unavailable.');
    return { count: 0, missingTests: [] };
  }

  // Extract dataset file references from tests array
  const tests    = config.tests || [];
  const repoRoot = findRepoRoot();
  if (!repoRoot) {
    warnings.push('Could not locate repo root — missing test detection unavailable.');
    return { count: 0, missingTests: [] };
  }

  const promptfooDir = path.join(repoRoot, 'tests', 'promptfoo');
  let expectedDescs = [];

  for (const testEntry of tests) {
    // testEntry may be a string path (e.g. "file://datasets/foo.yaml") or an object
    let filePath = null;
    if (typeof testEntry === 'string') {
      filePath = testEntry.replace(/^file:\/\//, '');
    } else if (testEntry.path) {
      filePath = testEntry.path.replace(/^file:\/\//, '');
    }

    if (!filePath) continue;

    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(promptfooDir, filePath);

    try {
      const content = fs.readFileSync(absPath, 'utf8');
      const matches = content.match(/^\s*- description:/gm);
      const descs   = content
        .split('\n')
        .filter(line => /^\s*- description:/.test(line))
        .map(line => line.replace(/^\s*- description:\s*/, '').replace(/^["']|["']$/g, '').trim());
      expectedDescs = expectedDescs.concat(descs);
      if (!matches) {
        // Try counting top-level test entries by "- vars:" or similar
        const altMatches = content.match(/^- /gm);
        if (altMatches) {
          // Add placeholder entries
          for (let i = 0; i < altMatches.length; i++) {
            expectedDescs.push(`(unnamed from ${path.basename(filePath)})`);
          }
        }
      }
    } catch (_) {
      warnings.push(`Could not read dataset file: ${filePath}`);
    }
  }

  return { count: expectedDescs.length, missingTests: [] };
}

// ---------------------------------------------------------------------------
// Comparison with previous run
// ---------------------------------------------------------------------------

function compareWithPrevious(dbPath, currentEvalId, configType, useJson) {
  // Find previous eval of the same type
  const rows = queryDb(dbPath, `
    SELECT id,
           datetime(created_at/1000, 'unixepoch', 'localtime') AS created_at_str,
           json_extract(config, '$.description') AS description
    FROM evals
    ORDER BY created_at DESC
  `, useJson);

  const sameType  = configType === 'all'
    ? rows
    : rows.filter(r => descriptionToType(r.description) === configType);

  const currentIdx = sameType.findIndex(r => r.id === currentEvalId);
  if (currentIdx < 0 || currentIdx + 1 >= sameType.length) return null;

  const prevEval = sameType[currentIdx + 1];

  const currResults = queryDb(dbPath, `
    SELECT json_extract(test_case, '$.description') AS name, success, score
    FROM eval_results WHERE eval_id = '${currentEvalId}'
  `, useJson);

  const prevResults = queryDb(dbPath, `
    SELECT json_extract(test_case, '$.description') AS name, success, score
    FROM eval_results WHERE eval_id = '${prevEval.id}'
  `, useJson);

  const prevMap = {};
  for (const r of prevResults) prevMap[r.name] = r;

  const regressions  = [];
  const improvements = [];
  let stillPassing   = 0;
  let stillFailing   = 0;

  for (const curr of currResults) {
    const prev = prevMap[curr.name];
    if (!prev) continue;
    const wasPass  = Number(prev.success) === 1;
    const nowPass  = Number(curr.success) === 1;

    if (wasPass && !nowPass) {
      regressions.push({ description: curr.name, previousScore: Number(prev.score), currentScore: Number(curr.score) });
    } else if (!wasPass && nowPass) {
      improvements.push({ description: curr.name, previousScore: Number(prev.score), currentScore: Number(curr.score) });
    } else if (wasPass && nowPass) {
      stillPassing++;
    } else {
      stillFailing++;
    }
  }

  return {
    previousEvalId:    prevEval.id,
    previousCreatedAt: prevEval.created_at_str,
    regressions,
    improvements,
    unchanged: { stillPassing, stillFailing },
  };
}

// ---------------------------------------------------------------------------
// Repo root detection
// ---------------------------------------------------------------------------

function findRepoRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const errors   = [];
  const warnings = [];

  const parsed = parseArgs(process.argv);
  if (parsed.error) {
    errors.push(parsed.error);
    output({ errors, warnings }, 1);
    return;
  }

  const { evalId: requestedEvalId, type, compare } = parsed;

  // Locate DB
  const repoRoot = findRepoRoot();
  if (!repoRoot) {
    errors.push('Could not locate repository root (no .git directory found).');
    output({ errors, warnings }, 1);
    return;
  }

  const dbPath = path.join(repoRoot, 'tests', 'promptfoo', '.promptfoo-data', 'promptfoo.db');
  if (!fs.existsSync(dbPath)) {
    errors.push(`Database not found at ${dbPath}. Run: cd tests/promptfoo && promptfoo eval --env-file .env`);
    output({ errors, warnings }, 1);
    return;
  }

  const useJson = supportsJsonFlag(dbPath);

  // Resolve target eval
  const { eval: targetEval, error: resolveError } = resolveEval(dbPath, requestedEvalId, type, useJson);
  if (resolveError) {
    errors.push(resolveError);
    output({ errors, warnings }, 1);
    return;
  }

  const configType = descriptionToType(targetEval.description);

  // Build evalMeta
  const evalMeta = {
    evalId:      targetEval.id,
    createdAt:   targetEval.created_at_str,
    description: targetEval.description,
    configType,
  };

  // Fetch results
  const rawResults = fetchResults(dbPath, targetEval.id, useJson);

  // Expected count via dataset scanning
  const { count: expectedCount } = detectExpectedCount(dbPath, targetEval.id, useJson, warnings);
  const effectiveExpected = expectedCount > 0 ? expectedCount : rawResults.length;

  // Build summary
  const summary = buildSummary(rawResults, effectiveExpected);

  // Categorize
  const { passing: passingTests, failing: failingTests } = categorizeResults(rawResults);

  // Missing tests (tests defined in datasets but absent from results)
  const missingTests = summary.missing > 0
    ? [{ description: `(${summary.missing} test(s) defined in datasets but absent from eval_results)`, source: 'dataset count vs eval_results count mismatch' }]
    : [];

  // Comparison
  const comparison = compare
    ? compareWithPrevious(dbPath, targetEval.id, type, useJson)
    : null;

  const result = {
    errors,
    warnings,
    evalMeta,
    summary,
    passingTests,
    failingTests,
    missingTests,
    comparison,
  };

  output(result, 0);
}

function output(data, exitCode) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  process.exit(exitCode);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`test-report-prepare.js error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
  }
}

module.exports = { parseArgs, descriptionToType };
