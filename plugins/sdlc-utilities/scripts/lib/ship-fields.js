'use strict';

// Single source of truth for ship-config fields.
// Consumed by:
//   - scripts/skill/setup.js  → emits as P7 `shipFields` (Step 3b questions)
//   - scripts/skill/ship.js   → imports VALID_SKIP and BUILT_IN_DEFAULTS
//   - scripts/util/ship-init.js → imports VALID_SKIP for --steps validation
//
// Keep schemas/sdlc-local.schema.json (repo root) in sync when adding,
// removing, or renaming fields.

const { PRESET_TO_STEPS } = require('./config');

// Canonical pipeline steps that may appear in ship.steps[]. Order matters
// — used as default ordering for the multi-select question and as the
// iteration order for resolving steps[] -> pipeline steps in ship.js.
const CANONICAL_STEPS = ['execute', 'commit', 'review', 'version', 'pr', 'archive-openspec'];

const SHIP_FIELDS = [
  {
    name: 'steps',
    label: 'Pipeline steps to run',
    type: 'multi-select',
    options: CANONICAL_STEPS.slice(),
    default: CANONICAL_STEPS.slice(),
    description: 'Pipeline steps to run by default. received-review and commit-fixes run conditionally based on review verdict and are not configurable here.',
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

// Derived: values legally allowed in ship.steps[] (and as members of the
// legacy --skip CLI flag, which subtracts from the resolved steps[]).
// Re-exported as both VALID_SKIP (legacy alias) and VALID_STEPS (preferred,
// self-documenting name). Same array reference — keeping VALID_SKIP avoids
// breaking imports while a follow-up cleanup retires it.
const VALID_STEPS = SHIP_FIELDS.find(f => f.name === 'steps').options.slice();
const VALID_SKIP = VALID_STEPS;

// Runtime resolver defaults consumed by ship.js mergeDefaults().
//
// Three fields intentionally diverge from SHIP_FIELDS[i].default:
//   - rebase: `true` here (legacy boolean, mapped to 'auto' by ship.js
//     line 191-192) vs 'auto' in SHIP_FIELDS (user-facing question default).
//     Same effective value, different storage form.
//   - workspace: 'prompt' here (runtime fallback — ask each time if no
//     config) vs 'branch' in SHIP_FIELDS (user-facing question default).
//     Different intents — don't collapse these without migration analysis.
//   - steps: PRESET_TO_STEPS.balanced here (runtime fallback when no config
//     exists — spec A3 says default is 'balanced') vs CANONICAL_STEPS in
//     SHIP_FIELDS (questionnaire default shows all six so users can pick).
//     The questionnaire default is intentionally broader than the runtime
//     fallback; do not collapse these.
const BUILT_IN_DEFAULTS = {
  steps: PRESET_TO_STEPS.balanced.slice(),
  bump: 'patch',
  draft: false,
  auto: false,
  reviewThreshold: 'high',
  workspace: 'prompt',
  rebase: true,
};

module.exports = { SHIP_FIELDS, VALID_SKIP, VALID_STEPS, BUILT_IN_DEFAULTS, CANONICAL_STEPS };
