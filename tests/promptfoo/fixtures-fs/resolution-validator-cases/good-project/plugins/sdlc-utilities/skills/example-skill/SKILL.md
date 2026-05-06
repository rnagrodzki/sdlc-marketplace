---
name: example-skill
description: Test fixture — passing case for script-resolution-version rule.
---
# example-skill

Resolves a helper script using the canonical pattern with `sort -V | tail -1`.

```bash
SCRIPT=$(find ~/.claude/plugins -name "example.js" -path "*/sdlc*/scripts/example.js" 2>/dev/null | sort -V | tail -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/example.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/example.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate example.js" >&2; exit 2; }
node "$SCRIPT"
```
