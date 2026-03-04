'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Discover skill files from .claude/skills/.
 * Handles two layouts:
 *   - Flat:   .claude/skills/<name>.md           → key = name
 *   - Nested: .claude/skills/<name>/SKILL.md     → key = <directory name>
 *
 * Supporting files inside skill subdirectories (README.md, REFERENCE.md, etc.) are skipped.
 */
function discoverSkillFiles(projectRoot) {
  const skillsDir = path.join(projectRoot, '.claude', 'skills');
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch (e) {
    return results;
  }

  for (const entry of entries) {
    const full = path.join(skillsDir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push({
        name: path.basename(entry.name, '.md'),
        relativePath: path.relative(projectRoot, full).replace(/\\/g, '/'),
        absolutePath: full,
      });
    } else if (entry.isDirectory()) {
      const skillMd = path.join(full, 'SKILL.md');
      if (fs.existsSync(skillMd)) {
        results.push({
          name: entry.name,
          relativePath: path.relative(projectRoot, skillMd).replace(/\\/g, '/'),
          absolutePath: skillMd,
        });
      }
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Discover agent files from .claude/agents/.
 * Handles the same flat/nested layouts as skills.
 */
function discoverAgentFiles(projectRoot) {
  const agentsDir = path.join(projectRoot, '.claude', 'agents');
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(agentsDir, { withFileTypes: true });
  } catch (e) {
    return results;
  }

  for (const entry of entries) {
    const full = path.join(agentsDir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push({
        name: path.basename(entry.name, '.md'),
        relativePath: path.relative(projectRoot, full).replace(/\\/g, '/'),
        absolutePath: full,
      });
    } else if (entry.isDirectory()) {
      const agentMd = path.join(full, 'AGENT.md');
      const fallbackMd = path.join(full, entry.name + '.md');
      const primary = fs.existsSync(agentMd) ? agentMd
        : fs.existsSync(fallbackMd) ? fallbackMd
        : null;
      if (primary) {
        results.push({
          name: entry.name,
          relativePath: path.relative(projectRoot, primary).replace(/\\/g, '/'),
          absolutePath: primary,
        });
      }
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { discoverSkillFiles, discoverAgentFiles };
