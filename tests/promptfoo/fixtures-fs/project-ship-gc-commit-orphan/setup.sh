#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false
git checkout -B main -q 2>/dev/null || git branch -m main
git add -A
git commit -q -m "chore: initial commit"
touch -t 202401010000 .sdlc/execution/commit-gone-20240101T000000Z.json
touch -t 202401010000 .sdlc/execution/ship-gone-20240101T000000Z.json
