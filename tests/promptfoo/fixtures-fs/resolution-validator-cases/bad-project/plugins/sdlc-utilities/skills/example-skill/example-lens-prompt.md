# Example Lens Subagent Prompt

Test fixture — failing case for the subagent-prompt-template surface of the
script-resolution-version rule (regression, see #485). This template resolves a
plugin script using the injected-path form, but subagent context has no
`sdlc plugin root:` line injected — the resolver below fails silently.

```bash
node "<PLUGIN_ROOT>/scripts/example.js"
```
