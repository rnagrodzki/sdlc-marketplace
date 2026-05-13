#!/usr/bin/env node
'use strict';

/**
 * migrate-learnings-log — migrate-learnings-log in plugins/sdlc-utilities/scripts/skill/migrate-learnings-log.js
 *
 * Migrates the learnings log from the legacy path <project>/.claude/learnings/log.md
 * to the canonical path <project>/.sdlc/learnings/log.md.
 *
 * Behavior by case:
 *   - Both absent    → print "migrate-learnings-log: nothing to migrate", exit 0
 *   - Target exists, legacy absent → print "migrate-learnings-log: already migrated", exit 0
 *   - Target absent, legacy exists → mkdir -p target dir, fs.renameSync(legacy, target),
 *                                    print "migrate-learnings-log: moved <legacy> → <target>", exit 0
 *   - Both exist     → print warning to stderr:
 *                      "migrate-learnings-log: both paths present; keeping <target>, leaving <legacy> in place — please review and delete legacy manually"
 *                      exit 0 (non-fatal, idempotent)
 *   - Filesystem error → print error to stderr, exit 1
 */

const path = require('path');
const fs = require('fs');

const cwd = process.cwd();
const legacy = path.join(cwd, '.claude', 'learnings', 'log.md');
const target = path.join(cwd, '.sdlc', 'learnings', 'log.md');

try {
  const legacyExists = fs.existsSync(legacy);
  const targetExists = fs.existsSync(target);

  if (!legacyExists && !targetExists) {
    console.log('migrate-learnings-log: nothing to migrate');
    process.exit(0);
  }
  if (targetExists && !legacyExists) {
    console.log('migrate-learnings-log: already migrated');
    process.exit(0);
  }
  if (targetExists && legacyExists) {
    process.stderr.write('migrate-learnings-log: both paths present; keeping ' + target + ', leaving ' + legacy + ' in place — please review and delete legacy manually\n');
    process.exit(0);
  }
  // legacy exists, target absent
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(legacy, target);
  console.log('migrate-learnings-log: moved ' + legacy + ' → ' + target);
  process.exit(0);
} catch (err) {
  process.stderr.write('migrate-learnings-log: error — ' + err.message + '\n');
  process.exit(1);
}
