## Objective

[1-2 sentences describing the broken behavior and its impact.
Example: "Webhook delivery fails silently when the target endpoint returns a 5xx
status, causing publishers to miss critical events with no retry or alert."]

## Details

### Current Behavior

[Describe exactly what happens now — include error messages, incorrect values,
unexpected UI states, or API responses.]

### Expected Behavior

[Describe what should happen instead. Be specific.]

### Reproduction Steps

1. [Step 1 — starting condition or setup]
2. [Step 2 — action that triggers the bug]
3. [Step 3 — observe the incorrect behavior]

### Environment

- **Environment:** [production / staging / dev]
- **Affected version / release:** [if known]
- **Affected accounts / tenants:** [if scoped to specific users]
- **Frequency:** [always / intermittent — rate if known]

### Supporting Evidence

[Attach logs, screenshots, Sentry links, trace IDs, or API response samples.
Use code blocks for raw output.]

## Acceptance Criteria

- [ ] [The broken behavior no longer occurs — specific condition that was failing now passes]
- [ ] [Root cause is addressed — not just the symptom]
- [ ] [No regression — related functionality unaffected]
- [ ] [Error handling — appropriate error surfaced or logged where applicable]

## Development Plan

_To be defined by the development team._

## How to Test

1. **Prerequisites:** [Test data, environment, account setup]
2. **Reproduction (confirm the bug exists before fix):**
   1. [Reproduce step 1]
   2. [Reproduce step 2]
3. **Verification (confirm the fix works):**
   1. [Verify step 1]
   2. [Verify step 2]
4. **Regression check:**
   - [Related functionality to confirm is still working]

## Release Notes

[Optional — only if the bug was customer-visible and the fix should appear in a changelog.]

_Example: "Fixed an issue where webhook delivery failures were silently dropped without retry."_