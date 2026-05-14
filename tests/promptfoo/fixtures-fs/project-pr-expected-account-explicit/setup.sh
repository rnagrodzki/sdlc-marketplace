#!/bin/bash
# Fixture: project with pr.expectedAccount set in .sdlc/config.json.
# Used to verify the identity-match path is taken (access probe skipped).
# The remote URL is a placeholder; the test env bypasses any real network call.
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git remote add origin git@github.com:example-org/example-repo.git
git add -A
git commit -q -m "init"
git checkout -q -b feat/test
echo "feature code" > feature.js
git add feature.js
git commit -q -m "feat: add feature"
