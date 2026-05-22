#!/usr/bin/env node
'use strict';

/**
 * migrate-jira-templates — one-shot idempotent migration of project-local Jira template overrides
 * from the legacy path <project>/.claude/jira-templates/ to the canonical path
 * <project>/.sdlc/jira-templates/.
 *
 * Behavior by case:
 *   - Both absent          → exit 0 (no-op)
 *   - Target exists, legacy absent → exit 0 (no-op — already migrated or never used)
 *   - Both exist           → print warning to stderr:
 *                            "migrate-jira-templates: both <legacy> and <target> exist;
 *                             keeping <target>, leaving <legacy> in place"
 *                            exit 0 (non-fatal, idempotent)
 *   - Legacy exists, target absent → fs.renameSync(legacyDir, targetDir), exit 0
 *   - Filesystem error     → print error to stderr, exit 1
 *
 * Implements R-MIGR (docs/specs/jira-sdlc.md). Mirrors migrate-learnings-log.js conventions.
 * (Fixes #423.)
 */

const path = require('path');
const fs = require('fs');
const { resolveSdlcRoot } = require(path.join(__dirname, '..', 'lib', 'config'));

// R-projectroot: use resolveSdlcRoot() NOT process.cwd() for workspace-mode compatibility.
const sdlcRoot = resolveSdlcRoot();
const legacyDir = path.join(sdlcRoot, '.claude', 'jira-templates');
const targetDir = path.join(sdlcRoot, '.sdlc', 'jira-templates');

try {
  const legacyExists = fs.existsSync(legacyDir);
  const targetExists = fs.existsSync(targetDir);

  if (!legacyExists && !targetExists) {
    // Both absent — no-op
    console.log(JSON.stringify({ action: 'noop', reason: 'neither present' }));
    process.exit(0);
  }

  if (targetExists && !legacyExists) {
    // Already migrated (or user created target manually) — no-op
    console.log(JSON.stringify({ action: 'noop', reason: 'already migrated' }));
    process.exit(0);
  }

  if (targetExists && legacyExists) {
    // Both present — prefer target, warn, leave legacy in place
    process.stderr.write(
      'migrate-jira-templates: both ' + legacyDir + ' and ' + targetDir +
      ' exist; keeping ' + targetDir + ', leaving ' + legacyDir + ' in place\n'
    );
    console.log(JSON.stringify({ action: 'skipped', reason: 'target already present' }));
    process.exit(0);
  }

  // Legacy exists, target absent — move it
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.renameSync(legacyDir, targetDir);
  console.log(JSON.stringify({ action: 'moved', from: legacyDir, to: targetDir }));
  process.exit(0);
} catch (err) {
  process.stderr.write('migrate-jira-templates: error — ' + err.message + '\n');
  process.exit(1);
}
