#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
# Seed minimal .sdlc/ and .claude/ directories
mkdir -p .sdlc
echo '{"schemaVersion":4}' > .sdlc/local.json
echo '{"schemaVersion":4}' > .sdlc/config.json
mkdir -p .claude
git add -A
git commit -q -m "chore: init"
git tag v1.0.0
