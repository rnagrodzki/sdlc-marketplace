---
name: review-receive-sdlc
description: "Use this skill when responding to code review feedback on a pull request or inline reviewer comments. Covers reading, verifying, evaluating, and responding to reviewer comments with a dual self-critique gate — prevents performative agreement and ensures technical rigor. Can be launched manually or automatically after /review-sdlc. Triggers on: process review feedback, respond to review, handle review comments, address PR feedback, fix review findings, review-receive."
user-invocable: true
---

# Responding to Code Review Feedback

Process reviewer comments with technical rigor. Each item is verified against the
actual codebase before any response is drafted or any change is made. Two self-critique
gates prevent performative agreement and catch weak reasoning before it reaches the reviewer.

---

## Step 1 — READ: Gather Review Feedback

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

## Step 3 — VERIFY: Check Against Codebase

For each feedback item, read the referenced code. Determine:
- **confirmed** — reviewer's claim is factually correct
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

Fix each issue found in Step 8:
- Delete performative openers, replace with substance
- Add specific code references where missing
- Shorten over-explained simple fixes

Continue until all gates pass (max 2 iterations per gate).

---

## Step 10 — IMPLEMENT: Execute Changes

Post responses (with explicit user approval for PR comments) then implement accepted changes.

**Presentation before posting:**
Show all drafted responses to the user:
```
Responses ready. Post to PR #<number>? (post / edit / skip)
  post  — post all responses to their threads
  edit  — show me which ones to change
  skip  — don't post, just implement the code changes
```

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

---

## Error Recovery

> **Flow**: detect → diagnose → auto-recover (retry once if transient) → invoke `error-report-sdlc` for persistent actionable failures.

| Error | Recovery | Invoke error-report-sdlc? |
|-------|----------|---------------------------|
| `gh pr view` or `gh api` fails to fetch PR comments | Check `gh auth status`; show error; ask user to supply feedback directly | No — auth or permissions issue |
| Comment references file/line that no longer exists | Note the discrepancy; verify against current HEAD diff | No — expected with rebased PRs |
| Cannot verify reviewer's claim (no runtime data/external context) | State limitation explicitly; ask user for direction | No — expected limitation |
| `gh api` 5xx or unexpected server error when posting reply | Retry once; if still failing, show the drafted response for manual posting | Yes if second attempt also fails |

When invoking `error-report-sdlc`, provide:
- **Skill**: review-receive-sdlc
- **Step**: Step 7 — RESPOND (posting GitHub thread replies)
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

---

## Learning Capture

After processing review feedback, append discoveries to `.claude/learnings/log.md`. Record
entries for: reviewer patterns worth knowing (e.g., they always flag X style), pushback
outcomes (accepted or rejected — to calibrate future responses), unclear feedback patterns
that revealed communication gaps, YAGNI findings that removed unnecessary work, or codebase
facts uncovered during verification.

---

## See Also

- `review-sdlc` — runs the code review that this skill responds to
- `pr-sdlc` — creates the PR that gets reviewed
