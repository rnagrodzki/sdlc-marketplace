#!/bin/bash
# Fixture for lib-worktree-exec.yaml — resolveMainWorktree from a linked worktree cwd.
# Creates a real linked worktree; test uses script_cwd pointing to the linked path.
set -e
git init --quiet -b main
git config user.email "test@test.com"
git config user.name "Test"
echo "seed" > seed.txt
git add seed.txt
git commit --quiet -m "init"
# Create a linked worktree branch and directory
git worktree add --quiet linked-wt feat/linked-test 2>/dev/null || git worktree add --quiet linked-wt -b feat/linked-test
# Write a marker so the test can confirm the linked path is different from the main
echo "linked" > linked-wt/marker.txt
