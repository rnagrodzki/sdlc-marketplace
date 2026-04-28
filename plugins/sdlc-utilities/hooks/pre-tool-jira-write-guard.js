#!/usr/bin/env node
'use strict';

/**
 * PreToolUse hook: Jira write-op guardrail (R21).
 *
 * Reads a JSON envelope from stdin (Claude Code hook protocol):
 *   { tool_name, tool_input, ... }
 *
 * For Jira write tools (both `mcp__atlassian__*` and `mcp__claude_ai_Atlassian__*`
 * namespaces), it independently verifies:
 *   (a) C13 placeholder regex finds zero markers in payload string fields,
 *   (b) for createJiraIssue / editJiraIssue with `description`: payload `## `
 *       headings are a subset of the resolved template's heading set,
 *   (c) approval token + critique artifact exist for sha256(canonical(payload))
 *       and are < 10 min old,
 *   (d) critique artifact has the expected {initial, findings[], final} shape.
 *
 * On success the hook consumes (deletes) both artifacts and returns
 * `{"continue": true}`. On any block, it emits a structured permissionDecision.
 * On unknown tools or unexpected exceptions it returns `{"continue": true}`
 * (defense-in-depth: the LLM-side checks are the second line of defense).
 */

const fs = require('fs');
const path = require('path');

// Dependency resolution: the hook lives in plugins/.../hooks/, the helpers
// live in plugins/.../skills/jira-sdlc/lib/. We always look up relative to
// __dirname so test harnesses can copy or symlink the plugin tree elsewhere.
const LIB_ROOT = path.resolve(__dirname, '..', 'skills', 'jira-sdlc', 'lib');
const { payloadHash } = require(path.join(LIB_ROOT, 'payload-hash.js'));
const { findPlaceholders } = require(path.join(LIB_ROOT, 'placeholder-detect.js'));
const { loadTemplateHeadings } = require(path.join(LIB_ROOT, 'template-fingerprint.js'));
const {
  verifyArtifacts,
  consumeArtifacts,
  purgeStale,
} = require(path.join(LIB_ROOT, 'artifact-store.js'));

const WRITE_TOOLS = new Set([
  'createJiraIssue',
  'editJiraIssue',
  'transitionJiraIssue',
  'addCommentToJiraIssue',
  'addWorklogToJiraIssue',
  'createIssueLink',
]);
const NAMESPACE_PREFIXES = ['mcp__atlassian__', 'mcp__claude_ai_Atlassian__'];

const HEADING_RE = /^##\s+(.+?)\s*$/gm;

function isJiraWriteTool(toolName) {
  if (typeof toolName !== 'string') return false;
  for (const prefix of NAMESPACE_PREFIXES) {
    if (toolName.startsWith(prefix)) {
      const op = toolName.slice(prefix.length);
      if (WRITE_TOOLS.has(op)) return op;
    }
  }
  return null;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { buf += chunk; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

function emitContinue() {
  process.stdout.write(JSON.stringify({ continue: true }));
}

function emitDeny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}

/**
 * Extract the description string from a tool_input payload, or null.
 * Atlassian MCP accepts description either as a markdown string or as ADF.
 * For template fingerprinting we only inspect markdown payloads — ADF
 * descriptions are exempt (no `## ` headings to compare).
 */
function extractDescriptionMarkdown(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return null;
  // createJiraIssue / editJiraIssue: top-level description (markdown)
  if (typeof toolInput.description === 'string') return toolInput.description;
  // Some shapes wrap in fields.description
  if (toolInput.fields && typeof toolInput.fields.description === 'string') {
    return toolInput.fields.description;
  }
  return null;
}

function extractIssueType(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return null;
  if (typeof toolInput.issueTypeName === 'string') return toolInput.issueTypeName;
  if (toolInput.issueType && typeof toolInput.issueType.name === 'string') {
    return toolInput.issueType.name;
  }
  if (toolInput.fields && toolInput.fields.issuetype && typeof toolInput.fields.issuetype.name === 'string') {
    return toolInput.fields.issuetype.name;
  }
  return null;
}

function extractPayloadHeadings(markdown) {
  const set = new Set();
  if (!markdown) return set;
  HEADING_RE.lastIndex = 0;
  let m;
  while ((m = HEADING_RE.exec(markdown)) !== null) {
    set.add(m[1].trim());
  }
  return set;
}

function isSubset(payloadSet, templateSet) {
  for (const h of payloadSet) {
    if (!templateSet.has(h)) return { ok: false, missing: h };
  }
  return { ok: true };
}

function projectRoot() {
  // Hooks run with cwd at the user's repo root in normal use. Allow override
  // via env for tests.
  return process.env.JIRA_GUARD_PROJECT_ROOT || process.cwd();
}

async function main() {
  let stdin;
  try {
    stdin = await readStdin();
  } catch (e) {
    process.stderr.write(`pre-tool-jira-write-guard: stdin read error: ${e.message}\n`);
    return emitContinue();
  }

  let envelope;
  try {
    envelope = JSON.parse(stdin || '{}');
  } catch (e) {
    process.stderr.write('pre-tool-jira-write-guard: malformed envelope JSON; allowing through\n');
    return emitContinue();
  }

  const toolName = envelope && envelope.tool_name;
  const op = isJiraWriteTool(toolName);
  if (!op) {
    return emitContinue();
  }

  const toolInput = envelope.tool_input;
  if (!toolInput || typeof toolInput !== 'object') {
    process.stderr.write('pre-tool-jira-write-guard: missing tool_input; allowing (defense-in-depth)\n');
    return emitContinue();
  }

  // (a) C13 placeholder check
  let markers;
  try {
    markers = findPlaceholders(toolInput);
  } catch (e) {
    process.stderr.write(`pre-tool-jira-write-guard: placeholder scan error: ${e.message}\n`);
    return emitContinue();
  }
  if (markers.length > 0) {
    const sample = markers.slice(0, 3).map((m) => `${m.path}:${m.marker}`).join(', ');
    return emitDeny(`R19/C13: unfilled placeholder marker(s) in payload — ${sample}`);
  }

  // (b) R18 template fingerprint (createJiraIssue / editJiraIssue with description only)
  if (op === 'createJiraIssue' || op === 'editJiraIssue') {
    const description = extractDescriptionMarkdown(toolInput);
    if (description !== null && description !== '') {
      const issueType = extractIssueType(toolInput);
      if (!issueType) {
        return emitDeny('R18: cannot enforce template — issue type missing from payload');
      }
      const tpl = loadTemplateHeadings(issueType, projectRoot());
      if (!tpl.source) {
        return emitDeny(`R18: no template found for issue type "${issueType}" (override or shipped)`);
      }
      const payloadHeadings = extractPayloadHeadings(description);
      const subset = isSubset(payloadHeadings, tpl.headings);
      if (!subset.ok) {
        return emitDeny(`R18: template mismatch — heading "${subset.missing}" not in ${tpl.source} template for "${issueType}"`);
      }
    } else if (op === 'createJiraIssue') {
      // Create requires a description-bearing template per R18.
      return emitDeny('R18: createJiraIssue requires a templated description');
    }
  }

  // (c)+(d) artifact verification
  let hash;
  try {
    hash = payloadHash(toolInput);
  } catch (e) {
    process.stderr.write(`pre-tool-jira-write-guard: hash error: ${e.message}\n`);
    return emitContinue();
  }
  const v = verifyArtifacts(hash);
  if (!v.approval || !v.critique) {
    return emitDeny(`R17/R20/R21: ${v.reason || 'artifact verification failed'} (hash=${hash.slice(0, 12)}…)`);
  }

  // Success — consume artifacts so they cannot be re-used for a different tool call.
  try { consumeArtifacts(hash); } catch { /* best-effort */ }
  // Best-effort housekeeping — runs only on the success path so a "stale" verdict
  // is reported as such by verifyArtifacts before the file is swept.
  try { purgeStale(); } catch { /* noop */ }
  return emitContinue();
}

main().catch((e) => {
  process.stderr.write(`pre-tool-jira-write-guard: uncaught error: ${e && e.stack || e}\n`);
  emitContinue();
});
