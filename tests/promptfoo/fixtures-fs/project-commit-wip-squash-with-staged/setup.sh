#!/bin/bash
set -e
git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false

echo "base" > base.txt
git add base.txt
git commit -q -m "chore: initial"

git checkout -q -b feat/wip-squash-staged

echo "wave1-file" > wave1.txt
git add wave1.txt
git commit -q -m "wip(execute): wave 1 — add wave1.txt"

# User hand-edits a new file on top, leaves it staged.
echo "hand-edit" > extra.txt
git add extra.txt
