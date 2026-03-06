---
description: Validate the plugin discovery chain — marketplace manifest, plugin manifests, commands, skills, scripts, hooks, and agents
allowed-tools: [Bash, Skill]
argument-hint: "[--markdown]"
---

# /plugin-check Command

Validates that the plugin is correctly wired for post-installation discovery.
Checks every manifest, cross-reference, and file path that Claude Code needs to
load commands, invoke skills, run scripts, fire hooks, and delegate to agents.

## Usage

```text
/sdlc:plugin-check
/sdlc:plugin-check --markdown
```

## Workflow

Invoke the `sdlc-validating-plugin-discovery` skill, passing `$ARGUMENTS` as the CLI flags.
The skill handles everything: script resolution, validation, result display,
remediation guidance, and re-validation.
