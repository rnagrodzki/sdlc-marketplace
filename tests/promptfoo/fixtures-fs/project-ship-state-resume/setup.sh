#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
# Initial commit on default branch
git add -A
git commit -q -m "chore: init"
# Use 'main' as the working branch (matches state file slug below).
git branch -M main
# Touch the state file so its mtime is "now" — detectResumeState() requires
# fresh === true (within COMPACT_RECOVERY_TTL_MS = 1h) for implicit resume.
touch .sdlc/execution/ship-main-20260101T000000Z.json
