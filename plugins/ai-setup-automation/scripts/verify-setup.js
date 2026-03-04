#!/usr/bin/env node
/**
 * verify-setup.js
 * Mechanical verification of .claude/ skills and agents.
 *
 * Usage:
 *   node verify-setup.js <mode> [options]
 *
 * Modes:
 *   validate    Principle compliance checks (P1-P3 skills, A1-A6 agents)
 *   health      Fast-pass health checks (Pass A, G, CLAUDE.md table diff)
 *   audit       Full Mechanical Verification Protocol (Passes A-G)
 *
 * Options:
 *   --project-root <path>   Project root (default: cwd)
 *   --target <file|dir>     Scope to specific file(s) — validate mode only
 *   --json                  JSON output to stdout (default)
 *   --markdown              Formatted markdown output to stdout
 *   --no-cache              Skip snapshot.json, force full scan
 *   --src-dir <path>        Source dir for symbol/route grep (default: auto-detect)
 *
 * Exit codes: 0 = all pass, 1 = issues found, 2 = script error
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const { safeHashFile, getFileMetadata } = require('./lib/hashing');
const { discoverSkillFiles, discoverAgentFiles } = require('./lib/discovery');
const {
  evaluateSkillCompliance,
  evaluateAgentCompliance,
  checkFrontmatterValid,
  checkToolsValid,
  checkCapabilityToolConsistency,
  checkSkillReferencesValid,
  anyMatch,
  AGENT_SELF_REVIEW_PATTERNS,
  AGENT_LEARNING_PATTERNS,
} = require('./lib/compliance');
const { countLearningEntries } = require('./lib/learnings');
const { hashProjectIndicators } = require('./lib/project');
const {
  extractFilePaths,
  extractSymbols,
  extractCodeBlocks,
  extractErrorCodes,
  extractApiRoutes,
} = require('./lib/extract');
const { diffClaudeMdVsDisk } = require('./lib/claude-md');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let mode = null;
  let projectRoot = process.cwd();
  let target = null;
  let outputFormat = 'json';
  let useCache = true;
  let srcDir = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--project-root' && args[i + 1]) {
      projectRoot = path.resolve(args[++i]);
    } else if (a === '--target' && args[i + 1]) {
      target = args[++i];
    } else if (a === '--src-dir' && args[i + 1]) {
      srcDir = path.resolve(args[++i]);
    } else if (a === '--json') {
      outputFormat = 'json';
    } else if (a === '--markdown') {
      outputFormat = 'markdown';
    } else if (a === '--no-cache') {
      useCache = false;
    } else if (['validate', 'health', 'audit'].includes(a)) {
      mode = a;
    }
  }

  if (!mode) {
    process.stderr.write('Usage: node verify-setup.js <validate|health|audit> [options]\n');
    process.exit(2);
  }

  return { mode, projectRoot, target, outputFormat, useCache, srcDir };
}

// ---------------------------------------------------------------------------
// Shared: cache loading and hash comparison
// ---------------------------------------------------------------------------

function loadSnapshot(projectRoot) {
  const snapshotPath = path.join(projectRoot, '.claude', 'cache', 'snapshot.json');
  if (!fs.existsSync(snapshotPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * Compare current files against snapshot hashes.
 * Returns per-file status: UNCHANGED | MODIFIED | NEW | DELETED
 */
function getCacheComparison(projectRoot, snapshot, skills, agents) {
  if (!snapshot) {
    return {
      snapshotExists: false,
      snapshotAge: null,
      skills: skills.map(s => ({ ...s, cacheStatus: 'NEW' })),
      agents: agents.map(a => ({ ...a, cacheStatus: 'NEW' })),
      indicatorsChanged: 0,
    };
  }

  const age = Date.now() - new Date(snapshot.generated_at).getTime();

  const skillsWithStatus = skills.map(s => {
    const current = safeHashFile(s.absolutePath);
    const cached = snapshot.skills?.[s.name]?.sha256;
    const cacheStatus = !cached ? 'NEW' : cached === current ? 'UNCHANGED' : 'MODIFIED';
    return { ...s, cacheStatus, cachedCompliance: snapshot.skills?.[s.name] };
  });

  const agentsWithStatus = agents.map(a => {
    const current = safeHashFile(a.absolutePath);
    const cached = snapshot.agents?.[a.name]?.sha256;
    const cacheStatus = !cached ? 'NEW' : cached === current ? 'UNCHANGED' : 'MODIFIED';
    return { ...a, cacheStatus, cachedCompliance: snapshot.agents?.[a.name] };
  });

  // Deleted items (in cache but not on disk)
  const diskSkillNames = new Set(skills.map(s => s.name));
  const diskAgentNames = new Set(agents.map(a => a.name));
  const deletedSkills = Object.keys(snapshot.skills || {}).filter(n => !diskSkillNames.has(n));
  const deletedAgents = Object.keys(snapshot.agents || {}).filter(n => !diskAgentNames.has(n));

  // Project indicator changes
  const currentIndicators = hashProjectIndicators(projectRoot);
  const indicatorsChanged = Object.entries(currentIndicators).filter(
    ([k, v]) => v !== (snapshot.project_indicators?.[k] ?? null)
  ).length;

  return {
    snapshotExists: true,
    snapshotAge: age,
    skills: skillsWithStatus,
    agents: agentsWithStatus,
    deletedSkills,
    deletedAgents,
    indicatorsChanged,
  };
}

// ---------------------------------------------------------------------------
// VALIDATE mode
// ---------------------------------------------------------------------------

function validateMode(projectRoot, opts) {
  const snapshot = opts.useCache ? loadSnapshot(projectRoot) : null;
  const allSkills = discoverSkillFiles(projectRoot);
  const allAgents = discoverAgentFiles(projectRoot);

  // Apply --target filter
  let skills = allSkills;
  let agents = allAgents;
  if (opts.target) {
    const t = path.resolve(opts.target);
    skills = allSkills.filter(s => s.absolutePath.startsWith(t) || s.absolutePath === t);
    agents = allAgents.filter(a => a.absolutePath.startsWith(t) || a.absolutePath === t);
  }

  const comparison = getCacheComparison(projectRoot, snapshot, skills, agents);
  let cacheHits = 0;

  // Skill validation
  const skillResults = [];
  for (const skill of comparison.skills) {
    // Use cached compliance if unchanged and cache is fresh
    if (skill.cacheStatus === 'UNCHANGED' && skill.cachedCompliance) {
      const c = skill.cachedCompliance;
      if (c.has_learning_capture !== false && (c.exempt_from_gates || c.has_quality_gates !== false)) {
        cacheHits++;
        skillResults.push({
          name: skill.name,
          path: skill.relativePath,
          source: 'cache',
          check_2a_learning: c.has_learning_capture,
          check_2b_quality_gates: c.has_quality_gates,
          check_2c_pcidci: c.has_pcidci_workflow,
          exempt_from_gates: c.exempt_from_gates,
          status: 'PASS',
          issues: [],
        });
        continue;
      }
    }

    let content;
    try {
      content = fs.readFileSync(skill.absolutePath, 'utf-8');
    } catch (e) {
      process.stderr.write(`Warning: Cannot read ${skill.absolutePath}: ${e.message}\n`);
      continue;
    }

    const compliance = evaluateSkillCompliance(skill.name, content);
    const issues = [];

    if (!compliance.has_learning_capture) {
      issues.push({
        check: '2a',
        message: 'Missing Learning Capture section',
        proposed_fix: 'Add ## Learning Capture section referencing .claude/learnings/log.md with trigger conditions and entry format',
      });
    }
    if (!compliance.exempt_from_gates && !compliance.has_quality_gates) {
      issues.push({
        check: '2b',
        message: 'Missing Quality Gates / critique-improve cycle',
        proposed_fix: 'Add ## Quality Gates section with gate table (trigger, check, pass criteria, fail action, max iterations)',
      });
    }
    if (!compliance.has_pcidci_workflow) {
      issues.push({
        check: '2c',
        message: 'Workflow lacks Plan→Critique→Improve→Do→Critique→Improve pattern',
        proposed_fix: 'Ensure workflow includes a review/validation step before output is considered complete',
      });
    }

    skillResults.push({
      name: skill.name,
      path: skill.relativePath,
      source: 'scan',
      check_2a_learning: compliance.has_learning_capture,
      check_2b_quality_gates: compliance.has_quality_gates,
      check_2c_pcidci: compliance.has_pcidci_workflow,
      exempt_from_gates: compliance.exempt_from_gates,
      status: issues.length === 0 ? 'PASS' : 'FAIL',
      issues,
    });
  }

  // Agent validation
  const agentResults = [];
  for (const agent of comparison.agents) {
    let content;
    try {
      content = fs.readFileSync(agent.absolutePath, 'utf-8');
    } catch (e) {
      process.stderr.write(`Warning: Cannot read ${agent.absolutePath}: ${e.message}\n`);
      continue;
    }

    const check3a = checkFrontmatterValid(content);
    const check3b = checkToolsValid(content);
    const check3c = checkCapabilityToolConsistency(content);
    const check3d = anyMatch(content, AGENT_SELF_REVIEW_PATTERNS);
    const check3e = anyMatch(content, AGENT_LEARNING_PATTERNS);
    const check3f = checkSkillReferencesValid(content, projectRoot);

    const issues = [];

    if (!check3a.pass) {
      issues.push({
        check: '3a',
        message: `Frontmatter missing required fields: ${check3a.missing_fields.join(', ')}`,
        proposed_fix: `Add missing fields to YAML frontmatter: ${check3a.missing_fields.map(f => `${f}: <value>`).join(', ')}`,
      });
    }
    if (!check3b.pass) {
      issues.push({
        check: '3b',
        message: `Invalid tools in frontmatter: ${check3b.invalid_tools.join(', ')}`,
        proposed_fix: `Replace invalid tools with valid Claude Code built-ins: Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, TodoWrite, Skill, ToolSearch, Task`,
      });
    }
    for (const w of check3c.warnings) {
      issues.push({
        check: '3c',
        severity: 'WARNING',
        message: `Capability "${w.capability}" may require tool ${w.missing_tools.join(' or ')} which is not declared`,
        proposed_fix: `Add ${w.missing_tools.join(' or ')} to tools: field if agent actually ${w.capability}`,
      });
    }
    if (!check3d) {
      issues.push({
        check: '3d',
        message: 'Workflow missing self-review step before delivery',
        proposed_fix: 'Add a self-review step to ## Workflow: re-read output against skill rules, pass/fail criteria, fix-or-warn logic, max 2 iterations',
      });
    }
    if (!check3e) {
      issues.push({
        check: '3e',
        message: 'Missing Learning Capture section',
        proposed_fix: 'Add ## Learning Capture section referencing .claude/learnings/log.md with trigger conditions and entry format',
      });
    }
    if (!check3f.pass) {
      issues.push({
        check: '3f',
        message: `Skill references not found on disk: ${check3f.missing.join(', ')}`,
        proposed_fix: `Verify referenced skill paths exist or remove stale references`,
      });
    }

    const hardFails = issues.filter(i => i.severity !== 'WARNING');
    agentResults.push({
      name: agent.name,
      path: agent.relativePath,
      source: 'scan',
      check_3a_frontmatter: check3a,
      check_3b_tools: check3b,
      check_3c_capability_tool: check3c,
      check_3d_self_review: check3d,
      check_3e_learning: check3e,
      check_3f_skill_refs: check3f,
      status: hardFails.length === 0 ? 'PASS' : 'FAIL',
      issues,
    });
  }

  const allIssues = [
    ...skillResults.flatMap(s => s.issues.map(i => ({ file: s.path, ...i }))),
    ...agentResults.flatMap(a => a.issues.map(i => ({ file: a.path, ...i }))),
  ];

  const skillsFail = skillResults.filter(s => s.status === 'FAIL').length;
  const agentsFail = agentResults.filter(a => a.status === 'FAIL').length;
  const hardIssues = allIssues.filter(i => i.severity !== 'WARNING');

  return {
    mode: 'validate',
    timestamp: new Date().toISOString(),
    cache_used: !!snapshot,
    cache_hits: cacheHits,
    skills: skillResults,
    agents: agentResults,
    issues: allIssues,
    summary: {
      skills_total: skillResults.length,
      skills_pass: skillResults.filter(s => s.status === 'PASS').length,
      skills_fail: skillsFail,
      agents_total: agentResults.length,
      agents_pass: agentResults.filter(a => a.status === 'PASS').length,
      agents_fail: agentsFail,
      total_issues: hardIssues.length,
      total_warnings: allIssues.filter(i => i.severity === 'WARNING').length,
    },
    overall: hardIssues.length === 0 ? 'COMPLIANT'
      : (skillsFail + agentsFail === skillResults.length + agentResults.length) ? 'NON-COMPLIANT'
      : 'HAS_ISSUES',
  };
}

// ---------------------------------------------------------------------------
// HEALTH mode — Fast passes A, G, CLAUDE.md diff, classification
// ---------------------------------------------------------------------------

/**
 * Run Fast Pass A: verify all file paths referenced in a skill/agent exist on disk.
 */
function runPassA(content, projectRoot) {
  const paths = extractFilePaths(content);
  const checked = paths.map(p => {
    // Resolve relative to projectRoot; also try absolute
    const resolved = path.isAbsolute(p.path) ? p.path : path.join(projectRoot, p.path);
    const exists = fs.existsSync(resolved);
    return { ...p, exists };
  });
  const failures = checked.filter(c => !c.exists);
  return {
    total: checked.length,
    pass: checked.length - failures.length,
    fail: failures.length,
    failures: failures.map(f => ({ path: f.path, lineNumber: f.lineNumber })),
  };
}

/**
 * Classify a file based on pass A and pass G results.
 */
function classifyFile(passA, passG, isAgent) {
  const reasons = [];

  if (passA && passA.fail > 2) {
    reasons.push(`Pass A: ${passA.fail} broken file paths`);
    return { status: 'CRITICAL', reasons };
  }

  if (passA && passA.fail > 0) {
    reasons.push(`Pass A: ${passA.fail} broken file path(s)`);
  }

  if (isAgent) {
    if (passG && (!passG.frontmatter_valid || !passG.tools_valid)) {
      reasons.push('Pass G: invalid frontmatter or tools');
    }
    if (passG && (!passG.has_self_review || !passG.has_learning_capture)) {
      reasons.push('Pass G: missing self-review or learning capture');
    }
  } else {
    if (passG && !passG.has_learning_capture) {
      reasons.push('Pass G: missing learning capture');
    }
    if (passG && !passG.exempt_from_gates && !passG.has_quality_gates) {
      reasons.push('Pass G: missing quality gates');
    }
  }

  if (reasons.length === 0) return { status: 'CURRENT', reasons };
  if (passA && passA.fail > 0 && reasons.length > 1) return { status: 'STALE', reasons };
  return { status: 'OUTDATED', reasons };
}

function healthMode(projectRoot, opts) {
  const snapshot = opts.useCache ? loadSnapshot(projectRoot) : null;
  const skills = discoverSkillFiles(projectRoot);
  const agents = discoverAgentFiles(projectRoot);
  const comparison = getCacheComparison(projectRoot, snapshot, skills, agents);

  const passAResults = {};
  const passGResults = {};
  const classifications = {};

  // Process skills
  for (const skill of comparison.skills) {
    let content;
    try {
      content = fs.readFileSync(skill.absolutePath, 'utf-8');
    } catch (e) {
      process.stderr.write(`Warning: Cannot read ${skill.absolutePath}: ${e.message}\n`);
      continue;
    }

    passAResults[skill.name] = runPassA(content, projectRoot);
    passGResults[skill.name] = evaluateSkillCompliance(skill.name, content);
    classifications[skill.name] = {
      type: 'skill',
      path: skill.relativePath,
      cacheStatus: skill.cacheStatus,
      ...classifyFile(passAResults[skill.name], passGResults[skill.name], false),
    };
  }

  // Process agents
  for (const agent of comparison.agents) {
    let content;
    try {
      content = fs.readFileSync(agent.absolutePath, 'utf-8');
    } catch (e) {
      process.stderr.write(`Warning: Cannot read ${agent.absolutePath}: ${e.message}\n`);
      continue;
    }

    passAResults[agent.name] = runPassA(content, projectRoot);
    passGResults[agent.name] = evaluateAgentCompliance(content);
    classifications[agent.name] = {
      type: 'agent',
      path: agent.relativePath,
      cacheStatus: agent.cacheStatus,
      ...classifyFile(passAResults[agent.name], passGResults[agent.name], true),
    };
  }

  // CLAUDE.md diff
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
  let claudeMdDiff = null;
  if (fs.existsSync(claudeMdPath)) {
    try {
      const claudeContent = fs.readFileSync(claudeMdPath, 'utf-8');
      claudeMdDiff = diffClaudeMdVsDisk(claudeContent, projectRoot);
    } catch (e) {
      process.stderr.write(`Warning: Cannot parse CLAUDE.md: ${e.message}\n`);
    }
  }

  // Overall health
  const statuses = Object.values(classifications).map(c => c.status);
  const overall = statuses.includes('CRITICAL') ? 'CRITICAL'
    : statuses.includes('STALE') || statuses.includes('OUTDATED') ? 'NEEDS_ATTENTION'
    : 'HEALTHY';

  return {
    mode: 'health',
    timestamp: new Date().toISOString(),
    cache: {
      snapshot_exists: comparison.snapshotExists,
      snapshot_age_hours: comparison.snapshotAge ? Math.round(comparison.snapshotAge / 3600000) : null,
      deleted_skills: comparison.deletedSkills || [],
      deleted_agents: comparison.deletedAgents || [],
      indicators_changed: comparison.indicatorsChanged,
    },
    pass_a: passAResults,
    pass_g: passGResults,
    claude_md: claudeMdDiff,
    classifications,
    learnings: countLearningEntries(projectRoot),
    overall,
  };
}

// ---------------------------------------------------------------------------
// AUDIT mode — Full Mechanical Verification Protocol (Passes A-G)
// ---------------------------------------------------------------------------

/** Auto-detect source directory */
function detectSrcDir(projectRoot) {
  for (const dir of ['src', 'lib', 'app', 'internal', 'pkg', 'cmd']) {
    const full = path.join(projectRoot, dir);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) return full;
  }
  return null; // no src dir found
}

/** Detect specs directory */
function detectSpecsDir(projectRoot) {
  for (const dir of ['specs', 'openspec', 'spec', 'docs/specs', 'documentation']) {
    const full = path.join(projectRoot, dir);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) return full;
  }
  return null;
}

/**
 * Grep for a symbol in a directory.
 * Returns { found: boolean, files: string[] }
 */
function grepInDir(pattern, dir, fileGlobs) {
  if (!dir || !fs.existsSync(dir)) return { found: false, files: [] };
  try {
    const includeArgs = fileGlobs.map(g => `--include="${g}"`).join(' ');
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cmd = `grep -r -l ${includeArgs} "${escaped}" "${dir}" 2>/dev/null`;
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 8000 });
    const files = result.trim().split('\n').filter(Boolean);
    return { found: files.length > 0, files };
  } catch (e) {
    // grep exits 1 when no matches
    return { found: false, files: [] };
  }
}

const CODE_FILE_GLOBS = ['*.go', '*.ts', '*.js', '*.py', '*.rs', '*.java', '*.kt', '*.rb', '*.php'];

function runPassB(content, srcDir) {
  if (!srcDir) return { skipped: true, reason: 'No src directory detected' };
  const symbols = extractSymbols(content);
  if (symbols.length === 0) return { total: 0, pass: 0, fail: 0, failures: [] };

  // Batch symbols into groups of 10 for efficiency
  const checked = [];
  for (let i = 0; i < symbols.length; i += 10) {
    const batch = symbols.slice(i, i + 10);
    for (const sym of batch) {
      const result = grepInDir(sym.symbol, srcDir, CODE_FILE_GLOBS);
      checked.push({ ...sym, found: result.found, files: result.files });
    }
  }

  const failures = checked.filter(c => !c.found);
  return {
    total: checked.length,
    pass: checked.length - failures.length,
    fail: failures.length,
    failures: failures.map(f => ({ symbol: f.symbol, kind: f.kind, lineNumber: f.lineNumber })),
  };
}

function runPassC(content, srcDir, specsDir) {
  const errorCodes = extractErrorCodes(content);
  if (errorCodes.length === 0) return { total: 0, in_source: 0, spec_only: 0, nonexistent: 0, details: [] };

  const details = [];
  for (const ec of errorCodes) {
    const inSource = srcDir ? grepInDir(ec.code, srcDir, CODE_FILE_GLOBS).found : false;
    const inSpecs = (!inSource && specsDir) ? grepInDir(ec.code, specsDir, ['*.md', '*.yaml', '*.json', '*.txt']).found : false;
    const status = inSource ? 'IN_SOURCE' : inSpecs ? 'SPEC_ONLY' : 'NONEXISTENT';
    details.push({ code: ec.code, lineNumber: ec.lineNumber, status });
  }

  return {
    total: details.length,
    in_source: details.filter(d => d.status === 'IN_SOURCE').length,
    spec_only: details.filter(d => d.status === 'SPEC_ONLY').length,
    nonexistent: details.filter(d => d.status === 'NONEXISTENT').length,
    details,
  };
}

function runPassD(content, srcDir) {
  if (!srcDir) return { skipped: true, reason: 'No src directory detected' };
  const routes = extractApiRoutes(content);
  if (routes.length === 0) return { total: 0, pass: 0, fail: 0, failures: [] };

  const checked = [];
  for (const route of routes) {
    // Search for the path string in source (router registrations)
    const escapedPath = route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const result = grepInDir(escapedPath, srcDir, CODE_FILE_GLOBS);
    checked.push({ ...route, found: result.found });
  }

  const failures = checked.filter(c => !c.found);
  return {
    total: checked.length,
    pass: checked.length - failures.length,
    fail: failures.length,
    failures: failures.map(f => ({ method: f.method, path: f.path, lineNumber: f.lineNumber })),
  };
}

function runPassE(projectRoot, skills) {
  const goModPath = path.join(projectRoot, 'go.mod');
  const packageJsonPath = path.join(projectRoot, 'package.json');

  let goVersion = null;
  if (fs.existsSync(goModPath)) {
    const goMod = fs.readFileSync(goModPath, 'utf-8');
    const m = goMod.match(/^go\s+([\d.]+)/m);
    if (m) goVersion = m[1];
  }

  let nodeVersion = null;
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      nodeVersion = pkg.engines?.node || null;
    } catch (e) {}
  }

  return {
    go_version: goVersion,
    node_version: nodeVersion,
    status: 'INFO', // Version compatibility requires semantic analysis — flag for LLM review
  };
}

function runPassF(content) {
  const blocks = extractCodeBlocks(content);
  return {
    total: blocks.length,
    blocks: blocks.map(b => ({
      language: b.language,
      lineStart: b.lineStart,
      lineEnd: b.lineEnd,
      // Include only first 20 lines of each block to keep output manageable
      code: b.code.split('\n').slice(0, 20).join('\n'),
    })),
  };
}

function auditMode(projectRoot, opts) {
  const srcDir = opts.srcDir || detectSrcDir(projectRoot);
  const specsDir = detectSpecsDir(projectRoot);

  // Run health checks first (Pass A, G)
  const healthResult = healthMode(projectRoot, opts);

  // Then run additional passes B-F on each skill
  const skills = discoverSkillFiles(projectRoot);
  const agents = discoverAgentFiles(projectRoot);

  const passBResults = {};
  const passCResults = {};
  const passDResults = {};
  const passFResults = {};

  for (const skill of skills) {
    let content;
    try {
      content = fs.readFileSync(skill.absolutePath, 'utf-8');
    } catch (e) {
      continue;
    }

    passBResults[skill.name] = runPassB(content, srcDir);
    passCResults[skill.name] = runPassC(content, srcDir, specsDir);
    passDResults[skill.name] = runPassD(content, srcDir);
    passFResults[skill.name] = runPassF(content);
  }

  // Also run on agents
  for (const agent of agents) {
    let content;
    try {
      content = fs.readFileSync(agent.absolutePath, 'utf-8');
    } catch (e) {
      continue;
    }
    passFResults[agent.name] = runPassF(content);
  }

  const passE = runPassE(projectRoot, skills);

  // Build per-skill summary
  const perSkillSummary = {};
  for (const skill of skills) {
    const a = healthResult.pass_a[skill.name];
    const b = passBResults[skill.name];
    const c = passCResults[skill.name];
    const d = passDResults[skill.name];
    const f = passFResults[skill.name];
    const g = healthResult.pass_g[skill.name];

    perSkillSummary[skill.name] = {
      pass_a: a ? `${a.pass}/${a.total} PASS${a.fail > 0 ? `, ${a.fail} FAIL` : ''}` : 'N/A',
      pass_b: b ? (b.skipped ? 'SKIPPED' : `${b.pass}/${b.total} PASS${b.fail > 0 ? `, ${b.fail} FAIL` : ''}`) : 'N/A',
      pass_c: c ? `${c.in_source} IN_SOURCE, ${c.spec_only} SPEC_ONLY, ${c.nonexistent} NONEXISTENT` : 'N/A',
      pass_d: d ? (d.skipped ? 'SKIPPED' : `${d.pass}/${d.total} PASS${d.fail > 0 ? `, ${d.fail} FAIL` : ''}`) : 'N/A',
      pass_e: passE.go_version ? `go ${passE.go_version}` : passE.node_version ? `node ${passE.node_version}` : 'N/A',
      pass_f: f ? `${f.total} code block(s)` : 'N/A',
      pass_g: g ? `G.1 ${g.has_learning_capture ? 'PASS' : 'FAIL'} G.2 ${g.exempt_from_gates ? 'EXEMPT' : g.has_quality_gates ? 'PASS' : 'FAIL'}` : 'N/A',
    };
  }

  return {
    mode: 'audit',
    timestamp: new Date().toISOString(),
    src_dir: srcDir,
    specs_dir: specsDir,
    pass_a: healthResult.pass_a,
    pass_b: passBResults,
    pass_c: passCResults,
    pass_d: passDResults,
    pass_e: passE,
    pass_f: passFResults,
    pass_g: healthResult.pass_g,
    claude_md: healthResult.claude_md,
    classifications: healthResult.classifications,
    per_skill_summary: perSkillSummary,
    learnings: countLearningEntries(projectRoot),
    overall: healthResult.overall,
  };
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function renderValidateMarkdown(result) {
  const lines = [`# Validation Report — ${result.timestamp.slice(0, 10)}`, ''];
  lines.push(`**Overall:** ${result.overall}  |  Cache hits: ${result.cache_hits}`);
  lines.push('');

  lines.push('## Skills');
  lines.push('| Skill | Self-Learning | Quality Gates | PCIDCI | Status |');
  lines.push('|-------|:------------:|:-------------:|:----:|--------|');
  for (const s of result.skills) {
    const exempt = s.exempt_from_gates ? ' (exempt)' : '';
    lines.push(`| ${s.name} | ${s.check_2a_learning ? '✅' : '❌'} | ${s.check_2b_quality_gates ? '✅' : '❌'}${exempt} | ${s.check_2c_pcidci ? '✅' : '❌'} | ${s.status} |`);
  }

  lines.push('');
  lines.push('## Agents');
  lines.push('| Agent | Frontmatter | Tools | Cap-Tool | Self-Review | Learning | Skill Refs | Status |');
  lines.push('|-------|:-----------:|:-----:|:--------:|:-----------:|:--------:|:----------:|--------|');
  for (const a of result.agents) {
    lines.push(`| ${a.name} | ${a.check_3a_frontmatter.pass ? '✅' : '❌'} | ${a.check_3b_tools.pass ? '✅' : '❌'} | ${a.check_3c_capability_tool.warnings.length === 0 ? '✅' : '⚠️'} | ${a.check_3d_self_review ? '✅' : '❌'} | ${a.check_3e_learning ? '✅' : '❌'} | ${a.check_3f_skill_refs.pass ? '✅' : '❌'} | ${a.status} |`);
  }

  if (result.issues.length > 0) {
    lines.push('');
    lines.push('## Issues');
    lines.push('| # | File | Check | Issue | Proposed Fix |');
    lines.push('|---|------|-------|-------|-------------|');
    result.issues.forEach((issue, i) => {
      lines.push(`| ${i + 1} | ${issue.file} | ${issue.check}${issue.severity ? ` (${issue.severity})` : ''} | ${issue.message} | ${issue.proposed_fix} |`);
    });
  }

  return lines.join('\n');
}

function renderHealthMarkdown(result) {
  const lines = [`# Health Report — ${result.timestamp.slice(0, 10)}`, ''];
  lines.push(`**Overall:** ${result.overall}`);

  if (result.cache.snapshot_exists) {
    lines.push(`**Cache:** ${result.cache.snapshot_age_hours}h old, ${result.cache.indicators_changed} indicators changed`);
  } else {
    lines.push('**Cache:** No snapshot — full scan');
  }
  lines.push('');

  const statuses = { CURRENT: [], OUTDATED: [], STALE: [], CRITICAL: [] };
  for (const [name, info] of Object.entries(result.classifications)) {
    (statuses[info.status] || statuses.OUTDATED).push({ name, ...info });
  }

  lines.push('## Classifications');
  if (statuses.CURRENT.length) lines.push(`✅ **CURRENT** (${statuses.CURRENT.length}): ${statuses.CURRENT.map(s => s.name).join(', ')}`);
  if (statuses.OUTDATED.length) {
    lines.push(`⚠️  **OUTDATED** (${statuses.OUTDATED.length}):`);
    for (const s of statuses.OUTDATED) lines.push(`  - ${s.name}: ${s.reasons.join('; ')}`);
  }
  if (statuses.STALE.length) {
    lines.push(`🗑️  **STALE** (${statuses.STALE.length}):`);
    for (const s of statuses.STALE) lines.push(`  - ${s.name}: ${s.reasons.join('; ')}`);
  }
  if (statuses.CRITICAL.length) {
    lines.push(`❌ **CRITICAL** (${statuses.CRITICAL.length}):`);
    for (const s of statuses.CRITICAL) lines.push(`  - ${s.name}: ${s.reasons.join('; ')}`);
  }

  if (result.claude_md) {
    lines.push('');
    lines.push('## CLAUDE.md');
    if (result.claude_md.missingFromTable.length) lines.push(`- Missing from table: ${result.claude_md.missingFromTable.map(x => x.name).join(', ')}`);
    if (result.claude_md.missingFromDisk.length) lines.push(`- In table but missing on disk: ${result.claude_md.missingFromDisk.map(x => x.name).join(', ')}`);
    if (!result.claude_md.missingFromTable.length && !result.claude_md.missingFromDisk.length) lines.push('- Tables match disk ✅');
  }

  const log = result.learnings;
  lines.push('');
  lines.push(`## Learnings Inbox: ${log.active} ACTIVE, ${log.promoted} PROMOTED, ${log.stale} STALE`);
  if (log.active >= 10) lines.push('> ⚠️  Recommend running `/aisa-evolve-harvest`');

  return lines.join('\n');
}

function renderAuditMarkdown(result) {
  const lines = [`# Audit Report — ${result.timestamp.slice(0, 10)}`, ''];
  lines.push(`**Overall:** ${result.overall}`);
  lines.push(`**Source dir:** ${result.src_dir || 'not detected'}  |  **Specs dir:** ${result.specs_dir || 'not detected'}`);
  lines.push('');

  // Per-skill summary table
  if (Object.keys(result.per_skill_summary).length > 0) {
    lines.push('## Per-Skill Verification');
    lines.push('| Skill | Pass A (paths) | Pass B (symbols) | Pass C (errors) | Pass D (routes) | Pass G (principles) |');
    lines.push('|-------|:--------------:|:----------------:|:---------------:|:---------------:|:-------------------:|');
    for (const [name, s] of Object.entries(result.per_skill_summary)) {
      lines.push(`| ${name} | ${s.pass_a} | ${s.pass_b} | ${s.pass_c} | ${s.pass_d} | ${s.pass_g} |`);
    }
    lines.push('');
  }

  // Classifications (reuse health logic)
  const statuses = { CURRENT: [], OUTDATED: [], STALE: [], CRITICAL: [] };
  for (const [name, info] of Object.entries(result.classifications)) {
    (statuses[info.status] || statuses.OUTDATED).push({ name, ...info });
  }
  lines.push('## Classifications');
  if (statuses.CURRENT.length) lines.push(`✅ **CURRENT** (${statuses.CURRENT.length}): ${statuses.CURRENT.map(s => s.name).join(', ')}`);
  if (statuses.OUTDATED.length) {
    lines.push(`⚠️  **OUTDATED** (${statuses.OUTDATED.length}):`);
    for (const s of statuses.OUTDATED) lines.push(`  - ${s.name}: ${s.reasons.join('; ')}`);
  }
  if (statuses.STALE.length) {
    lines.push(`🗑️  **STALE** (${statuses.STALE.length}):`);
    for (const s of statuses.STALE) lines.push(`  - ${s.name}: ${s.reasons.join('; ')}`);
  }
  if (statuses.CRITICAL.length) {
    lines.push(`❌ **CRITICAL** (${statuses.CRITICAL.length}):`);
    for (const s of statuses.CRITICAL) lines.push(`  - ${s.name}: ${s.reasons.join('; ')}`);
  }

  if (result.claude_md) {
    lines.push('');
    lines.push('## CLAUDE.md');
    if (result.claude_md.missingFromTable.length) lines.push(`- Missing from table: ${result.claude_md.missingFromTable.map(x => x.name).join(', ')}`);
    if (result.claude_md.missingFromDisk.length) lines.push(`- In table but missing on disk: ${result.claude_md.missingFromDisk.map(x => x.name).join(', ')}`);
    if (!result.claude_md.missingFromTable.length && !result.claude_md.missingFromDisk.length) lines.push('- Tables match disk ✅');
  }

  const log = result.learnings;
  lines.push('');
  lines.push(`## Learnings Inbox: ${log.active} ACTIVE, ${log.promoted} PROMOTED, ${log.stale} STALE`);
  if (log.active >= 10) lines.push('> ⚠️  Recommend running `/aisa-evolve-harvest`');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv);

  if (!fs.existsSync(opts.projectRoot)) {
    process.stderr.write(`Error: project root does not exist: ${opts.projectRoot}\n`);
    process.exit(2);
  }

  let result;
  switch (opts.mode) {
    case 'validate':
      result = validateMode(opts.projectRoot, opts);
      break;
    case 'health':
      result = healthMode(opts.projectRoot, opts);
      break;
    case 'audit':
      result = auditMode(opts.projectRoot, opts);
      break;
  }

  if (opts.outputFormat === 'markdown') {
    if (opts.mode === 'validate') process.stdout.write(renderValidateMarkdown(result) + '\n');
    else if (opts.mode === 'health') process.stdout.write(renderHealthMarkdown(result) + '\n');
    else if (opts.mode === 'audit') process.stdout.write(renderAuditMarkdown(result) + '\n');
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }

  // Exit 1 if issues found, 0 if all pass
  const hasIssues = result.overall !== 'COMPLIANT' && result.overall !== 'HEALTHY';
  process.exit(hasIssues ? 1 : 0);
}

main();
