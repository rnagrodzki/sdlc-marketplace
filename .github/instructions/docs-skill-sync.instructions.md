---
applyTo: "**/skills/**/SKILL.md,docs/skills/*.md,site/src/data/skills-meta.ts,site/src/content.config.ts,README.md"
---
# docs-skill-sync — Review Instructions

Reviews that skill changes are reflected in docs/skills/ markdown, site/src/data/skills-meta.ts, and the README skills table.

Default severity: high

## Checklist

### 1:1 existence checks
- Every skill directory under `plugins/sdlc-utilities/skills/<name>/` has a matching `docs/skills/<name>.md`
- Every user-invocable skill has a row in the `README.md` Skills table
- Every user-invocable skill has an entry in `site/src/data/skills-meta.ts` `skillsMeta` array with matching `slug`

### Content consistency — docs/skills/*.md
- The doc's Overview matches the skill's actual purpose
- The doc's Flags table lists every flag the SKILL.md documents (and no removed flags)
- The doc's Prerequisites list matches the SKILL.md's actual tool/config requirements
- The doc's "What It Creates or Modifies" section reflects the current artifacts
- The doc's Related Skills section references correct skill names and paths
- The doc follows the template structure from `docs/skill-doc-template.md`

### Content consistency — site/src/data/skills-meta.ts
- The `tagline` field accurately summarizes the skill's current behavior
- The `pipeline` array reflects the SKILL.md's current workflow steps in order
- The `connections` array reflects the skill's actual Related Skills
- The `category` field is correct for the skill's current function
- The `userInvocable` field matches the skill's frontmatter `user-invocable` value

### Content consistency — README.md
- The skill description in the README table matches the skill's actual purpose
- The README table link points to the correct `docs/skills/<name>.md` path

### Template and structural changes
- If `docs/skill-doc-template.md` changed, check whether existing skill docs need the new structure
- If `site/src/content.config.ts` changed, verify docs are still being picked up correctly

## Severity Guide

| Finding | Severity |
|---------|----------|
| Skill exists but has no docs/skills/ doc file | critical |
| SKILL.md workflow changed but pipeline array in skills-meta.ts is stale | high |
| Flags added/removed in SKILL.md but doc Flags table not updated | high |
| Tagline in skills-meta.ts describes old behavior | high |
| Broken connection in skills-meta.ts (references non-existent slug) | high |
| Missing README table row for user-invocable skill | medium |
| README description materially inaccurate | medium |
| Related Skills section references wrong skill name | medium |
| Doc Prerequisites list doesn't match actual requirements | medium |
| Minor wording drift between doc and skill | low |
| Template structure deviation in older doc | info |

## Note

In Claude Code reviews, files matching these patterns are excluded: `**/node_modules/**`, `tests/**`, `.claude/skills/**`.
Copilot path-specific instructions do not support exclusion patterns — use judgment
when findings apply to these files.
