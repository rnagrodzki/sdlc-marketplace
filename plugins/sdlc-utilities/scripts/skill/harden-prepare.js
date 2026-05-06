#!/usr/bin/env node
/**
 * harden-prepare.js — pre-computes the manifest for the harden-orchestrator
 * agent. Loads all five hardening surfaces deterministically (per-surface
 * loaders live in lib/harden-surfaces.js to honor the ≤200-line cap).
 * Implements docs/specs/harden-sdlc.md R1-R4, R10, R13.
 * Required: --failure-text, --skill. Stdin JSON fallback supported (CLI wins).
 * Exit codes: 0 success, 1 missing-required, 2 crash.
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const LIB = path.join(__dirname, '..', 'lib');
const { writeOutput } = require(path.join(LIB, 'output'));
const surfaces = require(path.join(LIB, 'harden-surfaces'));
const { resolveSkipConfigCheck, ensureConfigVersion } = require(path.join(LIB, 'config-version-prepare'));

// ---------------------------------------------------------------------------
// CLI parsing — mirror error-report-prepare.js posture
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    if (a === '--output-file') continue; // handled by writeOutput
    const eq = a.indexOf('=');
    let key, val;
    if (eq !== -1) {
      key = a.slice(2, eq);
      val = a.slice(eq + 1);
    } else {
      key = a.slice(2);
      val = argv[i + 1];
      if (val !== undefined && !val.startsWith('--')) {
        i++;
      } else {
        val = '';
      }
    }
    out[key] = val;
  }
  return out;
}

function camelKey(k) {
  return k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function readStdinJson() {
  try {
    if (process.stdin.isTTY) return {};
    const buf = fs.readFileSync(0, 'utf8');
    if (!buf.trim()) return {};
    return JSON.parse(buf);
  } catch (err) {
    process.stderr.write(`harden-prepare: stdin JSON parse failed — ${err.message}\n`);
    return {};
  }
}

function safeExec(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  } catch (err) {
    process.stderr.write(`harden-prepare: git command failed (${cmd.split(' ')[0]}): ${err.stderr ? err.stderr.toString().trim() : err.message}\n`);
    return '';
  }
}

// ---------------------------------------------------------------------------
// Pipeline state probes — optional context (R11)
// ---------------------------------------------------------------------------

function readPipelineState(projectRoot) {
  const dir = path.join(projectRoot, '.sdlc', 'execution');
  let shipState = null;
  let executeState = null;
  if (!fs.existsSync(dir)) return { shipState, executeState };

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const f of files) {
    if (!shipState && f.startsWith('ship-')) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        shipState = {
          paused: !!data.paused,
          currentStep: data.currentStep || null,
          lastFailedStep: data.lastFailedStep || null,
        };
      } catch (err) {
        process.stderr.write(`harden-prepare: skipping ship state file ${f} — ${err.message}\n`);
      }
    }
    if (!executeState && f.startsWith('execute-')) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        executeState = {
          failedTask: data.failedTask || null,
          failedWave: data.failedWave || null,
        };
      } catch (err) {
        process.stderr.write(`harden-prepare: skipping execute state file ${f} — ${err.message}\n`);
      }
    }
  }
  return { shipState, executeState };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const cli = parseArgs(process.argv.slice(2));
  const stdin = readStdinJson();

  const input = {};
  for (const [k, v] of Object.entries(stdin)) input[k] = v;
  for (const [k, v] of Object.entries(cli)) input[camelKey(k)] = v;

  const errors = [];

  // Issue #232: verifyAndMigrate gate (CLI > env > default false).
  const cwdForVerify = process.cwd();
  const skipConfigCheck = resolveSkipConfigCheck(process.argv);
  const cv = ensureConfigVersion(cwdForVerify, { skip: skipConfigCheck, roles: ['project'] });
  if (cv.errors.length > 0) {
    for (const e of cv.errors) errors.push(`config-version: ${e.role}: ${e.message}`);
    writeOutput({ errors, warnings: [], flags: { skipConfigCheck }, migration: cv.migration }, 'sdlc-harden', 1);
    return;
  }

  const required = ['failureText', 'skill'];
  for (const key of required) {
    if (!input[key] || String(input[key]).trim() === '') {
      errors.push(`Missing required field: ${key}`);
    }
  }

  if (errors.length > 0) {
    process.stderr.write(`harden-prepare: ${errors.join('; ')}\n`);
    writeOutput({ errors, warnings: [] }, 'sdlc-harden', 1);
    return;
  }

  const projectRoot = process.cwd();
  const surfaceLoadErrors = [];

  // Load all five surfaces deterministically (R4).
  const planGuardrails    = surfaces.loadPlanGuardrails(projectRoot, surfaceLoadErrors);
  const executeGuardrails = surfaces.loadExecuteGuardrails(projectRoot, surfaceLoadErrors);
  const reviewDimensions  = surfaces.loadReviewDimensions(projectRoot, surfaceLoadErrors);
  const copilotInstructions = surfaces.loadCopilotInstructions(projectRoot, surfaceLoadErrors);
  const errorReportSkillPath = surfaces.resolveErrorReportSkill(projectRoot, surfaceLoadErrors);

  const { shipState, executeState } = readPipelineState(projectRoot);

  const manifest = {
    failure: {
      text:       String(input.failureText),
      skill:      String(input.skill).trim(),
      step:       input.step       != null ? String(input.step).trim()       : '',
      operation:  input.operation  != null ? String(input.operation).trim()  : '',
      exitCode:   input.exitCode   != null && input.exitCode !== '' ? String(input.exitCode) : null,
      errorType:  input.errorType  != null ? String(input.errorType).trim()  : '',
      userIntent: input.userIntent != null ? String(input.userIntent)        : '',
      argsString: input.argsString != null ? String(input.argsString)        : '',
    },
    classification_hint: null,
    surfaces: {
      planGuardrails,
      executeGuardrails,
      reviewDimensions,
      copilotInstructions,
      errorReportSkillPath,
    },
    pipeline: {
      shipState,
      executeState,
    },
    repository: {
      root:   projectRoot,
      branch: safeExec('git rev-parse --abbrev-ref HEAD'),
      recentDiffSummary: safeExec('git diff --shortstat HEAD~1..HEAD 2>/dev/null'),
    },
    timestamp: new Date().toISOString(),
    errors: surfaceLoadErrors,
  };

  writeOutput(manifest, 'sdlc-harden', 0);
}

try {
  main();
} catch (err) {
  process.stderr.write(`harden-prepare.js crashed: ${err.stack || err.message}\n`);
  process.exit(2);
}
