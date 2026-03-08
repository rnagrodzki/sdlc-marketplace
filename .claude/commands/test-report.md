---
description: Analyze promptfoo test results and generate an evidence report with failure diagnosis and fix plan
---

# /test-report Command

Analyze the latest promptfoo test results from the local SQLite database and
generate a detailed markdown report in `.evidences/`. Categorizes failures
(infrastructure vs assertion vs missing), diagnoses root causes, and produces
a prioritized fix plan.

## Usage

- `/test-report` — Analyze the latest eval (any type)
- `/test-report --type behavioral` — Analyze only behavioral (LLM) test results
- `/test-report --type exec` — Analyze only script execution test results
- `/test-report --eval-id eval-abc-2026-03-08T16:00:00` — Analyze a specific eval run
- `/test-report --compare` — Include comparison with the previous run of the same type

## Workflow

Invoke the `test-report` skill, passing `$ARGUMENTS` as the CLI flags.
The skill handles everything: script resolution, data extraction from the SQLite DB,
failure categorization, report generation with plan-critique-improve cycle,
fix plan creation, and writing the evidence file to `.evidences/`.
