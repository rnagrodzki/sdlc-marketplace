#!/bin/bash
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "init"
echo "new content" > staged.js
git add staged.js
