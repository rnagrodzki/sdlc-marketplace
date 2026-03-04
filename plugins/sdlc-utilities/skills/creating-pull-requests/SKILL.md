---
name: creating-pull-requests
description: "Use this skill when creating or updating a pull request, updating a PR description, or generating PR content from commits and diffs. Handles the full PR workflow: consumes pre-computed context from pr-prepare.js, generates description with plan-critique-improve-do-critique-improve, user review, and gh CLI execution. Triggers on: create PR, open pull request, update PR, write PR description, PR summary, or when asked to describe changes for a pull request."
user-invokable: false
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

Every PR uses this 8-section flat structure. **All sections are always present.**

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

- ALL 8 sections MUST always be present — never omit one
- Fill with real content when derivable from commits, diff, or user answers
- Use **"N/A"** when a section genuinely doesn't apply (state why briefly)
- Use **"Not detected"** when detection was attempted but yielded nothing
- **Never fabricate** — if unsure, ask a clarifying question before filling
- Ask clarifying questions (especially for Business Context and Business Benefits)
  when git data alone isn't sufficient to fill the section confidently

---

## Workflow

### Step 1: Consume the Pre-computed Context

The `/pr` command has already run `pr-prepare.js`, written the JSON output to a
temp file, read and parsed it, and passed the parsed object to this skill as
`PR_CONTEXT_JSON`. It is an in-memory JavaScript/JSON object — no file path, no
bash commands needed to retrieve it. Read it now.

Key fields available:

| Field | Description |
| ----- | ----------- |
| `mode` | `"create"` or `"update"` |
| `baseBranch` | The target base branch |
| `currentBranch` | The branch being PR'd |
| `isDraft` | Whether to create a draft PR |
| `existingPr` | `{ number, title, url, state }` or `null` |
| `jiraTicket` | Detected ticket reference or `null` |
| `commits` | `[{ hash, subject, body, coAuthors }]` — all commits on this branch |
| `diffStat` | `{ filesChanged, insertions, deletions, summary }` |
| `diffContent` | Full unified diff text |
| `remoteState` | `{ pushed, remoteBranch, action }` |
| `warnings` | Non-fatal notes already surfaced to the user by the command |

### Step 2 (PLAN): Draft PR Description

Using data from `PR_CONTEXT_JSON`, draft all 8 sections of the PR template.

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
| All sections present | All 8 sections exist with content | Real content, "N/A", or "Not detected" — never empty |
| Specificity | Summary names a concrete change | No vague summaries like "various improvements" |
| Business honesty | Business Context/Benefits are concrete or "N/A" | No "because it was needed" or invented reasons |
| No file paths | Changes Overview uses concepts only | Zero file paths in this section |
| Title length | Title under 72 characters | `len(title) < 72` |
| No fabrication | All claims traceable to commits, diff, or user input | Nothing invented |
| JIRA accuracy | JIRA value matches evidence or is "Not detected" | No guessed ticket numbers |
| Audience check | Readable by non-technical stakeholders | No unexplained jargon in Summary/Business sections |
| Documentation sync | If diff adds new commands, changes structure, renames concepts, or adds new directories/scripts: check that at least one `docs:` commit exists on this branch OR ask the user to confirm docs are updated | PR does not silently ship structural changes without a corresponding docs update |

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
  3. Create or update the PR manually — here is your generated description to copy:

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

- Omit any of the 8 sections — always include all of them
- Write generic descriptions ("various improvements", "code cleanup")
- Fabricate a JIRA ticket, business reason, or technical claim
- Include file paths in the Changes Overview section
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

## Learning Capture

When creating pull requests, capture discoveries by appending to `.claude/learnings/log.md`.
Record entries for: repository PR conventions not covered by this skill, branch naming
patterns, CI requirements that affect PR descriptions, team-specific template preferences,
JIRA project key patterns, or review process quirks encountered while generating PR content.
