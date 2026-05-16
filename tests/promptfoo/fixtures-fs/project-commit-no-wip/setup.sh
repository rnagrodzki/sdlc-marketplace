#!/bin/bash
set -e
git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false

echo "base" > base.txt
git add base.txt
git commit -q -m "chore: initial"

git checkout -q -b feat/no-wip

echo "feature" > feature.txt
git add feature.txt
git commit -q -m "feat: add normal feature"

# Stage something so commit.js doesn't error on "nothing staged".
echo "more" > more.txt
git add more.txt
