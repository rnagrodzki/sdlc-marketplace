#!/usr/bin/env node
/**
 * check-consistency.js
 * Validates structural consistency across the sdlc-utilities plugin:
 * skills and scripts (skills-primary architecture).
 *
 * Rules checked:
 *   1. script-resolution-order  — all find patterns in skill files use plugins-first
 *                                 (~/.claude/plugins before CWD)
 *   2. skill-runs-script        — skills paired with prepare scripts must contain
 *                                 the find+node resolution pattern themselves
 *                                 Pairings: review-prepare.js → review-sdlc,
 *                                           pr-prepare.js     → pr-sdlc,
 *                                           version-prepare.js → version-sdlc
 *   3. skill-uses-mktemp        — skills that run prepare scripts must write output
 *                                 to a mktemp file (not pipe directly)
 *   4. skill-checks-exit-code   — skills that run prepare scripts must capture
 *                                 EXIT_CODE=$? and handle non-zero exit codes
 *   5. skill-passes-arguments   — skills that run prepare scripts must use $ARGUMENTS
 *                                 in the node "$SCRIPT" $ARGUMENTS call
 *   6. frontmatter-field-names  — all skills must use user-invocable (not user-invokable)
 *   7. user-invocable-flag      — the 6 user-facing skills must have user-invocable: true
 *
 * Usage:
 *   node check-consistency.js [--project-root <path>] [--json]
 *
 * Exit codes: 0 = all pass, 1 = issues found, 2 = script error
 * Output: human-readable report (default) or JSON array of findings
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let projectRoot = process.cwd();
  let jsonOutput  = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project-root' && args[i + 1]) {
      projectRoot = path.resolve(args[++i]);
    } else if (args[i] === '--json') {
      jsonOutput = true;
    }
  }
  return { projectRoot, jsonOutput };
}

// ---------------------------------------------------------------------------
// File reading helpers
// ---------------------------------------------------------------------------

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function listDir(dirPath) {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

function discoverSkills(root) {
  const dir = path.join(root, 'plugins/sdlc-utilities/skills');
  return listDir(dir)
    .filter(d => isDir(path.join(dir, d)))
    .map(d => ({ name: d, file: path.join(dir, d, 'SKILL.md') }))
    .filter(s => isFile(s.file));
}

function discoverScripts(root) {
  const dir = path.join(root, 'plugins/sdlc-utilities/scripts');
  return listDir(dir).filter(f => f.endsWith('.js') && !listDir(path.join(dir, f)).length);
}

// ---------------------------------------------------------------------------
// Skill–script pairings (skills-primary architecture)
// ---------------------------------------------------------------------------

// Maps prepare script filename → skill directory name
const SCRIPT_TO_SKILL = {
  'review-prepare.js': 'review-sdlc',
  'pr-prepare.js':     'pr-sdlc',
  'version-prepare.js': 'version-sdlc',
  'jira-prepare.js':   'jira-sdlc',
};

// All 6 skills that must declare user-invocable: true
const USER_INVOCABLE_SKILLS = [
  'pr-sdlc',
  'pr-customize-sdlc',
  'review-sdlc',
  'review-init-sdlc',
  'version-sdlc',
  'jira-sdlc',
];

// ---------------------------------------------------------------------------
// Pattern matchers
// ---------------------------------------------------------------------------

// Detect if content searches CWD (.) before ~/.claude/plugins for any *.js script
function detectCwdFirstResolution(content) {
  const lines = content.split('\n');
  const findings = [];
  let cwdIdx     = -1;
  let pluginsIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/find\s+\.\s+-name\s+["'][^"']+\.js["']/.test(line)) {
      cwdIdx = i;
    }
    if (/find\s+~\/\.claude\/plugins\s+-name\s+["'][^"']+\.js["']/.test(line)) {
      pluginsIdx = i;
    }
  }

  if (cwdIdx !== -1 && pluginsIdx !== -1 && cwdIdx < pluginsIdx) {
    findings.push({ line: cwdIdx + 1, detail: 'CWD searched before ~/.claude/plugins' });
  }
  return findings;
}

// Detect if content contains a find pattern referencing a specific script name
function containsPrepareScriptExecution(content, scriptName) {
  return content.includes(`-name "${scriptName}"`) || content.includes(`-name '${scriptName}'`);
}

// Detect if content contains node "$SCRIPT" (or 'node $SCRIPT') call
function containsNodeScriptCall(content) {
  return /node\s+["']?\$SCRIPT["']?/.test(content);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/**
 * Rule 1 — script-resolution-order
 * All find patterns in skill files must use plugins-first order.
 */
function checkScriptResolutionOrder(skills, findings) {
  for (const skill of skills) {
    const content = readFile(skill.file);
    if (!content) continue;
    const issues = detectCwdFirstResolution(content);
    for (const issue of issues) {
      findings.push({
        rule: 'script-resolution-order',
        severity: 'error',
        file: path.relative(process.cwd(), skill.file),
        line: issue.line,
        message: 'Script resolution uses CWD-first order. Use plugins-first: find ~/.claude/plugins first, then fall back to find .',
      });
    }
  }
}

/**
 * Rule 2 — skill-runs-script
 * Skills paired with a prepare script must contain the find+node resolution pattern.
 */
function checkSkillRunsScript(skills, scriptNames, findings) {
  for (const [scriptName, skillName] of Object.entries(SCRIPT_TO_SKILL)) {
    if (!scriptNames.includes(scriptName)) continue; // script not present in repo — skip

    const skill = skills.find(s => s.name === skillName);
    if (!skill) {
      findings.push({
        rule: 'skill-runs-script',
        severity: 'error',
        file: `plugins/sdlc-utilities/skills/${skillName}/SKILL.md`,
        message: `Skill directory '${skillName}' not found. Expected skill paired with ${scriptName}.`,
      });
      continue;
    }

    const content = readFile(skill.file);
    if (!content) continue;

    if (!containsPrepareScriptExecution(content, scriptName) || !containsNodeScriptCall(content)) {
      findings.push({
        rule: 'skill-runs-script',
        severity: 'error',
        file: path.relative(process.cwd(), skill.file),
        message: `Skill '${skillName}' is paired with ${scriptName} but does not contain the find+node resolution pattern. Skills must run their own prepare scripts.`,
      });
    }
  }
}

/**
 * Rule 3 — skill-uses-mktemp
 * Skills that run prepare scripts must write output to a mktemp file.
 */
function checkSkillUsesMktemp(skills, scriptNames, findings) {
  for (const [scriptName, skillName] of Object.entries(SCRIPT_TO_SKILL)) {
    if (!scriptNames.includes(scriptName)) continue;

    const skill = skills.find(s => s.name === skillName);
    if (!skill) continue; // already reported in rule 2

    const content = readFile(skill.file);
    if (!content || !containsPrepareScriptExecution(content, scriptName)) continue;

    if (!content.includes('mktemp')) {
      findings.push({
        rule: 'skill-uses-mktemp',
        severity: 'error',
        file: path.relative(process.cwd(), skill.file),
        message: `Skill '${skillName}' runs ${scriptName} but does not write output to a mktemp file. Large manifests (100KB+) break shell pipes — always use mktemp.`,
      });
    }
  }
}

/**
 * Rule 4 — skill-checks-exit-code
 * Skills that run prepare scripts must capture EXIT_CODE=$? and handle non-zero exits.
 */
function checkSkillChecksExitCode(skills, scriptNames, findings) {
  for (const [scriptName, skillName] of Object.entries(SCRIPT_TO_SKILL)) {
    if (!scriptNames.includes(scriptName)) continue;

    const skill = skills.find(s => s.name === skillName);
    if (!skill) continue;

    const content = readFile(skill.file);
    if (!content || !containsPrepareScriptExecution(content, scriptName)) continue;

    if (!content.includes('EXIT_CODE')) {
      findings.push({
        rule: 'skill-checks-exit-code',
        severity: 'error',
        file: path.relative(process.cwd(), skill.file),
        message: `Skill '${skillName}' runs ${scriptName} but does not capture or check EXIT_CODE. Add: EXIT_CODE=$? and handle non-zero exit codes.`,
      });
    }
  }
}

/**
 * Rule 5 — skill-passes-arguments
 * Skills that run prepare scripts must use $ARGUMENTS in the node "$SCRIPT" $ARGUMENTS call.
 */
function checkSkillPassesArguments(skills, scriptNames, findings) {
  for (const [scriptName, skillName] of Object.entries(SCRIPT_TO_SKILL)) {
    if (!scriptNames.includes(scriptName)) continue;

    const skill = skills.find(s => s.name === skillName);
    if (!skill) continue;

    const content = readFile(skill.file);
    if (!content || !containsPrepareScriptExecution(content, scriptName)) continue;

    if (!content.includes('$ARGUMENTS')) {
      findings.push({
        rule: 'skill-passes-arguments',
        severity: 'warning',
        file: path.relative(process.cwd(), skill.file),
        message: `Skill '${skillName}' runs ${scriptName} but does not use $ARGUMENTS. Use: node "$SCRIPT" $ARGUMENTS`,
      });
    }
  }
}

/**
 * Rule 6 — frontmatter-field-names
 * All skills must use user-invocable (not the deprecated user-invokable).
 */
function checkFrontmatterFieldNames(skills, findings) {
  for (const skill of skills) {
    const content = readFile(skill.file);
    if (!content) continue;

    if (content.includes('user-invokable')) {
      const lineNum = content.split('\n').findIndex(l => l.includes('user-invokable')) + 1;
      findings.push({
        rule: 'frontmatter-field-names',
        severity: 'error',
        file: path.relative(process.cwd(), skill.file),
        line: lineNum,
        message: "Deprecated frontmatter field 'user-invokable' found. Use 'user-invocable' instead.",
      });
    }
  }
}

/**
 * Rule 7 — user-invocable-flag
 * All 6 user-facing skills must declare user-invocable: true in frontmatter.
 */
function checkUserInvocableFlag(skills, findings) {
  for (const skillName of USER_INVOCABLE_SKILLS) {
    const skill = skills.find(s => s.name === skillName);
    if (!skill) {
      findings.push({
        rule: 'user-invocable-flag',
        severity: 'error',
        file: `plugins/sdlc-utilities/skills/${skillName}/SKILL.md`,
        message: `Skill '${skillName}' not found. All 6 user-facing skills must exist with user-invocable: true.`,
      });
      continue;
    }

    const content = readFile(skill.file);
    if (!content) continue;

    // Extract frontmatter block (between first --- and second ---)
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = fmMatch ? fmMatch[1] : '';

    if (!frontmatter.includes('user-invocable: true')) {
      const lineNum = content.split('\n').findIndex(l => l.includes('user-invocable')) + 1;
      findings.push({
        rule: 'user-invocable-flag',
        severity: 'error',
        file: path.relative(process.cwd(), skill.file),
        line: lineNum > 0 ? lineNum : undefined,
        message: `Skill '${skillName}' must have 'user-invocable: true' in frontmatter.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { projectRoot, jsonOutput } = parseArgs(process.argv);

  const pluginRoot = path.join(projectRoot, 'plugins/sdlc-utilities');
  if (!isDir(pluginRoot)) {
    process.stderr.write(`ERROR: Plugin directory not found: ${pluginRoot}\n`);
    process.stderr.write(`Run this script from the sdlc-marketplace repository root, or pass --project-root.\n`);
    process.exit(2);
  }

  const skills      = discoverSkills(projectRoot);
  const scriptNames = discoverScripts(projectRoot);

  const findings = [];

  checkScriptResolutionOrder(skills, findings);
  checkSkillRunsScript(skills, scriptNames, findings);
  checkSkillUsesMktemp(skills, scriptNames, findings);
  checkSkillChecksExitCode(skills, scriptNames, findings);
  checkSkillPassesArguments(skills, scriptNames, findings);
  checkFrontmatterFieldNames(skills, findings);
  checkUserInvocableFlag(skills, findings);

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(findings, null, 2) + '\n');
    process.exit(findings.length > 0 ? 1 : 0);
  }

  // Human-readable output
  const errors   = findings.filter(f => f.severity === 'error');
  const warnings = findings.filter(f => f.severity === 'warning');

  if (findings.length === 0) {
    process.stdout.write('✓ All consistency checks passed.\n');
    process.exit(0);
  }

  process.stdout.write(`Plugin consistency check: ${errors.length} error(s), ${warnings.length} warning(s)\n\n`);

  for (const f of findings) {
    const loc  = f.line ? `:${f.line}` : '';
    const icon = f.severity === 'error' ? '✗' : '⚠';
    process.stdout.write(`${icon} [${f.rule}] ${f.file}${loc}\n  ${f.message}\n\n`);
  }

  process.exit(findings.length > 0 ? 1 : 0);
}

main();
