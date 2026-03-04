#!/usr/bin/env node
/**
 * cache-snapshot.js
 * Generates .claude/cache/snapshot.json for the aisa-evolve-cache skill.
 *
 * Usage:
 *   node cache-snapshot.js [rebuild|status|invalidate] [--project-root <path>]
 *
 * Modes:
 *   rebuild   (default) — Full rebuild of snapshot.json
 *   status              — Report cache freshness without modifying anything
 *   invalidate          — Delete cache files, force full scan on next run
 *
 * Uses only Node.js built-in modules. No npm install required.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { hashBuffer, safeHashFile, getFileMetadata } = require('./lib/hashing');
const { discoverSkillFiles, discoverAgentFiles } = require('./lib/discovery');
const { evaluateSkillCompliance, evaluateAgentCompliance } = require('./lib/compliance');
const { countLearningEntries } = require('./lib/learnings');
const { hashProjectIndicators, projectRootHash } = require('./lib/project');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);
  let mode = 'rebuild';
  let projectRoot = process.cwd();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project-root' && args[i + 1]) {
      projectRoot = path.resolve(args[++i]);
    } else if (['rebuild', 'status', 'invalidate'].includes(args[i])) {
      mode = args[i];
    }
  }

  return { mode, projectRoot };
}

// ---------------------------------------------------------------------------
// REBUILD mode
// ---------------------------------------------------------------------------

function rebuildMode(projectRoot) {
  const skills = discoverSkillFiles(projectRoot);
  const agents = discoverAgentFiles(projectRoot);

  const skillsSection = {};
  for (const skill of skills) {
    let meta, compliance;
    try {
      meta = getFileMetadata(skill.absolutePath);
      compliance = evaluateSkillCompliance(skill.name, meta.content);
    } catch (e) {
      process.stderr.write(`Warning: Cannot process skill ${skill.name}: ${e.message}\n`);
      continue;
    }
    skillsSection[skill.name] = {
      path: skill.relativePath,
      sha256: hashBuffer(fs.readFileSync(skill.absolutePath)),
      lines: meta.lines,
      mtime: meta.mtime,
      ...compliance,
    };
  }

  const agentsSection = {};
  for (const agent of agents) {
    let meta, compliance;
    try {
      meta = getFileMetadata(agent.absolutePath);
      compliance = evaluateAgentCompliance(meta.content);
    } catch (e) {
      process.stderr.write(`Warning: Cannot process agent ${agent.name}: ${e.message}\n`);
      continue;
    }
    agentsSection[agent.name] = {
      path: agent.relativePath,
      sha256: hashBuffer(fs.readFileSync(agent.absolutePath)),
      lines: meta.lines,
      mtime: meta.mtime,
      ...compliance,
    };
  }

  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
  const claudeMd = fs.existsSync(claudeMdPath)
    ? { sha256: safeHashFile(claudeMdPath), mtime: fs.statSync(claudeMdPath).mtime.toISOString() }
    : { sha256: null, mtime: null };

  const snapshot = {
    generated_at: new Date().toISOString(),
    generated_by: 'aisa-evolve-cache',
    project_root_hash: projectRootHash(projectRoot),
    skills: skillsSection,
    agents: agentsSection,
    claude_md: claudeMd,
    learnings_log: countLearningEntries(projectRoot),
    project_indicators: hashProjectIndicators(projectRoot),
  };

  const cacheDir = path.join(projectRoot, '.claude', 'cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, 'snapshot.json'),
    JSON.stringify(snapshot, null, 2) + '\n'
  );

  console.log(
    `Cache rebuilt: ${Object.keys(skillsSection).length} skills, ` +
    `${Object.keys(agentsSection).length} agents → .claude/cache/snapshot.json`
  );
}

// ---------------------------------------------------------------------------
// STATUS mode
// ---------------------------------------------------------------------------

function formatAge(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function statusMode(projectRoot) {
  const cacheDir = path.join(projectRoot, '.claude', 'cache');
  const snapshotPath = path.join(cacheDir, 'snapshot.json');
  const driftPath = path.join(cacheDir, 'drift-report.json');

  const snapshotExists = fs.existsSync(snapshotPath);
  const driftExists = fs.existsSync(driftPath);

  console.log('## Cache Status\n');

  if (!snapshotExists) {
    console.log('- snapshot.json: MISSING');
    console.log(`- drift-report.json: ${driftExists ? 'EXISTS' : 'MISSING'}`);
    console.log('\n### Recommendation\nSTALE — full rebuild recommended');
    return;
  }

  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
  } catch (e) {
    console.log('- snapshot.json: EXISTS but CORRUPT — full rebuild recommended');
    console.log(`- drift-report.json: ${driftExists ? 'EXISTS' : 'MISSING'}`);
    return;
  }

  const age = Date.now() - new Date(snapshot.generated_at).getTime();
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

  let driftAge = 'MISSING';
  if (driftExists) {
    try {
      const drift = JSON.parse(fs.readFileSync(driftPath, 'utf-8'));
      driftAge = `age: ${formatAge(Date.now() - new Date(drift.generated_at).getTime())}`;
    } catch (e) {
      driftAge = 'EXISTS (unreadable)';
    }
  }

  console.log(`- snapshot.json: EXISTS — age: ${formatAge(age)}`);
  console.log(`- drift-report.json: ${driftExists ? `EXISTS — ${driftAge}` : 'MISSING'}`);

  // Compare hashes
  const currentSkills = discoverSkillFiles(projectRoot);
  const currentAgents = discoverAgentFiles(projectRoot);
  const cachedSkillNames = new Set(Object.keys(snapshot.skills || {}));
  const cachedAgentNames = new Set(Object.keys(snapshot.agents || {}));

  let staleSkills = 0;
  for (const skill of currentSkills) {
    const current = safeHashFile(skill.absolutePath);
    const cached = snapshot.skills?.[skill.name]?.sha256;
    if (!cached || cached !== current) staleSkills++;
  }
  const newSkills = currentSkills.filter(s => !cachedSkillNames.has(s.name)).length;
  const deletedSkills = [...cachedSkillNames].filter(
    n => !currentSkills.some(s => s.name === n)
  ).length;

  let staleAgents = 0;
  for (const agent of currentAgents) {
    const current = safeHashFile(agent.absolutePath);
    const cached = snapshot.agents?.[agent.name]?.sha256;
    if (!cached || cached !== current) staleAgents++;
  }

  const currentIndicators = hashProjectIndicators(projectRoot);
  let indicatorsChanged = 0;
  for (const [key, value] of Object.entries(currentIndicators)) {
    if (value !== (snapshot.project_indicators?.[key] ?? null)) indicatorsChanged++;
  }

  console.log(
    `- Skills cached: ${cachedSkillNames.size} / ${currentSkills.length} on disk` +
    (staleSkills > 0 ? ` — ${staleSkills} stale (hash mismatch)` : '') +
    (newSkills > 0 ? `, ${newSkills} new` : '') +
    (deletedSkills > 0 ? `, ${deletedSkills} deleted` : '')
  );
  console.log(
    `- Agents cached: ${cachedAgentNames.size} / ${currentAgents.length} on disk` +
    (staleAgents > 0 ? ` — ${staleAgents} stale` : '')
  );
  console.log(`- Project indicators: ${indicatorsChanged} changed since snapshot`);

  console.log('\n### Recommendation');
  if (age > twoWeeksMs) {
    console.log('STALE — cache older than 2 weeks, full rebuild recommended');
  } else if (staleSkills === 0 && staleAgents === 0 && newSkills === 0 && indicatorsChanged === 0) {
    console.log('FRESH — no rebuild needed');
  } else if (staleSkills + staleAgents + newSkills < 5) {
    console.log('PARTIALLY STALE — incremental scan sufficient');
  } else {
    console.log('STALE — full rebuild recommended');
  }
}

// ---------------------------------------------------------------------------
// INVALIDATE mode
// ---------------------------------------------------------------------------

function invalidateMode(projectRoot) {
  const cacheDir = path.join(projectRoot, '.claude', 'cache');
  let deleted = 0;
  for (const file of ['snapshot.json', 'drift-report.json']) {
    const filePath = path.join(cacheDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      deleted++;
    }
  }
  if (deleted > 0) {
    console.log(`Cache invalidated (${deleted} file${deleted > 1 ? 's' : ''} deleted). Next aisa-evolve run will do a full scan.`);
  } else {
    console.log('Nothing to invalidate — no cache files found.');
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
  const { mode, projectRoot } = parseArgs(process.argv);

  if (!fs.existsSync(projectRoot)) {
    process.stderr.write(`Error: project root does not exist: ${projectRoot}\n`);
    process.exit(1);
  }

  switch (mode) {
    case 'rebuild':
      rebuildMode(projectRoot);
      break;
    case 'status':
      statusMode(projectRoot);
      break;
    case 'invalidate':
      invalidateMode(projectRoot);
      break;
    default:
      process.stderr.write(`Unknown mode: ${mode}\n`);
      process.exit(1);
  }
}

main();
