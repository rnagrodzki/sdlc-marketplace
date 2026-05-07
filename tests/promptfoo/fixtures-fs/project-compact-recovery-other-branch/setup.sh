#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git checkout -B main -q 2>/dev/null || true
git commit --allow-empty -q -m "init"
NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
node -e "
const fs=require('fs');
const p='.sdlc/execution/.compact-recovery-otherbranch.json';
const o=JSON.parse(fs.readFileSync(p,'utf8'));
o.savedAt='$NOW';
fs.writeFileSync(p,JSON.stringify(o,null,2));
"
