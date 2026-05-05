# `/commit-sdlc` — Smart Git Commit

## Overview

Inspects staged changes and recent commit history to generate a commit message that matches the project's established style (conventional commits or otherwise). Stashes unstaged changes automatically before committing and restores them immediately after, keeping the working tree clean without any manual bookkeeping.

---

## Usage

```text
/commit-sdlc [flags]
```

---

## Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--no-stash` | Skip stashing unstaged changes during the commit | Stash enabled |
| `--scope <scope>` | Override the conventional commit scope | Auto-detected from diff |
| `--type <type>` | Override the conventional commit type (`feat`, `fix`, `refactor`, etc.) | Auto-detected from diff |
| `--amend` | Amend the last commit instead of creating a new one | Disabled |
| `--auto` | Skip interactive approval — commit immediately after message generation | Disabled |

---

## Examples

### Basic commit

Stage the changes you want to commit, then run:

```text
/commit-sdlc
```

The skill presents the generated message and a summary for review:

```text
Commit
────────────────────────────────────────────
Message:    feat(auth): add OAuth2 PKCE flow

Staged:     3 files changed, +142, -12
  src/auth/pkce.ts
  src/auth/index.ts

Stash:      2 unstaged files will be stashed and restored
────────────────────────────────────────────

Commit? (yes / edit / cancel)
> yes

✓ Committed: a1b2c3d feat(auth): add OAuth2 PKCE flow
  Files:   3 files changed, +142, -12
  Stash:   restored
```

### Force a commit type

Use `--type` to override the inferred type when the diff is ambiguous or the detected type is wrong:

```text
/commit-sdlc --type fix
```

The generated message will use `fix:` as the prefix regardless of what the diff analysis suggests.

### Amend the last commit

Use `--amend` to rewrite the most recent commit's message (or to fold newly staged changes into it):

```text
/commit-sdlc --amend
```

The skill generates a new message from the amended diff and prompts for confirmation before running `git commit --amend`.

### Skip stashing

Use `--no-stash` when you intentionally want unstaged changes to remain in the working tree during the commit and do not want them touched:

```text
/commit-sdlc --no-stash
```

No stash entry is created or restored. The commit proceeds with only the staged changes, and the working tree is left exactly as-is.

### Auto-commit without approval prompt

```text
/commit-sdlc --auto
```

Generates the commit message, runs the critique/improve cycle internally, and commits without prompting for confirmation. Stash behavior is unchanged — unstaged changes are still stashed and restored.

---

## Prerequisites

- **git** — must be run inside a git repository with a valid working tree.
- **Staged changes** — at least one file must be staged (`git add`) before running. When using `--amend`, staged changes are optional; the skill rewrites the message for the existing HEAD commit.

No external tools or configuration files are required beyond `git`.

### Harness Configuration

| Field | Value |
|---|---|
| `argument-hint` | `[--no-stash] [--scope <scope>] [--type <type>] [--amend] [--auto]` |
| Plan mode | Graceful refusal (Step 0) |

---

## Configuration

Commit message validation is configured in `.claude/sdlc.json` under the `commit` key. All fields are optional; if absent, the skill uses auto-detected style from recent commits and does not enforce pattern or type validation.

### Full Configuration Example

```json
{
  "commit": {
    "subjectPattern": "^(feat|fix|refactor|docs|test)(?:\\([a-z0-9-]+\\))?!?: .+$",
    "subjectPatternError": "Subject must match: type(scope)?: description (conventional commits)",
    "allowedTypes": ["feat", "fix", "refactor", "docs", "test", "chore"],
    "allowedScopes": ["auth", "api", "ui", "db", "cli"],
    "requireBodyFor": ["breaking"],
    "requiredTrailers": ["Co-Authored-By"]
  }
}
```

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `subjectPattern` | string (regex) | Regex pattern the commit subject must match. Enforced as a quality gate during commit. |
| `subjectPatternError` | string | Human-readable error message displayed when `subjectPattern` validation fails. |
| `allowedTypes` | array of strings | Allowed commit types when using conventional commits (e.g., `feat`, `fix`, `refactor`). Applies only to `--type` flag and auto-detection. Absence allows any type. |
| `allowedScopes` | array of strings | Allowed commit scopes (the parenthetical in `feat(scope)`). Applies only to `--scope` flag and auto-detection. Absence allows any scope. |
| `requireBodyFor` | array of strings | Commit types that require a body message (lines after a blank line). Checked as a quality gate. |
| `requiredTrailers` | array of strings | Required trailer keys in the commit message (e.g., `Co-Authored-By`, `Reviewed-By`). Checked as a quality gate. |

### Flag Conflicts with Configuration

When `--type` or `--scope` flags are provided, they override the configuration's `allowedTypes` and `allowedScopes`. The supplied type/scope is not validated against the allow-lists — it is used as-is. This supports rapid iteration when the project policy is intentionally bypassed for a single commit.

### Pattern Examples

#### 1. Conventional Commits (Strict)

Type and scope both required.

```json
{
  "subjectPattern": "^(feat|fix|refactor|docs)\\([a-z0-9-]+\\): .+$",
  "subjectPatternError": "Subject must match: type(scope): description",
  "allowedTypes": ["feat", "fix", "refactor", "docs"],
  "allowedScopes": ["auth", "api", "ui", "db"]
}
```

Matching message:
```
feat(auth): add OAuth2 PKCE flow
```

#### 2. Conventional Commits (Relaxed)

Type required, scope optional.

```json
{
  "subjectPattern": "^(feat|fix|refactor|docs)(?:\\([a-z0-9-]+\\))?: .+$",
  "subjectPatternError": "Subject must match: type[(scope)]: description",
  "allowedTypes": ["feat", "fix", "refactor", "docs"],
  "allowedScopes": ["auth", "api", "ui", "db"]
}
```

Matching messages:
```
feat(auth): add OAuth2 PKCE flow
fix: correct login retry logic
```

#### 3. Ticket Prefix

No type/scope; ticket ID required.

```json
{
  "subjectPattern": "^[A-Z]+-\\d+: .+$",
  "subjectPatternError": "Subject must match: PROJ-123: description"
}
```

Matching message:
```
PROJ-456: Update authentication handler
```

#### 4. Ticket Prefix + Conventional

Ticket ID and conventional type.

```json
{
  "subjectPattern": "^[A-Z]+-\\d+ (feat|fix|refactor)(?:\\([a-z0-9-]+\\))?: .+$",
  "subjectPatternError": "Subject must match: PROJ-123 type[(scope)]: description",
  "allowedTypes": ["feat", "fix", "refactor", "docs"]
}
```

Matching message:
```
PROJ-456 feat(auth): add OAuth2 PKCE flow
```

#### 5. Plain Imperative (No Type System)

No conventional commits; free-form imperative style.

```json
{
  "subjectPattern": "^[A-Z].+$",
  "subjectPatternError": "Subject must start with uppercase letter"
}
```

Matching messages:
```
Update authentication handler
Add OAuth2 PKCE flow
Refactor login logic
```

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| Git commit | A new commit on the current branch, or an amended HEAD commit when `--amend` is passed |
| Git stash (temporary) | Created from unstaged tracked-file changes before the commit and immediately popped after — not a permanent stash entry |

## OpenSpec Integration

When the project uses [OpenSpec](https://github.com/Fission-AI/OpenSpec/) and no explicit `--scope` flag is provided, this skill uses the active OpenSpec change name as a scope candidate (e.g., `feat(add-dark-mode): ...`). The project's existing commit style from recent commits takes precedence.

See [OpenSpec Integration Guide](../openspec-integration.md) for the full workflow.

---

## Link Verification (issue #198)

Before `git commit`, the skill pipes the commit message body through `scripts/lib/links.js` as a hard gate. The validator auto-derives `expectedRepo` from `git remote origin` and `jiraSite` from `~/.sdlc-cache/jira/` — the skill never constructs the validator context. URL classes checked: GitHub issues/PRs (owner/repo identity + existence), Atlassian `*.atlassian.net/browse/<KEY>` (host match), and any other `http(s)://` URL (HEAD reachability, 5s timeout). Hosts in the built-in skip list (`linkedin.com`, `x.com`, `twitter.com`, `medium.com`) are reported as `skipped`, not violations. Set `SDLC_LINKS_OFFLINE=1` to skip generic reachability while keeping context-aware checks (GitHub identity, Atlassian host) — useful in sandboxed CI runs. On non-zero exit, the commit is **not** executed and the violation list is surfaced verbatim. No flag toggles this gate — it is hard.

---

## Related Skills

- [`/pr-sdlc`](pr-sdlc.md) — create a pull request after committing
- [`/version-sdlc`](version-sdlc.md) — tag a release after committing
