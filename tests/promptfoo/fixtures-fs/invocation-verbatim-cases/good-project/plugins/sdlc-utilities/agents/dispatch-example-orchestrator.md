---
name: dispatch-example-orchestrator
description: Test fixture — passing case for the invocation-verbatim rule (#452). Two dispatch-example sections, one per accepted verbatim-guard phrasing.
tools: Read, Agent
---

# dispatch-example-orchestrator

## Step 2: Dispatch (exact phrasing)

Dispatch via Agent tool (subagent_type: general-purpose, model: dimension.model, run_in_background: false)

Use each dimension's precomputed dispatch fields verbatim; do not construct them from the example above.

## Step 3: Fan-out (variant phrasing)

Dispatch via Agent tool (subagent_type: general-purpose, model: dimension.model, run_in_background: false)

Pass the precomputed fields verbatim into the dispatch without further mutation.
