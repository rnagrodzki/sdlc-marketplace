#!/bin/bash
# Issue #429: receivedReview.alwaysHardenFromReview MISPLACED in .sdlc/config.json
# (the wrong location — must be local-only per R24). Used by exec tests to verify
# the prepare script emits a stderr warning and ignores the misplaced value
# (resolves flags.alwaysHardenFromReview to false).
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
mkdir -p .sdlc
cat > .sdlc/config.json <<'EOF'
{
  "$schema": "https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-config.schema.json",
  "schemaVersion": 3,
  "receivedReview": {
    "alwaysHardenFromReview": true
  }
}
EOF
cat > .sdlc/local.json <<'EOF'
{
  "$schema": "https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-local.schema.json",
  "schemaVersion": 3
}
EOF
git add .
git commit -q -m "init"
