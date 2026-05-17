'use strict';
const fs = require('fs');

// Assertion for E6: manifest file still exists after script exits (cross-shell survival).
// Input: raw path string (script_passthrough: true).
module.exports = (output) => {
  const filePath = (output || '').trim();
  if (!filePath) {
    return { pass: false, score: 0, reason: 'output is empty — no path printed' };
  }
  if (!fs.existsSync(filePath)) {
    return { pass: false, score: 0, reason: `manifest does not exist after script exit: ${filePath}` };
  }
  return { pass: true, score: 1, reason: `manifest persists at ${filePath}` };
};
