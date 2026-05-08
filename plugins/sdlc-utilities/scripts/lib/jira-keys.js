'use strict';

/**
 * jira-keys.js
 * Single source for JIRA-key extraction across the corpus (issue #284,
 * task 21). Replaces the bare `JIRA_PATTERN` in `skill/pr.js` and the
 * `TICKET_RE` inside `lib/version.js::parseConventionalCommit`.
 *
 * Canonical pattern: `\b([A-Z]{2,10}-\d+)\b`
 *   - 2-10 uppercase letters, a dash, then one or more digits
 *   - Word boundaries on both ends to avoid embedded matches
 *   - Matches typical Jira/Linear/etc. issue keys (PROJ-123, ABCD-7)
 *
 * The pattern is intentionally a string (not a precompiled RegExp) so
 * each caller can wrap it with the flags they need (`g` for find-all,
 * none for first-match) without sharing mutable RegExp state.
 *
 * Exports:
 *   - JIRA_KEY_REGEX_SOURCE   raw pattern string (no flags)
 *   - jiraKeyRegex(flags)     fresh RegExp with the requested flags
 *   - extractKeys(text, opts) all unique keys in `text`, optional prefix filter
 *   - extractFromBranchAndCommits(branch, commits, opts)
 *                             ordered, deduplicated keys from branch + commits
 */

const JIRA_KEY_REGEX_SOURCE = '\\b([A-Z]{2,10}-\\d+)\\b';

/**
 * Build a fresh RegExp instance with the given flags. Returning a new
 * instance per call avoids cross-caller state on global-flag matchers.
 * @param {string} [flags='']
 * @returns {RegExp}
 */
function jiraKeyRegex(flags = '') {
  return new RegExp(JIRA_KEY_REGEX_SOURCE, flags);
}

/**
 * Extract all unique JIRA keys from a blob of text. Order preserved.
 * @param {string} text
 * @param {object} [opts]
 * @param {string} [opts.prefix]  Limit to keys whose prefix matches (e.g. `"PROJ"`).
 * @returns {string[]}
 */
function extractKeys(text, { prefix = null } = {}) {
  if (!text) return [];
  const re = jiraKeyRegex('g');
  const all = Array.from(text.matchAll(re), m => m[1]);
  const filtered = prefix ? all.filter(id => id.startsWith(`${prefix}-`)) : all;
  return [...new Set(filtered)];
}

/**
 * Extract JIRA keys from a branch name and a list of commit subjects/bodies.
 * Branch name takes precedence (its key, if any, is first in the result).
 *
 * @param {string|null} branch
 * @param {Array<{subject?: string, body?: string}>} commits
 * @param {object} [opts]
 * @param {string} [opts.prefix]
 * @returns {string[]}  Unique keys, branch-first then commit order.
 */
function extractFromBranchAndCommits(branch, commits, opts = {}) {
  const seen = new Set();
  const out  = [];

  const push = (key) => {
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  };

  if (branch) {
    for (const k of extractKeys(branch, opts)) push(k);
  }
  if (Array.isArray(commits)) {
    for (const c of commits) {
      const text = `${c?.subject || ''}\n${c?.body || ''}`;
      for (const k of extractKeys(text, opts)) push(k);
    }
  }
  return out;
}

module.exports = {
  JIRA_KEY_REGEX_SOURCE,
  jiraKeyRegex,
  extractKeys,
  extractFromBranchAndCommits,
};
