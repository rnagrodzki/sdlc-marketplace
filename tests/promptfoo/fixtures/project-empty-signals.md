# Simulated Project Context: Minimal Project with No Recognizable Tech Signals

## Project Structure

Bare-minimum project with a single Python source file and a README.

```
README.md
src/
  main.py
```

## Key Dependencies

No `package.json`, no `tsconfig.json`, no `requirements.txt`, no `pyproject.toml`,
no `setup.py`, no `Pipfile`, no `go.mod`, no `Cargo.toml`, no `pom.xml`.

## Review Dimensions State

`.claude/review-dimensions/` directory does **not exist** — no dimensions installed.

## Signals Detected

| Signal | Evidence | Proposed Dimension |
|--------|----------|--------------------|
| Python file | src/main.py | code-quality-review (baseline only) |
| No test directories | no tests/, no __tests__/, no spec/ | no test-coverage |
| No CI/CD | no .github/workflows/, no .circleci/, no .travis.yml | no ci-cd-pipeline-review |
| No API definitions | no openapi.yaml, no swagger.json, no routes/ | no api-review |
| No dependency manifest | no requirements.txt, no package.json | no framework-specific dimensions |

## Context

User ran `/review-init-sdlc` on a very minimal project. Almost no tech stack signals are
present beyond a single Python file. The skill should handle this gracefully — it may propose
only a minimal baseline dimension (code-quality-review) or explain that insufficient signals
exist to propose meaningful tailored dimensions. It must not hallucinate dimensions that
have no supporting evidence.
