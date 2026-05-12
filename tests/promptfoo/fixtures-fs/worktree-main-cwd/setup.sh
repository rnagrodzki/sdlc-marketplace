#!/bin/bash
# Fixture for lib-worktree-exec.yaml — resolveMainWorktree from main worktree cwd.
set -e
git init --quiet -b main
git config user.email "test@test.com"
git config user.name "Test"
echo "seed" > seed.txt
git add seed.txt
git commit --quiet -m "init"
