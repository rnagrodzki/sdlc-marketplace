# sdlc-marketplace

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that automates SDLC tasks: generates structured PR descriptions from commits and diffs, and runs project-customizable multi-dimension code reviews matched to your changed files.

## Technical Requirements

| Requirement | Version | Notes |
| --- | --- | --- |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | — | This is a Claude Code plugin marketplace |
| Node.js | >= 16 | For helper scripts. Uses built-in modules, no `npm install` needed |
| git | — | Required for diff and commit analysis |
| gh (GitHub CLI) | — | Required for `/sdlc:pr`. Falls back to showing the description if unavailable |

## Installation

### Step 1 — Add the marketplace

```text
/plugin marketplace add rnagrodzki/sdlc-marketplace
```

This registers the marketplace catalog. No plugins are installed yet.

### Step 2 — Install the plugin

```text
/plugin install sdlc@sdlc-marketplace
```

Or browse interactively: run `/plugin`, go to the **Discover** tab, and select the plugin to install.

Verify by starting a new Claude Code session — the plugin announces itself:

```text
[sdlc-utilities] Plugin loaded. Use /sdlc:pr to create a pull request, /sdlc:review to run a code review, /sdlc:review-init to set up review dimensions.
```

See [docs/getting-started.md](docs/getting-started.md) for a full first-use walkthrough.

## Updating

### Step 1 — Refresh the marketplace catalog

```text
/plugin marketplace update sdlc-marketplace
```

### Step 2 — Update the plugin

```text
/plugin update sdlc@sdlc-marketplace
```

### Enable auto-update

Open `/plugin`, go to the **Marketplaces** tab, and toggle auto-update for `sdlc-marketplace`. When enabled, Claude Code checks for new versions on startup.

---

## Commands

| Command | Description |
| --- | --- |
| `/sdlc:pr` | Create a PR with an auto-generated structured description |
| `/sdlc:review` | Run multi-dimension code review on the current branch |
| `/sdlc:review-init` | Scan the project and create tailored review dimension files |

`/sdlc:pr` supports `--draft`, `--update`, and `--base <branch>` flags.
`/sdlc:review` supports `--base`, `--dimensions`, and `--dry-run` flags.

> **[Full reference →](docs/plugin-sdlc-utilities.md)** Usage examples, flag reference, example PR output, code review workflow, dimension format

---

## Documentation

| Document | Description |
| --- | --- |
| [Getting Started](docs/getting-started.md) | Installation, first use, what gets created |
| [Architecture](docs/architecture.md) | Repository structure, plugin system, name resolution |
| [Plugin: sdlc-utilities](docs/plugin-sdlc-utilities.md) | PR command usage, flags, example output, skill template |
| [Adding Skills](docs/adding-skills.md) | Create custom skills for your project |
| [Adding Commands](docs/adding-commands.md) | Create custom slash commands |
| [Adding Hooks](docs/adding-hooks.md) | Set up automated actions on session events |

## CI Checks

### Version Bump Check

A GitHub Actions workflow runs on every pull request targeting `main` and verifies that modified plugins have their `version` field bumped in `plugin.json`. The check:

- Detects which plugins have changed files in the PR
- Compares the `plugin.json` version against the base branch
- Fails if a plugin's files changed but its version was not incremented

To skip the check when a version bump is intentionally not needed, add the **`skip-version-check`** label to the pull request. The workflow will pass with a notice.

## Troubleshooting

### "Plugin not found" when updating via `/plugin` UI

This happens when the plugin name registered in the marketplace doesn't match the identity in `plugin.json`. Clear the cache, restart, and reinstall:

```bash
rm -rf ~/.claude/plugins/cache/sdlc-marketplace
```

Then restart Claude Code and run:

```text
/plugin install sdlc@sdlc-marketplace
```

### Plugin not updating after marketplace refresh

The `version` field in `plugin.json` must be bumped for Claude Code to detect a new version. If the version hasn't changed, Claude Code uses the cached copy. See the [CI Checks](#ci-checks) section — every PR that modifies plugin files must bump the version.

### Auto-update not working

Open `/plugin`, go to the **Marketplaces** tab, and verify auto-update is toggled on for `sdlc-utilities`. Auto-update is off by default for third-party marketplaces.

### Timeout during marketplace add or plugin install

Large repositories may exceed the default git timeout. Set the environment variable before starting Claude Code:

```bash
export CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=300000
```

## License

[AGPL-3.0](LICENSE)
