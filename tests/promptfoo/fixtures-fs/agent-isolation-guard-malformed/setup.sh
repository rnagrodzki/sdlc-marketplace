#!/bin/bash
# Fixture for pre-tool-agent-isolation-guard.js — malformed local.json.
# Hook must default to enabled (block) when local.json cannot be parsed.
set -e
git init --quiet -b main
git config user.email "test@test.com"
git config user.name "Test"
echo "seed" > seed.txt
git add seed.txt
git commit --quiet -m "init"

mkdir -p .sdlc
# Write intentionally malformed JSON
printf '{invalid json\n' > .sdlc/local.json
