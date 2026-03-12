# Promptfoo Behavioral Tests

Regression tests that run SDLC skills through Claude and verify behavioral patterns.

## Requirements

- Claude Code CLI installed (`claude` in PATH) and logged in
- Node.js 18+
- promptfoo installed globally: `npm install -g promptfoo`
- [Task](https://taskfile.dev) installed (optional but recommended): `brew install go-task`

## Run tests

From repo root:

```bash
task test          # LLM behavioral tests (all 6 skills)
task test:exec     # Script execution tests (no LLM, fast)
task test:all      # Both behavioral and exec tests
task test:skill -- pr-sdlc  # Single skill
task test:view     # Open web UI to inspect results
```

Or directly from `tests/promptfoo/`:

```bash
promptfoo eval --env-file .env
promptfoo eval --config promptfooconfig-exec.yaml --env-file .env
promptfoo view --env-file .env
```

## Results

Results are stored locally in `.promptfoo-data/` (gitignored).

- `.promptfoo-data/promptfoo.db` — SQLite database with all eval results
- `.promptfoo-data/logs/` — debug and error logs

Both `eval` and `view` must use `--env-file .env` to pick up this location.

## How it works

### Behavioral tests (`promptfooconfig.yaml`)

Each skill gets a dataset YAML under `datasets/` with 2–3 test cases. The
`providers/claude-cli.js` custom provider shells out to `claude -p` (your Claude
Pro/Max subscription — no API key needed). The `scripts/extract-skill-content.js`
`transformVars` script reads the skill's SKILL.md and injects it into the prompt
along with any sibling reference documents and a simulated project context.

Assertion pattern per test:
1. **Structural** (`regex`, `icontains`, `not-icontains`) — fast, deterministic
2. **Behavioral** (`llm-rubric`) — LLM-graded semantic check

### Script execution tests (`promptfooconfig-exec.yaml`)

Runs the three validator scripts directly against filesystem fixture directories
(no LLM involved). Tests that the scripts the skills call actually work correctly.

Testable scripts (no git dependency):
- `validate-discovery.js` — 16 plugin discovery checks
- `validate-pr-template.js` — 5 PR template validation checks
- `validate-dimensions.js` — dimension file validation

## Structure

```
tests/promptfoo/
  providers/      claude-cli.js, script-runner.js
  prompts/        skill-runner.txt, skill-runner-exec.txt
  scripts/        extract-skill-content.js (transformVars)
  datasets/       one YAML per skill (LLM + exec variants)
  fixtures/       markdown project context files (for LLM tests)
  fixtures-fs/    real directory fixtures (for exec tests)
```
