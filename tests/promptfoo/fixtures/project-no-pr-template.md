# Simulated Project Context: Project Without PR Template

## Project Structure

Node.js/Express API project without a custom PR template.

```
.github/
  PULL_REQUEST_TEMPLATE.md ← GitHub template (2 sections)
src/
  routes/
  middleware/
  models/
package.json
```

## GitHub PR Template (.github/PULL_REQUEST_TEMPLATE.md)

```markdown
## What Changed

Describe what was changed.

## Testing Steps

How to test this PR.
```

## Status

**No `.claude/pr-template.md`** — the custom template has not been created yet.

## Recent PR Patterns (via gh pr list)

Recent PRs consistently use:
- `## Summary` section
- `## Testing` section
- Some include a `## PROJ-789` JIRA reference section (about 60% of PRs)

Branch names: `feat/PROJ-789-search`, `fix/PROJ-790-auth`, suggesting active JIRA usage.

## Project Signals

- `package.json` dependencies: express 4.18, jsonwebtoken 9.0, jest 29
- No Cargo.toml, go.mod, or other language manifests
- Has `.github/PULL_REQUEST_TEMPLATE.md` with 2 sections
