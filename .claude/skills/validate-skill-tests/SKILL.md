---
name: validate-skill-tests
description: "Use after creating or modifying a plugin skill to verify promptfoo test coverage. Checks dataset existence, fixture reference validity, new behavior coverage, and assertion quality."
---

# Validate Skill Tests

After creating a new plugin skill or modifying a skill's workflow or flags, run through
this checklist to verify promptfoo test coverage is adequate.

## When to Use

Invoke this skill when you have:

- Created a new skill under `plugins/sdlc-utilities/skills/`
- Modified a skill's workflow steps or flags (argument-hint changed)
- Changed a skill's behavioral output (different format, new branches)

## Step 1 — Identify Modified Skills

Check which skills were modified in the current changeset:

```bash
git diff --name-only HEAD | grep 'plugins/sdlc-utilities/skills/.*/SKILL.md'
```

Extract skill names from the paths.

## Step 2 — Dataset Existence

For each modified skill, check whether a test dataset exists:

```
tests/promptfoo/datasets/<skill-name>.yaml
```

If the dataset does not exist, create one using `tests/promptfoo/datasets/review-sdlc.yaml`
as the canonical reference for structure and assertion patterns.

Each test case must include:
- `description` — identifies skill and specific behavior (e.g., `"commit-sdlc: --auto flag skips confirmation"`)
- `vars.skill_path` — path to the SKILL.md being tested
- `vars.project_context` — path to a fixture file in `tests/promptfoo/fixtures/`
- `assert` — array of assertions

## Step 3 — Fixture Reference Validity

For each test case in the dataset, verify:

1. Every `file://fixtures/<name>.md` reference points to an existing file under `tests/promptfoo/fixtures/`
2. Every `file://fixtures-fs/<name>/` reference points to an existing directory under `tests/promptfoo/fixtures-fs/`

Report any broken references.

## Step 4 — New Behavior Coverage

If the skill gained a new flag (compare `argument-hint` in the SKILL.md before/after) or
a new workflow step:

1. Check whether any existing test case exercises the new behavior
2. If not, suggest adding a test case with:
   - A descriptive name referencing the new flag/step
   - A fixture that exercises the new code path
   - Both structural and behavioral assertions

## Step 5 — Assertion Quality

Review each test case's assertions for completeness:

| Required | Type | Purpose |
|----------|------|---------|
| At least 1 | `icontains` or `regex` | Structural — verifies specific output strings |
| At least 1 | `llm-rubric` | Behavioral — verifies semantic correctness |

Flag test cases that have only structural OR only behavioral assertions.
Well-written `llm-rubric` assertions are specific enough to distinguish pass from fail
(e.g., "The commit message follows conventional commits format and references the changed files"
not "The output looks correct").

## Step 6 — Report Findings

Present findings in this format:

| Skill | Check | Status | Detail |
|-------|-------|--------|--------|
| `<name>` | Dataset exists | ✓/✗ | path or "missing" |
| `<name>` | Fixture refs valid | ✓/✗ | broken refs listed |
| `<name>` | New behavior covered | ✓/✗/N/A | uncovered flags/steps |
| `<name>` | Assertion quality | ✓/✗ | test cases with gaps |

## DO NOT

- Run `promptfoo eval` automatically — evaluation runs must always be initiated by the user
- Create test cases that test implementation details rather than observable behavior
- Write assertions that match on volatile output (timestamps, random IDs, file paths with user dirs)
