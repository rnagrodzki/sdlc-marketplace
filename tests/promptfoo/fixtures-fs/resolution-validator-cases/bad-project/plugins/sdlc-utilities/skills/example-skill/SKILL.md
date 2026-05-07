---
name: example-skill
description: Test fixture — failing case for script-resolution-version rule.
---
# example-skill

Resolves a helper script using the OLD pattern with bare `head -1` (regression).

```bash
SCRIPT=$(find ~/.claude/plugins -name "example.js" -path "*/sdlc*/scripts/example.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/example.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/example.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate example.js" >&2; exit 2; }
node "$SCRIPT"
```
