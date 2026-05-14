#!/bin/bash
# Fixture for pre-tool-agent-isolation-guard.js — no .sdlc/local.json.
# Hook must default to enabled (block) when no config is present.
set -e
git init --quiet -b main
git config user.email "test@test.com"
git config user.name "Test"
echo "seed" > seed.txt
git add seed.txt
git commit --quiet -m "init"
# No .sdlc/local.json — guard defaults to enabled
