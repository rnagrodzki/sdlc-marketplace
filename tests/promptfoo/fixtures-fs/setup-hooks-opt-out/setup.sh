#!/bin/bash
# Fixture for setup-prepare hooks section — opt-out already written.
# Verifies that setup.js detects hooks.agentIsolationGuard.enabled: false
# and populates the hooks section summary correctly.
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git commit -q --allow-empty -m "init"

mkdir -p .sdlc
cat > .sdlc/local.json << 'EOF'
{
  "schemaVersion": 3,
  "hooks": { "agentIsolationGuard": { "enabled": false } }
}
EOF
