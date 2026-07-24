---
name: example-skill
description: Test fixture — passing case for script-resolution-version rule.
---
# example-skill

Resolves a helper script using the canonical injected-path form. `<PLUGIN_ROOT>` is
substituted from the `sdlc plugin root: <abs>` line injected into session context
by the SessionStart hook.

```bash
node "<PLUGIN_ROOT>/scripts/example.js"
```
