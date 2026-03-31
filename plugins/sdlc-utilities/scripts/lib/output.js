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
 * Unified output: if --output-file is in argv, write to temp file and print path.
 * Otherwise print JSON to stdout (backward compatible).
 */
function writeOutput(data, prefix, exitCode = 0) {
  if (process.argv.includes('--output-file')) {
    const filePath = createOutputFile(prefix);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    process.stdout.write(filePath + '\n');
  } else {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  }
  process.exit(exitCode);
}

module.exports = { createOutputFile, writeOutput };
