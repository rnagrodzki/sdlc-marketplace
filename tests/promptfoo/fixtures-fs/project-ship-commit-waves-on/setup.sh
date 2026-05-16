#!/bin/bash
set -e
git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false

mkdir -p .sdlc
cat > .sdlc/local.json <<'EOF'
{
  "$schema": "sdlc-local.schema.json",
  "schemaVersion": 4,
  "ship": {
    "steps": ["execute", "commit", "pr"],
    "bump": "patch",
    "auto": false,
    "execute": {
      "commitWaves": true
    }
  }
}
EOF

echo "base" > base.txt
git add base.txt .sdlc
git commit -q -m "chore: initial"

git checkout -q -b feat/commit-waves-on
