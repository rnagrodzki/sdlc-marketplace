#!/bin/bash
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git checkout -q -b test-valid-branch
git add -A
git commit -q -m "init"
