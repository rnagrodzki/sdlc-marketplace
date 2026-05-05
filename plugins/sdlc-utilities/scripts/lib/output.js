'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

/**
 * Write JSON data to a temp file with a crypto-random name.
 * Returns the file path.
 */
function createOutputFile(prefix) {
  const hash = crypto.randomBytes(4).toString('hex');
  return path.join(os.tmpdir(), `${prefix}-${hash}.json`);
}

/**
 * Unified output: always writes JSON to a temp file under `os.tmpdir()` and
 * prints only the path on stdout. The previous stdout-JSON fallback was
 * removed (issue #209) because shell redirects of that fallback could
 * materialize transient `*-context-*.json` artifacts in the consumer cwd.
 * Callers that previously relied on stdout JSON must read the printed path.
 */
function writeOutput(data, prefix, exitCode = 0) {
  const filePath = createOutputFile(prefix);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  process.stdout.write(filePath + '\n');
  process.exit(exitCode);
}

module.exports = { createOutputFile, writeOutput };
