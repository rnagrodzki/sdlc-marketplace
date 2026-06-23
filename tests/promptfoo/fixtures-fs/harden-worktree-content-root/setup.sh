#!/bin/bash
# Fixture for harden-prepare-exec.yaml — linked-worktree content-root rooting (#474).
# Creates a main worktree with config.json + a main-only dimension, then a linked
# worktree (feat/x) whose branch removes main-only and adds branch-only.
# The test runs harden-prepare.js from linked-wt/ to assert content-root rooting.
set -e

git init -q -b main
git config user.email "test@test.com"
git config user.name "Test"

# --- main worktree: config + main-only dimension ---
mkdir -p .sdlc/review-dimensions

cat > .sdlc/config.json <<'CONFIG'
{
  "sdlc": "1.0.0",
  "plan": {
    "guardrails": [
      {
        "id": "main-config-guardrail",
        "description": "A guardrail that lives in the main worktree config.",
        "severity": "warning"
      }
    ]
  },
  "execute": {
    "guardrails": []
  }
}
CONFIG

cat > .sdlc/review-dimensions/main-only.md <<'DIMENSION'
---
name: main-only
description: "A review dimension that exists only in the main worktree branch."
severity: medium
triggers:
  - "**/*.ts"
---

# Main-Only Dimension

This dimension is committed on the main branch and should NOT appear when
harden-prepare.js is invoked from the linked worktree (feat/x).
DIMENSION

git add -A
git commit -q -m "init: main worktree with config + main-only dimension"

# --- linked worktree on feat/x ---
git worktree add --quiet linked-wt -b feat/x

# Remove main-only dimension from the branch, add branch-only
rm linked-wt/.sdlc/review-dimensions/main-only.md

cat > linked-wt/.sdlc/review-dimensions/branch-only.md <<'DIMENSION'
---
name: branch-only
description: "A review dimension that exists only in the active linked worktree branch."
severity: medium
triggers:
  - "**/*.ts"
---

# Branch-Only Dimension

This dimension is committed on the feat/x branch and MUST appear when
harden-prepare.js is invoked from the linked worktree (feat/x).
DIMENSION

cd linked-wt && git add -A && git commit -q -m "feat/x: replace main-only dimension with branch-only"
