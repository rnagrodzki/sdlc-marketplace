#!/usr/bin/env node
/**
 * openspec-enrich.js
 * Idempotent enrichment of openspec/config.yaml with a managed block
 * pointing contributors to sdlc-utilities skills.
 *
 * Usage:
 *   node openspec-enrich.js [--remove] [--project-root <path>] [--output-file]
 *
 * Exit codes:
 *   0 = success (action: append | update | unchanged | removed)
 *   1 = error (missing file, I/O error)
 *   2 = unexpected script crash
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENSPEC_ENRICH_VERSION = 1;

const BEGIN_RE = /^# BEGIN MANAGED BY sdlc-utilities \(v(\d+)\)$/m;
const END_RE   = /^# END MANAGED BY sdlc-utilities \(v\d+\)$/m;

const BLOCK_TEMPLATE = `# BEGIN MANAGED BY sdlc-utilities (v${OPENSPEC_ENRICH_VERSION})
#
# This block is maintained by the sdlc-utilities plugin. Do not edit manually.
# Re-run /setup-sdlc --openspec-enrich to update, or --remove-openspec to remove.
#
# Workflow for contributors:
#   1. /plan-sdlc --from-openspec <change-name>  — create an implementation plan from the change
#   2. /execute-plan-sdlc                         — execute the plan in waves
#   3. /ship-sdlc                                 — commit, review, version, and open a PR
#
# Do not invoke \`openspec archive\` directly — /ship-sdlc handles archival
# as a conditional pipeline step after validation passes.
#
# END MANAGED BY sdlc-utilities (v${OPENSPEC_ENRICH_VERSION})`;

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let remove      = false;
  let projectRoot = process.cwd();
  let outputFile  = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--remove') {
      remove = true;
    } else if (a === '--project-root' && args[i + 1]) {
      projectRoot = args[++i];
    } else if (a === '--output-file') {
      outputFile = true;
    }
  }

  return { remove, projectRoot, outputFile };
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Detect the managed block in file content.
 * @param {string} content
 * @returns {{ found: boolean, version: number|null, startIdx: number, endIdx: number }}
 */
function detectBlock(content) {
  const beginMatch = BEGIN_RE.exec(content);
  if (!beginMatch) {
    return { found: false, version: null, startIdx: -1, endIdx: -1 };
  }

  const endMatch = END_RE.exec(content.slice(beginMatch.index + beginMatch[0].length));
  if (!endMatch) {
    return { found: false, version: null, startIdx: -1, endIdx: -1 };
  }

  const version  = parseInt(beginMatch[1], 10);
  const startIdx = beginMatch.index;
  const endIdx   = beginMatch.index + beginMatch[0].length + endMatch.index + endMatch[0].length;

  return { found: true, version, startIdx, endIdx };
}

/**
 * Enrich the config file with the managed block.
 * @param {string} configPath  Absolute path to openspec/config.yaml
 * @param {{ remove: boolean }} options
 * @returns {{ action: string, version: number, path: string, changed: boolean, warning?: string }}
 */
function enrich(configPath, { remove } = {}) {
  if (!fs.existsSync(configPath)) {
    return {
      ok: false,
      action: 'missing',
      version: OPENSPEC_ENRICH_VERSION,
      path: configPath,
      changed: false,
      error: 'openspec/config.yaml not found',
    };
  }

  const content = fs.readFileSync(configPath, 'utf8');
  const block   = detectBlock(content);

  // --remove mode
  if (remove) {
    if (!block.found) {
      return {
        ok: true,
        action: 'removed',
        version: OPENSPEC_ENRICH_VERSION,
        path: configPath,
        changed: false,
      };
    }

    // Remove the block and normalize surrounding whitespace
    let before = content.slice(0, block.startIdx);
    let after  = content.slice(block.endIdx);

    // Trim trailing whitespace from before and leading whitespace from after
    before = before.replace(/\n+$/, '\n');
    after  = after.replace(/^\n+/, '');

    const newContent = before + after;
    fs.writeFileSync(configPath, newContent, 'utf8');
    return {
      ok: true,
      action: 'removed',
      version: OPENSPEC_ENRICH_VERSION,
      path: configPath,
      changed: true,
    };
  }

  // No block present → append
  if (!block.found) {
    const separator = content.endsWith('\n') ? '\n' : '\n\n';
    const newContent = content + separator + BLOCK_TEMPLATE + '\n';
    fs.writeFileSync(configPath, newContent, 'utf8');
    return {
      ok: true,
      action: 'append',
      version: OPENSPEC_ENRICH_VERSION,
      path: configPath,
      changed: true,
    };
  }

  // Block at higher version → no-op with warning
  if (block.version > OPENSPEC_ENRICH_VERSION) {
    return {
      ok: true,
      action: 'unchanged',
      version: block.version,
      path: configPath,
      changed: false,
      warning: `Managed block is at v${block.version}, plugin ships v${OPENSPEC_ENRICH_VERSION}. Use --remove to downgrade.`,
    };
  }

  // Block at current version → no-op
  if (block.version === OPENSPEC_ENRICH_VERSION) {
    return {
      ok: true,
      action: 'unchanged',
      version: OPENSPEC_ENRICH_VERSION,
      path: configPath,
      changed: false,
    };
  }

  // Block at lower version → update in place
  const before     = content.slice(0, block.startIdx);
  const after      = content.slice(block.endIdx);
  const newContent = before + BLOCK_TEMPLATE + after;
  fs.writeFileSync(configPath, newContent, 'utf8');

  return {
    ok: true,
    action: 'update',
    version: OPENSPEC_ENRICH_VERSION,
    path: configPath,
    changed: true,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const cli = parseArgs(process.argv);
  const configPath = path.join(cli.projectRoot, 'openspec', 'config.yaml');

  const result = enrich(configPath, { remove: cli.remove });

  const output = JSON.stringify(result, null, 2);

  if (cli.outputFile) {
    const tmpFile = path.join(os.tmpdir(), `openspec-enrich-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, output, 'utf8');
    process.stdout.write(`PREPARE_OUTPUT_FILE=${tmpFile}\n`);
  } else {
    process.stdout.write(output + '\n');
  }

  process.exit(result.ok === false ? 1 : 0);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`openspec-enrich.js error: ${err.message}\n${err.stack}\n`);
    process.exit(2);
  }
}

module.exports = { parseArgs, detectBlock, enrich, OPENSPEC_ENRICH_VERSION };
