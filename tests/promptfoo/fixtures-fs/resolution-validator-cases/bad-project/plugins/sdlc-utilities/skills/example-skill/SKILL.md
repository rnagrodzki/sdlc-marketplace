---
name: example-skill
description: Test fixture — failing case for script-resolution-version rule.
---
# example-skill

Resolves a helper script using the OLD `find ~/.claude/plugins` pattern (regression,
see #485) — this shape can silently select a fixture or marketplace-clone copy of
the script instead of the installed one, even with `sort -V | tail -1`.

```bash
SCRIPT=$(find ~/.claude/plugins -name "example.js" -path "*/sdlc*/scripts/example.js" 2>/dev/null | sort -V | tail -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/example.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/example.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate example.js" >&2; exit 2; }
node "$SCRIPT"
```
