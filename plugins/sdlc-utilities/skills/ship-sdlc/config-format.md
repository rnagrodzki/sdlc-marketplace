# ship-sdlc Configuration Reference

This document describes the `.sdlc/local.json → ship section`, the persistent configuration for ship-sdlc. Settings here apply to every `ship-sdlc` invocation in the repository unless overridden by a CLI flag.

---

## File Location

```
<repo-root>/.sdlc/local.json
```

The ship configuration lives in the `ship` section of the user-local (gitignored) `.sdlc/local.json` config file. Create it manually or run `/setup-sdlc` to walk through an interactive setup.

A JSON Schema is available at `schemas/sdlc-local.schema.json` for IDE autocompletion. Set the `$schema` field in your config to enable it.

---

## Full Example

```json
{
  "$schema": "https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-local.schema.json",
  "ship": {
    "preset": "balanced",
    "skip": ["version"],
    "bump": "patch",
    "draft": false,
    "auto": false,
    "reviewThreshold": "high",
    "workspace": "prompt",
    "rebase": true
  }
}
```

---

## Field Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `preset` | `"full"` \| `"balanced"` \| `"minimal"` | `"balanced"` | Execution preset passed to execute-plan-sdlc. `"full"` = Speed (fewer steps, parallel), `"balanced"` = Balanced, `"minimal"` = Quality (full gates). Legacy `"A"`/`"B"`/`"C"` values are accepted and normalized automatically. |
| `skip` | `string[]` | `[]` | Step names to skip by default on every run (e.g. `["version"]` to never bump version). Equivalent to passing `--skip` on the CLI. |
| `bump` | `"patch"` \| `"minor"` \| `"major"` | `"patch"` | Default version bump type applied when the `version` step runs. Overridden by `--bump` on the CLI. |
| `draft` | `boolean` | `false` | When `true`, PRs are created as drafts. Equivalent to `--draft`. |
| `auto` | `boolean` | `false` | When `true`, run in non-interactive auto mode (no confirmation prompts). Equivalent to `--auto`. |
| `reviewThreshold` | `"critical"` \| `"high"` \| `"medium"` | `"high"` | Minimum review-finding severity that triggers the received-review fix loop. See table below. |
| `workspace` | `"branch"` \| `"worktree"` \| `"prompt"` | `"prompt"` | Workspace isolation strategy for execute-plan-sdlc. `"branch"` = use a feature branch, `"worktree"` = use a git worktree, `"prompt"` = ask each time. Forwarded to execute-plan-sdlc as a hint. |
| `rebase` | `true` \| `false` \| `"prompt"` | `true` | When `true`, auto-rebase onto the default branch before execution (execute-plan-sdlc) and before versioning (ship-sdlc). When `false`, skip rebase. When `"prompt"`, ask each time. |

### reviewThreshold Levels

| Value | Which severities trigger the fix loop |
|-------|---------------------------------------|
| `"critical"` | Critical only |
| `"high"` | Critical + High |
| `"medium"` | Critical + High + Medium |

At `"high"` (the default), findings rated Medium or lower are reported but do not block the ship pipeline.

---

## Merge Precedence

When the same setting is specified in multiple places, the order of precedence is:

```
CLI flag  >  .sdlc/local.json (ship section)  >  built-in defaults
```

A flag passed directly on the command line always wins. If no flag is given, the config file value is used. If the config file is absent or does not specify a field, the built-in default applies.

---

## --init-config Walkthrough

Running `ship-sdlc --init-config` launches an interactive sequence that writes the `ship` section to `.sdlc/local.json`. The steps are:

1. **Preset preference** — Choose an execution preset:
   - `full` = Speed (minimal gates, maximise parallelism)
   - `balanced` = Balanced (default)
   - `minimal` = Quality (full critique and review gates)

2. **Steps to skip by default** — Enter a comma-separated list of step names to always skip (leave blank for none). Common choices: `version`, `review`.

3. **Default bump type** — Choose the default version increment: `patch`, `minor`, or `major`.

4. **Draft PR preference** — Should PRs be opened as drafts by default? (`yes` / `no`)

5. **Auto mode** — Should the pipeline run without confirmation prompts where supported? (`yes` / `no`). Default: `no`.

6. **Workspace isolation** — How should the execute step isolate work? (`branch` / `worktree` / `prompt`). Default: `prompt`.
   - `branch` = create or use a feature branch (simpler, most common)
   - `worktree` = create a git worktree (parallel work, isolated filesystem)
   - `prompt` = ask each time (current default behavior)

7. **Rebase strategy** — Should the pipeline rebase onto the default branch before execution and versioning? (`yes` / `no` / `prompt`). Default: `yes` (maps to `true`).
   - `yes` = always rebase automatically (`true` in config)
   - `no` = never rebase (`false` in config)
   - `prompt` = ask each time (`"prompt"` in config)

8. **Review threshold** — Choose the minimum severity that triggers a fix loop:
   - `critical` = only blockers
   - `high` = blockers + high-severity findings (recommended)
   - `medium` = blockers + high + medium-severity findings

9. **Write and confirm** — The tool runs `util/ship-init.js` with the collected answers to write the `ship` section to `.sdlc/local.json` and create `.sdlc/.gitignore`. The resulting config JSON is displayed for confirmation. If the ship section already exists, you are asked whether to overwrite it.

---

## Team Configuration Examples

### Solo developer — move fast

Minimises prompts and skips the version step to manage it manually.

```json
{
  "$schema": "https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-local.schema.json",
  "ship": {
    "preset": "full",
    "skip": ["version"],
    "bump": "patch",
    "draft": false,
    "auto": true,
    "reviewThreshold": "critical",
    "workspace": "branch"
  }
}
```

### Team with guardrails

Balanced preset, review threshold set to catch high-severity findings, PRs always open as drafts for team review.

```json
{
  "$schema": "https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-local.schema.json",
  "ship": {
    "preset": "balanced",
    "skip": [],
    "bump": "minor",
    "draft": true,
    "auto": false,
    "reviewThreshold": "high",
    "workspace": "prompt"
  }
}
```

### CI-adjacent — maximum confidence

Quality preset with the widest review threshold. Suitable for regulated environments or release branches where medium-severity findings must be resolved before merging.

```json
{
  "$schema": "https://raw.githubusercontent.com/rnagrodzki/sdlc-marketplace/main/schemas/sdlc-local.schema.json",
  "ship": {
    "preset": "minimal",
    "skip": [],
    "bump": "patch",
    "draft": false,
    "auto": false,
    "reviewThreshold": "medium",
    "workspace": "worktree"
  }
}
```
