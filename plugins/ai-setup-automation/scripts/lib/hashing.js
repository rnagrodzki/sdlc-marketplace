'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

function hashBuffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function hashString(str) {
  return crypto.createHash('sha256').update(str, 'utf-8').digest('hex');
}

function safeHashFile(filePath) {
  try {
    return hashBuffer(fs.readFileSync(filePath));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    process.stderr.write(`Warning: Cannot read ${filePath}: ${e.message}\n`);
    return null;
  }
}

function getFileMetadata(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const stat = fs.statSync(filePath);
  return {
    lines: content.split('\n').length,
    mtime: stat.mtime.toISOString(),
    content,
  };
}

module.exports = { hashBuffer, hashString, safeHashFile, getFileMetadata };
