#!/bin/bash
# Fixture for worktree-create-exec.yaml — no workspace.worktree config.
# worktree-create should fall back to inside layout (.claude/worktrees/<slug>).
set -e
git init --quiet -b main
git config user.email "test@test.com"
git config user.name "Test"
echo "seed" > seed.txt
git add seed.txt
git commit --quiet -m "init"
# No .sdlc/local.json — default layout used
