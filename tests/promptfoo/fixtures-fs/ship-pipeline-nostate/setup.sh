#!/bin/bash
set -e
git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false

echo "base" > base.txt
git add base.txt
git commit -q -m "chore: initial"

git checkout -q -b feat/ship

# No .sdlc/execution state file is written — both hooks must exit 0 silently
# (no ship state file for the current branch).
mkdir -p .sdlc/execution
