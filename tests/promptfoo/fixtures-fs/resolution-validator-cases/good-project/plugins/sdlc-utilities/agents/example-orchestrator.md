---
name: example-orchestrator
description: Test fixture — passing case for the orchestrator-template surface of the script-resolution-version rule.
---

# example-orchestrator

Dispatches subagents with pre-computed paths. Does not resolve any plugin script
itself — orchestrators run in subagent context, where the `sdlc plugin root:`
line is absent.
