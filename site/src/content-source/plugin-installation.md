# Plugin Installation and Discovery

This document explains how Claude Code plugins are installed from GitHub, what happens
on disk, how they are discovered at session start, and how scripts are resolved at runtime.

---

## Overview

The full lifecycle from GitHub repository to working skills:

```
GitHub: rnagrodzki/sdlc-marketplace
    │
    ▼  /plugin marketplace add rnagrodzki/sdlc-marketplace
Clones repo, reads .claude-plugin/marketplace.json
Marketplace registered in Claude Code
    │
    ▼  /plugin install sdlc@sdlc-marketplace
Copies plugin files to ~/.claude/plugins/
    │
    ▼  Session start
Claude Code scans ~/.claude/plugins/ for plugin.json files
Registers user-invocable skills in the / menu (e.g. /pr-sdlc)
Loads skill descriptions for auto-invocation matching
Attaches hooks from hooks.json
SessionStart hook injects "sdlc plugin root: <abs>" into session context
    │
    ▼  Runtime (e.g. /pr-sdlc)
Skill substitutes <PLUGIN_ROOT> from that context line and invokes the script directly:
  node "<PLUGIN_ROOT>/scripts/pr-prepare.js"
```

---

## Marketplace Layer

### Adding a marketplace

```text
/plugin marketplace add rnagrodzki/sdlc-marketplace
```

Claude Code clones or fetches the GitHub repository and reads the root
`.claude-plugin/marketplace.json` file:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "sdlc-marketplace",
  "description": "Marketplace for SDLC automation plugins.",
  "owner": { "name": "rnagrodzki" },
  "plugins": [
    {
      "name": "sdlc",
      "source": "./plugins/sdlc-utilities"
    }
  ]
}
```

The `plugins` array lists every plugin in this marketplace. Each entry has:

| Field | Description |
|-------|-------------|
| `name` | Plugin identifier used for marketplace/update operations |
| `source` | Relative path from the repo root to the plugin directory |

The marketplace is cached at:

```text
~/.claude/plugins/cache/<marketplace-name>/
```

For example: `~/.claude/plugins/cache/sdlc-marketplace/`

No plugin files are active at this point. The user must install the plugin separately.

### Schema reference

The `$schema` field is optional but recommended. It points to the Anthropic
schema definition for marketplace manifests and enables editor validation:

```
https://anthropic.com/claude-code/marketplace.schema.json
```

---

## Plugin Installation

### Installing a plugin

```text
/plugin install sdlc@sdlc-marketplace
```

The format is `<plugin-name>@<marketplace-name>`. Claude Code:

1. Reads the cached marketplace to find the plugin entry with `name: "sdlc"`
2. Resolves the `source` path to the plugin directory (`./plugins/sdlc-utilities`)
3. Copies the plugin files into `~/.claude/plugins/`

After installation, Claude Code can discover and load the plugin on next session start.

---

## On-Disk Layout

After installation, the plugin's files live under `~/.claude/plugins/cache/`. At runtime,
skills invoke scripts directly using the plugin root injected into session context (see
[Script Resolution at Runtime](#script-resolution-at-runtime)):

```bash
node "<PLUGIN_ROOT>/scripts/<script>.js"
```

The full path includes marketplace, plugin name, and version:

```text
~/.claude/plugins/cache/
└── <marketplace>/               # e.g. sdlc-marketplace
    └── <plugin>/                # e.g. sdlc
        └── <version>/           # e.g. 0.8.1
            ├── .claude-plugin/
            │   └── plugin.json        # Plugin identity and version
            ├── skills/
            │   ├── pr-sdlc/
            │   │   └── SKILL.md       # Invoked as /pr-sdlc
            │   └── review-sdlc/
            │       └── SKILL.md       # Invoked as /review-sdlc
            ├── scripts/
            │   ├── pr-prepare.js      # Helper scripts (invoked via <PLUGIN_ROOT>, see below)
            │   └── lib/
            ├── hooks/
            │   └── hooks.json
            └── agents/
                └── review-orchestrator.md
```

Example actual path: `~/.claude/plugins/cache/sdlc-marketplace/sdlc/0.8.1/scripts/pr-prepare.js`

Because the `SessionStart` hook computes and injects this path directly (see
[Script Resolution at Runtime](#script-resolution-at-runtime)), skills never need to search
this tree at runtime — the four-level nesting above is invisible to skill authors.

---

## Discovery at Session Start

When Claude Code starts a session, it scans `~/.claude/plugins/` for installed plugins.
For each directory containing `.claude-plugin/plugin.json`, it:

1. **Reads `plugin.json`** to get the plugin `name`, `description`, and `version`
2. **Registers user-invocable skills** — every `SKILL.md` with `user-invocable: true`
   is added to the `/` menu by its directory name: `skills/pr-sdlc/` → `/pr-sdlc`
3. **Loads skill descriptions** — every `SKILL.md` frontmatter `description` is registered
   for automatic invocation matching (Claude invokes skills when the description matches)
4. **Attaches hooks** — the `hooks/hooks.json` configuration is read and hook handlers
   are registered for `SessionStart`, `PreToolUse`, and `PostToolUse` events
5. **Makes agents available** — agent `.md` files in `agents/` are available for the
   `Agent` tool to invoke by name

---

## Name Resolution

User-invocable skills are registered by their directory name with no prefix:

| Plugin directory         | Invocation        |
|--------------------------|-------------------|
| `skills/pr-sdlc/`        | `/pr-sdlc`        |
| `skills/review-sdlc/`    | `/review-sdlc`    |
| `skills/version-sdlc/`   | `/version-sdlc`   |

The plugin `name` in `plugin.json` is used for marketplace and update operations, not
for skill invocation names. **Renaming skill directories changes the invocation names
for all installed users** — treat directory names as stable identifiers.

### Name consistency requirement

The `name` in each `marketplace.json` plugin entry **must match** the `name` in the
corresponding `plugin.json`. A mismatch causes "plugin not found" errors when users
try to update via the `/plugin` UI, because Claude Code looks up the installed plugin
identity (from `plugin.json`) in the marketplace catalog.

```
marketplace.json           plugin.json
─────────────────          ──────────────────────
"plugins": [               {
  { "name": "sdlc", … }       "name": "sdlc",    ← must match
]                          }
```

---

## Updating

### Manual update

```text
/plugin marketplace update sdlc-marketplace
/plugin update sdlc@sdlc-marketplace
```

### Auto-update

Open `/plugin`, go to **Marketplaces**, and toggle auto-update for `sdlc-marketplace`.
When enabled, Claude Code checks for new versions on startup and updates automatically.

### How version detection works

Claude Code compares the `version` field in the installed `plugin.json` against the
`version` in the cached marketplace copy. If they differ, an update is available.
**The `version` field must be bumped** (e.g., `0.6.3` → `0.6.4`) for Claude Code to
detect a new release — identical version strings are treated as up-to-date.

### Clearing the cache

If a plugin is stuck or won't update:

```bash
rm -rf ~/.claude/plugins/cache/sdlc-marketplace
```

Then restart Claude Code and reinstall:

```text
/plugin install sdlc@sdlc-marketplace
```

---

## Script Resolution at Runtime

Skills own script resolution — they invoke helper scripts directly using the injected-path
form. The `SessionStart` hook (`hooks/session-start.js`) computes the plugin root as
`path.resolve(__dirname, '..')` and emits it into session context as a stable line on
`startup`, `clear`, and `compact` (the line survives context compaction):

```text
sdlc plugin root: /Users/you/.claude/plugins/cache/sdlc-marketplace/sdlc/0.21.18
```

Skill bodies substitute `<PLUGIN_ROOT>` from that line and invoke the script directly:

```bash
node "<PLUGIN_ROOT>/scripts/pr-prepare.js"
```

**Why no search?** The hook that fired IS the active install, so its own root is by
construction the one correct target. Earlier versions of this pattern recursively searched
`~/.claude/plugins` and ranked whichever cached versions it found to pick the newest one
(#258). That ranking is no longer needed — there is nothing left to rank, because the firing
hook's root already identifies the active install directly.

**If the context line is missing** (e.g. a session predating this hook, or context that was
never refreshed), fall back to the repository-relative path when developing inside this repo —
`plugins/sdlc-utilities/scripts/pr-prepare.js`. This fallback is for local development only; it
is not part of the primary allowlistable command below.

**Why skills?** Skills are the primary entry point in the skills-primary model. Skills add a `VERBATIM` directive before each bash block, reducing the risk of LLM paraphrasing breaking script resolution. Skills also own argument parsing and preparation directly.

### Auto-approving script invocations

Claude Code prompts for approval before running a `Bash` command unless a matching rule
exists in `permissions.allow`. To auto-approve the injected-path invocation form, add a rule
to `settings.json` — user-level `~/.claude/settings.json`, project-level `.claude/settings.json`,
or `.claude/settings.local.json` for a personal override. This is **not** a `SKILL.md`
frontmatter field (`allowed-tools` is not a valid frontmatter field in this project) — a
plugin cannot write the user's settings files, so this rule is a documented recommendation
you deploy yourself:

```json
{
  "permissions": {
    "allow": ["Bash(node \"*/scripts/*.js\"*)"]
  }
}
```

Claude Code Bash permission rules support `*` wildcards anywhere in the pattern, not only as
a trailing suffix. This single rule matches the literal `node "` prefix, any path down to a
`scripts/` directory — covering both the installed cache path
(`~/.claude/plugins/cache/sdlc-marketplace/sdlc/<version>/scripts/...`) and the repository
path used during local development (`plugins/sdlc-utilities/scripts/...`) — any `.js` script
name, and any trailing arguments.

---

## Version Bump Enforcement

The CI workflow (`.github/scripts/check-version-bump.cjs`) automatically enforces
version bumps on pull requests:

1. Reads `.claude-plugin/marketplace.json` to discover all plugins
2. Uses `git diff` to identify which plugin directories have changed files
3. For each changed plugin, checks whether `plugin.json` `version` was bumped
4. Fails the PR check if the version is unchanged

If you modify any file under `plugins/<name>/`, you must increment the `version` in
`plugins/<name>/.claude-plugin/plugin.json`.

---

## Troubleshooting

Troubleshooting solutions for common issues:

- **"Plugin not found"** when updating via `/plugin` UI — name mismatch between
  `marketplace.json` and `plugin.json`
- **Plugin not updating** after marketplace refresh — `version` field not bumped
- **Auto-update not working** — auto-update toggle is off by default for third-party
  marketplaces
- **Timeout during marketplace add** — set `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=300000`

