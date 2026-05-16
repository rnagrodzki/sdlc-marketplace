#!/bin/bash
set -e
git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false

# Base commit on main (the fork-point for the feature branch)
echo "base" > base.txt
git add base.txt
git commit -q -m "chore: initial"

# Feature branch with two wip(execute): commits, no staged changes on top
git checkout -q -b feat/wip-squash

echo "wave1-file" > wave1.txt
git add wave1.txt
git commit -q -m "wip(execute): wave 1 — add wave1.txt"

echo "wave2-file" > wave2.txt
git add wave2.txt
git commit -q -m "wip(execute): wave 2 — add wave2.txt"

# Stage nothing; index is clean.
