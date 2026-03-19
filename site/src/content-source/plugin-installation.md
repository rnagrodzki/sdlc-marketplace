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
    │
    ▼  Runtime (e.g. /pr-sdlc)
Skill uses find to locate helper scripts:
  find ~/.claude/plugins -name "pr-prepare.js"
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

After installation, the plugin's files live under `~/.claude/plugins/cache/`. Scripts
are found at runtime using:

```bash
find ~/.claude/plugins -name "<script>.js"
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
            │   ├── pr-prepare.js      # Helper scripts (found at runtime via find)
            │   └── lib/
            ├── hooks/
            │   └── hooks.json
            └── agents/
                └── review-orchestrator.md
```

Example actual path: `~/.claude/plugins/cache/sdlc-marketplace/sdlc/0.8.1/scripts/pr-prepare.js`

Because scripts are nested 4 levels deep under `~/.claude/plugins/`, a recursive
`find` (without `-path` filters) is required — path-based filtering is fragile and
unnecessary since script names are unique within the plugin.

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

Skills own script resolution — they locate and run helper scripts themselves using this
two-step pattern:

```bash
# Step 1: Search installed plugin (recursive find — scripts are 4 levels deep under cache/)
SCRIPT=$(find ~/.claude/plugins -name "pr-prepare.js" 2>/dev/null | head -1)

# Step 2: Fall back to the repository tree (for development / testing)
[ -z "$SCRIPT" ] && [ -f "plugins/sdlc-utilities/scripts/pr-prepare.js" ] && SCRIPT="plugins/sdlc-utilities/scripts/pr-prepare.js"

# Step 3: Hard error if not found
[ -z "$SCRIPT" ] && { echo "ERROR: Could not locate pr-prepare.js. Is the sdlc plugin installed?" >&2; exit 2; }
```

**Why `find` without `-path`?** Scripts are nested 4 levels deep (`cache/<marketplace>/<plugin>/<version>/scripts/`). The `-path "*/scripts/*"` filter that was previously used is fragile — LLMs paraphrase it and silently drop the glob wildcards. Since script names are unique within the plugin, `-name` alone is sufficient.

**Why the direct-path CWD fallback?** Allows contributors working in the `sdlc-marketplace`
repository to run commands directly without installing the plugin globally. The fallback
uses a literal `[ -f "..." ]` check with no globbing — impossible to corrupt.

**Why skills?** Skills are the primary entry point in the skills-primary model. Skills add a `VERBATIM` directive before each bash block, reducing the risk of LLM paraphrasing breaking script resolution. Skills also own argument parsing and preparation directly.

---

## Version Bump Enforcement

The CI workflow (`.github/scripts/check-version-bump.js`) automatically enforces
version bumps on pull requests:

1. Reads `.claude-plugin/marketplace.json` to discover all plugins
2. Uses `git diff` to identify which plugin directories have changed files
3. For each changed plugin, checks whether `plugin.json` `version` was bumped
4. Fails the PR check if the version is unchanged

If you modify any file under `plugins/<name>/`, you must increment the `version` in
`plugins/<name>/.claude-plugin/plugin.json`.

---

## Troubleshooting

See the [README troubleshooting section](../README.md#troubleshooting) for solutions to:

- **"Plugin not found"** when updating via `/plugin` UI — name mismatch between
  `marketplace.json` and `plugin.json`
- **Plugin not updating** after marketplace refresh — `version` field not bumped
- **Auto-update not working** — auto-update toggle is off by default for third-party
  marketplaces
- **Timeout during marketplace add** — set `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=300000`

---

## See Also

- [Architecture](architecture.md) — repository structure, plugin manifest fields, name resolution
- [Getting Started](getting-started.md) — first-use walkthrough and what gets created
- [Adding Skills](adding-skills.md) — how to create new skills
- [Adding Commands](adding-commands.md) — how to create slash commands (legacy)
- [Adding Hooks](adding-hooks.md) — how to configure session hooks
