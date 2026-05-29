#!/usr/bin/env bash
# Fixture setup: harden-prepare with an existing guardrail whose description is
# in the 513–1024 char range. Exercises R16 pre-flight: this MUST now PASS after
# the description limit was raised 512 → 1024 (issue #438).
set -euo pipefail

# Initialise a git repo so resolveProjectRoot() and git-based helpers work.
git init -q 2>/dev/null || true
git add -A 2>/dev/null || true
git -c user.email=t@t.co -c user.name=t commit -qm init 2>/dev/null || true

echo "fixture-ready"
