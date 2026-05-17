#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false
git checkout -q -b feat/test-plan-mode
git add -A
git commit -q -m "chore: initial commit"
git remote add origin "https://github.com/example/test-repo.git"
git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
