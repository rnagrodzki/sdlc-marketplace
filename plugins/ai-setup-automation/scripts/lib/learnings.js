'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { safeHashFile } = require('./hashing');

function countLearningEntries(projectRoot) {
  const logPath = path.join(projectRoot, '.claude', 'learnings', 'log.md');
  const sha256 = safeHashFile(logPath);
  if (!sha256) {
    return { total_entries: 0, active: 0, promoted: 0, stale: 0, sha256: null };
  }

  const content = fs.readFileSync(logPath, 'utf-8');
  // Match **Status**: ACTIVE / PROMOTED[:target] / STALE
  const pattern = /\*\*Status\*\*\s*:\s*(ACTIVE|PROMOTED[^\n]*|STALE)/gi;
  let active = 0, promoted = 0, stale = 0;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const status = match[1].toUpperCase();
    if (status === 'ACTIVE') active++;
    else if (status.startsWith('PROMOTED')) promoted++;
    else if (status === 'STALE') stale++;
  }

  return { total_entries: active + promoted + stale, active, promoted, stale, sha256 };
}

module.exports = { countLearningEntries };
