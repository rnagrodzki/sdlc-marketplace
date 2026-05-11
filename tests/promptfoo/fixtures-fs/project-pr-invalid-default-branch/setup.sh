#!/bin/bash
# Fixture for pr-prepare-exec.yaml — invalid pr.defaultBranch shell-metacharacter
# rejection test. The config field contains shell metacharacters, so pr.js must
# reject the value via the branch-name validator BEFORE any shell interpolation
# reaches `git rev-parse`.
set -e
git init --quiet -b main
git config user.email "test@test.com"
git config user.name "Test"
echo "seed" > seed.txt
git add .
git commit --quiet -m "init"
git checkout -q -b feat/my-feature
echo "feature" > feature.js
git add feature.js
git commit --quiet -m "feat: add feature"
