# Skill Best Practices

## Scope

This guide covers **design quality**: what separates a reliable, maintainable skill from a fragile one. It assumes you have already read [Adding Skills](adding-skills.md), which covers the mechanics of creating a skill (directory structure, SKILL.md format, naming conventions, file limits).

---

## 1. Pipeline Structure (PCIDCI)

PCIDCI stands for **Plan → Critique → Improve → Do → Critique → Improve**. It is the mandatory pipeline structure for every skill that produces output for the user. Every step in a skill should be labeled with its role in this cycle.

Label steps with a role in parentheses: `### Step N (ROLE): Description`. Valid roles: `CONSUME`, `LOAD`, `SCAN`, `PLAN`, `CRITIQUE`, `IMPROVE`, `DO`, `VERIFY`, `REPORT`, `RECOVER`.

The dual critique gate is the key structural guarantee: critique the *plan* (pre-execution quality), then critique the *output* (post-execution quality). Not every skill needs all six stages, but every skill producing user-facing output must have at least one critique-improve loop before presenting it.

**Canonical examples:**
- `pr-sdlc` Steps 2–5: PLAN (draft description) → CRITIQUE (9-row gate table) → IMPROVE (fix issues) → DO (present and confirm).
- `execute-plan-sdlc` Steps 2–4 + 7–8: CRITIQUE wave structure before execution, then VERIFY + CRITIQUE after each wave.

**Critique checkpoint:**

| Check | Pass criteria |
|---|---|
| Every non-trivial step has a `(ROLE)` label | No unlabeled steps in the workflow |
| At least one CRITIQUE step precedes any user-facing output | Draft is never presented without a review pass |
| A CRITIQUE step exists after execution for externally-visible actions | Output quality is verified, not assumed |

---

## 2. Critique-Improve Loops

A critique-improve loop consists of two parts: a **quality gate table** that defines what to check and what "pass" means, and an **IMPROVE step** that fixes every failing gate. Neither part is optional.

Quality gate tables are not decoration. They are the machine-readable contract for what "good" means at that point in the pipeline. Each gate must be specific and verifiable — not a judgment call.

**Bad quality gate:**
```markdown
| Check | The output looks correct |
```

**Good quality gate (from `pr-sdlc`):**
```markdown
| Title length | Title is 72 characters or fewer |
| No fabrication | All claims traceable to commits or diff — nothing invented |
| No file paths | Changes Overview uses concepts only, no file paths |
```

Separate pre-execution gates (plan quality) from post-execution gates (output quality). These answer different questions and should not share a table.

Cap iterations at 2 per gate. If issues remain after two passes, surface to the user rather than looping indefinitely. See `review-receive-sdlc` Steps 5 and 8 for a dual-gate implementation: Step 5 gates the *evaluation* of feedback, Step 8 gates the *drafted response*.

**Critique checkpoint:**

| Check | Pass criteria |
|---|---|
| Every CRITIQUE step has a gate table | No prose-only critiques |
| Each gate row specifies a concrete pass criterion | No subjective checks ("looks good", "seems correct") |
| Max iterations are specified | Infinite loop prevention is explicit |

---

## 3. Spending Context Wisely

Once a skill activates, its full `SKILL.md` loads into the agent's context window alongside conversation history, system context, and other active skills. Every token competes for attention. Skills that pad context with things the agent already knows cause the agent to miss what matters.

Add what the agent *wouldn't* know without your skill: project conventions, non-obvious APIs, edge cases, specific tools to use. Omit general knowledge.

**Verbose (cut this):**
```markdown
## Authenticate with GitHub

GitHub is a code hosting platform. To create a pull request, you need to
authenticate. The `gh` CLI tool can be used for this purpose. First, make sure
the user is authenticated by running the auth check command.
```

**Concise (write this):**
```markdown
## Authenticate with GitHub

Check authentication: `gh auth status`. If it fails, stop and tell the user to run `gh auth login`.
```

Keep `SKILL.md` under 500 lines. When a skill legitimately needs more content, move reference material to separate files and use **conditional loading**: "Read `./api-errors.md` if the API returns a non-200 status code" — not a generic "see references/ for details." The agent must know *when* to load each file, or it won't load them at the right time.

**Critique checkpoint:**

| Check | Pass criteria |
|---|---|
| Each paragraph answers "would the agent get this wrong without it?" | No general knowledge, no filler |
| Reference files are conditionally loaded | "Read X when Y" — not "see references/" |
| SKILL.md is under 500 lines | Progressive disclosure is in place if needed |

---

## 4. Description as Trigger Spec

The `description` field in SKILL.md frontmatter determines when Claude activates your skill. It is a **trigger specification**, not a summary. Vague descriptions cause false negatives (skill misses relevant invocations) and false positives (skill fires for the wrong task).

Structure the description to:
1. Start with `"Use this skill when..."` or `"Use when..."`
2. List specific trigger situations with action verbs
3. End with `"Triggers on: keyword1, keyword2, ..."`

**Example (`jira-sdlc`):**
> Use this skill when creating, editing, searching, transitioning, commenting on, linking, assigning, or adding worklogs to Jira issues. Triggers on: create jira issue, update ticket, search jira, transition issue, log work, bulk operations.

The keyword list is what Claude uses for activation routing. If users commonly invoke the skill with a phrase you haven't listed, add it.

**Critique checkpoint:**

| Check | Pass criteria |
|---|---|
| Starts with "Use this skill when" or "Use when" | Consistent activation format |
| Ends with "Triggers on:" keyword list | Explicit routing keywords present |
| Under 1024 characters | Within system limit |

---

## 5. Calibrating Control

Not every instruction needs the same specificity. Prescribing everything produces rigid skills that fail when context varies. Leaving everything to judgment produces inconsistent output. Match instruction specificity to task fragility.

**Give the agent freedom** when multiple approaches are valid. Explain *why* rather than prescribing *how* — an agent that understands the intent makes better context-dependent decisions.

**Be prescriptive** when operations are fragile, order matters, or consistency is the requirement. Mark exact commands with `> **VERBATIM** — Run this block exactly as written.`

**Provide a default, not a menu.** Pick the right tool and mention alternatives briefly:

**Too many options:**
```markdown
You can use pypdf, pdfplumber, PyMuPDF, or pdf2image for text extraction.
```

**Clear default with escape hatch:**
```markdown
Use pdfplumber for text extraction. For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.
```

The VERBATIM pattern appears in `commit-sdlc`, `pr-sdlc`, `review-sdlc`, and `version-sdlc` for script invocation blocks. The scripts themselves are flexible; the *invocation* is not.

**Critique checkpoint:**

| Check | Pass criteria |
|---|---|
| Fragile operations are marked VERBATIM | No ambiguity on exact commands |
| Flexible areas explain why, not just what | Agent can adapt correctly to context |

---

## 6. User Consent Gates

Never execute an externally-visible action — git push, PR creation, API mutations, file writes to the user's project — without explicit user approval. Show the full plan or output first, then prompt.

**Standard consent menu:**
```
Would you like to proceed?
  yes    — execute as shown above
  edit   — revise and re-present
  cancel — stop here

Select:
```

Rules:
- Show the complete output *before* the consent prompt. The user approves what they see.
- The edit loop is unbounded — no limit on revision cycles.
- No default selection. The user types their choice.

`pr-sdlc` Step 5 shows the full PR title and description, then presents this menu. `commit-sdlc` Step 5 shows the staged files, stash status, and complete commit message before prompting. `version-sdlc` Step 5 shows the full release plan table before any git command runs.

**Critique checkpoint:**

| Check | Pass criteria |
|---|---|
| No externally-visible action precedes explicit "yes" | Consent gate covers every side-effect |
| Full output is shown before the consent prompt | User sees exactly what they are approving |
| Edit loop has no iteration cap | Unbounded revision is possible |

---

## 7. Error Recovery

Every skill that runs a script or external tool must have an `## Error Recovery` section. For the template format, see [Adding Skills](adding-skills.md#error-recovery-required). This section covers the design thinking behind it.

**Standard flow:** `DETECT → DIAGNOSE → RECOVER → ESCALATE`

**Error classification:**

| Type | Example | Action |
|---|---|---|
| User error | Wrong file path, auth not configured | Tell the user clearly. Do not report. |
| Transient | Network timeout, rate limit | Retry once. Escalate if it fails again. |
| Stale data | API rejects cached metadata | Rebuild cache, retry once. |
| System failure | Script crash (exit 2), 5xx after retry | Invoke `error-report-sdlc`. |

Invoke `error-report-sdlc` for persistent, actionable failures — script crashes and external service errors after retry. Do not invoke it for user errors (wrong input, tool not installed, missing auth). `jira-sdlc` demonstrates the stale-data pattern: when an API call fails due to stale cache, the skill rebuilds the cache and retries once before escalating.

**Critique checkpoint:**

| Check | Pass criteria |
|---|---|
| All failure classes are covered (user, transient, system) | No unhandled error paths |
| Each row has a specific recovery action | No "handle appropriately" entries |
| `error-report-sdlc` column is explicit for every row | Classification is not left to inference |

---

## 8. Complexity Routing

Not every invocation warrants the full pipeline. Routing by complexity makes trivial work fast and reserves the full PCIDCI cycle for tasks that need it. The routing decision must be explicit — a table or decision block in the skill — not buried in prose.

**Canonical routing table (`plan-sdlc` Step 0):**

| Scope | Action |
|---|---|
| 1 file, obvious change | Skip. Tell the user: "This doesn't need a plan." |
| 2–3 files, clear scope | Lightweight pipeline — skip exploration and review loop |
| 4+ files or unclear scope | Full PCIDCI pipeline |
| Multiple independent subsystems | Decompose into separate plans first |

Add a routing step near the top of any skill where invocation complexity varies significantly. Without it, the skill applies the same overhead to trivial and complex tasks alike.

**Critique checkpoint:**

| Check | Pass criteria |
|---|---|
| Routing is a visible table or decision block | Not hidden in prose |
| Trivial path skips unnecessary steps | Simple work completes quickly |

---

## 9. Supporting Files and Cross-Skill References

When a skill needs a format spec, prompt template, or reference checklist, place it alongside `SKILL.md` in the skill directory and reference it with a relative path. Do not inline long reference content into `SKILL.md`.

```
skills/plan-sdlc/
  SKILL.md
  plan-format-reference.md      ← format spec for plan documents
  plan-reviewer-prompt.md       ← subagent prompt template for plan review
```

Reference in `SKILL.md`: `See ./plan-format-reference.md for the exact format specification.`

**See Also section:** Every skill ends with a `## See Also` section listing related skills, using relative paths:
```markdown
## See Also

- [`/commit-sdlc`](../commit-sdlc/SKILL.md) — commit changes before creating a PR
- [`/pr-sdlc`](../pr-sdlc/SKILL.md) — create the pull request
```

**Workflow Continuation:** After completing its task, a skill should offer the user logical next steps rather than ending abruptly:
```
What would you like to do next?
  commit   — commit the changes (/commit-sdlc)
  pr       — create a pull request (/pr-sdlc)
  done     — stop here

Select:
```

On selection, invoke the next skill via the `Skill` tool. The user should never need to remember the name of the next step in a workflow.

**Critique checkpoint:**

| Check | Pass criteria |
|---|---|
| Long reference content is in separate files, not inlined | SKILL.md stays focused |
| See Also links use relative paths to SKILL.md files | Links work from the skill directory |
| Workflow Continuation offers logical next steps | User is not stranded after completion |

---

## 10. Gotchas, DO NOT, and Learning Capture

**Gotchas** are the highest-value content in many skills. They capture concrete failure modes the agent will hit without being told — not general advice, but specific corrections to specific mistakes.

Each gotcha entry: name the failure (bold), describe the symptom, explain the root cause, state the mitigation.

**Bad gotcha:**
```markdown
Be careful with large files.
```

**Good gotcha (from `pr-sdlc`):**
```markdown
**Large diff output.** `pr-prepare.js` embeds the full diff inline in its JSON output.
For repos with many changed files, this easily exceeds 100KB — too large to pipe through
a shell command without truncation. The failure manifests as "Unterminated string in JSON
at position N". Write script output to a temp file with `mktemp`, never pipe directly.
```

When the agent makes a mistake during real execution, add the correction to the gotchas section. This is the most direct way to improve a skill iteratively.

**DO NOT sections** list explicit prohibitions. Write them as imperatives, not suggestions:

```markdown
## DO NOT

- Skip the critique step, even when the task seems simple
- Present output to the user before the CRITIQUE step runs
- Invoke `error-report-sdlc` for user errors (wrong input, missing auth)
```

"Consider avoiding" is not a prohibition. "Do NOT" is.

**Learning Capture:** Every skill should end by appending discoveries to `.claude/learnings/log.md`. Only capture genuinely new information — project conventions not covered by the skill, edge cases encountered, patterns that required adjustment. Not a summary of what the skill did.

```markdown
## Learning Capture

After completing [action], append to `.claude/learnings/log.md`:

- Project-specific conventions not covered by this skill
- Edge cases the skill didn't handle that required manual adjustment

Format:
## YYYY-MM-DD — <skill-name>: <summary>
<what was learned>
```

**Critique checkpoint:**

| Check | Pass criteria |
|---|---|
| Each gotcha includes symptom, cause, and mitigation | Not vague warnings |
| DO NOT items use imperative voice | "Do NOT" — not "consider avoiding" |
| Learning Capture captures specific triggers | Not "log interesting things" |

---

## 11. Refine with Real Execution

The first draft of a skill almost always needs refinement. After writing a skill, run it against real tasks and feed results back into the skill — including successes, not just failures.

Read execution traces, not just final outputs. Common problems visible only in traces:

- Instructions too vague: the agent tries several approaches before finding one that works
- Instructions that don't apply to the current task: the agent follows them anyway
- Too many options with no clear default: the agent picks arbitrarily

Each pass of execute-then-revise noticeably improves quality. Complex domains benefit from several passes. Corrections from execution traces go into the [Gotchas](#10-gotchas-do-not-and-learning-capture) section — that is how the skill accumulates operational knowledge.

**Critique checkpoint:**

| Check | Pass criteria |
|---|---|
| Skill has been run against at least one real task | Not purely theoretical |
| Execution trace reviewed, not just final output | Inefficiencies visible in trace are addressed |
