---
name: example-orchestrator
description: Test fixture — failing case for the orchestrator-template surface of the script-resolution-version rule.
---

# example-orchestrator

Resolves a plugin script directly instead of receiving a pre-computed path from
the caller (regression, see #485). Orchestrators run in subagent context, where
the `sdlc plugin root:` line is absent — the resolver below fails silently.

```bash
SCRIPT=$(find ~/.claude/plugins -name "example.js" -path "*/sdlc*/scripts/example.js" 2>/dev/null | sort -V | tail -1)
node "$SCRIPT"
```
