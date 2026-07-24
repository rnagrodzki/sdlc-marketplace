# Example Lens Subagent Prompt

Test fixture — passing case for the subagent-prompt-template surface of the
script-resolution-version rule. This template receives pre-computed paths from
the orchestrator; it does not resolve any plugin script itself, because subagent
context has no `sdlc plugin root:` line injected.

## Inputs

You receive:
- `{MANIFEST_PATH}` — absolute path to a manifest file prepared by the orchestrator

Read the manifest at `{MANIFEST_PATH}` before evaluating.
