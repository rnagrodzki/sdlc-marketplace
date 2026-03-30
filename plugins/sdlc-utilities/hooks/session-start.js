#!/usr/bin/env node
/**
 * session-start.js
 * SessionStart hook — outputs plugin version, skill count, and project
 * context (pipeline resume, OpenSpec, git status, Jira cache, ship config)
 * into the system-reminder context.
 *
 * Lazy-loads ../scripts/lib/state.js and ../scripts/lib/git.js for project
 * context phases. Falls back gracefully if unavailable.
 *
 * Exit codes:
 *   0 = success (always — graceful degradation on errors)
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Read plugin version
// ---------------------------------------------------------------------------

let version = 'unknown';
try {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8')
  );
  if (manifest.version) version = manifest.version;
} catch {
  // Graceful degradation — version stays 'unknown'
}

// ---------------------------------------------------------------------------
// Count user-invocable skills
// ---------------------------------------------------------------------------

let skillCount = 0;
const skillsDir = path.join(pluginRoot, 'skills');

try {
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
    try {
      const content = fs.readFileSync(skillPath, 'utf8');
      // Extract frontmatter between first and second ---
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch && /user-invocable:\s*true/.test(fmMatch[1])) {
        skillCount++;
      }
    } catch {
      // No SKILL.md in this subdirectory — skip
    }
  }
} catch {
  // skills directory unreadable — count stays 0
}

// ---------------------------------------------------------------------------
// Pipeline resume detection
// ---------------------------------------------------------------------------

const resumeLines = [];

try {
  const { slugifyBranch, findStateFile, readState } = require('../scripts/lib/state');
  const { exec } = require('../scripts/lib/git');
  const branch = exec('git branch --show-current');
  if (branch) {
    const branchSlug = slugifyBranch(branch);

    // Check for ship state file
    const shipFound = findStateFile('ship', branchSlug);
    if (shipFound) {
      const shipState = readState('ship', branchSlug);
      if (shipState && shipState.data && Array.isArray(shipState.data.steps)) {
        const steps = shipState.data.steps;
        const inProgress = steps.find(s => s.status === 'in_progress');
        const lastCompleted = [...steps].reverse().find(s => s.status === 'completed');
        const currentStep = inProgress || lastCompleted;
        if (currentStep) {
          const stepIndex = steps.indexOf(currentStep) + 1;
          const stepName = currentStep.name || currentStep.id || 'unknown';
          const label = inProgress ? `paused at step ${stepIndex}: ${stepName}` : `last completed step ${stepIndex}: ${stepName}`;
          resumeLines.push(`Active pipeline: ship-sdlc on ${branch} (${label})`);
          resumeLines.push('  Resume with: /ship-sdlc --resume');
        }
      }
    }

    // Check for execute state file
    const executeFound = findStateFile('execute', branchSlug);
    if (executeFound) {
      const executeState = readState('execute', branchSlug);
      if (executeState && executeState.data && Array.isArray(executeState.data.waves)) {
        const waves = executeState.data.waves;
        const completedWaves = waves.filter(w => w.status === 'completed').length;
        const totalWaves = waves.length;
        resumeLines.push(`Active execution: execute-plan-sdlc on ${branch} (wave ${completedWaves} of ${totalWaves} complete)`);
        resumeLines.push('  Resume with: /execute-plan-sdlc --resume');
      }
    }
  }
} catch {
  // Graceful degradation — skip resume detection on any error
}

// ---------------------------------------------------------------------------
// Compact recovery (re-inject state after context compaction)
// ---------------------------------------------------------------------------

try {
  let recoveryDir;
  try {
    const { resolveMainWorktree } = require('../scripts/lib/state');
    recoveryDir = path.join(resolveMainWorktree(), '.sdlc', 'execution');
  } catch {
    recoveryDir = path.join(process.cwd(), '.sdlc', 'execution');
  }

  const recoveryPath = path.join(recoveryDir, '.compact-recovery.json');
  if (fs.existsSync(recoveryPath)) {
    const raw = fs.readFileSync(recoveryPath, 'utf8');
    const recovery = JSON.parse(raw);

    // Check freshness — ignore if older than 1 hour
    const ageMs = Date.now() - new Date(recovery.savedAt).getTime();
    const maxAgeMs = 60 * 60 * 1000; // 1 hour

    if (ageMs <= maxAgeMs) {
      resumeLines.push('Pipeline state recovered after compaction:');

      if (recovery.pipeline === 'ship-sdlc') {
        resumeLines.push(`  Pipeline: ship-sdlc on ${recovery.branch}`);
        if (recovery.currentStep) {
          resumeLines.push(`  Current step: ${recovery.currentStep}`);
        }
        if (recovery.reviewVerdict) {
          const findings = recovery.deferredFindings
            ? ` (${recovery.deferredFindings} deferred)`
            : '';
          resumeLines.push(`  Review verdict: ${recovery.reviewVerdict}${findings}`);
        }
      } else if (recovery.pipeline === 'execute-plan-sdlc') {
        resumeLines.push(`  Pipeline: execute-plan-sdlc on ${recovery.branch}`);
        resumeLines.push(`  Progress: wave ${recovery.completedWaves} of ${recovery.totalWaves} complete`);
      }
    }

    // Delete after reading — single-use
    fs.unlinkSync(recoveryPath);
  }
} catch {
  // Graceful degradation — skip compact recovery on any error
}

// ---------------------------------------------------------------------------
// OpenSpec context injection
// ---------------------------------------------------------------------------

try {
  const projectRoot = process.cwd();
  const openspecConfig = path.join(projectRoot, 'openspec', 'config.yaml');

  if (fs.existsSync(openspecConfig)) {
    const changesDir = path.join(projectRoot, 'openspec', 'changes');
    const activeChanges = [];

    if (fs.existsSync(changesDir)) {
      const changeDirs = fs.readdirSync(changesDir, { withFileTypes: true });
      for (const entry of changeDirs) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'archive') continue;
        const changeDir = path.join(changesDir, entry.name);
        const proposalPath = path.join(changeDir, 'proposal.md');
        if (!fs.existsSync(proposalPath)) continue;

        const specsDir = path.join(changeDir, 'specs');
        let deltaSpecCount = 0;
        if (fs.existsSync(specsDir)) {
          const specFiles = fs.readdirSync(specsDir, { withFileTypes: true });
          deltaSpecCount = specFiles.filter(f => f.isFile()).length;
        }

        const hasDesign = fs.existsSync(path.join(changeDir, 'design.md'));
        activeChanges.push({ name: entry.name, deltaSpecCount, hasDesign });
      }
    }

    if (activeChanges.length === 0) {
      resumeLines.push('OpenSpec: configured, no active changes');
    } else if (activeChanges.length === 1) {
      const change = activeChanges[0];
      const specLabel = `${change.deltaSpecCount} delta spec${change.deltaSpecCount !== 1 ? 's' : ''}`;
      const designLabel = change.hasDesign ? 'design.md present' : 'no design.md';
      resumeLines.push(`OpenSpec active: change "${change.name}" (${specLabel}, ${designLabel})`);

      // Attempt branch matching — use slug comparison to avoid false positives
      try {
        const { exec } = require('../scripts/lib/git');
        const branch = exec('git branch --show-current');
        if (branch) {
          const branchSlug = branch.toLowerCase().replace(/^(feat|fix|chore|refactor|docs)\//, '');
          const nameSlug = change.name.toLowerCase();
          // Match when the branch slug equals the change name, or one is a
          // prefix of the other followed by a separator (-, /)
          const slugRe = new RegExp(`(^|[/-])${nameSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[/-])`);
          if (branchSlug === nameSlug || slugRe.test(branchSlug)) {
            resumeLines.push(`  Branch match: ${branch} -> auto-linked`);
          }
        }
      } catch {
        // Graceful degradation — skip branch matching
      }
    } else {
      const names = activeChanges.map(c => c.name).join(', ');
      resumeLines.push(`OpenSpec active: ${activeChanges.length} changes (${names})`);
      resumeLines.push('  No branch match — pass --spec to select');
    }
  }
} catch {
  // Graceful degradation — skip OpenSpec context injection on any error
}

// ---------------------------------------------------------------------------
// Git context (Phase 1c)
// ---------------------------------------------------------------------------

try {
  const { checkGitState, detectBaseBranch, exec } = require('../scripts/lib/git');
  const projectRoot = process.cwd();
  const gitState = checkGitState(projectRoot);
  const { currentBranch, dirtyFiles } = gitState;

  const dirtyCount = dirtyFiles.length;
  const dirtyLabel = dirtyCount > 0 ? `${dirtyCount} file${dirtyCount !== 1 ? 's' : ''} modified` : 'clean';

  let aheadLabel = null;
  try {
    const baseBranch = detectBaseBranch(projectRoot);
    const aheadRaw = exec(`git rev-list --count origin/${baseBranch}..HEAD`, { cwd: projectRoot });
    if (aheadRaw !== null) {
      const aheadCount = parseInt(aheadRaw, 10);
      if (!isNaN(aheadCount) && aheadCount > 0) {
        aheadLabel = `ahead of ${baseBranch} by ${aheadCount}`;
      }
    }
  } catch {
    // Graceful degradation — omit ahead count if base branch detection fails
  }

  const statusParts = [dirtyLabel];
  if (aheadLabel) statusParts.push(aheadLabel);
  resumeLines.push(`Git: branch ${currentBranch} (${statusParts.join(', ')}) [snapshot]`);
} catch {
  // Graceful degradation — skip git context on any error
}

// ---------------------------------------------------------------------------
// Jira cache (Phase 1d)
// ---------------------------------------------------------------------------

try {
  const projectRoot = process.cwd();
  const jiraCacheDir = path.join(projectRoot, '.sdlc', 'jira-cache');
  if (fs.existsSync(jiraCacheDir)) {
    const cacheFiles = fs.readdirSync(jiraCacheDir).filter(f => f.endsWith('.json'));
    for (const cacheFile of cacheFiles) {
      try {
        const projectKey = path.basename(cacheFile, '.json');
        const cacheData = JSON.parse(fs.readFileSync(path.join(jiraCacheDir, cacheFile), 'utf8'));
        const lastUpdated = cacheData.lastUpdated;
        const maxAgeHours = cacheData.maxAgeHours;

        if (!lastUpdated) continue;

        const ageMs = Date.now() - new Date(lastUpdated).getTime();
        const ageHours = ageMs / (1000 * 60 * 60);

        let ageDisplay;
        if (ageHours < 1) {
          ageDisplay = 'less than 1h ago';
        } else if (ageHours < 24) {
          const h = Math.round(ageHours);
          ageDisplay = `${h}h ago`;
        } else {
          const d = Math.round(ageHours / 24);
          ageDisplay = `${d} day${d !== 1 ? 's' : ''} ago`;
        }

        if (maxAgeHours === 0) {
          resumeLines.push(`Jira cache: ${projectKey} (last updated ${ageDisplay}, permanent)`);
        } else if (ageHours > maxAgeHours) {
          resumeLines.push(`Jira cache: ${projectKey} (stale — ${ageDisplay}, TTL ${maxAgeHours}h) — refresh with /jira-sdlc --force-refresh`);
        } else {
          resumeLines.push(`Jira cache: ${projectKey} (last updated ${ageDisplay}, TTL ${maxAgeHours}h)`);
        }
      } catch {
        // Graceful degradation — skip this cache file on any error
      }
    }
  }
} catch {
  // Graceful degradation — skip Jira cache detection on any error
}

// ---------------------------------------------------------------------------
// Ship config (Phase 1e)
// ---------------------------------------------------------------------------

try {
  const projectRoot = process.cwd();
  const shipConfigPath = path.join(projectRoot, '.sdlc', 'ship-config.json');
  if (fs.existsSync(shipConfigPath)) {
    const shipConfig = JSON.parse(fs.readFileSync(shipConfigPath, 'utf8'));
    const preset    = shipConfig.preset    !== undefined ? `preset ${shipConfig.preset}` : null;
    const skip      = shipConfig.skip      !== undefined ? `skip ${JSON.stringify(shipConfig.skip)}` : null;
    const bump      = shipConfig.bump      !== undefined ? `bump ${shipConfig.bump}` : null;
    const threshold = shipConfig.reviewThreshold !== undefined ? `threshold ${shipConfig.reviewThreshold}` : null;
    const parts = [preset, skip, bump, threshold].filter(Boolean);
    if (parts.length > 0) {
      resumeLines.push(`Ship config: ${parts.join(', ')}`);
    }
  }
} catch {
  // Graceful degradation — skip ship config on any error
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const outputLines = [
  `sdlc: v${version} (${skillCount} skills loaded)`,
  'Plan mode routing: always invoke plan-sdlc via the Skill tool when plan mode is active.',
  ...resumeLines,
];

process.stdout.write(outputLines.join('\n') + '\n');
