#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -f .sdlc/.gitignore
git add openspec
git commit -q -m "init"
