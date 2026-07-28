#!/bin/bash
set -e
git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false

echo "base" > base.txt
git add base.txt
git commit -q -m "chore: initial"

git checkout -q -b feat/compact-recovery-fallback

mkdir -p .sdlc/execution

# Task 7 (R74, #505): NO ship state file — only execute state, so the writer
# hooks must fall back to the execute-plan-sdlc recovery shape. sessionId
# "sess-fixture" so the gate allows the write; mtime left fresh.
cat > .sdlc/execution/execute-feat-compact-recovery-fallback-20260608T120000Z.json <<'EOF'
{
  "version": 1,
  "branch": "feat/compact-recovery-fallback",
  "sessionId": "sess-fixture",
  "preset": "default",
  "waves": [
    { "status": "completed" },
    { "status": "completed" },
    { "status": "pending" }
  ]
}
EOF
