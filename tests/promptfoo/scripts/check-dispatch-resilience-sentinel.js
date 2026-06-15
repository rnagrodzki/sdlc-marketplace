#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '../../..');

const SENTINEL = 'nested Agent dispatch is supported — being dispatched as a subagent does not remove your Agent tool';

const skillContent = fs.readFileSync(
  path.join(REPO_ROOT, 'plugins/sdlc-utilities/skills/execute-plan-sdlc/SKILL.md'),
  'utf8'
);
const waveRunnerContent = fs.readFileSync(
  path.join(REPO_ROOT, 'plugins/sdlc-utilities/skills/execute-plan-sdlc/wave-runner-template.md'),
  'utf8'
);

const inSkill = skillContent.includes(SENTINEL);
const inWaveRunner = waveRunnerContent.includes(SENTINEL);

process.stdout.write(JSON.stringify({ inSkill, inWaveRunner }) + '\n');
