#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false
git checkout -B main -q 2>/dev/null || git branch -m main
git add -A
git commit -q -m "chore: initial commit"
# Create a feature branch with one staged change to simulate git diffs
git checkout -q -b feat/test-explore
echo "// changed" >> src/auth.js
git add src/auth.js
