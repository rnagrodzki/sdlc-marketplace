'use strict';

/**
 * Detect unfilled placeholder markers in jira-sdlc payloads (R19 / C13).
 *
 * Two equally-treated placeholder forms:
 *   - Brace form: `{snake_or_kebab_name}`
 *   - Bracket form: `[bracketed prose >= 3 chars]`
 *
 * Walks every string-valued field of the payload, including nested ADF
 * `text` nodes (Atlassian Document Format), so that placeholders inside
 * description / commentBody / body fields are caught.
 */

const PLACEHOLDER_REGEX = /\{[a-zA-Z_][a-zA-Z0-9_-]*\}|\[(?![{"\d])[^\]\n]{3,}\]/g;

/**
 * @param {*} payload
 * @returns {Array<{path: string, marker: string}>}
 */
function findPlaceholders(payload) {
  const results = [];
  walk(payload, '', results);
  return results;
}

function walk(node, path, results) {
  if (node === null || node === undefined) return;
  if (typeof node === 'string') {
    PLACEHOLDER_REGEX.lastIndex = 0;
    let m;
    while ((m = PLACEHOLDER_REGEX.exec(node)) !== null) {
      results.push({ path, marker: m[0] });
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, path ? `${path}[${i}]` : `[${i}]`, results));
    return;
  }
  if (typeof node === 'object') {
    for (const k of Object.keys(node)) {
      walk(node[k], path ? `${path}.${k}` : k, results);
    }
  }
}

module.exports = { findPlaceholders, PLACEHOLDER_REGEX };
