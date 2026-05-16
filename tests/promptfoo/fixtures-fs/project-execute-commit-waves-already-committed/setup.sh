#!/bin/bash
set -e
git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false

echo "base" > base.txt
git add base.txt
git commit -q -m "chore: initial"

git checkout -q -b feat/commit-waves-already

mkdir -p .sdlc/execution

# Wave 1 already has committedSha persisted.
cat > .sdlc/execution/execute-feat-commit-waves-already-20260516T100000Z.json <<'EOF'
{
  "version": 1,
  "skill": "execute-plan-sdlc",
  "startedAt": "2026-05-16T10:00:00Z",
  "branch": "feat/commit-waves-already",
  "planPath": null,
  "planHash": null,
  "quality": "balanced",
  "totalTasks": 3,
  "waves": [
    { "number": 1, "status": "completed", "tasks": [], "committedSha": "abc1234567890abc1234567890abc1234567890a" },
    { "number": 2, "status": "in_progress", "tasks": [] }
  ],
  "context": {}
}
EOF
