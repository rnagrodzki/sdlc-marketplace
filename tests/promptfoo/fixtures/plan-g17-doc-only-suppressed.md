# G17 Fixture: Suppressed — Doc-only Diff

## Context

A plan modifies only documentation files. All changed paths match `docs/**` or `*.md`. G17 should suppress UPDATE proposals for doc-only diffs and emit empty findings.

## Plan file (excerpt)

```markdown
### Task 1: Update API reference documentation

**Files:**
- Modify: docs/api/endpoints.md
- Modify: docs/api/authentication.md
- Modify: docs/guides/getting-started.md
- Create: docs/api/rate-limiting.md

**Description:** Expand the API reference to document rate limiting behavior and update the authentication guide with OAuth2 token refresh examples. No code changes.
```

## Dimension catalog (`.sdlc/review-dimensions/`)

```yaml
# api-design.md frontmatter
name: api-design
triggers:
  - "src/api/**"
  - "docs/api/**"
severity: medium
```

`docs/api/endpoints.md` and `docs/api/authentication.md` match `docs/api/**` (covered). `docs/guides/getting-started.md` and `docs/api/rate-limiting.md` also match `docs/**`.

## Learnings log (`.sdlc/learnings/log.md`)

No recent `harden-sdlc` entries.

## Expected G17 output

All plan paths match `docs/**` or `*.md` — this is a **doc-only diff**.

- **CREATE suppression:** C6 suppressed for single-file additions; C2 suppressed (fewer than 3 files share an uncovered prefix). No CREATE proposals.
- **UPDATE-path suppression:** Doc-only diff rule suppresses all U-criteria for `api-design`.
- **UPDATE-behavior suppression:** Description is documentation-only with "No code changes" — not a contract or behavior change; B-criteria do not fire.

Expected output:
- `findings`: `[]`
- `suppressed_count`: 0 (nothing even reached ranking before being suppressed by the doc-only rule)
- `rendering`: `""` (empty string)

G17 should NOT append `## Suggested Review Dimensions` to the plan.
