#!/bin/bash
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git remote add origin git@github.com:rnagrodzki/sdlc-marketplace.git
echo "code" > app.js
git add -A
git commit -q -m "init"
git checkout -q -b feat/test
echo "feature" > feature.js
git add feature.js
git commit -q -m "feat: add feature"
