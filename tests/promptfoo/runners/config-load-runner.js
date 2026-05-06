#!/usr/bin/env node
'use strict';

// Tiny test runner: read project config and emit its source list as JSON.
// Invoked by tests/promptfoo/datasets/config-load-exec.yaml.

const path = require('path');
const cfg = require(path.resolve(__dirname, '..', '..', '..', 'plugins', 'sdlc-utilities', 'scripts', 'lib', 'config.js'));

const result = cfg.readProjectConfig(process.cwd());
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
