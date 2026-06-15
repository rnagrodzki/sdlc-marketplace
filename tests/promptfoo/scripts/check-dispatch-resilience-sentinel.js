#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '../../..');

// Marker-file guard: confirm REPO_ROOT resolved to the repository root.
const MARKER = path.join(REPO_ROOT, 'CLAUDE.md');
if (!fs.existsSync(MARKER)) {
  process.stderr.write(`Script error: REPO_ROOT marker not found at ${MARKER} — script may have moved\n`);
  process.exit(2);
}

const SENTINEL = 'Nested Agent dispatch is supported — being dispatched as a subagent does not remove your Agent tool';

let skillContent;
let waveRunnerContent;
try {
  skillContent = fs.readFileSync(
    path.join(REPO_ROOT, 'plugins/sdlc-utilities/skills/execute-plan-sdlc/SKILL.md'),
    'utf8'
  );
} catch (err) {
  process.stderr.write(`Script error reading SKILL.md: ${err.message}\n`);
  process.exit(2);
}
try {
  waveRunnerContent = fs.readFileSync(
    path.join(REPO_ROOT, 'plugins/sdlc-utilities/skills/execute-plan-sdlc/wave-runner-template.md'),
    'utf8'
  );
} catch (err) {
  process.stderr.write(`Script error reading wave-runner-template.md: ${err.message}\n`);
  process.exit(2);
}

const inSkill = skillContent.includes(SENTINEL);
const inWaveRunner = waveRunnerContent.includes(SENTINEL);
const ok = inSkill && inWaveRunner;

process.stdout.write(JSON.stringify({ ok, inSkill, inWaveRunner }) + '\n');
if (!ok) {
  process.exit(1);
}
