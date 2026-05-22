#!/bin/bash
# Minimal git-init for a project fixture used by harden-prepare-exec.yaml R19
# tests. harden-prepare.js inspects git state, so the fixture must be a valid
# git repo. The bin/gh stub returns a deterministic `gh issue view` payload
# carrying the `mcp-failure` label.
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "init"
