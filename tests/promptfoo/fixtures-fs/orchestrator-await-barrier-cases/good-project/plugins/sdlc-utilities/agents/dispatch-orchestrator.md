---
name: dispatch-orchestrator
description: Test fixture — passing case for the orchestrator-await-barrier rule (#487). Dispatches Agent with the synchronous-dispatch/barrier guard present.
tools: Read, Agent
---

# dispatch-orchestrator

Dispatches sub-agents for parallel work and consolidates their results.

Await barrier: dispatch every task in a single message with `run_in_background: false`
and wait for all results before consolidating. Never consolidate on partial or zero
results (R-orchestrator-await, #487).

```
Agent({ description: "do work", prompt: "...", run_in_background: false })
```
