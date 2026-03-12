---
name: pr-sdlc
description: "Use this skill when creating or updating a pull request, updating a PR description, or generating PR content from commits and diffs. Handles the full PR workflow: consumes pre-computed context from pr-prepare.js, generates description with plan-critique-improve-do-critique-improve, user review, and gh CLI execution. Arguments: [--draft] [--update] [--base <branch>]. Triggers on: create PR, open pull request, update PR, write PR description, PR summary, or when asked to describe changes for a pull request."
user-invocable: true
---

# Creating Pull Requests

Consume pre-computed git context from `pr-prepare.js` and generate an 8-section
PR description readable by both technical and non-technical stakeholders.

## When to Use This Skill

- Creating a new pull request on any branch
- Updating an existing PR title or description
- Writing or rewriting a PR description
- Summarizing branch changes for review
- When the `/pr` command delegates here after running `pr-prepare.js`

## PR Template

> **Custom template**: If `PR_CONTEXT_JSON.customTemplate` is not null, use it as the
> template instead of the default 8-section structure below. Parse every `## Heading`
> line as a section name; the text under each heading is the fill instruction for that
> section. Apply the same fill rules: real content, "N/A", or "Not detected" — never
> fabricate. All sections defined in the custom template must appear in the output.

When no custom template is present, every PR uses this 8-section flat structure. **All sections in the active template are always present.**

```markdown
## Summary
[1-3 sentence plain-language overview accessible to anyone — no jargon]

## JIRA Ticket
[Auto-detected from branch name or commit messages, e.g. PROJ-123.
"Not detected" if no ticket reference found.]

## Business Context
[Why this change is needed from a business/product perspective.
What problem or opportunity prompted it.
"N/A" only for pure internal tooling/infra with no business dimension.]

## Business Benefits
[What value this delivers — user impact, revenue, efficiency,
risk reduction, compliance, etc.
"N/A" only for pure internal tooling/infra with no business dimension.]

## Technical Design
[Architectural approach, key decisions, patterns used.
Non-obvious trade-offs or alternatives considered.]

## Technical Impact
[What systems, services, APIs, or areas are affected.
Breaking changes, migration needs, performance implications.
"N/A" if the change is fully isolated with no external impact.]

## Changes Overview
[High-level description of what changed, grouped by logical concern.
No file paths — focus on concepts and behavior changes.]

## Testing
[How this was verified: manual steps, automated tests, edge cases.
If no tests added, explain why.]
```

**Section fill rules:**

- ALL sections in the active template MUST always be present — never omit one (8 sections for the default; the custom template's sections when a custom template is active)
- Fill with real content when derivable from commits, diff, or user answers
- Use **"N/A"** when a section genuinely doesn't apply (state why briefly)
- Use **"Not detected"** when detection was attempted but yielded nothing
- **Never fabricate** — if unsure, ask a clarifying question before filling
- Ask clarifying questions (especially for Business Context and Business Benefits)
  when git data alone isn't sufficient to fill the section confidently

---

## Workflow

### Step 0: Resolve and Run pr-prepare.js

> **VERBATIM** — Run this bash block exactly as written. Do not modify, rephrase, or simplify the commands.

```bash
SCRIPT=$(find ~/.claude/plugins -name "pr-prepare.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/pr-prepare.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/pr-prepare.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate pr-prepare.js. Is the sdlc plugin installed?" >&2; exit 2; }

PR_CONTEXT_FILE=$(mktemp /tmp/pr-context-XXXXXX.json)
node "$SCRIPT" $ARGUMENTS > "$PR_CONTEXT_FILE"
EXIT_CODE=$?
```

Read and parse `PR_CONTEXT_FILE` as `PR_CONTEXT_JSON`. Clean up after PR is created or cancelled:

```bash
rm -f "$PR_CONTEXT_FILE"
```

**On non-zero `EXIT_CODE`:**

- Exit code 1: The JSON still contains an `errors` array. Show each error to the user and stop.
- Exit code 2: Show `Script error — see output above` and stop.

**If `PR_CONTEXT_JSON.errors` is non-empty**, show each error message and stop.

**If `PR_CONTEXT_JSON.warnings` is non-empty**, show the warnings to the user before continuing.
Ask them to confirm if they want to proceed (particularly for uncommitted changes).

**If `PR_CONTEXT_JSON.ghAuth` is not null**, inform the user before continuing (no confirmation needed):

```text
GitHub account switched: now using "<account>" (was "<previousAccount>")
```

### Step 1: Consume the Context

Read `PR_CONTEXT_JSON` now.

Key fields available (including `customTemplate` added for project-level PR template support):

| Field | Description |
| ----- | ----------- |
| `mode` | `"create"` or `"update"` |
| `baseBranch` | The target base branch |
| `currentBranch` | The branch being PR'd |
| `isDraft` | Whether to create a draft PR |
| `ghAuth` | `{ switched, account, previousAccount }` or `null` — GitHub account switch result |
| `existingPr` | `{ number, title, url, state }` or `null` |
| `jiraTicket` | Detected ticket reference or `null` |
| `commits` | `[{ hash, subject, body, coAuthors }]` — all commits on this branch |
| `diffStat` | `{ filesChanged, insertions, deletions, summary }` |
| `diffContent` | Full unified diff text |
| `remoteState` | `{ pushed, remoteBranch, action }` |
| `warnings` | Non-fatal notes already surfaced to the user by the command |
| `customTemplate` | Full content of `.claude/pr-template.md` or `null` if not present |

### Step 2 (PLAN): Draft PR Description

> **If `PR_CONTEXT_JSON.customTemplate` is not null**: parse its `## Section` headings
> as the template structure. Use each section's body text as the fill instruction.
> Skip the default per-section instructions below and draft all custom sections instead.

Using data from `PR_CONTEXT_JSON`, draft all sections of the active PR template (custom sections if `customTemplate` is present, or the default 8 sections below).

For each section, apply the fill rules:

- **Summary**: Plain-language, no jargon, 1-3 sentences
- **JIRA Ticket**: Use `context.jiraTicket` or "Not detected"
- **Business Context / Benefits**: Infer from `context.commits` and `context.diffContent`. If insufficient evidence, **ask the user** before writing. Don't guess. Acceptable question: *"What business problem does this PR solve? Who benefits and how?"*
- **Technical Design**: Infer from `context.diffContent` — architecture, patterns, key decisions
- **Technical Impact**: Identify affected systems/APIs/services from the diff
- **Changes Overview**: Group by logical concern, no file paths
- **Testing**: Summarize test coverage from diff; if none, say so explicitly

Also draft the PR title: under 72 characters, conventional commit style
(`feat:`, `fix:`, `refactor:`, etc.).

### Step 3 (CRITIQUE): Self-review the Draft

Before presenting to the user, review the draft against every quality gate:

| Gate | Check | Pass Criteria |
| ---- | ----- | ------------- |
| All sections present | If custom template: all `##` sections from `customTemplate` have content. If default: all 8 hardcoded sections exist | Real content, "N/A", or "Not detected" — never empty |
| Specificity | Summary names a concrete change | No vague summaries like "various improvements" |
| Business honesty | Business Context/Benefits are concrete or "N/A" | No "because it was needed" or invented reasons |
| No file paths | Changes Overview uses concepts only | Zero file paths in this section |
| Title length | Title under 72 characters | `len(title) < 72` |
| No fabrication | All claims traceable to commits, diff, or user input | Nothing invented |
| JIRA accuracy | JIRA value matches evidence or is "Not detected" | No guessed ticket numbers |
| Audience check | Readable by non-technical stakeholders | No unexplained jargon in Summary/Business sections |
| Documentation sync | If diff adds new commands, changes structure, renames concepts, or adds new directories/scripts: check that at least one `docs:` commit exists on this branch OR ask the user to confirm docs are updated | PR does not silently ship structural changes without a corresponding docs update |

> **Note**: When a custom template is active, the "No file paths in Changes Overview"
> gate applies only if the custom template includes a section named "Changes Overview".
> All other universal gates (title length, no fabrication, JIRA accuracy, audience
> check, documentation sync) apply regardless of template.

Note every failing gate.

### Step 4 (IMPROVE): Revise Based on Critique

Fix each issue found in Step 3:

- Rewrite vague sections with specifics from the diff
- Replace invented content with "N/A" or "Not detected" plus a note
- If a business section still can't be filled confidently after revision,
  **ask the user** a targeted clarifying question and incorporate the answer
- Re-check all quality gates after revisions

Continue until all gates pass (max 2 iterations per gate).

### Step 5 (DO): Present for Review

Show the complete title and description. **Do not execute any `gh` command
before receiving explicit user approval.**

```text
PR Title: <title>

PR Description:
─────────────────────────────────────────────
<full description>
─────────────────────────────────────────────

<if mode = create>
Create this PR? (yes / edit / cancel)
  yes    — create the PR as shown
  edit   — tell me what to change
  cancel — abort without creating

<if mode = update>
Update PR #<number>? (yes / edit / cancel)
  yes    — update the PR title and description as shown
  edit   — tell me what to change
  cancel — abort without updating
```

If the user chooses `edit`, ask what to change, revise, and present again.
Loop until explicit `yes` or `cancel`.

### Step 6: Create or Update PR

**Only execute after explicit `yes` from Step 5.**

**Create mode:**

```bash
gh pr create --title "<title>" --body "<body>" [--draft]
```

**Update mode:**

```bash
gh pr edit --title "<title>" --body "<body>"
```

After success, display the PR URL:

```text
# Create mode:
Pull request created: <url>

# Update mode:
Pull request updated: <url>
```

**If `gh` is unavailable or fails**, show the error and provide a fallback:

```text
The GitHub CLI (gh) could not complete the operation. You can:
  1. Install gh: https://cli.github.com/
  2. Authenticate: gh auth login
  3. If multiple accounts are configured, switch to the correct one: gh auth switch
  4. Create or update the PR manually — here is your generated description to copy:

Title: <title>

<description>
```

---

## Best Practices

1. **Read ALL commits, not just the latest** — the PR is the sum of all branch work
2. **Diff is ground truth** — when commit messages and diff disagree, trust the diff
3. **Ask rather than guess** — a clarifying question is better than fabricated content
4. **No file paths in Changes Overview** — reviewers think in concepts, not paths
5. **Flag risks** — call out migrations, permission changes, or config changes
6. **Preserve author intent** — if commit messages express design rationale, carry it into the description

## DO NOT

- Omit any section from the active template (default 8 or custom) — always include all defined sections
- Write generic descriptions ("various improvements", "code cleanup")
- Fabricate a JIRA ticket, business reason, or technical claim
- Include file paths in the Changes Overview section (this rule applies only if the active template includes a "Changes Overview" section)
- Execute `gh pr create` or `gh pr edit` without explicit user approval
- Skip the plan-critique-improve-do-critique-improve cycle before presenting to the user
- Run git or gh bash commands to gather data — all context comes from `PR_CONTEXT_JSON`

## Gotchas

- **Large diff output**: `pr-prepare.js` embeds full `diffContent` inline in its JSON. For repos
  with many changed files this easily exceeds 100KB — too large to pipe through a shell command
  without truncation (failure manifests as "Unterminated string in JSON at position N"). The
  `pr.md` command already prescribes writing to a temp file (`mktemp`). If you ever need to
  re-run the script manually, always use `node pr-prepare.js > /tmp/pr-context-$$.json` and
  read from the file rather than piping output to a parser.

- **Installed plugin version skew silently suppresses custom template**: `pr-prepare.js` is
  resolved from the installed plugin, which may be older than the project's local copy. An
  older installed version may lack `customTemplate` support entirely, returning the field as
  absent or `null` even when `.claude/pr-template.md` exists on disk. **Always cross-check**:
  if `PR_CONTEXT_JSON.customTemplate` is null or absent, verify whether `.claude/pr-template.md`
  exists before defaulting to the 8-section template. If the file exists, read it directly and
  use it as the template, then warn the user that the installed plugin may be out of date and
  suggest re-installing (`/plugin install sdlc@sdlc-marketplace`).

- **Multiple GitHub accounts — auto-switch may pick the wrong account for team repos**: The
  skill detects the correct `gh` account using two phases: first it matches the account login
  against the remote repository owner name (fast, works for personal repos), then it tests API
  access per account (fallback, handles org repos). If you're a collaborator on a repo owned by
  a third party (not your org or personal account), the auto-detection may not find a match and
  falls back to the currently active account with a warning. In that case, run
  `gh auth switch --user <login>` manually before invoking the skill. The switch persists for
  subsequent commands.

## Learning Capture

When creating pull requests, capture discoveries by appending to `.claude/learnings/log.md`.
Record entries for: repository PR conventions not covered by this skill, branch naming
patterns, CI requirements that affect PR descriptions, team-specific template preferences,
JIRA project key patterns, or review process quirks encountered while generating PR content.
