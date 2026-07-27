---
name: example-skill
description: Test fixture — failing case for the orchestrator-await-barrier rule (#487). Marks a fan-out dispatch as await-barrier-required but never states the guard.
---

# example-skill

## Step 5: Fan out

<!-- fan-out-dispatch: await-barrier-required -->

Dispatch one Agent per task, in parallel, in a single message.
