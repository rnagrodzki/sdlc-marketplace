'use strict';

// Single source of truth for ship-config fields.
// Consumed by:
//   - scripts/skill/setup.js  → emits as P7 `shipFields` (Step 3b questions)
//   - scripts/skill/ship.js   → imports VALID_SKIP and BUILT_IN_DEFAULTS
//
// Keep schemas/sdlc-local.schema.json (repo root) in sync when adding,
// removing, or renaming fields.

const SHIP_FIELDS = [
  {
    name: 'preset',
    label: 'Pipeline variant',
    type: 'enum',
    options: ['full', 'balanced', 'minimal'],
    default: 'balanced',
    description: 'full (all steps), balanced (skip version), minimal (execute + commit + PR)',
  },
  {
    name: 'skip',
    label: 'Additional steps to skip',
    type: 'multi-select',
    options: ['execute', 'commit', 'review', 'version', 'pr', 'archive-openspec'],
    default: [],
    description: 'Top-level pipeline steps plus archive-openspec are user-skippable. received-review and commit-fixes run conditionally based on review verdict and are not in this list by design.',
  },
  {
    name: 'bump',
    label: 'Default version bump level',
    type: 'enum',
    options: ['patch', 'minor', 'major'],
    default: 'patch',
    description: 'Applied by /version-sdlc when no explicit bump argument is passed',
  },
  {
    name: 'draft',
    label: 'Open PRs as drafts?',
    type: 'boolean',
    options: ['yes', 'no'],
    default: false,
    description: 'Default value for the --draft flag on /pr-sdlc',
  },
  {
    name: 'auto',
    label: 'Run pipeline non-interactively?',
    type: 'boolean',
    options: ['yes', 'no'],
    default: false,
    description: 'Skip interactive approval prompts throughout the ship pipeline',
  },
  {
    name: 'workspace',
    label: 'Working environment',
    type: 'enum',
    options: ['branch', 'worktree', 'prompt'],
    default: 'branch',
    description: 'branch (current branch), worktree (isolated git worktree), prompt (ask each time)',
  },
  {
    name: 'rebase',
    label: 'Rebase before shipping?',
    type: 'enum',
    options: ['auto', 'skip', 'prompt'],
    default: 'auto',
    description: 'auto (rebase automatically), skip (never rebase), prompt (ask each time). Runtime values ship.js expects; do NOT write yes/no.',
  },
  {
    name: 'reviewThreshold',
    label: 'Minimum severity that blocks the pipeline',
    type: 'enum',
    options: ['critical', 'high', 'medium'],
    default: 'high',
    description: 'Findings at or above this severity halt the pipeline',
  },
];

// Derived: values user may legally pass to --skip or write into ship.skip[].
const VALID_SKIP = SHIP_FIELDS.find(f => f.name === 'skip').options.slice();

// Runtime resolver defaults consumed by ship.js mergeDefaults().
// Byte-identical to the pre-refactor inline constant in ship.js (lines 48-57).
// Preserving wire shape means ship.js runtime behavior is unchanged after
// the Task 4 refactor.
//
// Two fields intentionally diverge from SHIP_FIELDS[i].default:
//   - rebase: `true` here (legacy boolean, mapped to 'auto' by ship.js
//     line 191-192) vs 'auto' in SHIP_FIELDS (user-facing question default).
//     Same effective value, different storage form.
//   - workspace: 'prompt' here (runtime fallback — ask each time if no
//     config) vs 'branch' in SHIP_FIELDS (user-facing question default).
//     Different intents — don't collapse these without migration analysis.
const BUILT_IN_DEFAULTS = {
  preset: 'balanced',
  skip: [],
  bump: 'patch',
  draft: false,
  auto: false,
  reviewThreshold: 'high',
  workspace: 'prompt',
  rebase: true,
};

module.exports = { SHIP_FIELDS, VALID_SKIP, BUILT_IN_DEFAULTS };
