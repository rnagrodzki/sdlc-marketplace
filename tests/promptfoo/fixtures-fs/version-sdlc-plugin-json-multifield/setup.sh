#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "chore: init plugin manifest fixture"
git tag v0.1.0
echo "// noop" >> src/main.js
git add -A
git commit -q -m "fix: tighten input validation"
