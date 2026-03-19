export type StepType = 'script' | 'llm' | 'critique' | 'user' | 'dispatch' | 'verify';
export type SkillCategory = 'planning' | 'review' | 'gitops' | 'integrations';

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
      { id: 'requirements', label: 'Gather requirements', type: 'user', description: 'Accepts free-form description, spec file, or interactive clarification questions' },
      { id: 'explore', label: 'Explore codebase', type: 'script', description: 'Scans project tree, maps affected files, writes exploration scratchpad to $TMPDIR' },
      { id: 'decompose', label: 'Decompose tasks', type: 'llm', description: 'Breaks requirements into classified tasks with complexity, risk, and dependency fields' },
      { id: 'critique-plan', label: 'Self-critique plan', type: 'critique', description: 'Reviews decomposition for completeness, conflicting tasks, and missing dependencies' },
      { id: 'present', label: 'Present for approval', type: 'user', description: 'Shows requirements checklist, task mappings, and wave preview; waits for approval or changes' },
      { id: 'plan-review', label: 'Cross-model review', type: 'dispatch', description: 'Dispatches a second model to review the plan for correctness and completeness' },
      { id: 'save', label: 'Save plan', type: 'script', description: 'Writes plan to plansDirectory with date-prefixed filename' },
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
      { id: 'load-plan', label: 'Load & classify plan', type: 'script', description: 'Reads plan from context or file; classifies each task by complexity and risk' },
      { id: 'preset', label: 'Select model preset', type: 'user', description: 'Presents Speed/Balanced/Quality presets; waits for selection before executing' },
      { id: 'dispatch-wave', label: 'Dispatch wave agents', type: 'dispatch', description: 'Dispatches tasks in parallel per wave; batches trivial tasks into a single haiku agent' },
      { id: 'mechanical-verify', label: 'Mechanical verification', type: 'verify', description: 'Checks git diff and VERIFY token in filesystem; never trusts agent self-reports alone' },
      { id: 'spec-review', label: 'Spec compliance review', type: 'critique', description: 'Sonnet reviewer checks non-trivial task implementations against their specifications' },
      { id: 'checkpoint', label: 'Write checkpoint', type: 'script', description: 'Persists completed wave state to $TMPDIR for session resume on large plans' },
      { id: 'high-risk-gate', label: 'High-risk gate', type: 'user', description: 'Pauses before waves containing breaking changes, credential handling, or irreversible operations' },
    ],
    connections: [
      { to: 'plan-sdlc', label: 'executes plans from' },
      { to: 'review-sdlc', label: 'review changes after' },
      { to: 'pr-sdlc', label: 'open PR after' },
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
      { id: 'fix-prompt', label: 'Offer self-fix', type: 'user', description: 'Prompts to invoke review-receive-sdlc when actionable findings exist' },
    ],
    connections: [
      { to: 'review-init-sdlc', label: 'requires dimensions from' },
      { to: 'review-receive-sdlc', label: 'hands off findings to' },
      { to: 'pr-sdlc', label: 'reviews PRs from' },
    ],
  },
  {
    slug: 'review-init-sdlc',
    command: '/review-init-sdlc',
    category: 'review',
    userInvocable: true,
    tagline: 'Scans the project tech stack and creates tailored review dimension files used by review-sdlc.',
    pipeline: [
      { id: 'scan-stack', label: 'Scan tech stack', type: 'script', description: 'Reads package.json, directory structure, and file patterns to detect frameworks and tools' },
      { id: 'propose-dimensions', label: 'Propose dimensions', type: 'llm', description: 'Selects relevant dimensions from a catalog of 31 types based on evidence found' },
      { id: 'user-selection', label: 'User selects dimensions', type: 'user', description: 'Presents proposed dimensions with rationale; user picks which to install' },
      { id: 'write-dimensions', label: 'Write dimension files', type: 'script', description: 'Creates .claude/review-dimensions/*.md files for each selected dimension' },
      { id: 'validate', label: 'Validate dimensions', type: 'verify', description: 'Confirms all written files pass structural checks' },
      { id: 'copilot-prompt', label: 'Offer Copilot instructions', type: 'user', description: 'Optionally generates matching GitHub Copilot instruction files in .github/instructions/' },
    ],
    connections: [
      { to: 'review-sdlc', label: 'creates dimensions for' },
    ],
  },
  {
    slug: 'review-receive-sdlc',
    command: '/review-receive-sdlc',
    category: 'review',
    userInvocable: true,
    tagline: 'Responds to code review feedback with a dual self-critique gate that prevents blind implementation of incorrect suggestions.',
    pipeline: [
      { id: 'load-feedback', label: 'Load review feedback', type: 'script', description: 'Reads findings from context, pasted comments, or fetches PR comments via gh' },
      { id: 'verify-claims', label: 'Verify reviewer claims', type: 'verify', description: 'Reads the actual code referenced in each finding before forming a response' },
      { id: 'evaluate', label: 'Evaluate suggestions', type: 'critique', description: 'First critique gate: assess whether each suggestion is technically correct' },
      { id: 'self-critique', label: 'Self-critique response', type: 'critique', description: 'Second critique gate: review drafted responses for performative agreement or blind compliance' },
      { id: 'implement', label: 'Implement accepted fixes', type: 'llm', description: 'Applies accepted findings in priority order' },
      { id: 'post-replies', label: 'Post thread replies', type: 'script', description: 'Posts in-thread responses to reviewer comment threads via gh api' },
    ],
    connections: [
      { to: 'review-sdlc', label: 'responds to findings from' },
      { to: 'pr-sdlc', label: 'addresses review on PR from' },
    ],
  },
  {
    slug: 'commit-sdlc',
    command: '/commit-sdlc',
    category: 'gitops',
    userInvocable: true,
    tagline: 'Generates a commit message matching the project style, stashes unstaged changes automatically, and restores them after.',
    pipeline: [
      { id: 'stash', label: 'Stash unstaged changes', type: 'script', description: 'Stashes unstaged tracked-file changes to keep the working tree clean during commit' },
      { id: 'analyze-diff', label: 'Analyze staged diff', type: 'llm', description: 'Inspects staged changes and recent commit history to detect project commit style' },
      { id: 'generate-message', label: 'Generate commit message', type: 'llm', description: 'Produces a conventional commit (or project-style) message from the diff analysis' },
      { id: 'review-confirm', label: 'Review & confirm', type: 'user', description: 'Presents message and summary; accepts yes/edit/cancel' },
      { id: 'commit', label: 'Execute commit', type: 'script', description: 'Runs git commit (or git commit --amend) with the approved message' },
      { id: 'restore', label: 'Restore stash', type: 'script', description: 'Pops the stash to restore the working tree to its previous state' },
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
      { id: 'detect-account', label: 'Detect GitHub account', type: 'script', description: 'Selects the correct gh account for the repo when multiple accounts are authenticated' },
      { id: 'analyze-branch', label: 'Analyze branch commits', type: 'script', description: 'Reads all commits and the full diff since the base branch' },
      { id: 'generate-description', label: 'Generate PR description', type: 'llm', description: 'Fills the PR template (default 8-section or .claude/pr-template.md) from the analysis' },
      { id: 'review-confirm', label: 'Review & confirm', type: 'user', description: 'Presents title and description; accepts yes/edit/cancel before creating' },
      { id: 'create-pr', label: 'Create or update PR', type: 'script', description: 'Runs gh pr create or gh pr edit to open/update the PR' },
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
      { id: 'scan-conventions', label: 'Scan PR conventions', type: 'script', description: 'Reads existing GitHub PR templates, recent PR patterns, and Jira usage from commits' },
      { id: 'propose-template', label: 'Propose template', type: 'llm', description: 'Generates a tailored starter template based on detected conventions' },
      { id: 'interactive-edit', label: 'Interactive editing', type: 'user', description: 'User accepts, edits sections, or starts fresh' },
      { id: 'save-template', label: 'Save template', type: 'script', description: 'Writes final template to .claude/pr-template.md' },
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
      { id: 'detect-version', label: 'Detect version source', type: 'script', description: 'Reads .claude/version.json; auto-detects version file (package.json, Cargo.toml, etc.) on --init' },
      { id: 'infer-bump', label: 'Infer bump type', type: 'llm', description: 'Analyzes conventional commits since last tag to determine major/minor/patch when not specified' },
      { id: 'release-plan', label: 'Present release plan', type: 'user', description: 'Shows version change, tag, file, push target, changelog flag; waits for approval' },
      { id: 'bump-file', label: 'Bump version file', type: 'script', description: 'Updates the version field in-place in the configured version file' },
      { id: 'changelog', label: 'Generate CHANGELOG', type: 'llm', description: 'Produces a Keep a Changelog entry from commits since the last tag (--changelog only)' },
      { id: 'tag-push', label: 'Tag & push', type: 'script', description: 'Creates an annotated git tag and pushes tag and commit to origin' },
    ],
    connections: [
      { to: 'pr-sdlc', label: 'follows PR merge in' },
      { to: 'commit-sdlc', label: 'follows commits from' },
    ],
  },
  {
    slug: 'jira-sdlc',
    command: '/jira-sdlc',
    category: 'integrations',
    userInvocable: true,
    tagline: 'Manages Jira issues via Atlassian MCP with a project metadata cache that reduces most operations to a single MCP call.',
    pipeline: [
      { id: 'resolve-project', label: 'Resolve project key', type: 'script', description: 'Auto-detects project key from git branch or .claude/jira-config.json' },
      { id: 'load-cache', label: 'Load project cache', type: 'script', description: 'Reads .claude/jira-cache/<KEY>.json; runs 5-phase init on first use or --force-refresh' },
      { id: 'parse-intent', label: 'Parse user intent', type: 'llm', description: 'Interprets the natural-language request into a Jira operation with resolved field IDs' },
      { id: 'apply-template', label: 'Apply issue template', type: 'llm', description: 'Fills the issue description using the matching issue type template' },
      { id: 'execute-op', label: 'Execute Jira operation', type: 'script', description: 'Calls the Atlassian MCP tool for create/edit/transition/comment/search' },
      { id: 'cache-refresh', label: 'Auto-refresh cache', type: 'script', description: 'Detects stale cache on operation failure; rebuilds and retries automatically' },
    ],
    connections: [
      { to: 'pr-sdlc', label: 'create PR after story' },
      { to: 'review-sdlc', label: 'review before closing task' },
    ],
  },
];

export function getSkillMeta(slug: string): SkillMeta | undefined {
  return skillsMeta.find(s => s.slug === slug);
}

export function getSkillsByCategory(category: SkillCategory): SkillMeta[] {
  return skillsMeta.filter(s => s.category === category);
}
