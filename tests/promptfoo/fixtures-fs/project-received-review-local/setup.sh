#!/bin/bash
# Issue #233: receivedReview.alwaysFixSeverities configured in .sdlc/local.json
# (the canonical location). Used by received-review-prepare-exec tests to verify
# that the prepare script resolves flags.alwaysFixSeverities from local config.
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
mkdir -p .sdlc
cat > .sdlc/local.json <<'EOF'
{
  "$schema": "https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-local.schema.json",
  "schemaVersion": 3,
  "receivedReview": {
    "alwaysFixSeverities": ["high", "critical"]
  }
}
EOF
cat > .sdlc/config.json <<'EOF'
{
  "$schema": "https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-config.schema.json",
  "schemaVersion": 3
}
EOF
git add .
git commit -q -m "init"
