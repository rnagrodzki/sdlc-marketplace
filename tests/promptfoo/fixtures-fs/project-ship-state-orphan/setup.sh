#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
# Stay on the default initial branch (main) so cmdInit's pruneStateFiles
# matches ship-main-*.json.
git checkout -B main -q 2>/dev/null || git branch -m main
git add -A
git commit -q -m "init"
