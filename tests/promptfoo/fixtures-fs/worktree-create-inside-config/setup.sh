#!/bin/bash
# Fixture for worktree-create-exec.yaml — inside layout configured in .sdlc/local.json.
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
  "workspace": { "worktree": { "layout": "inside" } }
}
EOF
