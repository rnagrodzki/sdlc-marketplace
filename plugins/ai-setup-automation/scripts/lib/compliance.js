'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Valid Claude Code built-in tools (from aisa-evolve-principles/SKILL.md)
// ---------------------------------------------------------------------------

const VALID_TOOLS = new Set([
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
  'WebFetch', 'WebSearch', 'TodoWrite', 'Skill', 'ToolSearch', 'Task',
]);

// ---------------------------------------------------------------------------
// Skill principle patterns (P1, P2, P3) — from aisa-evolve-validate/REFERENCE.md
// ---------------------------------------------------------------------------

const SKILL_LEARNING_PATTERNS = [
  /learnings\/log\.md/i,
  /learning\s+capture/i,
  /capture.*learnings/i,
  /learnings.*capture/i,
];

const SKILL_QUALITY_GATE_PATTERNS = [
  /quality\s+gates?/i,
  /pass\s+criteria/i,
  /fail\s+action/i,
  /self-review/i,
  /critique.*before/i,
  /review.*before.*deliver/i,
];

const SKILL_PCIDCI_EXTRA_PATTERNS = [
  /critique/i,
  /verify.*before/i,
  /check.*pass/i,
];

// ---------------------------------------------------------------------------
// Agent principle patterns (A4, A5) — from aisa-evolve-validate/REFERENCE.md
// ---------------------------------------------------------------------------

const AGENT_SELF_REVIEW_PATTERNS = [
  /self-review/i,
  /review.*before.*deliver/i,
  /critique.*before/i,
  /quality\s+gate/i,
  /validate.*output/i,
  /re-read.*output/i,
  /check.*pass.*criteria/i,
];

const AGENT_LEARNING_PATTERNS = [
  /learning\s+capture/i,
  /learnings\/log\.md/i,
];

// ---------------------------------------------------------------------------
// Capability-tool mapping (A3) — from aisa-evolve-principles/SKILL.md
// ---------------------------------------------------------------------------

// Each entry: capability keywords in body → required tool(s)
// Returns warnings (not hard failures) since capability words appear in many contexts.
const CAPABILITY_TOOL_MAP = [
  { patterns: [/\brun\b/i, /\bexecute\b/i, /\blint\b/i, /\bcompile\b/i], tools: ['Bash'], label: 'run/execute/lint/compile' },
  { patterns: [/\bsearch\s+web\b/i, /\blook\s+up\b/i], tools: ['WebSearch'], label: 'search web' },
  { patterns: [/\bfetch\s+url\b/i, /\bdownload\b/i], tools: ['WebFetch'], label: 'fetch URL' },
  { patterns: [/\bload\s+skill\b/i, /\binvoke\s+skill\b/i], tools: ['Skill'], label: 'load/invoke skill' },
];

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function anyMatch(content, patterns) {
  return patterns.some(p => p.test(content));
}

// Strip frontmatter from content, returning only the body below the closing ---
function stripFrontmatter(content) {
  const fmMatch = content.match(/^---\n[\s\S]*?\n---\n/);
  return fmMatch ? content.slice(fmMatch[0].length) : content;
}

// ---------------------------------------------------------------------------
// Skill compliance — P1, P2, P3
// ---------------------------------------------------------------------------

function evaluateSkillCompliance(name, content) {
  const has_learning_capture = anyMatch(content, SKILL_LEARNING_PATTERNS);
  const has_quality_gates = anyMatch(content, SKILL_QUALITY_GATE_PATTERNS);
  const has_pcidci_workflow = has_quality_gates || anyMatch(content, SKILL_PCIDCI_EXTRA_PATTERNS);
  const exempt_from_gates = name.startsWith('openspec-');
  return { has_quality_gates, has_learning_capture, has_pcidci_workflow, exempt_from_gates };
}

// ---------------------------------------------------------------------------
// Agent compliance — A1 (frontmatter), A2 (tools)
// ---------------------------------------------------------------------------

function checkFrontmatterValid(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { pass: false, missing_fields: ['name', 'description', 'model'] };
  const fm = fmMatch[1];
  const required = ['name', 'description', 'model'];
  const missing = required.filter(field => !new RegExp(`^${field}\\s*:`, 'm').test(fm));
  return { pass: missing.length === 0, missing_fields: missing };
}

function checkToolsValid(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { pass: false, invalid_tools: [] };
  const fm = fmMatch[1];
  const toolsMatch = fm.match(/^tools\s*:\s*(.+)/m);
  if (!toolsMatch) return { pass: true, invalid_tools: [], omitted: true };
  const tools = toolsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
  const invalid = tools.filter(tool => {
    const base = tool.replace(/\s*\(.*\)/, '').trim();
    return !VALID_TOOLS.has(base);
  });
  return { pass: invalid.length === 0, invalid_tools: invalid };
}

// ---------------------------------------------------------------------------
// Agent compliance — A3 (capability-tool consistency)
// ---------------------------------------------------------------------------

/**
 * Check capability-tool consistency (A3).
 * Scans agent body (below frontmatter) for capability keywords.
 * Cross-references against declared tools.
 * Returns warnings only — not hard failures (per spec: "flag for review").
 */
function checkCapabilityToolConsistency(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const fm = fmMatch ? fmMatch[1] : '';
  const toolsMatch = fm.match(/^tools\s*:\s*(.+)/m);

  // If tools: is omitted, all tools are available — no capability mismatch possible
  if (!toolsMatch) return { pass: true, warnings: [], all_tools: true };

  const declaredTools = new Set(
    toolsMatch[1].split(',').map(t => t.replace(/\s*\(.*\)/, '').trim())
  );

  const body = stripFrontmatter(content);
  const warnings = [];

  for (const { patterns, tools, label } of CAPABILITY_TOOL_MAP) {
    if (anyMatch(body, patterns)) {
      const missing = tools.filter(t => !declaredTools.has(t));
      if (missing.length > 0) {
        warnings.push({ capability: label, expected_tools: tools, missing_tools: missing });
      }
    }
  }

  return { pass: warnings.length === 0, warnings };
}

// ---------------------------------------------------------------------------
// Agent compliance — A6 (skill references valid)
// ---------------------------------------------------------------------------

/**
 * Check that all .claude/skills/X and .claude/agents/X references in an
 * agent file resolve to real files on disk.
 */
function checkSkillReferencesValid(content, projectRoot) {
  const body = stripFrontmatter(content);
  // Match .claude/skills/<name> or .claude/agents/<name> with optional .md extension
  const refPattern = /\.claude\/(?:skills|agents)\/([a-zA-Z0-9_-]+(?:\.md)?)/g;
  const missing = [];
  let match;

  while ((match = refPattern.exec(body)) !== null) {
    const ref = match[0];
    const refPath = path.join(projectRoot, ref);
    const refPathMd = refPath.endsWith('.md') ? refPath : refPath + '.md';
    const refPathDir = refPath.endsWith('.md') ? refPath.slice(0, -3) : refPath;

    // Try: exact match, .md suffix, subdirectory with SKILL.md
    const exists = fs.existsSync(refPath)
      || fs.existsSync(refPathMd)
      || fs.existsSync(path.join(refPathDir, 'SKILL.md'))
      || fs.existsSync(path.join(refPathDir, 'AGENT.md'));

    if (!exists) {
      missing.push(ref);
    }
  }

  // Deduplicate
  const uniqueMissing = [...new Set(missing)];
  return { pass: uniqueMissing.length === 0, missing: uniqueMissing };
}

// ---------------------------------------------------------------------------
// Full agent compliance evaluation (A1-A5)
// ---------------------------------------------------------------------------

function evaluateAgentCompliance(content) {
  return {
    frontmatter_valid: checkFrontmatterValid(content).pass,
    tools_valid: checkToolsValid(content).pass,
    has_self_review: anyMatch(content, AGENT_SELF_REVIEW_PATTERNS),
    has_learning_capture: anyMatch(content, AGENT_LEARNING_PATTERNS),
  };
}

module.exports = {
  VALID_TOOLS,
  SKILL_LEARNING_PATTERNS,
  SKILL_QUALITY_GATE_PATTERNS,
  SKILL_PCIDCI_EXTRA_PATTERNS,
  AGENT_SELF_REVIEW_PATTERNS,
  AGENT_LEARNING_PATTERNS,
  anyMatch,
  stripFrontmatter,
  evaluateSkillCompliance,
  evaluateAgentCompliance,
  checkFrontmatterValid,
  checkToolsValid,
  checkCapabilityToolConsistency,
  checkSkillReferencesValid,
};
