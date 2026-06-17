#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "chore: release v1.2.4-rc.1"
git tag v1.2.4-rc.1
# HEAD is now tagged with a pre-release tag — idempotency guard fires
