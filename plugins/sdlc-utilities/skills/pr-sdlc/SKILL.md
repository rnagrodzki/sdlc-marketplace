---
name: pr-sdlc
description: "Use this skill when creating or updating a pull request, updating a PR description, or generating PR content from commits and diffs. Handles the full PR workflow: consumes pre-computed context from pr-prepare.js, generates description with plan-critique-improve-do-critique-improve, user review, and gh CLI execution. Auto-labels PRs based on context signals (branch, commits, diff, Jira) with mandatory approval. Arguments: [--draft] [--update] [--base <branch>] [--auto] [--label <name>]. Use --auto to skip interactive approval. Triggers on: create PR, open pull request, update PR, write PR description, PR summary, describe changes for a pull request."
user-invocable: true
argument-hint: "[--draft] [--update] [--base <branch>] [--auto] [--label <name>]"
---

# Creating Pull Requests

Consume pre-computed git context from `pr-prepare.js` and generate an 8-section
PR description readable by both technical and non-technical stakeholders.

**Announce at start:** "I'm using pr-sdlc (sdlc v{sdlc_version})." — extract the version from the `sdlc:` line in the session-start system-reminder. If no version is in context, omit the parenthetical.

## Step 0 — Plan Mode Check

If the system context contains "Plan mode is active":

1. Announce: "This skill requires write operations (gh pr create/edit). Exit plan mode first, then re-invoke `/pr-sdlc`."
2. Stop. Do not proceed to subsequent steps.

---

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
[Bullet-point list grouped by logical concern (not by file).
Each bullet describes a concept or behavior change — e.g.:
- Webhook handler validates event ID before processing and records it after success
- New migration adds processed_events table with TTL index
- Retry deduplication test coverage added
No file paths in this section.]

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

PR_CONTEXT_FILE=$(node "$SCRIPT" --output-file $ARGUMENTS)
EXIT_CODE=$?
```

Read and parse `PR_CONTEXT_FILE` as `PR_CONTEXT_JSON`. Clean up after PR is created or cancelled:

```bash
rm -f "$PR_CONTEXT_FILE"
```

**On non-zero `EXIT_CODE`:**

- Exit code 1: The JSON still contains an `errors` array. Show each error to the user and stop.
- Exit code 2: Show `Script error — see output above` and stop.

**On script crash (exit 2):** Invoke error-report-sdlc — Glob `**/error-report-sdlc/REFERENCE.md`, follow with skill=pr-sdlc, step=Step 0 — pr-prepare.js execution, error=stderr.

**If `PR_CONTEXT_JSON.errors` is non-empty**, show each error message and stop.

**If `PR_CONTEXT_JSON.warnings` is non-empty**, show the warnings prominently before continuing.
Do not ask for confirmation — the Step 5 approval gate (AskUserQuestion) is the consent point before PR creation.

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
| `existingPr` | `{ number, title, url, state, labels }` or `null` |
| `jiraTicket` | Detected ticket reference or `null` |
| `commits` | `[{ hash, subject, body, coAuthors }]` — all commits on this branch |
| `diffStat` | `{ filesChanged, insertions, deletions, summary }` |
| `diffContent` | Full unified diff text |
| `remoteState` | `{ pushed, remoteBranch, action }` |
| `warnings` | Non-fatal notes already surfaced to the user by the command |
| `changedFiles` | `string[]` — relative file paths changed in this PR |
| `repoLabels` | `[{ name, description }]` — labels defined in the repository; empty if unavailable |
| `customTemplate` | Full content of `.claude/pr-template.md` or `null` if not present |
| `prConfig` | PR title validation config from `.claude/sdlc.json` (null when absent) |
| `isAuto` | Whether `--auto` was passed — skip interactive prompts |
| `forcedLabels` | `string[]` — labels forced via `--label` flag(s), pre-validated against `repoLabels`. Always included in PR regardless of signal matching |

### Step 2 (PLAN): Draft PR Description

> **If `PR_CONTEXT_JSON.customTemplate` is not null**: parse its `## Section` headings
> as the template structure. Use each section's body text as the fill instruction.
> Skip the default per-section instructions below and draft all custom sections instead.

Using data from `PR_CONTEXT_JSON`, draft all sections of the active PR template (custom sections if `customTemplate` is present, or the default 8 sections below).

**OpenSpec enrichment (automatic when detected):**

**Hook context fast-path:** If the session-start system-reminder contains an `OpenSpec active:` line, use its data (change name, branch match status, delta spec count) to skip the `Glob for openspec/config.yaml` and change directory scanning. If the line is absent or the user switched branches since session start, fall back to the existing Glob-based detection. The hook context is a session-start snapshot — treat it as a hint, not as authoritative.

1. Glob for `openspec/config.yaml`. If absent, skip this block entirely.
2. Identify the active change: Glob `openspec/changes/*/proposal.md` (exclude `archive/`). If one matches, use it. If multiple, match against `PR_CONTEXT_JSON.currentBranch`. If ambiguous, skip — do not ask during PR creation.
3. If an active change is found, Read in parallel:
   - `proposal.md` — use intent and scope to pre-fill **Business Context** and **Business Benefits** (reduces need for AskUserQuestion clarification)
   - `design.md` (if exists) — use architectural approach for **Technical Design** section
4. Add to the PR description, below the title: `**OpenSpec:** openspec/changes/<name>/`

When OpenSpec context provides business rationale, use it directly instead of asking the user. Still ask if the proposal is too vague to fill Business Context/Benefits confidently.

For each section, apply the fill rules:

- **Summary**: Plain-language, no jargon, 1-3 sentences
- **JIRA Ticket**: Use `context.jiraTicket` or "Not detected"
- **Business Context / Benefits**: Infer from `context.commits` and `context.diffContent`. If insufficient evidence, **use AskUserQuestion** to ask the user before writing. Don't guess. Acceptable question: *"What business problem does this PR solve? Who benefits and how?"*
- **Technical Design**: Infer from `context.diffContent` — architecture, patterns, key decisions
- **Technical Impact**: Identify affected systems/APIs/services from the diff
- **Changes Overview**: Group by logical concern — each bullet describes a concept or behavior change (e.g. "Added retry deduplication", "New database migration for event tracking"). Never list file paths. Think about what a reviewer needs to understand, not which files were touched.
- **Testing**: Summarize test coverage from diff; if none, say so explicitly

Also draft the PR title: under 72 characters. If `prConfig` is non-null, constrain the title generation:
- **allowedTypes** set → choose from allowed types only for the title prefix (e.g., if `allowedTypes: ["feat", "fix"]`, only use those)
- **allowedScopes** set → choose from allowed scopes only (e.g., if `allowedScopes: ["api", "ui"]`, only use those)
- Config constraints take precedence over conventional commit style inference from commit subjects

If `prConfig` is null or absent, use conventional commit style (`feat:`, `fix:`, `refactor:`, etc.).

#### Common Patterns Reference

Teams can configure their PR title patterns in `.claude/sdlc.json`. Here are four real-world examples to guide configuration:

**Pattern 1: Conventional Commits**
```json
{
  "pr": {
    "titlePattern": "^(feat|fix|refactor|chore|docs|test|ci)(\\([a-z-]+\\))?: .+$",
    "titlePatternError": "Title must follow conventional commits: type(scope): description",
    "allowedTypes": ["feat", "fix", "refactor", "chore", "docs", "test", "ci"],
    "allowedScopes": []
  }
}
```

**Pattern 2: Ticket Prefix**
```json
{
  "pr": {
    "titlePattern": "^[A-Z]{2,10}-\\d+: .+$",
    "titlePatternError": "Title must start with ticket ID (e.g., PROJ-42: description)",
    "allowedTypes": [],
    "allowedScopes": []
  }
}
```

**Pattern 3: Ticket Prefix + Conventional**
```json
{
  "pr": {
    "titlePattern": "^[A-Z]{2,10}-\\d+ (feat|fix|chore): .+$",
    "titlePatternError": "Title format: TICKET-123 type: description",
    "allowedTypes": ["feat", "fix", "chore"],
    "allowedScopes": []
  }
}
```

**Pattern 4: Semantic PR (Squash-Merge Friendly)**
```json
{
  "pr": {
    "titlePattern": "^(feat|fix|breaking): .+$",
    "titlePatternError": "Title must use semantic type: feat|fix|breaking",
    "allowedTypes": ["feat", "fix", "breaking"],
    "allowedScopes": []
  }
}
```

#### Step 2b: Infer Labels

If `PR_CONTEXT_JSON.repoLabels` is empty, skip this step entirely — produce no label suggestions.

Otherwise, analyze the PR context and fuzzy-match against `repoLabels` to produce `suggestedLabels: string[]`.

**Signals to match:**

| Signal | Example match |
| ------ | ------------- |
| Branch prefix (`fix/`, `feat/`, `docs/`, `refactor/`, `chore/`) | `bug`/`bugfix`, `enhancement`/`feature`, `documentation`, `refactoring` |
| Commit subject prefixes (conventional commits) | Same as branch prefix |
| Changed file paths (`changedFiles`) | Only `.md` files → `documentation`; only test files → `tests`; CI config files → `ci`/`infrastructure` |
| Diff size (`diffStat`) | Small diff (<50 lines changed) → `small`/`quick-review` |
| Jira ticket type (if available) | Bug ticket → `bug`; Story → `feature`/`enhancement` |

**Matching rules:**

1. Fuzzy-match each signal against `repoLabels[].name` and `repoLabels[].description` — e.g., repo has `type:bug` and branch is `fix/...` → match
2. Never suggest a label not in `repoLabels` — only exact names from the list are valid
3. Keep suggestions conservative: 1–4 labels typical; deduplicate (multiple signals matching the same label count as one)
4. **Update mode:** note `existingPr.labels` as already applied; only suggest new labels not already present in `existingPr.labels`

**Output:** `suggestedLabels` — a list of label names for use in Steps 5 and 6. If no labels match, produce an empty list.

**Auto mode:** When `PR_CONTEXT_JSON.isAuto` is true, apply `suggestedLabels` directly without presenting them for approval. Labels are still validated against `repoLabels` — no fabricated labels. The applied labels are shown in the Step 5 output for visibility.

**Forced labels:** If `PR_CONTEXT_JSON.forcedLabels` is non-empty, merge all forced labels into `suggestedLabels`. Forced labels are always included regardless of signal matching — they cannot be removed during interactive edit. Deduplicate: if a forced label was also inferred from signals, it appears only once. In the final `suggestedLabels` list, forced labels appear first.

### Step 3 (CRITIQUE): Self-review the Draft

Before presenting to the user, review the draft against every quality gate:

| Gate | Check | Pass Criteria |
| ---- | ----- | ------------- |
| All sections present | If custom template: all `##` sections from `customTemplate` have content. If default: all 8 hardcoded sections exist | Real content, "N/A", or "Not detected" — never empty |
| Specificity | Summary names a concrete change | No vague summaries like "various improvements" |
| Business honesty | Business Context/Benefits are concrete or "N/A" | No "because it was needed" or invented reasons |
| No file paths | Changes Overview uses concepts only | Zero file paths in this section |
| Title length | Title under 72 characters | `len(title) < 72` |
| Title pattern match | Title matches `prConfig.titlePattern` regex (skip when null/absent) | Regex passes or `prConfig` is null |
| No fabrication | All claims traceable to commits, diff, or user input | Nothing invented |
| JIRA accuracy | JIRA value matches evidence or is "Not detected" | No guessed ticket numbers |
| Audience check | Readable by non-technical stakeholders | No unexplained jargon in Summary/Business sections |
| Documentation sync | If diff adds new commands, changes structure, renames concepts, or adds new directories/scripts: check that at least one `docs:` commit exists on this branch OR ask the user to confirm docs are updated | PR does not silently ship structural changes without a corresponding docs update |
| Label validity | Every label in `suggestedLabels` exists in `repoLabels` | Zero fabricated labels |
| Forced label inclusion | Every label in `forcedLabels` appears in the final `suggestedLabels` list | Zero forced labels dropped |

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
  **use AskUserQuestion** to ask a targeted clarifying question and incorporate the answer
- Re-check all quality gates after revisions

Continue until all gates pass (max 2 iterations per gate).

### Step 5 (DO): Present for Review

Show the complete title, labels (if any), and description. **Do not execute any `gh` command
before receiving explicit user approval via AskUserQuestion.**

**Auto mode:** When `PR_CONTEXT_JSON.isAuto` is true, skip the AskUserQuestion prompt entirely. Still display the full title, labels, and description for visibility, then proceed directly to Step 6 (execution). Treat the response as an implicit `yes`. All critique gates (Steps 3–4) still run — only the interactive approval prompt is skipped.

**Create mode** (with `suggestedLabels` non-empty):

```text
PR Title: <title>
Labels: <label1> (forced), <label2>

PR Description:
─────────────────────────────────────────────
<full description>
─────────────────────────────────────────────
```

Labels from `forcedLabels` are marked with `(forced)` suffix to distinguish them from inferred labels.

**Update mode** (with existing labels and new suggestions):

```text
PR Title: <title>
Existing labels (preserved): <existing1>, <existing2>
New labels: <new1>, <new2>

PR Description:
─────────────────────────────────────────────
<full description>
─────────────────────────────────────────────
```

If no labels are suggested, omit the Labels line entirely — do not show "Labels: none".
In update mode, if there are existing labels but no new suggestions, still show the "Existing labels (preserved)" line but omit "New labels".

```text
Use AskUserQuestion to ask (adapt question to mode):

For create mode:
> Create this PR as shown?
Options: **yes** — create the PR | **edit** — tell me what to change | **cancel** — abort

For update mode:
> Update PR #<number> as shown?
Options: **yes** — update the PR | **edit** — tell me what to change | **cancel** — abort
```

If the user chooses `edit`, ask what to change, revise, and present again.
During the edit flow, users can add or remove labels. Any added labels must be validated against `repoLabels` — reject labels not in the list.
Loop until explicit `yes` or `cancel`.

### Step 6: Create or Update PR

**Only execute after explicit `yes` from Step 5.**

**Pre-execution title pattern validation:** Before executing `gh pr create` or `gh pr edit`, if `prConfig` is non-null and `prConfig.titlePattern` is set, validate the title against the pattern:

```bash
node -e "
const title = process.argv[1];
const pattern = process.argv[2];
const error = process.argv[3];
if (!new RegExp(pattern).test(title)) {
  console.error(error || pattern);
  process.exit(1);
}
" "$title" "$titlePattern" "$titlePatternError"
```

On failure:
- Show the error message from `prConfig.titlePatternError` (or the pattern itself as fallback)
- Do NOT create or edit the PR
- Ask the user to edit the title and retry

On success:
- Continue to label creation and `gh pr create` / `gh pr edit`

**Just-in-time label creation:** Before executing `gh pr create` or `gh pr edit`, check each label in `forcedLabels` against `repoLabels`. For any forced label NOT found in `repoLabels`, create it:

```bash
gh label create "<name>" --description "Auto-created by pr-sdlc" --color "c5def5" 2>/dev/null
```

This is idempotent — the command succeeds silently if the label already exists. This ensures forced labels work in any repository where the plugin is installed, not just repos where labels were pre-created.

**Create mode:**

```bash
gh pr create --title "<title>" --body "<body>" [--draft] [--label "<l1>" --label "<l2>"]
```

If no labels were approved, omit the `--label` flags entirely.

**Update mode:**

```bash
gh pr edit --title "<title>" --body "<body>" [--add-label "<l1>,<l2>"]
```

If no new labels were approved, omit the `--add-label` flag entirely. Note: `--add-label` is additive — it never removes existing labels.

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

**On script crash (exit 2):** Invoke error-report-sdlc — Glob `**/error-report-sdlc/REFERENCE.md`, follow with skill=pr-sdlc, step=Step 6 — Create or Update PR, error=gh CLI failure message.

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
- Execute `gh pr create` or `gh pr edit` without explicit user approval (unless `--auto` was passed)
- Skip the plan-critique-improve-do-critique-improve cycle before presenting to the user
- Run git or gh bash commands to gather data — all context comes from `PR_CONTEXT_JSON`

## Error Recovery

> **Flow**: detect → diagnose → auto-recover (retry once if transient) → invoke `error-report-sdlc` for persistent actionable failures.

| Error | Recovery | Invoke error-report-sdlc? |
|-------|----------|---------------------------|
| `pr-prepare.js` exit 1 (`errors[]` present) | Show each error, stop | No — user input error |
| `pr-prepare.js` exit 2 (crash) | Show stderr, stop | Yes |
| `gh pr create` / `gh pr edit` fails with 5xx or unexpected error | Show error; offer manual fallback (copy title + description) | Yes |
| `gh` unavailable | Show install instructions | No — user setup |
| `gh` auth failure | Show `gh auth login` instructions | No — auth, not a bug |

When invoking `error-report-sdlc`, provide:
- **Skill**: pr-sdlc
- **Step**: Step 0 (script crash) or Step 6 (gh CLI failure)
- **Operation**: `pr-prepare.js` execution or `gh pr create` / `gh pr edit`
- **Error**: exit code 2 + stderr, or gh error output
- **Suggested investigation**: Check installed plugin version; verify git remote is configured and branch is pushed

---

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

- **OpenSpec change detection during PR creation should not block.** Unlike plan-sdlc which can ask the user to disambiguate multiple active changes, pr-sdlc should silently skip OpenSpec enrichment if the change cannot be uniquely identified from the branch name. PR creation should never be blocked by spec detection ambiguity.

## Learning Capture

When creating pull requests, capture discoveries by appending to `.claude/learnings/log.md`.
Record entries for: repository PR conventions not covered by this skill, branch naming
patterns, CI requirements that affect PR descriptions, team-specific template preferences,
JIRA project key patterns, or review process quirks encountered while generating PR content.

## What's Next

After creating or updating the PR, common follow-ups include:
- `/review-sdlc` — review the branch
- `/version-sdlc` — tag a release after merge

If OpenSpec enrichment was applied in Step 2 (an active change was detected), also suggest:
- `/opsx:verify` — validate implementation completeness against the spec (after merge)
- `/opsx:archive` — merge delta specs into main specs (after verification passes)

## See Also

- [`/commit-sdlc`](../commit-sdlc/SKILL.md) — commit changes before creating a PR
- [`/review-sdlc`](../review-sdlc/SKILL.md) — review the branch
- [`/setup-sdlc --pr-template`](../setup-sdlc/SKILL.md) — create a custom PR template
- [`/version-sdlc`](../version-sdlc/SKILL.md) — tag a release after merge
