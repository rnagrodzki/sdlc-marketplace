#!/bin/bash
# Note: the tmp/ subdirectory is intentionally empty — no sdlc-context-stats.json.
# This fixture exercises the "sidecar missing" branch of context-advisory.js.
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "init" || true
