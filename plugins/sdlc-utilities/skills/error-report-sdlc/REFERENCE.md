# Error-to-Jira Proposal — Procedure Reference

Used by `error-report-sdlc`. Follow every section in order.

---

## Section 1: Error Classification

Only proceed with a Jira proposal for **issue-worthy** errors. Skip silently for all others.

**Issue-worthy** (proceed with proposal):

| Error | Examples |
|---|---|
| Prepare script crash | Exit code 2 from any `*-prepare.js` script |
| CLI tool failure | `gh pr create` / `gh pr edit` fails with non-auth error; `git tag` or `git push` fails |
| Persistent API error | HTTP 400 on the same Jira operation 2+ times in a row |
| Persistent conflict | HTTP 409 that persists after one retry |
| Escalated task failure | Task in `executing-plans-smartly` fails after 2 retries |
| Build failure blocking execution | Build fails and blocks wave progression |

**NOT issue-worthy** (skip proposal, continue normal error handling):

| Error | Reason |
|---|---|
| Exit code 1 from prepare script | User input error — missing config, wrong args |
| HTTP 401 | Auth token expired — user action needed |
| HTTP 403 | Insufficient permission — user action needed |
| HTTP 404 on issue key | User typo — not a bug |
| User cancellation | Intentional — not an error |
| Lint-only failure | Low severity, auto-fixable |
| Missing project key / config | User setup — not a bug |
| `gh auth` not logged in | User setup — not a bug |

---

## Section 2: Pre-flight Verification

Run these checks before offering the proposal. If any required check fails, **skip the proposal silently** and return to the calling skill's normal error handling.

**Check 1 — jira-prepare.js available:**

```bash
JIRA_SCRIPT=$(find ~/.claude/plugins -name "jira-prepare.js" 2>/dev/null | head -1)
[ -z "$JIRA_SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/jira-prepare.js" ] && JIRA_SCRIPT="plugins/sdlc-utilities/scripts/jira-prepare.js"
```

If `JIRA_SCRIPT` is empty after both attempts → skip proposal. The jira-sdlc capability is not installed.

**Check 2 — Project key resolvable:**

Attempt resolution in this order:
1. Git branch pattern: extract `[A-Z]{2,10}` from branch name if it matches `[A-Z]{2,10}-\d+`
2. `.claude/jira-config.json` field `defaultProject`
3. If neither yields a key → skip proposal

Store the resolved key as `JIRA_PROJECT_KEY`.

**Check 3 — Cache status (informational only, do not block):**

```bash
node "$JIRA_SCRIPT" --project "$JIRA_PROJECT_KEY" --check
```

Note the result. If cache is missing or stale, the proposal can still proceed — jira-sdlc will handle initialization on create.

---

## Section 3: Consent Gate 1 — Offer

Present this prompt to the user:

```
This error may be worth tracking as a Jira issue. Create one? (yes / no)
  yes — I'll draft the issue with the full error context for your review
  no  — skip, continue with normal error handling
```

**On `no`:** Return to the calling skill's normal error handling immediately. Do not proceed.

**On `yes`:** Continue to Section 4.

---

## Section 4: Assemble Issue Content

Read `./templates/ToolingError.md` (locate via Glob: `**/error-report-sdlc/templates/ToolingError.md` under `~/.claude/plugins`, then cwd fallback).

Fill all `{placeholder}` markers using the context provided by the calling skill:

| Placeholder | Source |
|---|---|
| `{what failed — one line}` | Summarize the error in one sentence |
| `{skill name}` | The calling skill's name (e.g., `pr-sdlc`) |
| `{step number and name}` | The step where the error occurred |
| `{what the skill was trying to do}` | The operation being attempted |
| `{ISO timestamp}` | Current timestamp in ISO 8601 format |
| `{script crash \| CLI failure \| ...}` | Pick the matching error type |
| `{code}` | Exit code or HTTP status |
| `{full error text}` | Complete error message or output |
| `{repository name from git remote}` | Run `git remote get-url origin` or use `git remote -v` |
| `{current branch}` | Run `git branch --show-current` |
| `{what the user was doing}` | Describe the user's intent |
| `{with arguments if any}` | Arguments the skill was invoked with |
| `{step that failed and why}` | The specific step and failure reason |
| `{what was blocked}` | What could not complete |
| `{skill-specific hints}` | The `Suggested investigation` from the calling skill |

Remove any section where no applicable content exists. Do NOT leave raw `{placeholder}` text in the final description.

Determine priority:
- **High**: Script crash (exit 2), build failure blocking waves
- **Medium**: CLI failure, persistent API error, escalated task failure

Build the title: `[{skill-name}] {one-line error summary}` (max 72 chars).

---

## Section 5: Consent Gate 2 — Review

Present the assembled issue to the user:

```
Proposed Jira Issue:
───────────────────────────────────────────
Title:    {assembled title}
Type:     Bug
Priority: {High | Medium}
Labels:   tooling-error, {skill-name}

Description:
{filled template content}
───────────────────────────────────────────
Create this issue? (yes / edit / cancel)
  yes    — create the issue as shown
  edit   — tell me what to change
  cancel — skip issue creation
```

If the user says `edit`: apply the requested changes, re-present. Loop until `yes` or `cancel`.

**On `cancel`:** Return to the calling skill's normal error handling. Do not create anything.

**On `yes`:** Continue to Section 6.

---

## Section 6: Create the Jira Issue

**6a. Load cache:**

```bash
CACHE_JSON=$(node "$JIRA_SCRIPT" --project "$JIRA_PROJECT_KEY" --load)
```

If `--load` fails (exit non-zero), skip creation silently and report: `Could not load Jira cache — issue not created. Run /jira-sdlc to initialize it.` Then return to normal error handling.

**6b. Resolve issue type:**

Read `cache.issueTypes`. Find the entry whose key or value matches "Bug" (case-insensitive). Use the exact type name string (e.g., `"Bug"`) — not the ID.

If no Bug type found: use the first available issue type and note it in the output.

**6c. Call `mcp__atlassian__createJiraIssue`:**

```
{
  cloudId: cache.cloudId,
  projectKey: JIRA_PROJECT_KEY,
  issueTypeName: "<resolved bug type name>",
  summary: "<assembled title>",
  description: "<filled template content>",
  contentFormat: "markdown",
  priority: { name: "<High|Medium>" },
  labels: ["tooling-error", "<skill-name>"]
}
```

Use the MCP prefix that is active in this session (default: `mcp__atlassian__`; may be `mcp__claude_ai_Atlassian__`).

**6d. On success:** Report the created issue key and URL:

```
Jira issue created: {KEY}-{number} — {url}
```

**6e. On failure:** Report the error without retrying:

```
Could not create Jira issue: {error}
```

Then return to the calling skill's normal error handling.

---

## Section 7: Return to Calling Skill

After Section 6 (whether the issue was created, skipped, or failed), **always return control to the calling skill's error handling**. This procedure is additive — it never replaces the skill's own error output or stop behavior.

---

## DO NOT

- Propose for user input errors, auth/permission failures, or user cancellations
- Create an issue without both consent gates passing (Sections 3 and 5)
- Initialize a new jira-sdlc cache — only use existing cache; skip if absent
- Retry a failed MCP call
- Leave `{placeholder}` text in the issue description
- Block the calling skill's normal error flow
