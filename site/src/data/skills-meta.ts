export type StepType = 'script' | 'llm' | 'critique' | 'user' | 'dispatch' | 'verify';
export type SkillCategory = 'planning' | 'review' | 'gitops' | 'workflows' | 'integrations';

export interface PipelineStep {
  id: string;
  label: string;
  type: StepType;
  description?: string;
}

export interface SkillConnection {
  to: string;
  label: string;
}

export interface SkillMeta {
  slug: string;
  command: string;
  category: SkillCategory;
  userInvocable: boolean;
  tagline: string;
  pipeline: PipelineStep[];
  connections: SkillConnection[];
}

export const skillsMeta: SkillMeta[] = [
  {
    slug: 'plan-sdlc',
    command: '/plan-sdlc',
    category: 'planning',
    userInvocable: true,
    tagline: 'Writes an implementation plan from requirements with per-task complexity, risk, and dependency metadata.',
    pipeline: [
      { id: 'requirements', label: 'Gather requirements', type: 'user', description: 'Free-form description, spec file, or clarification questions' },
      { id: 'explore', label: 'Explore codebase', type: 'script', description: 'Scans project tree, maps files, writes scratchpad' },
      { id: 'decompose', label: 'Decompose tasks', type: 'llm', description: 'Breaks requirements into tasks with complexity/risk metadata' },
      { id: 'critique-plan', label: 'Self-critique plan', type: 'critique', description: 'Reviews for coverage, dependency integrity, scope creep' },
      { id: 'revise-present', label: 'Revise and present', type: 'user', description: 'Fixes critique issues; shows plan for approval' },
      { id: 'save', label: 'Write plan document', type: 'script', description: 'Writes plan to plansDirectory with date prefix' },
      { id: 'plan-review', label: 'Cross-model review', type: 'dispatch', description: 'Dispatches a second model to review the written plan' },
    ],
    connections: [
      { to: 'execute-plan-sdlc', label: 'produces plans for' },
      { to: 'review-sdlc', label: 'review after execution' },
      { to: 'pr-sdlc', label: 'open PR after execution' },
    ],
  },
  {
    slug: 'execute-plan-sdlc',
    command: '/execute-plan-sdlc',
    category: 'planning',
    userInvocable: true,
    tagline: 'Orchestrates wave-based parallel plan execution with critique loops, spec compliance review, and automatic error recovery.',
    pipeline: [
      { id: 'load-plan', label: 'Load and validate plan', type: 'script', description: 'Reads plan from context or file; validates structure' },
      { id: 'classify', label: 'Classify tasks and build waves', type: 'llm', description: 'Assigns complexity, risk, model; builds dependency waves' },
      { id: 'critique-waves', label: 'Critique wave structure', type: 'critique', description: 'Checks file conflicts, risk clustering, context gaps' },
      { id: 'preset', label: 'Revise and select preset', type: 'user', description: 'Fixes wave issues; presents Speed/Balanced/Quality preset' },
      { id: 'high-risk-gate', label: 'High-risk gate', type: 'user', description: 'Pauses before waves with breaking or irreversible changes' },
      { id: 'dispatch-wave', label: 'Dispatch wave agents', type: 'dispatch', description: 'Parallel agents per task; batches trivials into one haiku' },
      { id: 'mechanical-verify', label: 'Verify and checkpoint', type: 'verify', description: 'git diff, canary tokens, tests, conflict detection' },
      { id: 'spec-review', label: 'Spec compliance review', type: 'critique', description: 'Reviewer checks implementations against specifications' },
      { id: 'final-verify', label: 'Final verification', type: 'verify', description: 'Full test suite, build, lint after all waves complete' },
      { id: 'final-critique', label: 'Final output critique', type: 'critique', description: 'Checks deliverables, drift, orphaned files, TODOs' },
    ],
    connections: [
      { to: 'plan-sdlc', label: 'executes plans from' },
      { to: 'review-sdlc', label: 'review changes after' },
      { to: 'pr-sdlc', label: 'open PR after' },
      { to: 'commit-sdlc', label: 'commit changes after' },
      { to: 'version-sdlc', label: 'release after' },
    ],
  },
  {
    slug: 'ship-sdlc',
    command: '/ship-sdlc',
    category: 'workflows',
    userInvocable: true,
    tagline: 'Orchestrates the full shipping pipeline: execute, commit, review, fix, version, and PR in one invocation.',
    pipeline: [
      { id: 'load-config', label: 'Load config and flags', type: 'script', description: 'Reads .sdlc/ship-config.json, merges CLI flags, detects context' },
      { id: 'build-pipeline', label: 'Build pipeline plan', type: 'llm', description: 'Determines which steps run, builds routing table with conditions' },
      { id: 'validate', label: 'Validate pipeline', type: 'critique', description: 'Checks prerequisites, warns about interactive pauses' },
      { id: 'confirm', label: 'Present and confirm', type: 'user', description: 'Shows full pipeline table; proceeds automatically in --auto mode' },
      { id: 'execute-steps', label: 'Execute pipeline steps', type: 'dispatch', description: 'Invokes sub-skills sequentially with flag forwarding' },
      { id: 'review-gate', label: 'Review verdict gate', type: 'llm', description: 'Evaluates review findings; triggers fix loop for critical/high' },
      { id: 'report', label: 'Pipeline summary', type: 'verify', description: 'Prints results, decisions log, deferred findings, cleanup' },
    ],
    connections: [
      { to: 'execute-plan-sdlc', label: 'invokes' },
      { to: 'commit-sdlc', label: 'invokes' },
      { to: 'review-sdlc', label: 'invokes' },
      { to: 'received-review-sdlc', label: 'invokes conditionally' },
      { to: 'version-sdlc', label: 'invokes' },
      { to: 'pr-sdlc', label: 'invokes' },
    ],
  },
  {
    slug: 'review-sdlc',
    command: '/review-sdlc',
    category: 'review',
    userInvocable: true,
    tagline: 'Dispatches parallel review subagents per dimension, deduplicates findings, and posts a consolidated comment to the PR.',
    pipeline: [
      { id: 'load-dimensions', label: 'Load review dimensions', type: 'script', description: 'Reads .claude/review-dimensions/ and matches dimensions to changed files via glob patterns' },
      { id: 'scope-diff', label: 'Resolve diff scope', type: 'script', description: 'Computes the diff based on --committed/--staged/--working/--worktree flags' },
      { id: 'dispatch-reviewers', label: 'Dispatch review agents', type: 'dispatch', description: 'Parallel subagents review each matching dimension independently' },
      { id: 'deduplicate', label: 'Deduplicate findings', type: 'llm', description: 'Merges overlapping findings from multiple dimensions into a unified list' },
      { id: 'post-comment', label: 'Post PR comment', type: 'script', description: 'Posts consolidated review comment to the GitHub PR via gh CLI' },
      { id: 'fix-prompt', label: 'Offer self-fix', type: 'user', description: 'Prompts to invoke received-review-sdlc when actionable findings exist' },
    ],
    connections: [
      { to: 'review-init-sdlc', label: 'requires dimensions from' },
      { to: 'received-review-sdlc', label: 'hands off findings to' },
      { to: 'pr-sdlc', label: 'reviews PRs from' },
      { to: 'commit-sdlc', label: 'commit after approval' },
    ],
  },
  {
    slug: 'review-init-sdlc',
    command: '/review-init-sdlc',
    category: 'review',
    userInvocable: true,
    tagline: 'Scans the project tech stack and creates tailored review dimension files used by review-sdlc.',
    pipeline: [
      { id: 'scan-stack', label: 'Scan tech stack', type: 'script', description: 'Reads manifests, file patterns, config to detect stack' },
      { id: 'discover-existing', label: 'Discover existing dimensions', type: 'script', description: 'Checks installed dimensions; runs validation in --add mode' },
      { id: 'propose-dimensions', label: 'Propose dimensions', type: 'llm', description: 'Selects dimensions from catalog based on scan evidence' },
      { id: 'critique-proposals', label: 'Critique proposals', type: 'critique', description: 'Checks trigger specificity, overlap, evidence quality' },
      { id: 'refine-proposals', label: 'Refine proposals', type: 'llm', description: 'Tightens triggers, resolves overlaps, adds project context' },
      { id: 'user-selection', label: 'Present and create', type: 'user', description: 'User selects dimensions; writes .claude/review-dimensions/' },
      { id: 'validate', label: 'Validate dimensions', type: 'verify', description: 'Runs validate-dimensions.js structural checks' },
      { id: 'copilot-prompt', label: 'Offer Copilot instructions', type: 'user', description: 'Optionally generates .github/instructions/ files' },
    ],
    connections: [
      { to: 'review-sdlc', label: 'creates dimensions for' },
    ],
  },
  {
    slug: 'received-review-sdlc',
    command: '/received-review-sdlc',
    category: 'review',
    userInvocable: true,
    tagline: 'Responds to code review feedback with a dual self-critique gate that prevents blind implementation of incorrect suggestions.',
    pipeline: [
      { id: 'load-feedback', label: 'Read review feedback', type: 'script', description: 'Gathers findings from context, paste, or gh API' },
      { id: 'categorize', label: 'Categorize and flag', type: 'llm', description: 'Classifies each item; flags unclear items to resolve' },
      { id: 'verify-claims', label: 'Verify against codebase', type: 'verify', description: 'Reads referenced code to confirm or refute each claim' },
      { id: 'evaluate', label: 'Evaluate suggestions', type: 'llm', description: 'Determines agree/disagree/needs-discussion per item' },
      { id: 'critique-eval', label: 'Critique evaluation', type: 'critique', description: 'Gate 1: checks blind agreement, YAGNI, completeness' },
      { id: 'revise-eval', label: 'Revise evaluation', type: 'llm', description: 'Strengthens reasoning, reclassifies unsupported items' },
      { id: 'draft-responses', label: 'Draft responses', type: 'llm', description: 'Writes per-item responses with technical substance' },
      { id: 'critique-responses', label: 'Critique responses', type: 'critique', description: 'Gate 2: checks performative language, weak pushback' },
      { id: 'implement', label: 'Implement and reply', type: 'user', description: 'Posts thread replies (with approval); implements fixes' },
    ],
    connections: [
      { to: 'review-sdlc', label: 'responds to findings from' },
      { to: 'pr-sdlc', label: 'addresses review on PR from' },
      { to: 'commit-sdlc', label: 'commit fixes after' },
    ],
  },
  {
    slug: 'commit-sdlc',
    command: '/commit-sdlc',
    category: 'gitops',
    userInvocable: true,
    tagline: 'Generates a commit message matching the project style, stashes unstaged changes automatically, and restores them after.',
    pipeline: [
      { id: 'prepare', label: 'Run commit-prepare.js', type: 'script', description: 'Computes staged diff, recent commits, branch context' },
      { id: 'analyze-diff', label: 'Analyze diff and style', type: 'llm', description: 'Reads staged changes and detects project commit style' },
      { id: 'generate-message', label: 'Generate commit message', type: 'llm', description: 'Drafts conventional or project-style commit message' },
      { id: 'critique-message', label: 'Critique message', type: 'critique', description: 'Reviews against 7 quality gates (style, accuracy, etc.)' },
      { id: 'revise-message', label: 'Revise message', type: 'llm', description: 'Fixes all failing quality gates from critique' },
      { id: 'review-confirm', label: 'Present and commit', type: 'user', description: 'Shows message; on approval: stash, commit, restore stash' },
      { id: 'verify-commit', label: 'Verify commit', type: 'verify', description: 'Confirms commit created and stash restored via git log' },
    ],
    connections: [
      { to: 'pr-sdlc', label: 'feeds into' },
      { to: 'version-sdlc', label: 'precedes tagging in' },
    ],
  },
  {
    slug: 'pr-sdlc',
    command: '/pr-sdlc',
    category: 'gitops',
    userInvocable: true,
    tagline: 'Analyzes branch commits and diff to generate a structured PR description, then opens the PR via the GitHub CLI.',
    pipeline: [
      { id: 'prepare', label: 'Run pr-prepare.js', type: 'script', description: 'Computes commits, diff, branch state, account switch' },
      { id: 'consume', label: 'Consume context', type: 'script', description: 'Parses commits, diff, JIRA ticket, custom template' },
      { id: 'draft-description', label: 'Draft PR description', type: 'llm', description: 'Fills all template sections from branch analysis' },
      { id: 'critique-draft', label: 'Critique draft', type: 'critique', description: 'Reviews against 9 quality gates (specificity, etc.)' },
      { id: 'revise-draft', label: 'Revise draft', type: 'llm', description: 'Fixes failing gates; asks user if context unclear' },
      { id: 'review-confirm', label: 'Present for approval', type: 'user', description: 'Shows title and description; yes/edit/cancel' },
      { id: 'create-pr', label: 'Create or update PR', type: 'script', description: 'Runs gh pr create or gh pr edit after approval' },
    ],
    connections: [
      { to: 'pr-customize-sdlc', label: 'uses template from' },
      { to: 'review-sdlc', label: 'review branch before' },
      { to: 'commit-sdlc', label: 'follows commits from' },
    ],
  },
  {
    slug: 'pr-customize-sdlc',
    command: '/pr-customize-sdlc',
    category: 'gitops',
    userInvocable: true,
    tagline: 'Guides you through creating or editing a project-specific PR description template saved to .claude/pr-template.md.',
    pipeline: [
      { id: 'scan-conventions', label: 'Scan project signals', type: 'script', description: 'Reads GitHub templates, recent PRs, manifests, JIRA evidence' },
      { id: 'draft-template', label: 'Draft template proposal', type: 'llm', description: 'Adapts default 8-section template using scan signals' },
      { id: 'critique-template', label: 'Critique proposal', type: 'critique', description: 'Checks completeness, duplicates, evidence backing' },
      { id: 'revise-template', label: 'Refine proposal', type: 'llm', description: 'Tightens fill instructions, removes speculative sections' },
      { id: 'interactive-edit', label: 'Present and customize', type: 'user', description: 'User accepts, edits sections, or starts fresh' },
      { id: 'save-template', label: 'Write template file', type: 'script', description: 'Writes final template to .claude/pr-template.md' },
      { id: 'validate', label: 'Validate template', type: 'verify', description: 'Runs validate-pr-template.js structural checks' },
    ],
    connections: [
      { to: 'pr-sdlc', label: 'provides template for' },
    ],
  },
  {
    slug: 'version-sdlc',
    command: '/version-sdlc',
    category: 'gitops',
    userInvocable: true,
    tagline: 'Manages the full semantic release workflow: version bump, annotated git tag, optional CHANGELOG entry, and push.',
    pipeline: [
      { id: 'prepare', label: 'Run version-prepare.js', type: 'script', description: 'Detects version source, tags, commits, existing config' },
      { id: 'plan-release', label: 'Determine bump and changelog', type: 'llm', description: 'Selects version bump; drafts changelog entry if enabled' },
      { id: 'critique-release', label: 'Critique release plan', type: 'critique', description: 'Reviews semver, breaking changes, changelog completeness' },
      { id: 'revise-release', label: 'Revise release plan', type: 'llm', description: 'Fixes quality gate failures from critique' },
      { id: 'present-plan', label: 'Present release plan', type: 'user', description: 'Shows version, tag, changelog flag; awaits approval' },
      { id: 'verify-preconditions', label: 'Verify pre-conditions', type: 'verify', description: 'Checks tag conflicts, uncommitted changes, git identity' },
      { id: 'check-ci', label: 'Check CI scripts', type: 'verify', description: 'Verifies installed retag/changelog scripts are current' },
      { id: 'execute-release', label: 'Execute release', type: 'script', description: 'Atomically: bump version, changelog, commit, tag, push' },
    ],
    connections: [
      { to: 'pr-sdlc', label: 'follows PR merge in' },
      { to: 'commit-sdlc', label: 'follows commits from' },
      { to: 'jira-sdlc', label: 'update ticket after release' },
    ],
  },
  {
    slug: 'jira-sdlc',
    command: '/jira-sdlc',
    category: 'integrations',
    userInvocable: true,
    tagline: 'Manages Jira issues via Atlassian MCP with a project metadata cache that reduces most operations to a single MCP call.',
    pipeline: [
      { id: 'resolve-project', label: 'Resolve project key', type: 'script', description: 'Auto-detects from git branch or .sdlc/jira-config.json' },
      { id: 'load-cache', label: 'Initialize or load cache', type: 'script', description: 'Builds cache on first use; reads cached metadata after' },
      { id: 'parse-intent', label: 'Classify operation', type: 'llm', description: 'Interprets request into create/edit/search/transition/etc.' },
      { id: 'execute-op', label: 'Execute Jira operation', type: 'script', description: 'Calls Atlassian MCP with cached field IDs and schemas' },
      { id: 'cache-refresh', label: 'Update cache', type: 'script', description: 'Saves new users, transitions; auto-refreshes on stale data' },
    ],
    connections: [
      { to: 'pr-sdlc', label: 'create PR after story' },
      { to: 'review-sdlc', label: 'review before closing task' },
      { to: 'plan-sdlc', label: 'informs planning in' },
    ],
  },
  {
    slug: 'setup-sdlc',
    command: '/setup-sdlc',
    category: 'gitops',
    userInvocable: true,
    tagline: 'Unified project setup — configures version, ship, review, and jira settings in one interactive flow.',
    pipeline: [
      { id: 'detect', label: 'Detect current state', type: 'script', description: 'Runs setup-prepare.js to find existing configs and legacy files' },
      { id: 'migrate', label: 'Migrate legacy configs', type: 'llm', description: 'Consolidates legacy files into unified .claude/sdlc.json' },
      { id: 'configure', label: 'Interactive config builder', type: 'user', description: 'Walks through version, ship, jira, and review settings' },
      { id: 'validate', label: 'Validate written config', type: 'verify', description: 'Re-runs setup-prepare.js to confirm config is readable' },
      { id: 'delegate-content', label: 'Delegate content setup', type: 'dispatch', description: 'Invokes review-init-sdlc and pr-customize-sdlc as needed' },
      { id: 'summary', label: 'Show summary', type: 'llm', description: 'Reports what was created, migrated, and configured' },
    ],
    connections: [
      { to: 'version-sdlc', label: 'configures versioning for' },
      { to: 'ship-sdlc', label: 'configures pipeline for' },
      { to: 'review-init-sdlc', label: 'delegates dimensions to' },
      { to: 'jira-sdlc', label: 'configures project key for' },
    ],
  },
];

export function getSkillMeta(slug: string): SkillMeta | undefined {
  return skillsMeta.find(s => s.slug === slug);
}

export function getSkillsByCategory(category: SkillCategory): SkillMeta[] {
  return skillsMeta.filter(s => s.category === category);
}
