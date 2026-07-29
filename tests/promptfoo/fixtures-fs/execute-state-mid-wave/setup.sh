#!/usr/bin/env bash
# Fixture: mid-wave execute state for the context-producer / liveness /
# resume-reset exec datasets.
#
# `cpSync` in tests/promptfoo/scripts/extract-skill-content.js copies with
# preserveTimestamps:false, so every copied entry lands with a *fresh* mtime.
# reapRunDirectories() checks `ttl-fresh` BEFORE the live-run-id check, so an
# un-backdated run directory would always be kept for the wrong reason and the
# gc cases would never exercise the stale branch. Backdate both per-run
# directories so `gc --ttl-days 1` classifies them as stale and has to fall
# through to the liveRunIds comparison.
set -euo pipefail

touch -t 202401010000 .sdlc/execution/19990101T000000
touch -t 202401010000 .sdlc/execution/20250101T000000
