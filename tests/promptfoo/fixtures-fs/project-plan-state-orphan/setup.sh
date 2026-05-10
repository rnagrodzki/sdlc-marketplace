#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "init"
# Backdate the stale state files so gc considers them older than the TTL.
touch -t 202401010000 .sdlc/execution/plan-deletedbranch-20240101T000000Z.json
touch -t 202401010000 .sdlc/execution/execute-deletedbranch-20240101T000000Z.json
