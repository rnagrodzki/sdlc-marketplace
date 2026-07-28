#!/bin/bash
set -e
rm -rf .git
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "chore: release v1.2.3"
git tag v1.2.3
