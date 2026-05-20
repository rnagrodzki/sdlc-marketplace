#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false
git checkout -B main -q 2>/dev/null || git branch -m main
git add -A
git commit -q -m "chore: initial commit"
