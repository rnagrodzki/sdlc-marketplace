#!/bin/bash
# Clean project for setup-sdlc --only pr-labels sub-flow tests.
# Pre-existing pr.titlePattern is intentionally present so that writing
# pr.labels does not clobber siblings (sub-flow gotcha #1).
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "init"
