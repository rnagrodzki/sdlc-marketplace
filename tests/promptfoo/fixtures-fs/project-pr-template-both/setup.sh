#!/bin/bash
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "init"
git checkout -q -b feat/test
echo "feature code" > feature.js
git add feature.js
git commit -q -m "feat: add feature"
