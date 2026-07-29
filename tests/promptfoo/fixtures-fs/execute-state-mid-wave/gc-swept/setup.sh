#!/usr/bin/env bash
# Post-first-sweep sibling of the parent fixture: identical, minus the orphaned
# 19990101T000000/ directory that the first `gc` run already deleted. Used by
# the gc idempotency case — the script-runner provider issues exactly one
# `spawnSync` per test case, so "the second run" is expressed by shipping the
# post-first-run filesystem, the same convention as
# datasets/migrate-config-exec.yaml's idempotent re-run case.
set -euo pipefail

touch -t 202401010000 .sdlc/execution/20250101T000000
