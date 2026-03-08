# Simulated Project Context: Monorepo with CI/CD and Multiple Workspaces

## Project Structure

TypeScript monorepo using pnpm workspaces with GitHub Actions CI/CD.

```
packages/
  api/            ← Backend Express API package
  web/            ← React frontend package
  shared/         ← Shared utilities and types
apps/
  dashboard/      ← Internal dashboard app
.github/
  workflows/
    ci.yml        ← Build, test, lint on PRs
    release.yml   ← Release automation
.circleci/
  config.yml      ← Additional CI pipeline
pnpm-workspace.yaml
package.json      ← Root workspace config
tsconfig.json     ← Base TypeScript config
```

## Key Dependencies (root package.json)

```json
{
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "devDependencies": {
    "typescript": "5.4.2",
    "eslint": "8.57.0",
    "turbo": "2.1.0",
    "changesets": "2.27.0"
  }
}
```

## Workspace Config (pnpm-workspace.yaml)

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

## Signals for Dimension Proposals

| Signal | Evidence | Proposed Dimension |
|--------|----------|--------------------|
| pnpm-workspace.yaml + packages/ + apps/ | Monorepo workspace config | monorepo-governance-review |
| .github/workflows/ + .circleci/ | CI/CD pipeline files | ci-cd-pipeline-review |
| TypeScript strict mode | tsconfig.json present | code-quality-review (baseline) |
| No auth/ORM/migration files | No auth or DB signals | no security/data-integrity |
