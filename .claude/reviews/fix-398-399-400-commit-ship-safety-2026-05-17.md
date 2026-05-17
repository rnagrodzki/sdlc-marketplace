## Code Review — 8 dimension(s), 8 finding(s)

> Automated review by `review-sdlc` v0.20.11 · 2026-05-17

### Summary

| Dimension | Findings | Critical | High | Medium | Low | Info |
|-----------|----------|----------|------|--------|-----|------|
| code-quality | 3 | 0 | 1 | 1 | 1 | 0 |
| docs-skill-sync | 1 | 0 | 0 | 1 | 0 | 0 |
| hook-readiness | 0 | 0 | 0 | 0 | 0 | 0 |
| runtime-contract | 1 | 0 | 0 | 1 | 0 | 0 |
| script-resolution | 1 | 0 | 1 | 0 | 0 | 0 |
| security-review | 1 | 0 | 0 | 1 | 0 | 0 |
| skill-architecture | 1 | 0 | 0 | 0 | 1 | 0 |
| spec-compliance | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **8** | **0** | **2** | **3** | **1** | **0** |

### Verdict: APPROVED WITH NOTES

Two high-severity findings need attention — a missing script-resolution failure guard in the new plan-mode Step 0 block and an error-path manifest cleanup inconsistency in commit.js — with medium and low findings that should be tracked for follow-up.

---

### code-quality — 3 finding(s)

<details>
<summary>0 critical · 1 high · 1 medium · 1 low · 0 info</summary>

#### [HIGH] Error-path writeOutput calls in commit.js still write to os.tmpdir() — SKILL.md comment is misleading
**File:** `plugins/sdlc-utilities/scripts/skill/commit.js:191`
The success path in `commit.js` now writes the manifest to `.sdlc/execution/` via `writeManifestState`, but four error-path branches (lines 191, 203, 218, 270) still call `writeOutput` which writes to `os.tmpdir()`. The SKILL.md bash block comment reads "No EXIT trap: manifest is persistent (.sdlc/execution/commit-<slug>-<ts>.json)" — but this is only true when `EXIT_CODE === 0`. On error paths, `COMMIT_CONTEXT_FILE` points to a tempdir file. The `rm -f "$COMMIT_CONTEXT_FILE"` cleanup instructions are still correct (they work for both paths), but the comment creates a false impression that all manifests are persistent. A future maintainer reading the SKILL.md might believe the trap was removed because no cleanup is needed, and skip adding `rm -f` calls on new error branches.
**Suggestion:** Amend the SKILL.md comment to: "No EXIT trap: success-path manifest is persistent (.sdlc/execution/); error-path manifests still write to os.tmpdir() via writeOutput. Explicit rm -f at each exit path handles both cases."

#### [MEDIUM] Dead `--output-file` argument passed to commit.js which silently ignores it
**File:** `plugins/sdlc-utilities/skills/commit-sdlc/SKILL.md:46`
The SKILL.md bash block passes `--output-file` to `commit.js` (`COMMIT_CONTEXT_FILE=$(node "$SCRIPT" --output-file $ARGUMENTS)`), but `commit.js` `parseArgs` has no handler for `--output-file` — unrecognised flags are silently ignored. The script always prints the manifest path regardless. The `--output-file` argument is a vestige of the `writeOutput` era. Note: ship-sdlc has the same pattern at line 24, so this is consistent across skills, but both have dead args.
**Suggestion:** Remove `--output-file` from both bash blocks since the scripts output the manifest path unconditionally. Alternatively, add explicit `--output-file` parsing to both scripts that is a no-op (for documentation clarity), with a comment explaining the flag is accepted for backward compatibility.

#### [LOW] `resolveDefaultBranch` called twice on the success path — minor redundancy
**File:** `plugins/sdlc-utilities/scripts/skill/commit.js:144`
`resolveDefaultBranch(projectRoot)` is called once inside `detectWipSquash` (refactored inline call) and again in `main()` at the default-branch detection block. Both calls run the same `git symbolic-ref` + fallback logic, producing two git subprocess invocations per commit-prepare run.
**Suggestion:** Compute `defaultBranch` once in `main()` and pass it as an argument into `detectWipSquash` to eliminate the duplicate shell invocation.

</details>

---

### docs-skill-sync — 1 finding(s)

<details>
<summary>0 critical · 0 high · 1 medium · 0 low · 0 info</summary>

#### [MEDIUM] ship-sdlc.md "After plan-mode block" section omits the cleanup step for the temp output file
**File:** `docs/skills/ship-sdlc.md:668`
The new "After plan-mode block" section documents the resume behavior (state file written, implicit-resume picks it up) but does not mention that the SKILL.md also runs `rm -f "$PLAN_MODE_OUTPUT_FILE"` to clean up the intermediate temp output file. Users reading the doc to understand the plan-mode flow see: state file written, resume picks it up — but not that a separate temp file is created and must be cleaned up. This is a doc accuracy gap only; the SKILL.md implementation is correct.
**Suggestion:** Add a sentence: "ship-sdlc also removes the intermediate prepare output file (`$PLAN_MODE_OUTPUT_FILE`) after confirming the state file was written."

</details>

---

### hook-readiness — 0 finding(s)

No findings. The changed SKILL.md sections introduce inline validation patterns (default-branch check, plan-mode-blocked path) that are inherently one-shot and invocation-scoped. They do not match reactive, cross-skill duplication patterns that warrant a hook conversion.

---

### runtime-contract — 1 finding(s)

<details>
<summary>0 critical · 0 high · 1 medium · 0 low · 0 info</summary>

#### [MEDIUM] plan-mode-blocked spawnSync has no timeout — hangs indefinitely if state/ship.js blocks
**File:** `plugins/sdlc-utilities/scripts/skill/ship.js:1030`
The `spawnSync('node', [stateShipPath, 'init', ...], { encoding: 'utf8' })` call has no `timeout` option. If `state/ship.js init` hangs (e.g., disk full during atomic write, lock contention on `.sdlc/execution/`), the parent process blocks indefinitely with no user-visible feedback. The error path correctly surfaces `result.stderr`, but a blocked subprocess never reaches the error path.
**Suggestion:** Add `timeout: 10000` (10 seconds) to the spawnSync options. On timeout, `result.status` will be null and `result.error` will be set — add handling: `if (result.error) { process.stderr.write('state/ship.js init timed out or crashed: ' + result.error.message + '\n'); process.exit(1); }`.

</details>

---

### script-resolution — 1 finding(s)

<details>
<summary>0 critical · 1 high · 0 medium · 0 low · 0 info</summary>

#### [HIGH] Missing failure guard in ship-sdlc plan-mode Step 0 script resolution block
**File:** `plugins/sdlc-utilities/skills/ship-sdlc/SKILL.md:20`
The new plan-mode Step 0 bash block resolves `ship.js` with:
```bash
SCRIPT=$(find ~/.claude/plugins -name "ship.js" -path "*/sdlc*/scripts/skill/ship.js" 2>/dev/null | sort -V | tail -1)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/skill/ship.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/skill/ship.js"
```
There is no third line providing the failure guard: `[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate skill/ship.js. Is the sdlc plugin installed?" >&2; exit 2; }`. Without it, if both `find` and the static fallback fail, `$SCRIPT` is empty and `node "" --output-file --plan-mode-blocked $ARGUMENTS` executes with a blank script path. Node.js will emit a cryptic `MODULE_NOT_FOUND` or `ERR_INVALID_ARG_TYPE` error to stderr, which is surfaced as "Script error — see output above" rather than the actionable "Is the sdlc plugin installed?" message. The Step 1c bash block (normal ship pipeline path) has this guard; the plan-mode Step 0 addition was made without it.
**Suggestion:** Add the failure guard as a third line in the plan-mode bash block, identical to Step 1c: `[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate skill/ship.js. Is the sdlc plugin installed?" >&2; exit 2; }`

</details>

---

### security-review — 1 finding(s)

<details>
<summary>0 critical · 0 high · 1 medium · 0 low · 0 info</summary>

#### [MEDIUM] Persistent commit manifests in .sdlc/execution/ include full staged diff — extends exposure window for accidentally staged secrets
**File:** `plugins/sdlc-utilities/scripts/skill/commit.js:354` · OWASP A09
`writeManifestState('commit', currentBranch, result)` persists the full `result` object — which includes `stagedDiff` — to `.sdlc/execution/commit-<slug>-<ts>.json`. If a user accidentally stages a file containing credentials before running `/commit-sdlc`, those credentials are now written to a persistent state file in `.sdlc/execution/`. The previous `os.tmpdir()` approach relied on a shell trap for prompt cleanup; the persistent approach leaves the diff on disk until the next prune-on-write or GC cycle. This is not a new attack vector (secrets in staging area are the real problem), but the extended persistence window increases the blast radius if `.sdlc/` is accidentally committed or shared.
**Suggestion:** Either (1) strip `stagedDiff` from the persisted manifest and rely on the `stagedFiles` array for the cross-shell survival use case, or (2) add a note to `docs/skills/commit-sdlc.md` that `.sdlc/execution/commit-*.json` files contain staged diff content and should be included in `.gitignore` (check if `.sdlc/execution/` is already gitignored).

</details>

---

### skill-architecture — 1 finding(s)

<details>
<summary>0 critical · 0 high · 0 medium · 1 low · 0 info</summary>

#### [LOW] ship-sdlc SKILL.md DO NOT section does not enumerate the plan-mode Step 0 cleanup obligation
**File:** `plugins/sdlc-utilities/skills/ship-sdlc/SKILL.md:16`
The new plan-mode Step 0 adds a 7-step path that ends with `rm -f "$PLAN_MODE_OUTPUT_FILE"`. The DO NOT section at the bottom of SKILL.md doesn't mention this cleanup obligation. A future editor adding a new exit branch in Step 0 may not realize the temp output file (`$PLAN_MODE_OUTPUT_FILE`) must be removed on every exit path.
**Suggestion:** Add to the DO NOT section: "Do NOT exit the plan-mode-blocked path (Step 0, steps 3–7) without running `rm -f "$PLAN_MODE_OUTPUT_FILE"` — the temp output file is separate from the persistent state file."

</details>

---

### spec-compliance — 0 finding(s)

No findings. Both `docs/specs/commit-sdlc.md` and `docs/specs/ship-sdlc.md` were updated in the same changeset as their respective SKILL.md files. New spec requirements R14, R15 (commit-sdlc) and R64 (ship-sdlc), plus constraints C12 and C13, accurately describe the implemented behavior. Spec-first ordering is satisfied.

---
