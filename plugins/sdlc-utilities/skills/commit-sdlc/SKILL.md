---
name: commit-sdlc
description: "Use this skill when committing staged changes, creating a git commit, or generating a commit message. Analyzes staged diff and recent commit history to generate a message matching the project's style. Stashes unstaged changes to isolate the commit, commits after user confirmation, and auto-restores the stash. Arguments: [--no-stash] [--scope <scope>] [--type <type>] [--amend] [--auto]. Use --auto to skip interactive approval. Triggers on: commit changes, create commit, write commit message, git commit, smart commit, commit staged, stage and commit."
user-invocable: true
argument-hint: "[--no-stash] [--scope <scope>] [--type <type>] [--amend] [--auto]"
model: haiku
---


# Smart Commit Skill

Consume pre-computed commit context from `commit-prepare.js`, generate a commit message
matching the project's style, optionally stash unstaged changes, commit after user
confirmation, and auto-restore the stash.

**Announce at start:** "I'm using commit-sdlc (sdlc v{sdlc_version})." — extract the version from the `sdlc:` line in the session-start system-reminder. If no version is in context, omit the parenthetical.

## When to Use This Skill

- Committing staged changes with an auto-generated message
- Generating a commit message that matches the project's existing style
- Isolating staged changes from unstaged work before committing
- Amending the most recent commit with updated staged changes

## Workflow

## Step 0 — Plan Mode Check

If the system context contains "Plan mode is active":

1. Announce: "This skill requires write operations (git commit). Exit plan mode first, then re-invoke `/commit-sdlc`."
2. Stop. Do not proceed to subsequent steps.

---

### Step 0: Resolve and Run commit-prepare.js

> **VERBATIM** — Run this bash block exactly as written. Do not modify, rephrase, or simplify the commands.

```bash
SCRIPT=$(find ~/.claude/plugins -name "commit-prepare.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/commit-prepare.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/commit-prepare.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate commit-prepare.js. Is the sdlc plugin installed?" >&2; exit 2; }

COMMIT_CONTEXT_FILE=$(node "$SCRIPT" --output-file $ARGUMENTS)
EXIT_CODE=$?
```

Read and parse `COMMIT_CONTEXT_FILE` as `COMMIT_CONTEXT_JSON`. Clean up after the commit completes or is cancelled:

```bash
rm -f "$COMMIT_CONTEXT_FILE"
```

**On non-zero `EXIT_CODE`:**

- Exit code 1: The JSON still contains an `errors` array. Show each error to the user and stop.
- Exit code 2: Show `Script error — see output above` and stop.

**On script crash (exit 2):** Invoke error-report-sdlc — Glob `**/error-report-sdlc/REFERENCE.md`, follow with skill=commit-sdlc, step=Step 0 — commit-prepare.js execution, error=stderr.

**If `COMMIT_CONTEXT_JSON.errors` is non-empty**, show each error message and stop.

**If `COMMIT_CONTEXT_JSON.warnings` is non-empty**, show the warnings to the user before continuing.

---

### Step 1 (CONSUME): Read the Context

Extract these fields from `COMMIT_CONTEXT_JSON`:

| Field | Description |
| ----- | ----------- |
| `currentBranch` | Active git branch |
| `flags` | `{ noStash, scope, type, amend, auto }` — parsed CLI flags |
| `staged.files` | List of staged file paths |
| `staged.fileCount` | Number of staged files |
| `staged.diff` | Full unified diff of staged changes |
| `staged.diffStat` | Diff stat summary line |
| `unstaged.files` | Modified tracked files not staged |
| `unstaged.hasChanges` | Whether unstaged changes exist |
| `recentCommits` | Last 15 commits (oneline format) for style detection |
| `lastCommitMessage` | Previous commit message (only when `flags.amend` is true) |
| `commitConfig` | Commit message validation config from .claude/sdlc.json (null when absent) |

### Step 2 (PLAN): Generate Commit Message

1. Analyze `staged.diff` to understand what changed. Read the full diff — do not rely on file names alone.
2. Analyze `recentCommits` to detect project commit style:
   - Conventional commits: `type(scope): description`?
   - Plain imperative English?
   - Ticket prefix pattern (e.g. `PROJ-123: ...`)?
   - Capitalization conventions?
**2a. Config override (run before steps 3–6 below):** If `commitConfig` is non-null:
- If `commitConfig.allowedTypes` is set AND `flags.type` is NOT set → choose the type exclusively from `allowedTypes`. Do not infer a type outside this list.
- If `commitConfig.allowedScopes` is set AND `flags.scope` is NOT set → choose the scope exclusively from `allowedScopes` (or omit if none fits). Do not infer a scope outside this list.
- Config constraints take precedence over `recentCommits` inference. If `recentCommits` suggests a type not in `allowedTypes`, use the closest allowed type.
- If `commitConfig.requireBodyFor` is set and the selected type appears in that list → a body is mandatory. Do not omit the body for these commit types.
- If `commitConfig.requiredTrailers` is set → include all listed trailer keys in the commit body, after a blank line, in `Key: Value` format. Use an empty string as the value placeholder if no value is known; do not invent values.

**Common `subjectPattern` examples (for reference when `commitConfig.subjectPattern` is set):**

| Style | Pattern | Example |
| ----- | ------- | ------- |
| Conventional commits | `^(feat\|fix\|refactor\|chore\|docs\|test\|ci)(\([a-z-]+\))?: .+$` | `feat(auth): add OAuth2 PKCE flow` |
| Ticket prefix | `^[A-Z]{2,10}-\d+: .+$` | `PROJ-123: fix login timeout` |
| Ticket + conventional | `^[A-Z]{2,10}-\d+ (feat\|fix\|chore): .+$` | `PROJ-123 feat: add dark mode` |
| Plain imperative | `^[A-Z].{10,70}$` | `Add rate limiting to API endpoints` |

3. If `flags.type` is set, use it as the commit type. If not, infer from the nature of the change (constrained by `commitConfig.allowedTypes` per step 2a above).
4. If `flags.scope` is set, use it as the scope. If not, infer from the changed files or omit (constrained by `commitConfig.allowedScopes` per step 2a above).
4a. **OpenSpec scope hint (optional):** If `flags.scope` is not set, Glob for `openspec/config.yaml`. If found, Glob `openspec/changes/*/proposal.md` (exclude `archive/`). If exactly one active change exists, or one matches the current branch name, use the change directory name as a candidate scope (e.g., change `add-dark-mode` → scope `add-dark-mode`). This is a hint only — the style detected from `recentCommits` in step 2 takes precedence. If recent commits don't use scopes, do not force one.

    **Hook context fast-path:** If the session-start system-reminder contains an `OpenSpec active:` line, use its data (change name, branch match status) to skip the `Glob for openspec/config.yaml` and change directory scanning. If the line is absent or the user switched branches since session start, fall back to the existing Glob-based detection. The hook context is a session-start snapshot — treat it as a hint, not as authoritative.
4b. **OpenSpec change trailer (optional):** If step 4a identified an active OpenSpec change, add an `OpenSpec-Change: <change-directory-name>` trailer to the commit message body. Trailers go after a blank line at the end of the body, in git standard `Key: Value` format. If the commit has no body (trivial change where the subject line is sufficient), skip the trailer — do not add a body solely for the trailer.
5. If `flags.amend` and `lastCommitMessage` is non-null, use it as the starting point — revise based on staged diff.
6. Draft subject line (max 72 chars) and optional body:
   - Subject: imperative mood, concise, no trailing period
   - Body: only when the change is non-trivial and benefits from "why" context; blank line between subject and body

### Step 3 (CRITIQUE): Self-review the Message

Review against every quality gate in the table below. Note every failing gate.

### Step 4 (IMPROVE): Revise Based on Critique

Fix each issue found in Step 3. Max 2 iterations per gate.

### Step 5 (DO): Present and Execute

Show the full commit plan to the user. **Do not execute any git commands before receiving explicit user approval via AskUserQuestion.**

**Auto mode:** When `flags.auto` is true, skip the AskUserQuestion prompt entirely. Still display the full commit plan for visibility, then proceed directly to execution. Treat the response as an implicit `yes`. All critique gates (Steps 3–4) still run — only the interactive approval prompt is skipped.

```
Commit
────────────────────────────────────────────
Message:    feat(auth): add OAuth2 PKCE flow

            Replaces the implicit flow with PKCE to comply with
            the new OAuth 2.1 requirements.

Staged:     3 files changed, +142, -12
  src/auth/pkce.ts
  src/auth/index.ts
  tests/auth/pkce.test.ts

Trailer:    OpenSpec-Change: add-oauth2-pkce  (if applicable)

Stash:      2 unstaged files will be stashed and restored
────────────────────────────────────────────

```

Use AskUserQuestion to ask:
> Commit as shown?

Options:
- **yes** — commit as shown
- **edit** — tell me what to change
- **cancel** — abort

Omit the `Stash:` line if `unstaged.hasChanges` is false or `flags.noStash` is true.
Show `Amend:` instead of `Commit:` heading when `flags.amend` is true.

**On `yes`:**

0. **Subject pattern gate (hard gate):** If `commitConfig` is non-null and `commitConfig.subjectPattern` is set, validate the subject line before proceeding:

   ```bash
   node -e "
     const pattern = new RegExp(process.argv[1]);
     const subject = process.argv[2];
     if (!pattern.test(subject)) { process.exit(1); }
   " "<subjectPattern>" "<subject line>"
   ```

   - If the check **passes** (exit 0): continue to step 1.
   - If the check **fails** (exit 1): show the error message from `commitConfig.subjectPatternError` if set, otherwise show the pattern itself as a fallback. Do **not** proceed with the commit. Ask the user to edit the subject to match the pattern. Do not allow overriding this gate.

1. If `unstaged.hasChanges` is true AND `flags.noStash` is false:
   ```bash
   git stash push --keep-index -m "commit-sdlc: temp stash"
   ```
2. Execute the commit:
   - If `flags.amend` is true: `git commit --amend -m "<message>"`
   - Otherwise: `git commit -m "<message>"`
3. If stash was created in step 1:
   ```bash
   git stash pop
   ```

**On `edit`:** Ask what to change, revise the message, and present again. Loop until explicit `yes` or `cancel`.

**On `cancel`:** Abort without changes.

**Hook failure handling**: If `git commit` fails due to a pre-commit hook, the stash is still in place. Inform the user: "Pre-commit hook failed. Your unstaged changes are stashed (`git stash list` to see). Fix the hook issue, re-stage your changes, and re-run `/commit-sdlc`."

### Step 6 (CRITIQUE): Verify

Run `git log -1 --oneline` to confirm the commit was created. If stash was used, confirm it was popped via `git stash list`.

Show the result:

```
✓ Committed: a1b2c3d feat(auth): add OAuth2 PKCE flow
  Files:   3 files changed, +142, -12
  Stash:   restored (2 unstaged files back in working tree)
```

Omit the `Stash:` line if no stash was used.

---

## Quality Gates

| Gate | Check | Pass Criteria |
| ---- | ----- | ------------- |
| Style match | Message follows project's commit style | Consistent with `recentCommits` patterns |
| Subject length | Subject ≤ 72 characters | `len(subject) <= 72` |
| Accuracy | Message describes the actual staged diff | Every claim traceable to `staged.diff` |
| Type correctness | Commit type matches the change | `feat`=new feature, `fix`=bug fix, `refactor`=restructure, `chore`=maintenance |
| Imperative mood | Subject uses imperative form | "add" not "adds" or "added" |
| No fabrication | Nothing invented beyond the diff | Every claim backed by staged changes |
| Body relevance | Body adds value or is absent | Does not restate the subject; no filler |
| Pattern match | Subject matches `commitConfig.subjectPattern` regex | Regex test passes; skip when `commitConfig` is null or `subjectPattern` is absent |
| Required body | Body present when type in `commitConfig.requireBodyFor` | Body non-empty for the selected type; skip when `commitConfig` is null or `requireBodyFor` is absent |
| Required trailers | All `commitConfig.requiredTrailers` keys present in body | Every listed trailer key appears; skip when `commitConfig` is null or `requiredTrailers` is absent |

## Best Practices

1. Read the full staged diff, not just file names
2. Match the project's commit style from `recentCommits`
3. Prefer conventional commits when the project uses them
4. Keep the subject concise — details go in the body
5. Body explains "why"; subject explains "what"
6. Present the full diff stat so the user can verify scope before confirming

## DO NOT

- Execute any git command without explicit user approval (`yes`) (unless `--auto` was passed)
- Fabricate changes not present in `staged.diff`
- Skip the critique step (Step 3)
- Include file paths in the subject line
- Run `git stash` if `flags.noStash` is true
- Run `git commit --amend` unless `flags.amend` was explicitly passed
- Stash untracked files — only stash modified tracked files (`--keep-index`, no `--include-untracked`)

## Error Recovery

> **Flow**: detect → diagnose → auto-recover (retry once if transient) → invoke `error-report-sdlc` for persistent actionable failures.

| Error | Recovery | Invoke error-report-sdlc? |
| ----- | -------- | ------------------------- |
| `commit-prepare.js` exit 1 | Show `errors[]`, stop | No — user input error |
| `commit-prepare.js` exit 2 (crash) | Show stderr, stop | Yes |
| No staged changes (exit 1) | Inform user, suggest `git add` | No — user action needed |
| `git stash push` fails | Abort commit, show error | Yes if non-trivial failure |
| `git commit` fails (hook) | Show hook output; inform user stash is still in place; suggest recovery | No — hook failure is expected |
| `git commit` fails (other) | Show error | Yes |
| `git stash pop` conflict | Warn user, suggest `git stash show -p` and manual resolution | No — user needs to resolve |

When invoking `error-report-sdlc`, provide:
- **Skill**: commit-sdlc
- **Step**: Step 0 (script crash) or Step 5 (commit execution)
- **Operation**: `commit-prepare.js` execution or `git stash`/`git commit`/`git stash pop`
- **Error**: exit code + stderr or git error output
- **Suggested investigation**: Check git identity; verify no branch protection rules; inspect hook scripts

---

## Gotchas

- **Stash pop conflicts**: If a staged file also has unstaged modifications, `git stash pop` may produce merge conflicts. The skill warns the user and does NOT attempt auto-resolution.
- **Amend on main/master**: A warning is shown when `--amend` is used on a protected branch. The skill does not block — this is the user's decision.
- **Pre-commit hook failure with active stash**: If a hook fails, the stash remains. The skill informs the user and provides recovery instructions — do not silently leave the stash without notifying.
- **Empty body**: A commit body is optional. Only include one when the staged diff is non-trivial and the "why" adds real value.
- **Single commit in repo**: `git log --oneline -15` may return fewer than 15 lines on a new repo. This is fine — the LLM falls back to conventional commits as the default style.

## Learning Capture

After completing a commit, if the project's detected commit style was non-conventional or unusual, append to `.claude/learnings/log.md`:

```
## YYYY-MM-DD — commit-sdlc: <brief summary>
<what was learned about this project's commit style or any edge case encountered>
```

## What's Next

After completing the commit, common follow-ups include:
- `/review-sdlc` — review the changes
- `/version-sdlc` — tag a release
- `/pr-sdlc` — create a pull request

## See Also

- [`/review-sdlc`](../review-sdlc/SKILL.md) — review changes after committing
- [`/pr-sdlc`](../pr-sdlc/SKILL.md) — create a PR after committing
- [`/version-sdlc`](../version-sdlc/SKILL.md) — tag a release after committing
