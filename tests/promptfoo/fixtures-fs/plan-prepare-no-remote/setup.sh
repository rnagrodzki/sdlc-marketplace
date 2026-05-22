#!/bin/bash
# Fixture for plan-prepare-exec.yaml — T3c: no origin → githubHosting.detected = false, host = null
git init -q
git config user.email "test@test.com"
git config user.name "Test"
echo "init" > README.md
git add -A
git commit -q -m "init"
