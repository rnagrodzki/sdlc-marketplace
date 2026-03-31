#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse command-line flags
 */
function parseArgs(args) {
  const result = {
    projectRoot: process.cwd(),
    json: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project-root' && i + 1 < args.length) {
      result.projectRoot = args[i + 1];
      i++;
    } else if (args[i] === '--json') {
      result.json = true;
    }
  }
  return result;
}

/**
 * Import readSection from lib/config.js
 */
function loadReadSection() {
  // Try to find config.js in the plugin scripts directory (relative to this file)
  const scriptDir = __dirname;
  const configPath = path.join(scriptDir, 'lib', 'config.js');

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
    const plan = readSection(flags.projectRoot, 'plan');

    // If no plan section or no guardrails, return empty pass
    if (!plan || !Array.isArray(plan.guardrails)) {
      const output = {
        overall: 'pass',
        summary: { total: 0, pass: 0, errors: 0, warnings: 0 },
        guardrails: [],
      };
      if (flags.json) {
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log('No plan guardrails configured.');
      }
      process.exit(0);
    }

    const guardrails = plan.guardrails;
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
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(`Guardrails: ${totalPass}/${guardrails.length} passed`);
      for (const result of results) {
        const statusStr = result.status === 'PASS' ? '✓' : '✗';
        console.log(`  ${statusStr} ${result.id}`);
        for (const err of result.errors) {
          console.log(`    ERROR: ${err}`);
        }
        for (const warn of result.warnings) {
          console.log(`    WARNING: ${warn}`);
        }
      }
    }

    process.exit(overall === 'pass' ? 0 : 1);
  } catch (err) {
    console.error('CRASH:', err.message);
    process.exit(2);
  }
}

main();
