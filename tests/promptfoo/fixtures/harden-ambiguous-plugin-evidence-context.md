# Failure Context — harden-sdlc invocation (ambiguous + plugin evidence)

## Failure Details
Calling skill:  execute-plan-sdlc
Step:           Step 5 — DO (Wave 2)
Operation:      dispatch standard agent for Task 3
Failure text:   Agent returned malformed JSON; orchestrator at plugins/sdlc-utilities/agents/harden-orchestrator.md emitted no `classification` key. The user's plan task description was also vague ("update the thing"). Both plugin and user content could explain the failure.
Exit code:      0
Error type:     escalation
User intent:    Implement plan tasks

## Loaded Surfaces
- planGuardrails[]:    [{id:"single-responsibility-tasks", severity:"warning", description:"Each task addresses exactly one concern"}]
- executeGuardrails[]: [{id:"yagni", severity:"warning", description:"Do not add functionality until needed"}]
- reviewDimensions[]:  []
- copilotInstructions[]: []
- pluginRepoUrl:       https://github.com/rnagrodzki/sdlc-marketplace

## Orchestrator Result (synthesized for this scenario)
classification:           ambiguous
classificationRationale:  Failure cites plugins/sdlc-utilities/agents/harden-orchestrator.md (plugin evidence) AND a vague user task description (user-code evidence)
routeToErrorReport:       false
errorReportPayload:       {skill:"execute-plan-sdlc", step:"Step 5", operation:"dispatch standard agent", errorText:"Agent returned malformed JSON…", errorType:"ambiguous"}
proposals:                [{surface:"plan-guardrails", action:"strengthen", targetFile:".sdlc/config.json", patch:"…", rationale:"Tighten single-responsibility-tasks to error severity"}]
