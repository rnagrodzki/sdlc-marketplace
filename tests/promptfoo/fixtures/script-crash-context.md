# Error Context from pr-sdlc

## Error Details
Skill: pr-sdlc
Step: Step 1 — Run skill/pr.js
Operation: Execute skill/pr.js to gather PR context
Error: Exit code 2 — TypeError: Cannot read properties of undefined (reading 'commits')
  at parsePRContext (/Users/dev/.claude/plugins/cache/sdlc-marketplace/sdlc/0.13.0/scripts/skill/pr.js:142:38)
  at main (/Users/dev/.claude/plugins/cache/sdlc-marketplace/sdlc/0.13.0/scripts/skill/pr.js:28:18)
Suggested investigation: Check that git log output is parseable; verify branch has commits

## Environment
Repository: user/my-project
Branch: feature/add-search
gh auth status: authenticated as user (oauth_token)
