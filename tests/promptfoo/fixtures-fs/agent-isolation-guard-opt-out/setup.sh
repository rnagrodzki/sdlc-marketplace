#!/bin/bash
# Fixture for pre-tool-agent-isolation-guard.js — opt-out via local.json.
# When hooks.agentIsolationGuard.enabled: false, hook must emit continue.
set -e
git init --quiet -b main
git config user.email "test@test.com"
git config user.name "Test"
echo "seed" > seed.txt
git add seed.txt
git commit --quiet -m "init"

mkdir -p .sdlc
cat > .sdlc/local.json << 'EOF'
{
  "hooks": { "agentIsolationGuard": { "enabled": false } }
}
EOF
