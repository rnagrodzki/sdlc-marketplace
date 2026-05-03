#!/bin/bash
set -e
git init -q
git config user.email "test@test.com"
git config user.name "Test"
mkdir -p .sdlc
cat > .sdlc/local.json <<'EOF'
{
  "$schema": "https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-local.schema.json",
  "ship": {
    "preset": "balanced",
    "skip": [],
    "bump": "patch"
  }
}
EOF
echo '*' > .sdlc/.gitignore
git add -f .sdlc/.gitignore
git commit -q -m "init"
