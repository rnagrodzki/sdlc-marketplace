#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
mkdir -p .sdlc
cat > .sdlc/local.json <<'EOF'
{
  "ship": {
    "preset": "full"
  }
}
EOF
echo '*' > .sdlc/.gitignore
git add -f .sdlc/.gitignore
git commit -q -m "init"
