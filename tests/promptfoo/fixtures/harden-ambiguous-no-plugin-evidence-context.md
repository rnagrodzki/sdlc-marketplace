# Failure Context — harden-sdlc invocation (ambiguous, no plugin evidence — Step 5c suppressed)

## Failure Details
Calling skill:  plan-sdlc
Step:           Step 4 — CRITIQUE
Operation:      assess plan-guardrail compliance
Failure text:   Plan guardrail "single-responsibility-tasks" rationale was unclear; user content alone — no plugin scripts referenced.
Exit code:      0
Error type:     escalation
User intent:    Plan a refactor

## Loaded Surfaces
- planGuardrails[]:    [{id:"single-responsibility-tasks", severity:"warning", description:"Each task addresses exactly one concern"}]
- executeGuardrails[]: []
- reviewDimensions[]:  []
- copilotInstructions[]: []
- pluginRepoUrl:       https://github.com/rnagrodzki/sdlc-marketplace

## Orchestrator Result (synthesized for this scenario)
classification:           ambiguous
classificationRationale:  Plan content is vague but no plugin code is implicated; user-side intent could not be determined.
routeToErrorReport:       false
errorReportPayload:       null
proposals:                [{surface:"plan-guardrails", action:"strengthen", targetFile:".sdlc/config.json", patch:"…", rationale:"Tighten single-responsibility-tasks description"}]
