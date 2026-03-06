#!/usr/bin/env node
/**
 * check-consistency.js
 * Validates structural consistency across the sdlc-utilities plugin:
 * commands, skills, scripts, and docs.
 *
 * Rules checked:
 *   1. Script resolution order — all find patterns use plugins-first, then CWD
 *   2. Command runs script — commands with matching *-prepare.js must contain
 *      the find+node pattern themselves, not delegate it to the skill
 *   3. Skill receives context — skills paired with prepare scripts must NOT
 *      contain find+node patterns for those prepare scripts
 *   4. Argument passthrough — commands use $ARGUMENTS when calling prepare scripts
 *   5. Frontmatter field names — all skills use user-invocable (not user-invokable)
 *   6. Command docs exist — every command has docs/commands/<name>.md
 *   7. Temp file pattern — commands that run scripts must write to mktemp
 *   8. Exit code handling — bash blocks must guard exit codes after node runs
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

function discoverCommands(root) {
  const dir = path.join(root, 'plugins/sdlc-utilities/commands');
  return listDir(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: f.replace(/\.md$/, ''), file: path.join(dir, f) }));
}

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

function discoverDocs(root) {
  const dir = path.join(root, 'docs/commands');
  return listDir(dir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
}

// ---------------------------------------------------------------------------
// Pattern matchers
// ---------------------------------------------------------------------------

// Matches: find ~/.claude/plugins -name "<script>" ...
const RE_PLUGINS_FIRST = /find\s+~\/\.claude\/plugins\s+-name\s+["']([^"']+)["']/g;
// Matches: find . -name "<script>" ...
const RE_CWD_FIRST = /find\s+\.\s+-name\s+["']([^"']+)["']/g;

// Detect blocks that do CWD-first (bad) — find . comes before find ~/.claude/plugins
function detectCwdFirstResolution(content, scriptName) {
  const lines = content.split('\n');
  const findings = [];
  let cwdIdx = -1;
  let pluginsIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const scriptPat = scriptName ? scriptName : '[^"\']+\\.js';
    if (new RegExp(`find\\s+\\.\\s+-name\\s+["']${scriptPat}["']`).test(line)) {
      cwdIdx = i;
    }
    if (new RegExp(`find\\s+~\\/\\.claude\\/plugins\\s+-name\\s+["']${scriptPat}["']`).test(line)) {
      pluginsIdx = i;
    }
  }

  if (cwdIdx !== -1 && pluginsIdx !== -1 && cwdIdx < pluginsIdx) {
    findings.push({ line: cwdIdx + 1, detail: 'CWD searched before ~/.claude/plugins' });
  }
  return findings;
}

// Detect if content contains a find+node pattern for a given script
function containsPrepareScriptExecution(content, scriptName) {
  return content.includes(`-name "${scriptName}"`) || content.includes(`-name '${scriptName}'`);
}

// Detect if content contains node "$SCRIPT" call (script execution)
function containsNodeScriptCall(content) {
  return /node\s+["']?\$SCRIPT["']?/.test(content);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function checkScriptResolutionOrder(commands, skills, findings) {
  // Rule 1: All find patterns use plugins-first
  for (const cmd of commands) {
    const content = readFile(cmd.file);
    if (!content) continue;
    const issues = detectCwdFirstResolution(content);
    for (const issue of issues) {
      findings.push({
        rule: 'script-resolution-order',
        severity: 'error',
        file: path.relative(process.cwd(), cmd.file),
        line: issue.line,
        message: `Script resolution uses CWD-first order. Use plugins-first: find ~/.claude/plugins first, then fall back to find .`,
      });
    }
  }

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
        message: `Script resolution uses CWD-first order. Use plugins-first: find ~/.claude/plugins first, then fall back to find .`,
      });
    }
  }
}

// Derive the expected prepare script name from a command name
function prepareScriptFor(commandName) {
  return `${commandName}-prepare.js`;
}

// Derive the expected skill name from a command name (heuristic)
function skillForCommand(commandName) {
  // e.g. "review" → "sdlc-reviewing-changes", "pr" → "sdlc-creating-pull-requests"
  const map = {
    review: 'sdlc-reviewing-changes',
    pr: 'sdlc-creating-pull-requests',
    version: 'sdlc-versioning-releases',
    'review-init': 'sdlc-initializing-review-dimensions',
    'pr-customize': 'sdlc-customizing-pr-template',
    'plugin-check': 'sdlc-validating-plugin-discovery',
  };
  return map[commandName] || null;
}

function checkCommandRunsScript(commands, scriptNames, skillMap, findings) {
  // Rule 2: Commands with a matching *-prepare.js must contain find+node themselves
  for (const cmd of commands) {
    const scriptName = prepareScriptFor(cmd.name);
    if (!scriptNames.includes(scriptName)) continue; // no prepare script for this command

    const content = readFile(cmd.file);
    if (!content) continue;

    if (!containsPrepareScriptExecution(content, scriptName)) {
      findings.push({
        rule: 'command-runs-script',
        severity: 'error',
        file: path.relative(process.cwd(), cmd.file),
        message: `Command has a matching prepare script (${scriptName}) but does not contain the find+node resolution pattern. The command must run the script and pass MANIFEST_JSON to the skill.`,
      });
    }
  }
}

function checkSkillReceivesContext(skills, scriptNames, findings) {
  // Rule 3: Skills paired with prepare scripts must NOT execute those scripts
  // (they should receive pre-computed JSON from the command)
  const prepareScriptToSkill = {
    'review-prepare.js': 'sdlc-reviewing-changes',
    'pr-prepare.js': 'sdlc-creating-pull-requests',
    'version-prepare.js': 'sdlc-versioning-releases',
  };

  for (const skill of skills) {
    const expectedScript = Object.keys(prepareScriptToSkill).find(
      s => prepareScriptToSkill[s] === skill.name
    );
    if (!expectedScript) continue; // skill not paired with a prepare script

    const content = readFile(skill.file);
    if (!content) continue;

    if (containsPrepareScriptExecution(content, expectedScript) && containsNodeScriptCall(content)) {
      findings.push({
        rule: 'skill-receives-context',
        severity: 'error',
        file: path.relative(process.cwd(), skill.file),
        message: `Skill contains find+node execution of ${expectedScript}. The command should run the script and pass pre-computed context to the skill instead.`,
      });
    }
  }
}

function checkArgumentPassthrough(commands, scriptNames, findings) {
  // Rule 4: Commands that run prepare scripts must use $ARGUMENTS for passthrough
  for (const cmd of commands) {
    const scriptName = prepareScriptFor(cmd.name);
    if (!scriptNames.includes(scriptName)) continue;

    const content = readFile(cmd.file);
    if (!content || !containsPrepareScriptExecution(content, scriptName)) continue;

    // Check that node "$SCRIPT" is followed by $ARGUMENTS somewhere on the same or next logical line
    if (!content.includes('$ARGUMENTS')) {
      findings.push({
        rule: 'argument-passthrough',
        severity: 'warning',
        file: path.relative(process.cwd(), cmd.file),
        message: `Command runs ${scriptName} but does not use $ARGUMENTS for passthrough. Use: node "$SCRIPT" $ARGUMENTS`,
      });
    }
  }
}

function checkFrontmatterFieldNames(skills, findings) {
  // Rule 5: All skills must use user-invocable (not user-invokable)
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
        message: `Deprecated frontmatter field 'user-invokable' found. Use 'user-invocable' instead.`,
      });
    }
  }
}

function checkCommandDocsExist(commands, docNames, findings) {
  // Rule 6: Every command must have a matching docs/commands/<name>.md
  for (const cmd of commands) {
    if (!docNames.includes(cmd.name)) {
      findings.push({
        rule: 'command-docs-exist',
        severity: 'warning',
        file: path.relative(process.cwd(), cmd.file),
        message: `Missing documentation file: docs/commands/${cmd.name}.md`,
      });
    }
  }
}

function checkTempFilePattern(commands, scriptNames, findings) {
  // Rule 7: Commands that run scripts must use mktemp (not pipe directly)
  for (const cmd of commands) {
    const scriptName = prepareScriptFor(cmd.name);
    if (!scriptNames.includes(scriptName)) continue;

    const content = readFile(cmd.file);
    if (!content || !containsPrepareScriptExecution(content, scriptName)) continue;

    if (!content.includes('mktemp')) {
      findings.push({
        rule: 'temp-file-pattern',
        severity: 'error',
        file: path.relative(process.cwd(), cmd.file),
        message: `Command runs ${scriptName} but does not write output to a mktemp file. Large manifests (100KB+) break shell pipes — always use mktemp.`,
      });
    }
  }
}

function checkExitCodeHandling(commands, scriptNames, findings) {
  // Rule 8: Commands that run scripts must check EXIT_CODE after node invocation
  for (const cmd of commands) {
    const scriptName = prepareScriptFor(cmd.name);
    if (!scriptNames.includes(scriptName)) continue;

    const content = readFile(cmd.file);
    if (!content || !containsPrepareScriptExecution(content, scriptName)) continue;

    if (!content.includes('EXIT_CODE')) {
      findings.push({
        rule: 'exit-code-handling',
        severity: 'error',
        file: path.relative(process.cwd(), cmd.file),
        message: `Command runs ${scriptName} but does not capture or check EXIT_CODE. Add: EXIT_CODE=$? and handle non-zero exit codes.`,
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

  const commands   = discoverCommands(projectRoot);
  const skills     = discoverSkills(projectRoot);
  const scriptNames = discoverScripts(projectRoot);
  const docNames   = discoverDocs(projectRoot);

  const findings = [];

  checkScriptResolutionOrder(commands, skills, findings);
  checkCommandRunsScript(commands, scriptNames, {}, findings);
  checkSkillReceivesContext(skills, scriptNames, findings);
  checkArgumentPassthrough(commands, scriptNames, findings);
  checkFrontmatterFieldNames(skills, findings);
  checkCommandDocsExist(commands, docNames, findings);
  checkTempFilePattern(commands, scriptNames, findings);
  checkExitCodeHandling(commands, scriptNames, findings);

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
    const loc = f.line ? `:${f.line}` : '';
    const icon = f.severity === 'error' ? '✗' : '⚠';
    process.stdout.write(`${icon} [${f.rule}] ${f.file}${loc}\n  ${f.message}\n\n`);
  }

  process.exit(findings.length > 0 ? 1 : 0);
}

main();
