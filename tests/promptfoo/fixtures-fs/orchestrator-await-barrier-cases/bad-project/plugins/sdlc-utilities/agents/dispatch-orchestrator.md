---
name: dispatch-orchestrator
description: Test fixture — failing case for the orchestrator-await-barrier rule (#487). Dispatches Agent but declares no synchronous-dispatch/barrier guard.
tools: Read, Agent
---

# dispatch-orchestrator

Dispatches sub-agents for parallel work and consolidates their results.

```
Agent({ description: "do work", prompt: "..." })
```
