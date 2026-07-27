---
name: example-skill
description: Test fixture — passing case for the orchestrator-await-barrier rule (#487). Marks a fan-out dispatch as await-barrier-required and states the guard.
---

# example-skill

## Step 5: Fan out

<!-- fan-out-dispatch: await-barrier-required -->

Dispatch one Agent per task, in parallel, in a single message, with
`run_in_background: false`. Await barrier: never consolidate on partial or zero
results (R-orchestrator-await, #487).
