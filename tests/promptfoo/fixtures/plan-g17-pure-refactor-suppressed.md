# G17 Fixture: Suppressed — Pure Refactor (B-criteria suppression)

## Context

A plan renames internal variables and extracts a helper function — no behavior change. B-criteria must be suppressed because the description explicitly marks this as a pure refactor.

## Plan file (excerpt)

```markdown
### Task 1: Extract validateToken helper (pure refactor)

**Files:**
- Modify: src/auth/session.js
- Modify: src/auth/session.test.js

**Description:** Pure refactor: extract inline token validation logic into a `validateToken()` helper in the same file. Rename-only for variable names (`tok` → `token`, `usr` → `user`). No behavior change. No new dependencies. No public API or CLI surface change. Idempotency and error semantics unchanged.
```

## Dimension catalog (`.sdlc/review-dimensions/`)

```yaml
# auth-security.md frontmatter
name: auth-security
triggers:
  - "src/auth/**"
severity: high
skip-when:
  - "rename-only"
```

`src/auth/session.js` is covered by `auth-security`. The description references authentication code, which would normally fire **B2** (auth/session management + `security`-type dimension exists). However, the description explicitly states "pure refactor", "rename-only", and "no behavior change".

## Learnings log (`.sdlc/learnings/log.md`)

No recent `harden-sdlc` entries.

## Expected G17 output

**B-criteria suppression applies:** The description contains explicit pure-refactor markers ("pure refactor", "rename-only", "no behavior change"). B2 must NOT fire.

- **No UPDATE-path proposals:** `src/auth/session.js` matches `src/auth/**` (covered); no trigger-staleness criteria fire.
- **No UPDATE-behavior proposals:** B2 suppressed by pure-refactor markers. B1/B3/B4 do not apply (no flag/API changes, no invariant flips, no new dependencies).
- **No CREATE proposals:** All paths covered.

Expected output:
- `findings`: `[]`
- `suppressed_count`: 0
- `rendering`: `""` (empty string)

G17 should NOT append `## Suggested Review Dimensions` to the plan.
