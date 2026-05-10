#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git checkout -B current-branch -q 2>/dev/null || true
git commit --allow-empty -q -m "init"
