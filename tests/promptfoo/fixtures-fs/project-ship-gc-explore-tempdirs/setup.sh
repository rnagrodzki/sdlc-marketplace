#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false
git checkout -B main -q 2>/dev/null || git branch -m main
git add -A
git commit -q -m "chore: initial commit"

# Create a controlled fake-tmpdir to hold sdlc-explore-* directories
mkdir -p fake-tmpdir

# Stale tempdir for a dead branch (slug: dead-branch)
mkdir -p fake-tmpdir/sdlc-explore-dead-branch-abc123
touch -t 202401010000 fake-tmpdir/sdlc-explore-dead-branch-abc123

# Fresh tempdir for a live branch (slug: main)
mkdir -p fake-tmpdir/sdlc-explore-main-xyz789
