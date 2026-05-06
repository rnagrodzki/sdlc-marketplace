#!/usr/bin/env node
/**
 * @file ci/validate-guardrails.js
 * @description Validates guardrail definitions in .sdlc/config.json (issue #231;
 *   legacy .claude/sdlc.json read via lib/config.js fallback): checks schema
 *   compliance, id uniqueness, severity values, and description quality.
 * @exit 0 all checks pass, 1 validation issues found
 */
'use strict';

const fs = require('fs');
const path = require('path');
const LIB = path.join(__dirname, '..', 'lib');

/**
 * Parse command-line flags
 */
function parseArgs(args) {
  const result = {
    projectRoot: process.cwd(),
    json: false,
    section: 'plan',
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project-root' && i + 1 < args.length) {
      result.projectRoot = args[i + 1];
      i++;
    } else if (args[i] === '--json') {
      result.json = true;
    } else if (args[i] === '--section' && i + 1 < args.length) {
      result.section = args[i + 1];
      i++;
    }
  }
  return result;
}

/**
 * Import readSection from lib/config.js
 */
function loadReadSection() {
  const configPath = path.join(LIB, 'config.js');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Could not find lib/config.js at ${configPath}`);
  }

  const config = require(configPath);
  if (typeof config.readSection !== 'function') {
    throw new Error('readSection not exported from lib/config.js');
  }

  return config.readSection;
}

/**
 * Validate a single guardrail
 * @returns {object} { id, status, errors, warnings }
 */
function validateGuardrail(guardrail, seenIds) {
  const errors = [];
  const warnings = [];
  const result = {
    id: guardrail.id || '(missing)',
    status: 'PASS',
    errors,
    warnings,
  };

  // Validate id exists and is string
  if (!guardrail.id) {
    errors.push('id is missing');
    result.status = 'FAIL';
  } else if (typeof guardrail.id !== 'string') {
    errors.push('id must be a string');
    result.status = 'FAIL';
  } else {
    // Validate kebab-case pattern
    const kebabPattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    if (!kebabPattern.test(guardrail.id)) {
      errors.push(`id must match kebab-case pattern: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`);
      result.status = 'FAIL';
    }

    // Validate no duplicate IDs
    if (seenIds.has(guardrail.id)) {
      errors.push(`id is duplicated across guardrails`);
      result.status = 'FAIL';
    } else {
      seenIds.add(guardrail.id);
    }
  }

  // Validate description exists and is non-empty string
  if (!guardrail.description) {
    errors.push('description is missing');
    result.status = 'FAIL';
  } else if (typeof guardrail.description !== 'string') {
    errors.push('description must be a string');
    result.status = 'FAIL';
  } else if (guardrail.description.trim() === '') {
    errors.push('description cannot be empty');
    result.status = 'FAIL';
  }

  // Validate description length <= 512
  if (guardrail.description && guardrail.description.length > 512) {
    errors.push(`description exceeds 512 characters (${guardrail.description.length} chars)`);
    result.status = 'FAIL';
  }

  // Validate severity is valid (optional, defaults to error)
  if (guardrail.severity !== undefined && guardrail.severity !== null) {
    if (!['error', 'warning'].includes(guardrail.severity)) {
      errors.push(`severity must be "error", "warning", or undefined (got "${guardrail.severity}")`);
      result.status = 'FAIL';
    }
  }

  return result;
}

/**
 * Main validation logic
 */
function main() {
  const args = process.argv.slice(2);
  const flags = parseArgs(args);

  try {
    const readSection = loadReadSection(flags.projectRoot);
    const section = flags.section || 'plan';
    const sectionData = readSection(flags.projectRoot, section);

    // If no section or no guardrails, return empty pass
    if (!sectionData || !Array.isArray(sectionData.guardrails)) {
      const output = {
        overall: 'pass',
        summary: { total: 0, pass: 0, errors: 0, warnings: 0 },
        guardrails: [],
      };
      if (flags.json) {
        process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      } else {
        process.stdout.write(`No ${section} guardrails configured.\n`);
      }
      process.exit(0);
    }

    const guardrails = sectionData.guardrails;
    const seenIds = new Set();
    const results = [];

    let totalPass = 0;
    let totalFail = 0;
    let totalWarnings = 0;

    for (const guardrail of guardrails) {
      const validation = validateGuardrail(guardrail, seenIds);
      results.push(validation);

      if (validation.status === 'PASS') {
        totalPass++;
      } else {
        totalFail++;
      }
      totalWarnings += validation.warnings.length;
    }

    const overall = totalFail === 0 ? 'pass' : 'fail';
    const output = {
      overall,
      summary: {
        total: guardrails.length,
        pass: totalPass,
        errors: totalFail,
        warnings: totalWarnings,
      },
      guardrails: results,
    };

    if (flags.json) {
      process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    } else {
      process.stdout.write(`Guardrails: ${totalPass}/${guardrails.length} passed\n`);
      for (const result of results) {
        const statusStr = result.status === 'PASS' ? '✓' : '✗';
        process.stdout.write(`  ${statusStr} ${result.id}\n`);
        for (const err of result.errors) {
          process.stdout.write(`    ERROR: ${err}\n`);
        }
        for (const warn of result.warnings) {
          process.stdout.write(`    WARNING: ${warn}\n`);
        }
      }
    }

    process.exit(overall === 'pass' ? 0 : 1);
  } catch (err) {
    process.stderr.write('CRASH: ' + err.message + '\n');
    process.exit(2);
  }
}

main();
