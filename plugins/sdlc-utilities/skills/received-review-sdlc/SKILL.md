---
name: received-review-sdlc
description: "Use this skill when responding to code review feedback on a pull request or inline reviewer comments. Covers reading, verifying, evaluating, and responding to reviewer comments with a dual self-critique gate — prevents performative agreement and ensures technical rigor. Can be launched manually or automatically after /review-sdlc. Triggers on: process review feedback, respond to review, handle review comments, address PR feedback, fix review findings, received-review."
user-invocable: true
argument-hint: "[PR-URL or PR-number]"
---

# Responding to Code Review Feedback

Process reviewer comments with technical rigor. Each item is verified against the full
codebase context — not just the change diff — before any response is drafted. Internal
self-critique gates ensure quality. No changes are made until the user explicitly approves
the proposed action plan.

**Announce at start:** "I'm using received-review-sdlc (sdlc v{sdlc_version})." — extract the version from the `sdlc:` line in the session-start system-reminder. If no version is in context, omit the parenthetical.

---

## Step 0 — Plan Mode Check

If the system context contains "Plan mode is active":

1. Announce: "This skill requires write operations (file edits, gh api calls). Exit plan mode first, then re-invoke `/received-review-sdlc`."
2. Stop. Do not proceed to subsequent steps.

---

## Step 1 — READ: Gather Review Feedback

### Step 1a — Run received-review-prepare.js (when PR number available)

When a PR number or URL is provided (via arguments or user input), run the prepare script to pre-compute review thread state:

```bash
SCRIPT=$(find ~/.claude/plugins -name "received-review-prepare.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && SCRIPT=$(find . -path "*/scripts/received-review-prepare.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && { echo "WARNING: Could not locate received-review-prepare.js" >&2; }

if [ -n "$SCRIPT" ]; then
  MANIFEST_FILE=$(node "$SCRIPT" --output-file $ARGUMENTS --pr <PR_NUMBER>)
  EXIT_CODE=$?
  echo "MANIFEST_FILE=$MANIFEST_FILE"
  echo "EXIT_CODE=$EXIT_CODE"
fi
```

**On exit code 0:** Read the manifest JSON. Display the incremental summary:

```
Found N outstanding comments (M resolved, K already replied, J stale — skipped).
Processing only the N outstanding comments.
```

Use only threads with `status: "outstanding"` for Steps 2–11. Store the full manifest (including resolved/self-replied/stale threads) for use in Step 12 (PR Reply & Resolve).

**On exit code 1:** No PR found or missing arguments. Fall back to Step 1b.

**On exit code 2:** Script error. Invoke `error-report-sdlc` with:
- **Skill:** received-review-sdlc
- **Step:** Step 1 — READ
- **Operation:** received-review-prepare.js execution
- **Error:** stderr output from the script

### Step 1b — Manual feedback gathering (fallback)

When no PR number is available, the prepare script is not found, or Step 1a fails:

Locate the review feedback from one of:
- Findings already in conversation context (e.g. passed in from `/review-sdlc`)
- User paste
- PR URL — fetch with:
  ```bash
  gh pr view <number> --comments
  gh api repos/{owner}/{repo}/pulls/{number}/reviews
  ```

Parse each comment into a structured list:

```
| # | File | Line | Reviewer | Comment | Type |
```

Type classification: `bug`, `style`, `architecture`, `feature-request`, `question`, `unclear`.

---

## Step 2 — UNDERSTAND: Categorize and Flag

For each item:
- Assign a type from the classification above
- Flag items that are **unclear** (ambiguous intent, missing context, could be interpreted multiple ways)

**CRITICAL:** If ANY item is unclear:
```
STOP — do not implement anything yet.
Ask for clarification on ALL unclear items at once.
WHY: Items may be related. Partial understanding = wrong implementation.
```

Only proceed to Step 3 after all items are understood.

---

## Step 3 — VERIFY: Check Against Full Codebase Context

For each feedback item, gather context beyond the immediate change diff:

1. **Read the referenced code** — understand what the code actually does
2. **Trace callers and dependents** — use LSP references or grep to find who calls the changed code, what imports it, and what would be affected by the suggested change
3. **Check architectural context** — read related modules, interfaces, and tests to understand the design intent behind the current implementation
4. **Evaluate ripple effects** — determine whether the suggested change would break or improve behavior beyond the immediate diff

Determine the verification status:
- **confirmed** — reviewer's claim is correct, and the suggestion works in full context
- **confirmed, but suggestion is incomplete** — the issue is real but the proposed fix has side effects or misses related code that also needs updating
- **incorrect** — reviewer is wrong about what the code does
- **partially correct** — some aspects correct, some not
- **cannot verify** — would need runtime data or external context

For "cannot verify" items: state the limitation explicitly, ask the user for direction.

---

## Step 4 — EVALUATE: Assess Each Item

Using verification results, determine for each item:

- **agree, will fix** — technically correct, should be changed
- **agree, won't fix** — correct but out of scope or lower priority (state reason)
- **disagree** — technically incorrect for this codebase (provide reasoning)
- **needs discussion** — architectural impact, requires owner input

**YAGNI check for feature requests:**
```
grep codebase for actual usage
IF unused: "This isn't called anywhere. Remove it (YAGNI)? Or is there usage I'm missing?"
IF used: Then evaluate the suggestion on merit
```

**Source trust:**
- Trusted partner feedback: implement after understanding, skip performative agreement
- External/automated reviewer: verify technically, apply YAGNI, push back if wrong

---

## Step 5 — CRITIQUE #1: Self-Critique the Evaluation

> **INTERNAL** — Do not display gate results, pass/fail status, or any output from this step to the user. Process silently and proceed to the next step.

Before drafting responses, review the evaluation against these gates:

| Gate | Check | Pass Criteria |
|------|-------|--------------|
| Verification completeness | Every item verified against actual code | No item evaluated without reading relevant source |
| No blind agreement | Disagreements exist where technically warranted | Not everything marked "agree" unless genuinely correct |
| YAGNI applied | Feature suggestions checked for real vs hypothetical need | No "sounds good, will add" for speculative features |
| Unclear items resolved | All unclear items clarified before proceeding | Not implementing partial feedback |
| Technical grounding | Every agree/disagree decision cites code or behavior | No decisions based on "seems right" without evidence |

Note every failing gate.

---

## Step 6 — IMPROVE #1: Revise Evaluation

> **INTERNAL** — Do not display output from this step to the user. Process silently.

Fix each issue found in Step 5:
- Re-read code for items where verification was incomplete
- Strengthen technical reasoning where it was vague
- Reclassify items where the initial assessment was unsupported

Continue until all gates pass (max 2 iterations per gate).

---

## Step 7 — RESPOND (DO): Draft Responses

Draft a response for each item. Response structure per item:

1. Factual acknowledgment of what was said (no performative openers)
2. What will be done OR technical reason for disagreement
3. If implementing: brief description of approach

**Forbidden openers — NEVER use:**
- "You're absolutely right!"
- "Great point!" / "Excellent feedback!"
- "Thanks for catching that!" / Any gratitude expression
- "Let me implement that now" (before verification)

**Instead, start with the substance:**
- Restate the technical issue
- State the decision (fix / won't fix / disagree)
- Provide reasoning

**Pushback format:**
```
Checked [specific code location]. [What it actually does]. [Consequence of the suggested change].
Decision: [keeping as-is / discussing with owner / needs more context].
```

**GitHub thread replies:** Reply in-thread using the comment ID, not as a top-level PR comment:
```bash
gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies \
  -f body="<response text>"
```

---

## Step 8 — CRITIQUE #2: Self-Critique the Responses

> **INTERNAL** — Do not display gate results, pass/fail status, or any output from this step to the user. Process silently and proceed to the next step.

Review drafted responses against these gates:

| Gate | Check | Pass Criteria |
|------|-------|--------------|
| No performative language | Zero forbidden openers or gratuitous praise | Responses start with substance, not social filler |
| Technically grounded | Every response references specific code, behavior, or constraint | No hand-waving ("this should be fine") |
| Pushback is technical | Disagreements cite code, performance data, or design constraints | No "I prefer" or "I think" without backing evidence |
| Thread-level replies | Each response targets its specific comment thread | No top-level dump of all responses |
| Implementation plan clear | For accepted items, response states what will change | Reviewer knows what to expect in next push |
| No blind agreement | Factual errors corrected, not accommodated | Incorrect reviewer claims are challenged |
| Proportional effort | Simple fixes get short responses; complex items get detailed ones | No walls of text for typo fixes |

Note every failing gate.

---

## Step 9 — IMPROVE #2: Revise Responses

> **INTERNAL** — Do not display output from this step to the user. Process silently.

Fix each issue found in Step 8:
- Delete performative openers, replace with substance
- Add specific code references where missing
- Shorten over-explained simple fixes

Continue until all gates pass (max 2 iterations per gate).

---

## Step 10 — PRESENT: Show Findings and Proposed Plan

This is the first user-visible output after the analysis phase. Present the complete analysis
and proposed actions to the user. **No changes have been made yet.**

**1. Analysis summary table:**

```
| # | File | Line | Type | Verdict | Reasoning |
```

Show every item with its type (bug, style, architecture, etc.) and verdict (agree will fix /
agree won't fix / disagree / needs discussion) with a one-line reasoning summary.

**2. Proposed action plan:**

Group items by action:
- **Will fix:** list items with brief description of the change
- **Will push back:** list items with the core technical reason
- **Needs discussion:** list items with what's unresolved

**3. Drafted PR responses:**

Show the full text of each drafted response, labeled by item number.

**4. Consent gate:**

Use AskUserQuestion to ask:
> No changes have been made yet. How to proceed?

Options:
- **implement** — post responses to PR and apply code changes
- **edit** — modify the plan before proceeding
- **skip** — discard, make no changes

If the user chooses **edit**, ask what to change, revise, and present again.
Loop until explicit **implement** or **skip**.

**Do NOT proceed to Step 11 without explicit `implement` from the user via AskUserQuestion.**

---

## Step 11 — IMPLEMENT: Execute Changes

**Only execute after explicit `implement` from Step 10.**

Post responses to PR threads, then implement accepted code changes.

**Implementation order:**
1. Blocking issues (breaks functionality, security)
2. Simple fixes (typos, imports, naming)
3. Complex fixes (refactoring, logic changes)

For each change: make the edit, verify it compiles/passes tests, then move to the next.
Do NOT batch changes across items.

**Items marked "disagree" or "needs discussion":** Do NOT implement — await reviewer or
owner input.

**Gracefully correcting wrong pushback:**
If you pushed back and were wrong:
```
Correct: "You were right — I checked [X] and it does [Y]. Implementing now."
Wrong:   Long apology, defensive explanation, over-explaining
```
State the correction factually and move on.

---

## Step 12 — REPLY & RESOLVE: Post PR Thread Replies

**Mandatory step — always presented after Step 11 completes.**

1. **Summarize** what was done:

```
Review feedback processing complete:
- N comments addressed (code changes implemented)
- M comments pushed back (with technical reasoning)
- K comments intentionally skipped (agree, won't fix)
```

2. **Consent gate** — Use AskUserQuestion:

> Should I reply to all addressed review comments on the PR and resolve the threads?

Options:
- **yes** — post replies and resolve threads
- **skip** — do not post replies (user will handle manually)
- **selective** — let me choose which threads to reply to

3. **If yes or selective:** For each comment in the action plan:

   **For addressed comments (agree, will fix):**
   - Post a reply describing what was changed:
     ```bash
     gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies \
       -f body="Fixed — <brief description of what was changed>"
     ```
   - Resolve the thread via GraphQL mutation:
     ```bash
     gh api graphql -f query='mutation($threadId: ID!) { resolveReviewThread(input: {threadId: $threadId}) { thread { isResolved } } }' -F threadId="<thread_id>"
     ```

   **For pushback comments (disagree):**
   - Post the drafted pushback response (from Step 7):
     ```bash
     gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies \
       -f body="<pushback response>"
     ```
   - Do NOT resolve the thread — leave for reviewer to evaluate

   **For intentionally skipped comments (agree, won't fix):**
   - Post a reply explaining why it was skipped:
     ```bash
     gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies \
       -f body="Acknowledged — not fixing in this PR because: <reason>"
     ```
   - Do NOT resolve — let the reviewer decide

4. **Report results:**

```
Replied to N threads:
- K resolved (fixed)
- M replied with pushback (left open for reviewer)
- J replied with skip reason (left open for reviewer)
```

---

## Best Practices

1. Read ALL feedback before responding to any of it — items may be related
2. Verify every claim — reviewers can be wrong about what code does
3. Group unclear items and ask once, not piecemeal
4. Pushback is professional; blind agreement is not
5. Implementation order matters: blocking first, cosmetic last
6. When the reviewer is wrong, say so clearly with evidence
7. Actions speak — a clean implementation is better than a verbose acknowledgment

---

## DO NOT

- Use performative openers ("Great catch!", "You're right!", "Thanks!")
- Agree with factually incorrect claims to avoid conflict
- Implement unclear feedback — clarify all unclear items first
- Implement feature requests without a YAGNI check
- Reply top-level when the comment is in a review thread
- Skip the self-critique steps even when evaluation seems obvious
- Batch implement without testing each change individually
- Express gratitude — let the code changes speak
- Display output from internal critique steps (Steps 5-6, 8-9) to the user

---

## Error Recovery

> **Flow**: detect → diagnose → auto-recover (retry once if transient) → invoke `error-report-sdlc` for persistent actionable failures.

| Error | Recovery | Invoke error-report-sdlc? |
|-------|----------|---------------------------|
| `gh pr view` or `gh api` fails to fetch PR comments | Check `gh auth status`; show error; ask user to supply feedback directly | No — auth or permissions issue |
| Comment references file/line that no longer exists | Note the discrepancy; verify against current HEAD diff | No — expected with rebased PRs |
| Cannot verify reviewer's claim (no runtime data/external context) | State limitation explicitly; ask user for direction | No — expected limitation |
| `gh api` 5xx or unexpected server error when posting reply | Retry once; if still failing, show the drafted response for manual posting | Yes if second attempt also fails |
| `received-review-prepare.js` exit 2 (script crash) | Show stderr output, invoke error-report-sdlc | Yes |
| GraphQL resolve mutation fails | Retry once; if still failing, list which threads were not resolved | Yes if second attempt fails |
| Thread ID not found during resolve | Skip that thread, warn user | No — expected with race conditions |

When invoking `error-report-sdlc`, provide:
- **Skill**: received-review-sdlc
- **Step**: Step 11 — IMPLEMENT (posting GitHub thread replies, only after user consent in Step 10)
- **Operation**: `gh api` call to post comment reply
- **Error**: HTTP status + error message from above
- **Suggested investigation**: Check `gh auth status`; verify PR number is correct and accessible; confirm repo permissions

---

## Gotchas

- **Contradictory comments across threads:** When reviewer leaves contradictory feedback in
  different threads, flag the contradiction and ask for clarification rather than guessing
  which one they meant.
- **Comments on deleted lines:** May reference code that no longer exists in the current
  revision. Verify against current HEAD, not the diff context shown in the review.
- **Automated review tools:** Findings from `/review-sdlc` or similar automated tools should
  be treated as external reviewer feedback — verify each finding against actual code before
  accepting it.
- **Re-running after partial reply:** If the skill previously posted replies but didn't
  resolve threads (or vice versa), re-running with the prepare script will detect
  self-replied threads and skip them, preventing duplicate replies.
- **GraphQL thread IDs vs REST comment IDs:** The reply endpoint uses REST `databaseId`
  (from `comment.databaseId`), while the resolve mutation uses the GraphQL thread `id`
  (from `thread.id`). The prepare script provides both in its manifest output.

---

## Learning Capture

After processing review feedback, append discoveries to `.claude/learnings/log.md`. Record
entries for: reviewer patterns worth knowing (e.g., they always flag X style), pushback
outcomes (accepted or rejected — to calibrate future responses), unclear feedback patterns
that revealed communication gaps, YAGNI findings that removed unnecessary work, or codebase
facts uncovered during verification.

---

## What's Next

After replying to review threads, common follow-ups include:
- `/commit-sdlc` — commit the fixes

## See Also

- [`/review-sdlc`](../review-sdlc/SKILL.md) — source of findings this skill responds to
- [`/commit-sdlc`](../commit-sdlc/SKILL.md) — commit the fixes after review
- [`/pr-sdlc`](../pr-sdlc/SKILL.md) — the PR being reviewed
