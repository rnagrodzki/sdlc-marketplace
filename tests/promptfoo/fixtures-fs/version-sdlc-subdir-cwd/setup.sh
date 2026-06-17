#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "chore: init"
git tag v1.0.0
# Post-tag commit so HEAD is not on the tag — prevents idempotency guard from firing
echo "// placeholder" >> subdir/.gitkeep
git add -A
git commit -q -m "chore: add subdir placeholder"
