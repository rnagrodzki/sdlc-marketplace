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
const { payloadHash, canonicalize } = require(path.join(LIB_ROOT, 'payload-hash.js'));
const { findPlaceholdersForToolInput } = require(path.join(LIB_ROOT, 'placeholder-detect.js'));
const { loadTemplateHeadings } = require(path.join(LIB_ROOT, 'template-fingerprint.js'));
const {
  verifyArtifacts,
  consumeArtifacts,
  purgeStale,
  debugDir,
  atomicWrite,
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

// Max characters of an offending Acceptance Criteria line to embed in a deny
// reason. Lines longer than this are truncated with a single-character
// ellipsis (`…`) so the deny payload stays small.
const MAX_EXCERPT_LEN = 120;

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
  // KEEP: hook entry point — do not change to resolveSdlcRoot()
  return process.env.JIRA_GUARD_PROJECT_ROOT || process.cwd();
}

/**
 * Check that the `## Acceptance Criteria` section (if present) in a markdown
 * description contains only GitHub-flavored checklist items (- [ ] / - [x] / - [X]).
 *
 * Returns null when the section is absent (permissive fallback for edits that
 * don't touch AC) or when every non-blank line in the section is a valid
 * checklist item.
 *
 * Returns a quoted excerpt of the first offending line on violation.
 *
 * Implements R25/G15 deterministic gate (spec #412).
 */
function checkAcceptanceCriteriaChecklist(markdown) {
  if (!markdown || typeof markdown !== 'string') return null;

  // Locate ## Acceptance Criteria heading (case-insensitive, optional trailing colon).
  const acHeadingRe = /^##\s+Acceptance Criteria[:\s]*$/im;
  const headingMatch = acHeadingRe.exec(markdown);
  if (!headingMatch) {
    // Section absent — permissive: skip check (covers partial edits per R25 spec).
    return null;
  }

  // Extract the section body from after the heading to the next ## heading or end-of-string.
  const afterHeading = markdown.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingIdx = afterHeading.search(/^##\s/m);
  const sectionBody = nextHeadingIdx === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIdx);

  // Checklist item regex: optional leading spaces, dash, space, bracket pair, content.
  // Allows: - [ ] ..., - [x] ..., - [X] ... (optionally indented for nested criteria).
  const checklistRe = /^[\t ]*-\s\[[\sxX]\]\s+\S/;

  for (const rawLine of sectionBody.split('\n')) {
    const line = rawLine.trimEnd();
    if (line.trim() === '') continue; // blank lines are fine
    if (!checklistRe.test(line)) {
      // Quote the offending line (truncate at MAX_EXCERPT_LEN chars to avoid
      // giant deny reasons). Reserve 3 chars for the trailing ellipsis so the
      // final string length stays at MAX_EXCERPT_LEN.
      const excerpt =
        line.length > MAX_EXCERPT_LEN
          ? line.slice(0, MAX_EXCERPT_LEN - 3) + '…'
          : line;
      return `"${excerpt}"`;
    }
  }

  return null; // all non-blank lines passed
}

/**
 * ADF form of the R25/G15 acceptance-criteria gate.
 *
 * Extracts a possible ADF description from tool_input (handles both raw ADF
 * object and JSON-stringified ADF). Walks the top-level `doc.content[]` to
 * find a heading node with text "Acceptance Criteria" (case-insensitive).
 * Then inspects the sibling content nodes until the next heading node.
 *
 * Each non-heading sibling MUST be a `taskList` node (GitHub-flavored checklist
 * items per R25.2). Any other node type (e.g., `paragraph`, `bulletList`,
 * `orderedList`) is a violation.
 *
 * Returns null when:
 *   - No ADF description is present (permissive fallback).
 *   - No "Acceptance Criteria" heading is found in the ADF tree.
 *   - All sibling nodes are taskList nodes.
 *
 * Returns the offending node type string on the first violation.
 *
 * Implements R25/G15 ADF path (spec #412).
 */
function checkAcceptanceCriteriaAdf(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return null;

  // Try to extract an ADF doc object from the payload.
  let adfDoc = null;

  // Direct ADF object at top level or in fields.
  const rawDesc =
    (toolInput.description && typeof toolInput.description === 'object' ? toolInput.description : null) ||
    (toolInput.fields && toolInput.fields.description && typeof toolInput.fields.description === 'object'
      ? toolInput.fields.description
      : null);

  if (rawDesc && rawDesc.type === 'doc') {
    adfDoc = rawDesc;
  } else {
    // JSON-stringified ADF.
    const strDesc =
      (typeof toolInput.description === 'string' ? toolInput.description : null) ||
      (toolInput.fields && typeof toolInput.fields.description === 'string'
        ? toolInput.fields.description
        : null);
    if (strDesc) {
      try {
        const parsed = JSON.parse(strDesc);
        if (parsed && parsed.type === 'doc') adfDoc = parsed;
      } catch { /* not JSON — not ADF */ }
    }
  }

  if (!adfDoc || !Array.isArray(adfDoc.content)) return null;

  // Find the heading node whose text content is "Acceptance Criteria".
  let acHeadingIdx = -1;
  for (let i = 0; i < adfDoc.content.length; i++) {
    const node = adfDoc.content[i];
    if (node.type === 'heading') {
      const text = (Array.isArray(node.content) ? node.content : [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text || '')
        .join('');
      if (/acceptance criteria/i.test(text.trim())) {
        acHeadingIdx = i;
        break;
      }
    }
  }

  if (acHeadingIdx === -1) return null; // section absent — permissive

  // Inspect sibling nodes until the next heading.
  // R25.2 mandates GitHub-flavored checklist items only — only `taskList`
  // ADF nodes encode that semantic. `bulletList` / `orderedList` are
  // rejected.
  const ALLOWED_LIST_TYPES = new Set(['taskList']);
  for (let i = acHeadingIdx + 1; i < adfDoc.content.length; i++) {
    const node = adfDoc.content[i];
    if (node.type === 'heading') break; // reached next section
    if (!ALLOWED_LIST_TYPES.has(node.type)) {
      return node.type; // violation: non-taskList node in AC section
    }
  }

  return null; // all nodes are taskList
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

  // (a) C13 placeholder check (contentFormat-aware: routes ADF commentBody
  // through the ADF tree walker so JSON-array literals in the stringified
  // ADF blob never trip the bracket-form regex).
  let markers;
  let placeholderWarnings = [];
  try {
    const placeholderResult = findPlaceholdersForToolInput(toolInput);
    markers = placeholderResult.results;
    placeholderWarnings = placeholderResult.warnings || [];
  } catch (e) {
    process.stderr.write(`pre-tool-jira-write-guard: placeholder scan error: ${e.message}\n`);
    return emitContinue();
  }
  for (const w of placeholderWarnings) {
    process.stderr.write(`pre-tool-jira-write-guard: ${w}\n`);
  }
  if (markers.length > 0) {
    const sample = markers.slice(0, 3).map((m) => `${m.path}:${m.marker}`).join(', ');
    return emitDeny(`R19/C13: unfilled placeholder marker(s) in payload — ${sample}`);
  }

  // (b-pre) R25/G15 — Acceptance Criteria checklist-only gate.
  // Runs after the C13 placeholder check (a) and before the R18 fingerprint check (b).
  // Checks that the `## Acceptance Criteria` section body (when present) contains
  // only `- [ ]` / `- [x]` / `- [X]` checklist items. Other sections are not
  // checked here — they are covered by the LLM-driven Step 2.5 critique pass.
  if (op === 'createJiraIssue' || op === 'editJiraIssue') {
    const acMarkdown = extractDescriptionMarkdown(toolInput);
    if (acMarkdown !== null && acMarkdown !== '') {
      // Markdown path
      const acViolation = checkAcceptanceCriteriaChecklist(acMarkdown);
      if (acViolation !== null) {
        return emitDeny(
          `R25/G15: Acceptance Criteria section must contain only "- [ ] …" checklist items. Non-checklist line: ${acViolation}`
        );
      }
    } else {
      // ADF path: description may be an ADF object or a JSON string of an ADF object.
      const adfViolation = checkAcceptanceCriteriaAdf(toolInput);
      if (adfViolation !== null) {
        return emitDeny(
          `R25/G15: Acceptance Criteria section must contain only "- [ ] …" checklist items (ADF taskList). Non-taskList node type: ${adfViolation}`
        );
      }
    }
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
    // Spec R21: surface both hashes so the user can self-diagnose whether the
    // approval/critique was never written (artifact-hash=none) or was written
    // under a different payload hash (artifact-hash differs from hook-hash).
    const nearby = Array.isArray(v.nearbyArtifactHashes) ? v.nearbyArtifactHashes : [];
    const artifactHashStr = nearby.length
      ? nearby.map(h => `${h.slice(0, 12)}…`).join('|')
      : 'none';

    // R21.2: always-on deny-path diagnostic dump. Writes the received
    // tool_input, the canonical JSON byte-string, the hook-computed hash, and
    // the same-prefix nearby artifact hashes so the user can diff against the
    // skill's critique artifact byte-for-byte without re-triggering the
    // dispatch. Dump-write failures are swallowed — the deny is still emitted.
    // Uses `debugDir()` + `atomicWrite()` from artifact-store so the directory
    // constant matches `purgeStale()` (single TMPDIR_REAL resolution) and so a
    // crash mid-write cannot leave a partially written dump on disk.
    let dumpPath = null;
    const canonicalInput = canonicalize(toolInput);
    const canonical = JSON.stringify(canonicalInput);
    try {
      const dumpDirPath = debugDir();
      fs.mkdirSync(dumpDirPath, { recursive: true, mode: 0o700 });
      dumpPath = path.join(dumpDirPath, `${hash.slice(0, 12)}.json`);
      atomicWrite(
        dumpPath,
        JSON.stringify({
          tool_input: toolInput,
          canonical_json: canonical,
          hook_hash: hash,
          nearby_artifact_hashes: nearby,
        }, null, 2),
        { mode: 0o600 }
      );
    } catch { dumpPath = null; /* diagnostic only */ }

    // R21.2: length hints for multi-line string fields. Helps the user
    // recognize trailing-whitespace hash-mismatch failures from a single
    // failed call instead of 3–5 trial-and-error retries. We emit BOTH the
    // raw `tool_input` length and — when it differs — the canonicalized
    // length (post-`trimEnd()`). Without this, a trailing-whitespace mismatch
    // shows a hint of N while the hash was actually computed on N-k chars,
    // misleading the user into hunting for a content diff that isn't there.
    const lenHints = [];
    const pushLen = (label, raw, canon) => {
      if (typeof raw !== 'string') return;
      lenHints.push(canon !== undefined && canon !== raw.length
        ? `${label}-len=${raw.length} (canonical=${canon})`
        : `${label}-len=${raw.length}`);
    };
    pushLen('commentBody', toolInput.commentBody,
      typeof canonicalInput.commentBody === 'string' ? canonicalInput.commentBody.length : undefined);
    pushLen('description', toolInput.description,
      typeof canonicalInput.description === 'string' ? canonicalInput.description.length : undefined);
    if (toolInput.fields && typeof toolInput.fields.description === 'string') {
      const canonFD = canonicalInput.fields && typeof canonicalInput.fields.description === 'string'
        ? canonicalInput.fields.description.length
        : undefined;
      pushLen('fields.description', toolInput.fields.description, canonFD);
    }

    const extras = [
      `hook-hash=${hash.slice(0, 12)}…`,
      `artifact-hash=${artifactHashStr}`,
      ...(dumpPath ? [`dump=${dumpPath}`] : []),
      ...lenHints,
    ].join(', ');
    return emitDeny(
      `R17/R20/R21: ${v.reason || 'artifact verification failed'} (${extras})`
    );
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
