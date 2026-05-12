#!/usr/bin/env node
'use strict';
/**
 * workspace-fields-test.js
 * Test driver for workspace-fields.js validate() functions (issue #351).
 *
 * Usage:
 *   node tests/promptfoo/scripts/workspace-fields-test.js --case <name>
 *
 * Each case returns a single JSON object:
 *   { pass: boolean, error?: string }
 *
 * Cases:
 *   base-traversal         base='../etc' → TypeError mentioning '..'
 *   base-relative          base='some/relative' → TypeError (not absolute, not ~)
 *   template-no-placeholder  template='~/fixed/path' → TypeError mentioning '{slug} or {branch}'
 *   template-traversal     template='~/../etc/{slug}' → TypeError
 *   nametemplate-path-sep  nameTemplate='{slug}/sub' → TypeError mentioning 'path separator'
 *   nametemplate-empty     nameTemplate='' → TypeError
 *   nametemplate-issue-no-digits  nameTemplate='{issue}-{slug}' with digit-less branch → TypeError
 *   layout-invalid         layout='bogus' → TypeError
 *   layout-valid           layout='sibling' → pass
 *   base-valid             base='~/dev/worktrees' → pass
 *   template-valid         template='~/dev/wt/{slug}' → pass
 */

const path = require('path');
const LIB = path.join(__dirname, '..', '..', '..', 'plugins', 'sdlc-utilities', 'scripts', 'lib');
const {
  LAYOUT_FIELD,
  BASE_FIELD,
  TEMPLATE_FIELD,
  NAME_TEMPLATE_FIELD,
} = require(path.join(LIB, 'workspace-fields'));

// Sentinel repo context for validators that need a repoContext
const REPO_CONTEXT = {
  repoRoot: '/tmp/test-repo',
  repoName: 'test-repo',
  home:     '/Users/testuser',
};

// ---------------------------------------------------------------------------
// Case definitions
// ---------------------------------------------------------------------------

const CASES = {
  'base-traversal': () => {
    try {
      BASE_FIELD.validate('../etc', 'inside', REPO_CONTEXT);
      return { pass: false, error: 'Expected TypeError but got none' };
    } catch (err) {
      return { pass: err instanceof TypeError && err.message.includes('..') };
    }
  },

  'base-relative': () => {
    try {
      BASE_FIELD.validate('some/relative', 'inside', REPO_CONTEXT);
      return { pass: false, error: 'Expected TypeError but got none' };
    } catch (err) {
      return { pass: err instanceof TypeError };
    }
  },

  'template-no-placeholder': () => {
    try {
      TEMPLATE_FIELD.validate('~/fixed/path', REPO_CONTEXT);
      return { pass: false, error: 'Expected TypeError but got none' };
    } catch (err) {
      return {
        pass: err instanceof TypeError && err.message.includes('{slug}') && err.message.includes('{branch}'),
      };
    }
  },

  'template-traversal': () => {
    try {
      TEMPLATE_FIELD.validate('~/../etc/{slug}', REPO_CONTEXT);
      return { pass: false, error: 'Expected TypeError but got none' };
    } catch (err) {
      return { pass: err instanceof TypeError };
    }
  },

  'nametemplate-path-sep': () => {
    try {
      NAME_TEMPLATE_FIELD.validate('{slug}/sub', REPO_CONTEXT);
      return { pass: false, error: 'Expected TypeError but got none' };
    } catch (err) {
      return {
        pass: err instanceof TypeError && (
          err.message.includes('path separator') || err.message.includes('/')
        ),
      };
    }
  },

  'nametemplate-empty': () => {
    try {
      NAME_TEMPLATE_FIELD.validate('', REPO_CONTEXT);
      return { pass: false, error: 'Expected TypeError but got none' };
    } catch (err) {
      return { pass: err instanceof TypeError };
    }
  },

  'nametemplate-issue-no-digits': () => {
    // The validator uses a digit-bearing sentinel branch (feat/351-example),
    // so {issue} works in the default case. To test digit-less rejection,
    // we call resolvePath directly with a digit-less branch.
    const { resolvePath } = require(path.join(LIB, 'worktree-path'));
    try {
      resolvePath({
        layout: 'inside',
        repoRoot: REPO_CONTEXT.repoRoot,
        repoName: REPO_CONTEXT.repoName,
        slug:     'feat-foo',
        branch:   'feat/foo',   // no digits
        home:     REPO_CONTEXT.home,
        nameTemplate: '{issue}-{slug}',
      });
      return { pass: false, error: 'Expected TypeError but got none' };
    } catch (err) {
      return {
        pass: err instanceof TypeError && err.message.includes('{issue}'),
      };
    }
  },

  'layout-invalid': () => {
    try {
      LAYOUT_FIELD.validate('bogus');
      return { pass: false, error: 'Expected TypeError but got none' };
    } catch (err) {
      return { pass: err instanceof TypeError };
    }
  },

  'layout-valid': () => {
    try {
      LAYOUT_FIELD.validate('sibling');
      return { pass: true };
    } catch (err) {
      return { pass: false, error: err.message };
    }
  },

  'base-valid': () => {
    try {
      BASE_FIELD.validate('~/dev/worktrees', 'inside', REPO_CONTEXT);
      return { pass: true };
    } catch (err) {
      return { pass: false, error: err.message };
    }
  },

  'template-valid': () => {
    try {
      TEMPLATE_FIELD.validate('~/dev/wt/{slug}', REPO_CONTEXT);
      return { pass: true };
    } catch (err) {
      return { pass: false, error: err.message };
    }
  },
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const caseIdx = args.indexOf('--case');
if (caseIdx === -1 || !args[caseIdx + 1]) {
  process.stderr.write('Usage: workspace-fields-test.js --case <name>\n');
  process.stderr.write(`Available cases: ${Object.keys(CASES).join(', ')}\n`);
  process.exit(1);
}

const caseName = args[caseIdx + 1];
const caseFunc = CASES[caseName];
if (!caseFunc) {
  process.stderr.write(`Unknown case: "${caseName}"\n`);
  process.stderr.write(`Available cases: ${Object.keys(CASES).join(', ')}\n`);
  process.exit(1);
}

try {
  const result = caseFunc();
  console.log(JSON.stringify(result));
  process.exit(result.pass ? 0 : 1);
} catch (err) {
  console.log(JSON.stringify({ pass: false, error: `Uncaught: ${err.message}` }));
  process.exit(1);
}
