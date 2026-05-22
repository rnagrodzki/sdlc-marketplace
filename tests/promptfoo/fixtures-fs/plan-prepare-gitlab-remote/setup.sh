#!/bin/bash
# Fixture for plan-prepare-exec.yaml — T3b: GitLab remote → githubHosting.detected = false
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git remote add origin git@gitlab.com:example-org/example-repo.git
echo "init" > README.md
git add -A
git commit -q -m "init"
