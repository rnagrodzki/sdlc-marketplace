# Simulated Project Context: Project with Existing PR Template

## Project Structure

Full-stack web application with existing PR template customizations.

```
.claude/
  pr-template.md          ← existing custom template (5 sections)
.github/
  PULL_REQUEST_TEMPLATE.md ← GitHub template (2 sections: "What Changed", "Testing Steps")
src/
package.json
```

## Existing .claude/pr-template.md

```markdown
## Summary

Describe what this PR does in 2-3 sentences. Focus on user-facing or business impact.

## Technical Design

Explain the approach taken, key architectural decisions, and any trade-offs considered.

## Testing

Describe how the changes were tested: unit tests, integration tests, manual verification.

## Deployment

List any deployment steps, environment variable changes, database migrations, or infrastructure changes required.

## Rollback

Describe how to roll back these changes if issues arise in production.
```

## Recent PR Patterns (via gh pr list)

Recent PRs consistently use the 5-section format above. All PRs include "Deployment" and "Rollback" sections because the project deploys to production frequently.

## JIRA Evidence

Branch names in recent PRs: `feat/PROJ-123-add-payment`, `fix/PROJ-456-auth-bug`.
JIRA project: PROJ.
