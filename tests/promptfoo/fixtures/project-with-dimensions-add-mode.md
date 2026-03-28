# Simulated Project Context: Node.js/Express/TypeScript App (Add Mode)

## Project Structure

Node.js/Express backend API with TypeScript, Jest tests, and GitHub Actions CI/CD.

```
src/
  controllers/    ← 12 Express route controllers
  services/       ← 18 business logic services
  models/         ← 14 database models (Sequelize)
  middleware/     ← 6 middleware files
  utils/          ← 9 utility modules
__tests__/
  unit/           ← 18 unit test files
  integration/    ← 7 integration test files
  e2e/            ← 4 end-to-end test files
.github/
  workflows/
    ci.yml
    deploy.yml
.claude/
  review-dimensions/
    code-quality-review.md
    security-review.md
package.json
tsconfig.json
```

## Key Dependencies (package.json)

```json
{
  "dependencies": {
    "express": "4.18.2",
    "sequelize": "6.35.2",
    "pg": "8.11.3",
    "jsonwebtoken": "9.0.2",
    "bcryptjs": "2.4.3",
    "zod": "3.22.4"
  },
  "devDependencies": {
    "typescript": "5.3.3",
    "jest": "29.7.0",
    "@types/jest": "29.5.11",
    "ts-jest": "29.1.2",
    "supertest": "6.3.4",
    "@types/supertest": "6.0.2"
  }
}
```

## Review Dimensions State

`.claude/review-dimensions/` exists with **2 dimensions** already installed:

- `code-quality-review.md`
- `security-review.md`

## validate-dimensions.js Output

```
Dimension Validation Report

| Dimension            | Status | Errors | Warnings |
|----------------------|--------|--------|----------|
| code-quality-review  | PASS   | 0      | 0        |
| security-review      | PASS   | 0      | 0        |

Overall: PASS
```

## Signals for Additional Dimension Proposals

| Signal | Evidence | Proposed Dimension |
|--------|----------|--------------------|
| Jest + supertest | devDependencies, __tests__/ dir (29 files) | test-coverage |
| GitHub Actions | .github/workflows/ci.yml, .github/workflows/deploy.yml | ci-cd-pipeline-review |

## Context

User ran `/review-init-sdlc --add` to expand existing dimensions. The skill should detect
the 2 already-installed dimensions and propose only the additional dimensions justified by
new signals (test infrastructure and CI/CD workflows). It must not re-propose or overwrite
`code-quality-review` or `security-review`.
