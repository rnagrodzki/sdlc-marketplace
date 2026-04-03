# Simulated Project Context: Broken Plugin Structure

## Project Type

Claude Code plugin marketplace repository with intentional discovery issues.

## File Structure

```
.claude-plugin/
  marketplace.json        ← missing $schema field
plugins/
  sdlc-utilities/
    .claude-plugin/
      plugin.json         ← valid
    commands/
      pr.md               ← references "sdlc-nonexistent" skill (does not exist)
      review.md           ← valid
    skills/
      sdlc-broken-skill/
        SKILL.md          ← frontmatter missing "description" field
    hooks/
      hooks.json          ← INVALID JSON (parse error)
    scripts/
      skill/
        pr.js
```

## validate-discovery.js Output

The script reports: **overall: fail, 3 errors, 1 warning**

Failed checks:
- **PD2** (warning): `$schema` field missing from marketplace.json
- **PD9** (error): `sdlc/commands/pr.md` references skill "sdlc-nonexistent" but `skills/sdlc-nonexistent/SKILL.md` does not exist
- **PD11** (error): `sdlc/skills/sdlc-broken-skill/SKILL.md` frontmatter missing "description"
- **PD15** (error): `sdlc/hooks/hooks.json` is invalid JSON

## Remediation Needed

1. Add `"$schema": "https://anthropic.com/claude-code/marketplace.schema.json"` to marketplace.json
2. Fix `pr.md` command to reference an existing skill, or create the missing `sdlc-nonexistent` skill
3. Add `description: ...` to `sdlc-broken-skill/SKILL.md` frontmatter
4. Fix `hooks.json` to be valid JSON (e.g., `{"hooks": {}}`)
