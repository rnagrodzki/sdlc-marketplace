### Branch A: Init Workflow (`flow === "init"`)

### Step 1 (CONSUME): Read the Context

Read `VERSION_CONTEXT_JSON`. Extract:

- `detectedVersionFile` — path to the detected version file (e.g. `package.json`)
- `currentVersion` — version string found in that file or from git tags
- `existingTags` — list of existing git release tags
- `tagConvention` — detected tag prefix (e.g. `v`, `release/`, or empty)
- `suggestedConfig` — the config object that will be written to `.claude/sdlc.json → version section`

### Step 2 (PRESENT): Show Detected Setup

Display the detected configuration in a clean summary table:

```
Detected setup:
  Mode:         file
  Version file: package.json
  Version:      1.2.3
  Tag prefix:   v
  Changelog:    no (use --changelog flag to enable per release)

Suggested config:
  .claude/sdlc.json → version section — will be written
```

### Step 3 (CONFIRM): Ask User to Confirm

Use AskUserQuestion to present the detected setup and ask:
> Does this look right?

Options:
- **yes** — write version section to .claude/sdlc.json
- **tag-only** — use git tags as version source (no version file)
- **changelog** — same as yes, but enable changelog by default
- **cancel** — abort setup

### Step 4 (WRITE): Write Config on Confirmation

On `yes` or `changelog`, write the version section to `.claude/sdlc.json` using `writeSection` from lib/config.js with
the content from `suggestedConfig` (adjusted if `changelog` was chosen).

Then scaffold the retag workflow into the project:

1. Copy `plugins/sdlc-utilities/scripts/retag-release.js` → `.github/scripts/retag-release.js` (create `.github/scripts/` if it doesn't exist)
2. Copy `plugins/sdlc-utilities/templates/retag-release.yml` → `.github/workflows/retag-release.yml` (create `.github/workflows/` if it doesn't exist)

If either target file already exists, skip copying it (do not overwrite).

**When `config.changelog === true`** (i.e., user chose `changelog` option, or changelog was already enabled):

3. Copy `plugins/sdlc-utilities/scripts/check-changelog.js` → `.github/scripts/check-changelog.js` (reuse the same `.github/scripts/` directory)
4. Copy `plugins/sdlc-utilities/templates/check-changelog.yml` → `.github/workflows/check-changelog.yml`

If either target file already exists, skip copying it (do not overwrite).

Display:

```
✓ .claude/sdlc.json → version section written.
✓ .github/workflows/retag-release.yml added (auto-fixes tags after squash merge to main).
✓ .github/scripts/retag-release.js added.
✓ .github/workflows/check-changelog.yml added (validates changelog entry exists after each push to main).
✓ .github/scripts/check-changelog.js added.
Run /version-sdlc patch to create your first release.
```

If a file was skipped because it already existed, show `(already exists — skipped)` instead of `added`.
The check-changelog lines are only shown when `config.changelog === true`.

**Retag script version check** — after scaffolding (whether files were added or skipped), check if the installed files are up to date:

1. Read the installed `.github/scripts/retag-release.js` (if it exists) and look for `const RETAG_SCRIPT_VERSION = (\d+);`. If absent, treat as version 1.
2. Read the installed `.github/workflows/retag-release.yml` (if it exists) and look for `# retag-release-version: (\d+)`. If absent, treat as version 1.
3. Read the plugin's current copies of those files (from the same paths used for scaffolding) and extract their version numbers the same way.
4. If either installed file's version is less than the plugin's current version, show an update prompt:

```
⚠  Outdated retag files detected:
   .github/scripts/retag-release.js   (installed: v1, current: v2)
   .github/workflows/retag-release.yml (installed: v1, current: v2)

Changes in v2:
- Retag now preserves original tag message metadata (required for --hotfix DORA annotations)

Update these files? (yes / no)
```

On `yes`, overwrite the outdated files with the plugin's current copies. On `no`, warn:
```
⚠  Skipped update. Note: hotfix tag metadata (Type: hotfix) will not survive retagging until you update these files.
```

**Changelog script version check** — after checking retag files, if `config.changelog === true`:

1. Read `.github/scripts/check-changelog.js` (if it exists) and look for `const CHECK_CHANGELOG_SCRIPT_VERSION = (\d+);`. If absent, treat as version 1.
2. Read `.github/workflows/check-changelog.yml` (if it exists) and look for `# check-changelog-version: (\d+)`. If absent, treat as version 1.
3. Read the plugin's current copies and extract their version numbers.
4. If either installed file's version is less than the plugin's current version, include them in the update prompt alongside outdated retag files.

On `tag-only`, update `suggestedConfig.mode` to `"tag"` before writing. Apply the same workflow scaffolding.

On `cancel`, stop immediately without writing any files.
