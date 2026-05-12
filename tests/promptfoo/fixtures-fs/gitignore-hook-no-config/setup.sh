#!/bin/bash
# Fixture for ensure-worktree-gitignore hook — no workspace.worktree config.
# Hook should be a no-op: no .gitignore written or modified.
set -e
git init --quiet -b main
git config user.email "test@test.com"
git config user.name "Test"
echo "seed" > seed.txt
git add seed.txt
git commit --quiet -m "init"

# No .sdlc/local.json — hook must exit 0 without touching .gitignore
