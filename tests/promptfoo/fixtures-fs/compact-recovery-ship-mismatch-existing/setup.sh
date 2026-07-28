#!/bin/bash
set -e
git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"
git config commit.gpgsign false

echo "base" > base.txt
git add base.txt
git commit -q -m "chore: initial"

git checkout -q -b feat/compact-recovery-mismatch

mkdir -p .sdlc/execution

# Task 7 (R74, #505): ship state owned by session "sess-fixture". Tests in the
# dataset invoke the writer hooks with a DIFFERENT session_id on stdin, so
# hookEnforcementAllowed(...) must deny and the write must be skipped.
cat > .sdlc/execution/ship-feat-compact-recovery-mismatch-20260608T120000Z.json <<'EOF'
{
  "version": 1,
  "startedAt": "2026-06-08T12:00:00Z",
  "branch": "feat/compact-recovery-mismatch",
  "sessionId": "sess-fixture",
  "flags": { "auto": true, "steps": ["execute", "commit", "pr"] },
  "steps": [
    { "name": "execute", "status": "completed" },
    { "name": "commit", "status": "in_progress" },
    { "name": "pr", "status": "pending" }
  ]
}
EOF

# Pre-existing recovery sidecar with a sentinel value that a denied write must
# leave byte-for-byte untouched (proves "skip the write" rather than
# "overwrite with a denied marker").
cat > .sdlc/execution/.compact-recovery-feat-compact-recovery-mismatch.json <<'EOF'
{"sentinel":"untouched-by-denied-write","savedAt":"2020-01-01T00:00:00.000Z"}
EOF
