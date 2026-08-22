#!/bin/bash
# Fixture for plan-prepare-exec.yaml — plan template detection
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git remote add origin git@github.com:example-org/example-repo.git
mkdir -p .sdlc
echo "# Project Plan Template" > .sdlc/plan-template.md
echo "init" > README.md
git add -A
git commit -q -m "init"
