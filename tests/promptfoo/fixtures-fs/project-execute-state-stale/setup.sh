#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "init"
touch -t 202401010000 .sdlc/execution/execute-deletedbranch-20240101T000000Z.json
