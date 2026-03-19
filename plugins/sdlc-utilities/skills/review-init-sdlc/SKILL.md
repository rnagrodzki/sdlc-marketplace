---
name: review-init-sdlc
description: "Use this skill when initializing or expanding review dimensions for a project. Scans the project's tech stack, dependencies, file patterns, and architecture to propose relevant review dimensions tailored to the specific project. Arguments: [--add] [--no-copilot]. Triggers on: initialize review dimensions, add review dimension, setup code review, create dimension files, expand review config, review-init."
user-invocable: true
---

# Initializing Review Dimensions

Project-aware dimension creator: scan tech stack, propose tailored dimensions with evidence,
let the user select, write files, and validate with the validation script.

> **CRITICAL — Inline output only.** Always produce dimension proposals, evidence citations,
> and trigger patterns directly in your current response. Never write "the simulated output is
> complete above", "see my previous response", or any similar deferral. If no files can be
> written (simulation context), still emit the full proposed dimension YAML/Markdown inline.

Supporting references (dimension format spec, 5 example dimensions) are in
`review-sdlc/REFERENCE.md` and `review-sdlc/EXAMPLES.md`. Locate them using Glob
with `path: ~/.claude` and pattern `**/review-sdlc/REFERENCE.md`. If not found, retry
Glob with the default path (cwd). Use the same approach for EXAMPLES.md.

---

## Arguments

- `--add` — expansion mode: propose only dimensions not already installed
- `--no-copilot` — skip the GitHub Copilot instructions prompt after dimension creation

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

### Step 1 (SCAN) — Analyze Project Tech Stack

Use Glob to discover and then Read in parallel to collect signals. Do NOT read entire
codebases — read only manifests, config files, and directory listings.

**Dependency manifests (read if they exist):**

- `package.json` — Node.js/JS/TS deps, devDeps, scripts
- `requirements.txt`, `pyproject.toml`, `setup.py` — Python
- `go.mod` — Go
- `Cargo.toml` — Rust
- `pom.xml`, `build.gradle` — Java/JVM
- `Gemfile` — Ruby

**Structural signals (Glob only — do not read content):**

Read `./scan-patterns.md` for the complete structural signal glob patterns. Run all relevant patterns in parallel using Glob.

**Config files (read if they exist):**

- `.github/workflows/*.yml` → CI/CD
- `.eslintrc*`, `pylintrc`, `golangci.yml` → linting
- `tsconfig.json` → check `strict` mode (type-safety dimension evidence)
- `lerna.json`, `pnpm-workspace.yaml`, `nx.json` → monorepo evidence
- `*.graphql`, `openapi.yaml`, `openapi.json` → API contract evidence

From the scan, extract:

1. **Primary language(s)** and framework(s) (Express, FastAPI, Gin, Spring, Rails, etc.)
2. **Key dependency categories** — auth, ORM, HTTP, queues, caching
3. **Directory patterns** present in the repo (with file counts where useful)
4. **Infrastructure and tooling** signals

---

### Step 2 — Discover Existing Dimensions

Check `.claude/review-dimensions/` for already-installed dimension files.

In `--add` (expansion) mode:

- Locate the validation script:
  ```bash
  SCRIPT=$(find ~/.claude/plugins -name "validate-dimensions.js" 2>/dev/null | head -1)
  [ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/validate-dimensions.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/validate-dimensions.js"
  ```
- Run: `node "$SCRIPT" --project-root . --json`
- Extract the list of currently installed dimension names from the output
- Note their trigger patterns so new proposals avoid identical globs

Additionally, in `--add` mode, check if there are uncovered file suggestions from a recent review run. Locate and run `review-prepare.js` to get the current branch's uncovered file analysis:

```bash
PREP=$(find ~/.claude/plugins -name "review-prepare.js" 2>/dev/null | head -1)
[ -z "$PREP" ] && [ -f "plugins/sdlc-utilities/scripts/review-prepare.js" ] && PREP="plugins/sdlc-utilities/scripts/review-prepare.js"
[ -n "$PREP" ] && node "$PREP" --project-root . --json 2>/dev/null
```

If this succeeds, parse `plan_critique.uncovered_suggestions` from the output. These are files not covered by any installed dimension — use them as additional evidence in Step 3 (cite: "Recent review found N uncovered files matching this pattern"). If the command fails (no changed files, not in a git repo, etc.), silently skip — it is bonus evidence, not required.

If NOT in expansion mode: skip this step.

---

### Step 3 (PLAN) — Propose Dimension Catalog

Read `./dimension-catalog.md` now to access the full dimension catalog. Select relevant dimensions from Core, Extended, and Project-type sections based on the tech stack signals from Step 1.

**Rules:**

- Only propose a dimension if there is concrete evidence — do NOT propose `api-review`
  for a CLI tool with no routes, or `mobile-app-review` for a pure web project
- Always include `code-quality-review` as the baseline
- In `--add` mode: exclude dimensions already installed
- In `--add` mode: if `review-prepare.js` produced `uncovered_suggestions`, treat each as additional evidence — cite the specific files found
- Distinguish `api-review` (route/controller code quality) from `api-contract-review` (schema file changes); both may be appropriate for projects with explicit schema files
- Distinguish `documentation-review` (docs presence/structure) from `documentation-quality-review` (docs content accuracy and completeness); flag if both are proposed for the same project

For each proposed dimension, prepare:

- **Name**: lowercase-hyphenated (must match D2 constraints)
- **Description**: one sentence, max 256 chars
- **Why relevant**: cite specific evidence (file paths, dependency names, directory file counts)
- **Trigger patterns**: match the project's actual directory names (not generic defaults)
- **Skip-when patterns**: test/vendor/build/dist dirs
- **Body**: tailored checklist referencing the specific frameworks/libraries found

**Customization is mandatory** — do not generate generic dimensions. Reference the project's
actual stack in the body (e.g., "Check SQLAlchemy ORM usage — avoid raw `session.execute()`
with string concatenation", not just "avoid raw SQL").

---

### Step 4 (CRITIQUE) — Evaluate Proposals

Before presenting, self-review the full proposal set:

- **Trigger specificity**: any trigger that matches `**/*` or similarly broad? Tighten it to the actual directories found.
- **Overlap**: do two proposed dimensions share identical trigger file sets? Flag for merging.
- **Evidence quality**: is each proposal backed by concrete scan findings? Remove any without evidence.
- **Instructions tailored**: does each body reference the project's specific framework by name? If not, add project context.
- **Expansion gaps** (in `--add` mode): are there project patterns not covered by existing OR proposed dimensions?
- **Uncovered suggestion coverage** (in `--add` mode): if Step 2 produced `uncovered_suggestions`, do the proposed dimensions now cover all of those file patterns? List any that remain unaddressed and note whether they need a custom dimension.
- **Trigger validity**: do patterns conform to glob syntax (no `***`, balanced brackets)?
- **Dimension distinction**: if both `api-review` and `api-contract-review` are proposed, confirm both are justified (route code + schema files both present). Same for `documentation-review` vs `documentation-quality-review`.

---

### Step 5 (IMPROVE) — Refine Proposals

Based on the critique:

- Tighten broad triggers to match the project's actual directory structure
- Resolve overlaps: merge into one dimension or split triggers so each has exclusive coverage
- Add project-specific framework/library names to each dimension's body
- Remove any dimension without concrete evidence

---

### Step 6 (DO) — Present and Create

**Present proposals** as a numbered list with evidence summaries:

```text
Proposed review dimensions for this project:

1. code-quality-review (medium severity) — always included
   Coverage: **/*.ts, **/*.tsx
   Why: TypeScript project with 47 source files

2. security-review (high severity)
   Coverage: **/middleware/**, **/auth/**, **/*auth*
   Why: Found `jsonwebtoken` and `passport` in package.json; src/auth/ with 8 files

3. api-review (high severity)
   Coverage: **/routes/**, **/controllers/**
   Why: Express.js routes in src/routes/ (12 files), OpenAPI spec at docs/api.yaml

Install which? (numbers comma-separated, or "all"):
```

Wait for user selection.

For each selected dimension:

1. Create `.claude/review-dimensions/` if it does not exist:

   ```bash
   mkdir -p .claude/review-dimensions
   ```

2. Write the full dimension file (frontmatter + tailored body). Use the corresponding
   example from `review-sdlc/EXAMPLES.md` as the starting template, then
   customize with the project-specific evidence.
3. Confirm each file written with its path.

---

### Step 7 — Validate Installation

Run the validation script (use `SCRIPT` resolved in Step 2, or re-resolve if Step 2 was skipped):

```bash
SCRIPT=$(find ~/.claude/plugins -name "validate-dimensions.js" 2>/dev/null | head -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/validate-dimensions.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/validate-dimensions.js"
node "$SCRIPT" --project-root . --markdown
EXIT_CODE=$?
```

- If exit code **1**: Show the validation errors; offer to fix them automatically.
- If exit code **2**: Show `Script error — see output above` and stop.

**Error-to-GitHub issue proposal**:

For exit code 2 (script crash), locate the procedure: Glob for `**/error-report-sdlc/REFERENCE.md`
under `~/.claude/plugins`, then retry with cwd. If found, follow the procedure with:

- **Skill**: review-init-sdlc
- **Step**: Step 7 — Validate Installation
- **Operation**: Running validate-dimensions.js to check installed dimensions
- **Error**: Exit code 2 — script crash (full error on stderr)
- **Suggested investigation**: Check Node.js version; inspect stderr for stack trace; verify validate-dimensions.js is accessible via the plugin path

If not found, skip — the capability is not installed.

Present the markdown output table.

If any file has errors, show the error detail and offer to fix them automatically.

---

### Step 8 (COPILOT) — Propose GitHub Copilot Review Instructions

**Skip this step if:**
- Step 7 validation reported any errors (broken dimensions produce bad instructions)
- `--no-copilot` flag was passed

**Opt-in prompt:**

```text
Would you also like to generate GitHub Copilot review instructions?
These mirror your review dimensions so Copilot's automatic PR code review follows the same standards.
Files will be created in .github/instructions/ (one per dimension, ~1-2 KB each).
(yes/no):
```

If the user answers no, skip to the next section.

---

**Check existing state:**

Use Glob to check `.github/instructions/*.instructions.md`. If any files exist with the same
names as the selected dimensions, list them and confirm overwrite before proceeding.

In `--add` mode: only generate Copilot instructions for the newly added dimensions, not
existing ones.

---

**PLAN sub-step — map dimensions to Copilot instruction files:**

For each validated dimension, compute the proposed `.github/instructions/<name>.instructions.md`
file. Show the plan:

```text
Proposed Copilot instruction files:

1. .github/instructions/security-review.instructions.md
   applyTo: "**/middleware/**,**/auth/**,**/*auth*"
   ~1,420 chars (limit: 4,000) ✓

2. .github/instructions/code-quality-review.instructions.md
   applyTo: "**/*.ts,**/*.tsx"
   ~1,180 chars (limit: 4,000) ✓

Generate all? (yes/no/select numbers):
```

---

**CRITIQUE sub-step — self-review proposals:**

Before generating, check:

- **Overly broad `applyTo`**: any pattern that is `**/*` or `**` alone? Flag for tightening.
- **4,000-char overflow**: estimate char count of the rendered instruction body. Flag any that exceed the limit with the exact count.
- **Duplicate `applyTo` patterns** across files: note that Copilot applies all matching instructions (acceptable, but worth flagging to the user).

---

**IMPROVE sub-step — refine before writing:**

Based on critique:

- Condense instructions that exceed 4,000 chars: remove verbose explanatory prose, keep
  the checklist and severity guide table. If still over limit, truncate the checklist to the
  most important items and add a note `<!-- truncated to fit 4,000-char Copilot limit -->`.
- Tighten any broad `applyTo` patterns to match the project's actual directory structure.

---

**DO sub-step — write files:**

For each selected instruction:

1. Create `.github/instructions/` if it does not exist:
   ```bash
   mkdir -p .github/instructions
   ```

2. Write `.github/instructions/<name>.instructions.md` using this template:

   ```markdown
   ---
   applyTo: "{triggers array joined by comma}"
   ---
   # {name} — Review Instructions

   {description}

   Default severity: {severity}

   ## Checklist

   {body checklist items — convert "- [ ] " prefix to "- " (plain list, no checkboxes)}

   ## Severity Guide

   {severity guide table from body, if present}
   {if skip-when patterns exist:}

   ## Note

   In Claude Code reviews, files matching these patterns are excluded: {skip-when patterns}.
   Copilot path-specific instructions do not support exclusion patterns — use judgment
   when findings apply to these files.
   ```

   **Mapping rules:**

   | Dimension field | Copilot field | Transformation |
   |---|---|---|
   | `triggers` (array) | `applyTo` (string) | Join with `,` — e.g. `"**/auth/**,**/middleware/**"` |
   | `description` | Opening paragraph | Used as-is |
   | `severity` | Header note | "Default severity: {value}" |
   | Body checklist | Checklist section | Strip `- [ ]` → `- ` |
   | `skip-when` | Note section | Advisory text |
   | `max-files`, `requires-full-diff` | — | Omit (not applicable to Copilot) |

3. Confirm each file with its path and character count.

**Final summary:**

```text
Generated Copilot instruction files:
  .github/instructions/security-review.instructions.md      (1,420 chars)
  .github/instructions/code-quality-review.instructions.md  (1,180 chars)

These files are read by GitHub Copilot when reviewing pull requests that touch
the matched file paths. Enable Copilot code review in your repository settings
to activate automatic PR reviews.
```

---

## Quality Gates

Before marking complete, verify:

- Every proposed dimension cites specific project evidence (file paths, dependency names, counts)
- Every created dimension passes all D1-D12 validation checks
- No duplicate dimension names (including against existing dimensions in `--add` mode)
- All trigger patterns reference the project's actual directory structure, not generic defaults

---

## Error Recovery

| Error Type | Example | Invoke error-report-sdlc? | Recovery Action |
|---|---|---|---|
| User error — missing tools | `gh` not authenticated, `node` not on PATH | No | Tell user clearly. Provide the command to fix it. Do not report. |
| User error — wrong flags | `--add` specified but no dimension name given | No | Show correct usage. Ask user to re-invoke with correct args. |
| Transient — MCP timeout | Atlassian MCP call fails due to network | No | Retry once. If fails again, skip MCP-dependent signal (don't block the scan). |
| Stale cache | Dimension metadata out of sync with project state | No | Re-run the scan from scratch (Step 1). Rebuild from current codebase. |
| Script crash — validate-dimensions.js exit 2 | Script throws uncaught exception | Yes | Invoke `error-report-sdlc` with full context. |
| Script error — validate-dimensions.js exit 1 | Invalid dimension file format | No | Show the validation errors. Let user correct the dimension file manually. |
| MCP tool unavailable | Atlassian MCP not configured | No | Warn user that JIRA-dependent signals will be skipped. Continue scan with remaining signals. |

---

## Gotchas

- **Dimension file naming collision.** When `--add` is used to add a new dimension, the skill generates a filename from the dimension name. If a file with that name already exists in `.claude/review-dimensions/`, the skill will silently overwrite it. Always check for existing files before writing a new dimension.
- **Glob pattern count explosion.** Step 1 runs ~35 glob patterns to detect the tech stack. On large monorepos, this can produce thousands of matches and slow the scan significantly. If the Glob tool returns very large result sets (>500 paths), sample the first 20 rather than processing all of them.
- **Copilot step gated on gh auth.** The Step 8 copilot sub-cycle requires `gh auth status` to pass to read the `.github/copilot-instructions.md` path. If `gh` is not authenticated, the copilot step will fail mid-workflow. Check `gh auth status` at the start of the copilot step before attempting any `gh` reads — and skip the step gracefully if unauthenticated, rather than failing.
- **validate-dimensions.js YAML parser limitations.** The script uses a hand-rolled YAML frontmatter parser that handles simple key-value pairs only. Dimension files with multi-line values or nested YAML will fail validation with a misleading "malformed frontmatter" error. The root cause is the parser, not the file. Tell the user to use flat key-value frontmatter only.
- **review-prepare.js not available at init time.** The skill references `review-prepare.js` in --add mode, but this script may not be installed if the plugin cache hasn't been primed yet. If `review-prepare.js` is not found via the standard resolution, skip the dimension matching step and proceed with manual scan only.

---

## DO NOT

- Do NOT create dimension files without first running the tech stack scan (Step 1) — dimensions must be grounded in actual project signals
- Do NOT skip the validate-dimensions.js step — invalid dimensions cause review-sdlc to fail silently on those dimensions
- Do NOT overwrite existing dimension files without explicit user consent — use `--add` only for new dimensions
- Do NOT propose more than 10 dimensions at once — users can't meaningfully evaluate more than that in a single session; offer expansion in follow-up runs with `--add`
- Do NOT invoke `error-report-sdlc` for user errors (missing tools, wrong flags, unauthenticated CLI) — only for script crashes (exit 2)

---

## Learning Capture

Log to `.claude/learnings/log.md` when:

- A tech stack pattern reliably mapped to a dimension that the user accepted — note the evidence-to-dimension mapping for future reuse
- User rejected a proposed dimension — note which dimension and the likely reason (triggers too broad? not relevant to their stack?)
- User requested a dimension that was not proposed — note what evidence was missed in the scan
- A created dimension failed validation — note which check failed and the root cause
- User opted in to Copilot instructions — note how many dimensions were converted and any that needed condensing
- User declined Copilot instructions — note for awareness (they may want to know about `--no-copilot` for future runs)
- A Copilot instruction exceeded the 4,000-char limit — note which dimension and how it was condensed

## Workflow Continuation

After completing the review dimension setup, present the user with available next actions:

```
What would you like to do next?
  review   — run a code review with the new dimensions (/review-sdlc)
  commit   — commit the dimension files (/commit-sdlc)
  done     — stop here

Select:
```

On selection, invoke the chosen skill using the Skill tool. On "done", end without further action.

## See Also

- `review-sdlc/REFERENCE.md` — dimension file format spec and examples
- `review-sdlc/EXAMPLES.md` — 5 copy-paste-ready dimension files to adapt
- [`/review-sdlc`](../review-sdlc/SKILL.md) — uses the dimensions created by this skill
