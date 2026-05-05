---
name: test-quality
description: "Reviews promptfoo behavioral test datasets, fixtures, and test scripts for assertion quality, fixture accuracy, and skill coverage"
triggers:
  - "tests/promptfoo/datasets/*.yaml"
  - "tests/promptfoo/fixtures/*.md"
  - "tests/promptfoo/fixtures-fs/**"
  - "tests/promptfoo/scripts/*.js"
  - "tests/promptfoo/promptfooconfig*.yaml"
skip-when:
  - "tests/promptfoo/.promptfoo-data/**"
  - "tests/promptfoo/.env"
severity: medium
model: sonnet
---

# Test Quality Review

Review promptfoo behavioral test datasets, fixtures, and supporting scripts for correctness and meaningful coverage. This project uses promptfoo to validate that SDLC skills produce correct AI agent behavior. Each dataset YAML file defines test cases with `vars` (skill_path, project_context, user_request) and `assert` blocks (icontains, regex, not-icontains, llm-rubric).

## Checklist

- [ ] Each test case `description` clearly identifies the skill and the specific behavior being tested — e.g., `"commit-sdlc: --auto flag skips interactive approval prompt"`, not just `"test commit"`
- [ ] `vars.skill_path` references a SKILL.md that actually exists at that path in the repository
- [ ] `vars.project_context` references a fixture file (`file://fixtures/...`) that exists in `tests/promptfoo/fixtures/` — no broken references
- [ ] Fixture appropriateness comments at the top of each dataset are accurate — a fixture marked CORRECT provides signals relevant to the skill, a fixture marked INVALID explains why it is unsuitable
- [ ] `assert` blocks include at least one structural assertion (icontains/regex) AND one behavioral assertion (llm-rubric) — structural alone misses intent, behavioral alone is flaky
- [ ] `icontains` and `regex` assertions match strings actually produced by the skill workflow — not hallucinated output patterns
- [ ] `not-icontains` / `not-regex` assertions verify meaningful exclusions (e.g., skill must NOT propose a dimension when evidence is absent) — not trivial negations
- [ ] `llm-rubric` assertions describe expected behavior specifically enough that a grading LLM can distinguish pass from fail — no vague criteria like "response is good"
- [ ] When a skill adds or changes behavior (new flags, new workflow steps), corresponding test cases are added or updated in the dataset — no untested behavior changes
- [ ] `fixtures-fs/` directory-based fixtures have the expected file tree structure matching what the test scenario requires (e.g., `plugins/sdlc-utilities/skills/` hierarchy for discovery tests)
- [ ] Test helper scripts in `tests/promptfoo/scripts/` handle edge cases (missing files, malformed input) without crashing — they should exit cleanly with a descriptive error
- [ ] `promptfooconfig*.yaml` references valid dataset paths and provider configuration — no stale entries pointing to renamed or deleted datasets

## Severity Guide

| Finding | Severity |
|---------|----------|
| Broken fixture reference — test case references nonexistent file | high |
| skill_path references a SKILL.md that doesn't exist | high |
| Test case has no behavioral assertion (llm-rubric) — only structural checks | medium |
| Fixture appropriateness comment is wrong — fixture doesn't match scenario | medium |
| Skill behavior changed but no test case updated | medium |
| llm-rubric criteria too vague to distinguish pass/fail | medium |
| promptfooconfig references deleted dataset | medium |
| Test description doesn't identify which skill is tested | low |
| fixtures-fs structure has unnecessary extra files | low |
