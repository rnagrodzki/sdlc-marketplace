#!/usr/bin/env node
/**
 * session-start.js
 * SessionStart hook — outputs plugin version and user-invocable skill count
 * into the system-reminder context.
 *
 * Output format (stdout → system-reminder):
 *   sdlc: v0.16.5 (11 skills loaded)
 *   Plan mode routing: always invoke plan-sdlc via the Skill tool when plan mode is active.
 *
 * Uses only Node.js built-in modules. No npm install required.
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
// Output
// ---------------------------------------------------------------------------

process.stdout.write(
  `sdlc: v${version} (${skillCount} skills loaded)\n` +
  'Plan mode routing: always invoke plan-sdlc via the Skill tool when plan mode is active.\n'
);
