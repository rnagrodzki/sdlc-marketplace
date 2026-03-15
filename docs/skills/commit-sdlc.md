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

---

## Prerequisites

- **git** — must be run inside a git repository with a valid working tree.
- **Staged changes** — at least one file must be staged (`git add`) before running. When using `--amend`, staged changes are optional; the skill rewrites the message for the existing HEAD commit.

No external tools or configuration files are required beyond `git`.

---

## What It Creates or Modifies

| File / Artifact | Description |
|-----------------|-------------|
| Git commit | A new commit on the current branch, or an amended HEAD commit when `--amend` is passed |
| Git stash (temporary) | Created from unstaged tracked-file changes before the commit and immediately popped after — not a permanent stash entry |

---

## Related Skills

- [`/pr-sdlc`](pr-sdlc.md) — create a pull request from the current branch after committing
- [`/version-sdlc`](version-sdlc.md) — tag a release after the commit is in place
