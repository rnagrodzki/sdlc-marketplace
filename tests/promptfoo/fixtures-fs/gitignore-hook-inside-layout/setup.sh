#!/bin/bash
# Fixture for ensure-worktree-gitignore hook — inside layout with ensureGitignore:true.
# Hook should add .claude/worktrees/ to root .gitignore managed block.
set -e
git init --quiet -b main
git config user.email "test@test.com"
git config user.name "Test"
echo "seed" > seed.txt
git add seed.txt
git commit --quiet -m "init"

# Configure workspace.worktree with inside layout
mkdir -p .sdlc
cat > .sdlc/local.json << 'EOF'
{
  "workspace": { "worktree": { "layout": "inside" } }
}
EOF
