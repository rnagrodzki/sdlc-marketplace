#!/bin/bash
set -e
git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false

echo "base" > base.txt
git add base.txt
git commit -q -m "chore: initial"

git checkout -q -b feat/compact-recovery-match

mkdir -p .sdlc/execution

# Task 7 (R74, #505): ship state for branch feat/compact-recovery-match (slug
# feat-compact-recovery-match), sessionId "sess-fixture", commit in_progress.
# mtime is left fresh (setup.sh run time) — this fixture exercises the
# positive "hookEnforcementAllowed true -> write" path where savedAt is
# expected to land close to "now" via the state file's own mtime.
cat > .sdlc/execution/ship-feat-compact-recovery-match-20260608T120000Z.json <<'EOF'
{
  "version": 1,
  "startedAt": "2026-06-08T12:00:00Z",
  "branch": "feat/compact-recovery-match",
  "sessionId": "sess-fixture",
  "flags": { "auto": true, "steps": ["execute", "commit", "pr"] },
  "steps": [
    { "name": "execute", "status": "completed" },
    { "name": "commit", "status": "in_progress" },
    { "name": "pr", "status": "pending" }
  ]
}
EOF
