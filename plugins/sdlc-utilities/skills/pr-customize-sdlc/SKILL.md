---
name: pr-customize-sdlc
description: "Use this skill when guiding the user through creating or editing a custom PR template for this project. Scans project signals (GitHub PR template, recent PRs, manifests) to propose a tailored starter, then guides the user through interactive customization. Triggers on: /pr-customize-sdlc, create PR template, edit PR template, customize PR description format."
user-invocable: true
argument-hint: "[template-file-path]"
---

# Customizing PR Template

Project-aware PR template creator: scan existing conventions, propose a tailored template,
guide the user through customization section by section, then write `.claude/pr-template.md`.

**Announce at start:** "I'm using pr-customize-sdlc (sdlc v{sdlc_version})." — extract the version from the `sdlc:` line in the session-start system-reminder. If no version is in context, omit the parenthetical.

---

## Plan Mode Check

If the system context contains "Plan mode is active":

1. Announce: "This skill requires write operations. Exit plan mode first, then re-invoke `/pr-customize-sdlc`."
2. Stop. Do not proceed to subsequent steps.

---

## Arguments

None — this skill takes no arguments.

---

## Workflow

### Step 0 — Pre-flight Checks

**Validate git state:**

```bash
git rev-parse --is-inside-work-tree
```

If not inside a git repository, stop with:

```text
This skill must be run from inside a git repository.
```

**Check for existing template:**

```bash
test -f .claude/pr-template.md && echo "exists" || echo "not-found"
```

If the file exists, inform the user:

```text
A PR template already exists at .claude/pr-template.md.
The skill will help you review and update it.
```

### Step 1 (SCAN) — Gather Project Signals

Run these checks in parallel to collect signals that will inform the template proposal.

**1. GitHub PR template**: Check if `.github/PULL_REQUEST_TEMPLATE.md` exists. If so, read it —
extract every `## Heading` and note the overall structure.

**2. Recent PRs**: Run:

```bash
gh pr list --limit 5 --json number,title,body 2>/dev/null
```

If successful, scan the `body` fields for recurring `##` heading patterns. A heading is
"consistent" if it appears in 3 or more of the 5 PRs.

**3. Existing template**: Check if `.claude/pr-template.md` already exists. If so, read it.
When it exists the skill will propose edits to the current template, not a replacement
from scratch.

**4. Manifest signals**: Read whichever of these exist (use Glob first, then Read):

- `package.json` — note project name, whether it looks like a library (`"main"`, `"exports"`) or application, monorepo indicators (`"workspaces"`)
- `go.mod`, `Cargo.toml`, `pyproject.toml`, `pom.xml` — note project type

Look for JIRA/Jira patterns in these files as well.

**5. JIRA evidence**: Check for `[A-Z]{2,10}-\d+` patterns in:

- The current branch name
- The subject lines of recent commits (`git log --oneline -20 2>/dev/null`)

If no JIRA pattern is found anywhere, note that the "JIRA Ticket" section may not be needed.

---

From the scan, extract:

| Signal | What to capture |
| --- | --- |
| **Convention signals** | Section headings from GitHub template or recent PR bodies |
| **JIRA used?** | Branch name, commit subjects, or manifest references |
| **Project type** | Library, application, service, monorepo |
| **Existing template** | Present or absent; if present, list its current sections |

---

### Step 2 (PLAN) — Draft Template Proposal

Using the scan signals, draft a proposed `.claude/pr-template.md`.

**Starting point:**

- If `.claude/pr-template.md` already exists: start from its sections
- Otherwise: start from the default 8-section template:
  1. Summary
  2. JIRA Ticket
  3. Business Context
  4. Business Benefits
  5. Technical Design
  6. Technical Impact
  7. Changes Overview
  8. Testing

**Adaptation rules (apply in order):**

1. **GitHub template merge**: If `.github/PULL_REQUEST_TEMPLATE.md` has sections not in the
   starting template, propose adding them. Cite the GitHub template as evidence.
2. **Recent PR patterns**: If 3+ of the last 5 PRs consistently include a `##` heading not
   in the starting template, propose adding that section.
3. **Remove JIRA section**: If no JIRA evidence was found anywhere, propose removing the
   "JIRA Ticket" section and include an explanatory note.
4. **Rename/merge**: If the GitHub template or recent PRs use different names for similar
   sections (e.g. "What Changed" vs "Changes Overview"), prefer the project's convention.
5. **Custom sections**: If a section appears in the GitHub template or recent PRs with
   unique project content (e.g. "Deployment Steps", "Migration Notes", "QA Checklist"),
   include it in the proposal.

**Format for every section in the proposed template:**

```markdown
## Section Name
[Fill instruction — what the LLM should write here, 1-3 sentences]
```

Fill instruction requirements:

- Specific enough to guide the LLM (not just "write about X")
- Uses project terminology found during the scan
- Between 20 and 200 characters

---

### Step 3 (CRITIQUE) — Evaluate Proposal

Self-review the drafted template before presenting it to the user:

- **Completeness**: Does every section have a fill instruction of at least 20 characters?
- **No duplicates**: Do any two sections cover the same ground? If so, merge them.
- **Evidence**: Is every added or removed section backed by a concrete scan signal?
  Remove speculative sections with no supporting evidence.
- **Fill quality**: Are the fill instructions actionable? Replace vague ones
  ("write about X") with specific guidance
  (e.g. "Describe the API contract changes and any migration steps for consumers").
- **JIRA consistency**: If "JIRA Ticket" was removed, is there a note explaining why?
  If kept, does the fill instruction read:
  "Auto-detected from branch/commits, e.g. PROJ-123. 'Not detected' if no ticket found."?

---

### Step 4 (IMPROVE) — Refine Proposal

Based on the critique:

- Add missing fill instructions
- Merge duplicate sections into one
- Remove speculative sections that lack evidence
- Replace vague fill instructions with specific, actionable guidance

---

### Step 5 (DO) — Present and Customize

Present the refined template in a readable format. Show each section heading and its fill
instruction.

Use AskUserQuestion to present the template and ask:
> Accept this PR template?

Options:
- **accept** — write this template as-is to .claude/pr-template.md
- **edit** — tell me which sections to add, remove, rename, or modify
- **section N** — change a specific section (tell me the number)

If the user chooses **edit** or **section N**: make the requested changes and present the
updated template again. Loop until the user says **accept**.

---

### Step 6 — Write Template File

After the user accepts:

1. Create the `.claude/` directory if it does not exist:

   ```bash
   mkdir -p .claude
   ```

2. Write the accepted template to `.claude/pr-template.md`.

3. Confirm success:

   ```text
   Written to .claude/pr-template.md

   This template will be used by /pr-sdlc for all future PRs on this project.
   To update it, run /pr-customize-sdlc again.
   ```

---

### Step 7 — Validate

After writing, locate and run the validation script:

```bash
SCRIPT=$(find ~/.claude/plugins -name "validate-pr-template.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/validate-pr-template.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/validate-pr-template.js"
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate validate-pr-template.js. Is the sdlc plugin installed?" >&2; exit 2; }
node "$SCRIPT" --project-root .
EXIT_CODE=$?
```

- Exit code 0 (validation **passes**): show the summary table from the script output.
- Exit code 1 (validation **fails**): show the error and offer to fix it automatically.
- Exit code 2 (script **crash**): show stderr and invoke `error-report-sdlc`.

---

## Quality Gates

Before marking complete, verify:

- Template has at least one `## Section` heading
- Every section has a fill instruction of at least 20 characters
- No duplicate section headings
- File was written successfully to `.claude/pr-template.md`
- Validation script passed

---

## Error Recovery

> **Flow**: detect → diagnose → auto-recover (retry once if transient) → invoke `error-report-sdlc` for persistent actionable failures.

| Error | Recovery | Invoke error-report-sdlc? |
|-------|----------|---------------------------|
| Not a git repo (`git rev-parse` fails) | Show error, stop | No — user setup |
| `validate-pr-template.js` not found | Show error, stop | Yes |
| `validate-pr-template.js` exit 1 (validation fails) | Show findings, offer auto-fix | No — recoverable |
| `validate-pr-template.js` exit 2 (crash) | Show stderr, stop | Yes |
| `gh pr list` fails in Step 1 scan | Skip recent PR signal, continue | No — bonus signal only |

When invoking `error-report-sdlc`, provide:
- **Skill**: pr-customize-sdlc
- **Step**: Step 7 — Validate (script crash) or Step 0 (script not found)
- **Operation**: `validate-pr-template.js` execution
- **Error**: exit code 2 + stderr
- **Suggested investigation**: Check installed plugin version; verify script is present in `~/.claude/plugins`

---

## Gotchas

1. **Existing template detection false negative.**
   *Symptom:* The skill proposes creating a new PR template even though the project already has one, causing conflicts or duplicates.
   *Root cause:* The skill scans for `.github/PULL_REQUEST_TEMPLATE.md` but projects may store templates at `.github/PULL_REQUEST_TEMPLATE/*.md` (multi-template setup). The single-file check misses the directory-based pattern entirely.
   *Mitigation:* Before proposing creation, also check for `.github/PULL_REQUEST_TEMPLATE/` as a directory. If multiple templates exist there, present the list to the user and ask which one to use as a baseline.

2. **JIRA project key extraction fails silently.**
   *Symptom:* The generated template omits the Jira link section or formats it incorrectly (e.g., wrong project key prefix).
   *Root cause:* The `[A-Z]{2,10}-\d+` regex scans recent PR titles/bodies and branch names, but fails when the project uses a non-standard key format, when no PRs mention JIRA, or when the branch naming convention does not include the ticket key.
   *Mitigation:* If JIRA evidence is ambiguous (fewer than 2 matches, or multiple distinct key prefixes found), ask the user for the project key explicitly before generating the template.

3. **validate-pr-template.js path resolution failure.**
   *Symptom:* Validation step errors out and the user sees "ERROR: Could not locate validate-pr-template.js" — but the exit code is 2 (script not found), not 1 (validation failure), so the error recovery table routes it to `error-report-sdlc` instead of a simple retry.
   *Root cause:* The `find ~/.claude/plugins` command finds nothing on a fresh install or when the plugin has not yet been fully cached locally. The fallback path (`plugins/sdlc-utilities/scripts/`) also fails if the skill is invoked from outside the marketplace repo.
   *Mitigation:* If the script is not found, skip validation and warn the user that validation was skipped rather than blocking the entire flow. Log the missing-script event so `error-report-sdlc` can surface it later.

4. **Interactive customization loop accumulates inconsistent state.**
   *Symptom:* After several edit rounds, the template contains contradictory sections (e.g., the user removed "Summary", then asked to "add linked issues above the summary" — the skill re-adds a summary section implicitly).
   *Root cause:* Each edit is applied as a delta to the previous version. Contradictory edits are not detected because the skill only tracks the latest change, not the full edit history.
   *Mitigation:* After each edit, re-present the full rendered template (not just the diff). Before applying an edit that references a previously removed section, confirm with the user whether the section should be restored.

---

## DO NOT

- Do NOT overwrite an existing `.claude/pr-template.md` without first showing the user the current template content and obtaining explicit "yes" consent.
- Do NOT skip the `validate-pr-template.js` step — an invalid template will break `gh pr create` for the entire project.
- Do NOT hard-code JIRA project keys or ticket formats based on assumptions — always derive from actual evidence or ask the user.
- Do NOT present a generic template without first completing the project signal scan (Step 1) — every template must be tailored to the project's conventions.
- Do NOT allow the edit loop to bypass validation — each final save must run the validator before marking the skill complete.

---

## Learning Capture

Log to `.claude/learnings/log.md` when:

- A scan signal reliably mapped to a section the user accepted — note the
  evidence-to-section mapping
- User removed a proposed section — note which section and the likely reason
- User requested a section that was not proposed — note which scan signal was missed
- Validation failed — note which check failed and the root cause

## What's Next

After completing the PR template customization, common follow-ups include:
- `/pr-sdlc` — create a PR with the new template
- `/commit-sdlc` — commit the template file

## See Also

- `pr-sdlc/SKILL.md` — uses the template written by this skill
- `scripts/validate-pr-template.js` — validates the template format
