# sdlc-marketplace

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin that automates SDLC tasks: generates structured PR descriptions from commits and diffs, and runs project-customizable multi-dimension code reviews.

## Installation

### Via the plugin UI (recommended)

1. Open Claude Code and run `/plugin`
2. Go to **Marketplaces** → **Add marketplace** → enter `rnagrodzki/sdlc-marketplace`
3. Go to **Discover** → select `sdlc` → **Install**

### Via CLI commands

```text
/plugin marketplace add rnagrodzki/sdlc-marketplace
/plugin install sdlc@sdlc-marketplace
```

See [docs/getting-started.md](docs/getting-started.md) for a full first-use walkthrough.

## Updating

### Via the plugin UI

Open `/plugin`, go to **Marketplaces**, and toggle auto-update for `sdlc-marketplace`. When enabled, Claude Code checks for new versions on startup.

### Via update commands

```text
/plugin marketplace update sdlc-marketplace
/plugin update sdlc@sdlc-marketplace
```

---

## Commands

| Command | Description |
| --- | --- |
| [`/sdlc:pr`](docs/commands/pr.md) | Create a PR with an auto-generated structured description |
| [`/sdlc:pr-customize`](docs/commands/pr-customize.md) | Create or edit a project-specific PR template interactively |
| [`/sdlc:review`](docs/commands/review.md) | Run multi-dimension code review on the current branch |
| [`/sdlc:review-init`](docs/commands/review-init.md) | Scan the project and create tailored review dimension files |
| [`/sdlc:version`](docs/commands/version.md) | Bump version, create git tag, optionally generate CHANGELOG, and push |

---

## Documentation

| Document | Description |
| --- | --- |
| [Getting Started](docs/getting-started.md) | Installation, first use, what gets created |
| [Architecture](docs/architecture.md) | Repository structure, plugin system, name resolution |
| [Adding Skills](docs/adding-skills.md) | Create custom skills for your project |
| [Adding Commands](docs/adding-commands.md) | Create custom slash commands |
| [Adding Hooks](docs/adding-hooks.md) | Set up automated actions on session events |

## Troubleshooting

### "Plugin not found" when updating via `/plugin` UI

Clear the cache, restart, and reinstall:

```bash
rm -rf ~/.claude/plugins/cache/sdlc-marketplace
```

Then restart Claude Code and run:

```text
/plugin install sdlc@sdlc-marketplace
```

### Plugin not updating after marketplace refresh

The `version` field in `plugin.json` must be bumped for Claude Code to detect a new version. If the version hasn't changed, Claude Code uses the cached copy.

### Auto-update not working

Open `/plugin`, go to the **Marketplaces** tab, and verify auto-update is toggled on for `sdlc-marketplace`. Auto-update is off by default for third-party marketplaces.

### Timeout during marketplace add or plugin install

Large repositories may exceed the default git timeout. Set the environment variable before starting Claude Code:

```bash
export CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=300000
```

## License

[AGPL-3.0](LICENSE)
