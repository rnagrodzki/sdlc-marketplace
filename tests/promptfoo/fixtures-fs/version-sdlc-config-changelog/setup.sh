#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "chore: init"
git tag v1.0.0
# Add a feat commit so the next bump produces a changelog
echo "// added" >> src/index.js
git add -A
git commit -q -m "feat: add new capability"
