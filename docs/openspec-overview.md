# OpenSpec Overview

OpenSpec is an AI-native spec-driven development (SDD) framework. It solves a fundamental problem in AI-assisted development: AI coding assistants jump straight to implementation without establishing a shared understanding of requirements, constraints, and design decisions. The result is code that drifts from intent, misses edge cases, and requires expensive rework. OpenSpec inserts a lightweight specification layer between intent and implementation where human and AI agree on proposal, specs, design, and tasks before any code is written.

The framework follows four philosophical principles. It is **fluid, not rigid** -- specs evolve with the project rather than becoming stale artifacts. It is **iterative, not waterfall** -- you can move through the artifact chain at your own pace, circling back as understanding deepens. It is **easy, not complex** -- the default workflow is three commands end-to-end. And it is **brownfield-first** -- OpenSpec is designed for existing codebases with real constraints, not greenfield idealism.

OpenSpec works by maintaining a living specification directory alongside your code. Changes are proposed as isolated deltas against those specs, reviewed and refined through a dependency chain of artifacts, and merged back once implementation is complete. This keeps the spec directory as an always-current source of truth for how the system behaves.

---

## Installation & Setup

Install globally via your preferred package manager:

```bash
npm install -g @fission-ai/openspec@latest
# or
pnpm add -g @fission-ai/openspec@latest
# or
yarn global add @fission-ai/openspec@latest
# or
bun add -g @fission-ai/openspec@latest
```

**Requires Node.js >= 20.19.0.**

Initialize OpenSpec in your project:

```bash
openspec init
```

This creates the following directory structure:

```
openspec/
  specs/           # Source of truth -- how the system currently behaves
  changes/         # Proposed modifications -- one folder per change
    archive/       # Completed changes
  config.yaml      # Project configuration
  schemas/         # Custom workflow schemas (optional)
```

---

## Core Concepts

### Specs

Specs are the source of truth for how your system behaves. They live in `openspec/specs/` and describe current system behavior using structured requirements language.

Specs use RFC 2119 keywords (SHALL, MUST, SHOULD, MAY) for requirement levels and Given/When/Then scenarios for behavioral descriptions.

```markdown
# Auth Specification

## Purpose
Authentication and session management.

## Requirements

### Requirement: User Authentication
The system SHALL issue a JWT token upon successful login.

#### Scenario: Valid credentials
- GIVEN a user with valid credentials
- WHEN the user submits login form
- THEN a JWT token is returned
```

### Delta Specs

Delta specs represent how a change modifies existing specifications. Rather than rewriting entire spec files, delta specs use explicit markers -- ADDED, MODIFIED, REMOVED, and RENAMED sections -- to describe what changes.

Delta specs are isolated within a change folder during development. When the change is archived, the deltas merge into the main `specs/` directory. This is the key innovation for brownfield projects: you never need to write specs for your entire system upfront. You only spec the parts you are changing, and the spec directory grows organically over time.

### Changes

A change lives in `openspec/changes/<name>/` and contains four artifacts that form a dependency chain:

| Artifact | File | Purpose |
|---|---|---|
| **Proposal** | `proposal.md` | Why and what -- intent, scope, approach |
| **Specs** | `specs/` | Delta specs showing requirements changes |
| **Design** | `design.md` | How -- technical approach, architecture decisions |
| **Tasks** | `tasks.md` | Implementation checklist derived from specs and design |

The dependency chain is: **proposal -> specs -> design -> tasks -> implement**. Each artifact builds on the previous one, ensuring implementation traces back to intent.

### Schemas

Schemas define the artifact workflow for a change -- which artifacts exist, what they generate, and their dependency order. The built-in default schema is `spec-driven`:

```yaml
name: spec-driven
artifacts:
  - id: proposal
    generates: proposal.md
    requires: []
  - id: specs
    generates: specs/
    requires: [proposal]
  - id: design
    generates: design.md
    requires: [specs]
    apply-required: false
  - id: tasks
    generates: tasks.md
    requires: [specs]
    apply-required: true
```

The `apply-required` field controls whether an artifact must exist before implementation can begin. In the default schema, tasks are required but design is optional.

Custom schemas can be forked from existing ones or created from scratch. This allows teams to add phases (e.g., research, security review) or remove ones they do not need.

### Archive

When a change is complete, archiving moves it to `openspec/changes/archive/YYYY-MM-DD-<name>/` and merges its delta specs into the main `specs/` directory. This keeps the specs directory as an accurate reflection of the current system while preserving the full change history.

---

## Slash Commands (AI Assistant)

OpenSpec provides slash commands for use within AI coding assistants. The available commands depend on the active profile.

### Core Profile (default)

| Command | Purpose |
|---|---|
| `/opsx:propose <name>` | Create a change and generate all planning artifacts in one step |
| `/opsx:explore [topic]` | Investigate ideas, compare approaches before committing to a change |
| `/opsx:apply [name]` | Implement tasks from the change (reads tasks.md, executes them) |
| `/opsx:archive [name]` | Archive completed change -- merges delta specs into main specs |

### Expanded Profile

Enabled via `openspec config profile`. Adds granular control over the artifact lifecycle:

| Command | Purpose |
|---|---|
| `/opsx:new <name>` | Scaffold a new change folder (no artifacts generated yet) |
| `/opsx:continue [name]` | Create the next artifact in the dependency chain |
| `/opsx:ff [name]` | Fast-forward: create ALL planning artifacts at once |
| `/opsx:verify [name]` | Validate that implementation matches artifacts/specs |
| `/opsx:sync [name]` | Merge delta specs into main specs without archiving |
| `/opsx:bulk-archive` | Archive multiple completed changes, resolving spec conflicts |
| `/opsx:onboard` | Interactive guided tutorial using your actual codebase |

---

## CLI Commands (Terminal)

### Setup

| Command | Description |
|---|---|
| `openspec init [path]` | Initialize OpenSpec in a project. Options: `--tools`, `--force`, `--profile` |
| `openspec update` | Regenerate skills/commands after config changes |

### Browsing

| Command | Description |
|---|---|
| `openspec list` | Browse changes and specs |
| `openspec view` | Interactive dashboard |
| `openspec show <item>` | Read specific content (a change, spec, or artifact) |

### Validation

| Command | Description |
|---|---|
| `openspec validate` | Check for structural issues. Options: `--all`, `--json` |

### Lifecycle

| Command | Description |
|---|---|
| `openspec archive` | Finalize changes from the CLI |

### Workflow Support

Agent-compatible commands. All support `--json` for structured output.

| Command | Description |
|---|---|
| `openspec status` | Artifact completion status for the current change |
| `openspec instructions` | AI-readable next-step instructions |
| `openspec templates` | Find template file paths |
| `openspec schemas` | List available schemas |

### Schema Management

| Command | Description |
|---|---|
| `openspec schema init <name>` | Create a new schema from scratch |
| `openspec schema fork <source> <name>` | Fork an existing schema |
| `openspec schema validate [name]` | Validate schema structure |
| `openspec schema which` | Show which schema is active |

### Configuration

| Command | Description |
|---|---|
| `openspec config` | View current configuration |
| `openspec config edit` | Open config in editor |
| `openspec config profile` | Change delivery mode and workflow selection |

### Utility

| Command | Description |
|---|---|
| `openspec feedback <message>` | Submit feedback |
| `openspec completion install` | Install shell completion |

---

## Workflow Patterns

### Quick Path (Core Profile)

The simplest end-to-end workflow. Three commands from idea to archived change:

```
/opsx:propose <name>  -->  /opsx:apply  -->  /opsx:archive
```

### Exploratory

When you need to investigate before committing to an approach:

```
/opsx:explore <topic>  -->  /opsx:propose <name>  -->  /opsx:apply  -->  /opsx:archive
```

### Full Control (Expanded Profile)

Step through each artifact individually with review between steps:

```
/opsx:new <name>  -->  /opsx:continue (repeat)  -->  /opsx:apply  -->  /opsx:verify  -->  /opsx:archive
```

### Speed Run (Expanded Profile)

Generate all planning artifacts at once, then implement and verify:

```
/opsx:new <name>  -->  /opsx:ff  -->  /opsx:apply  -->  /opsx:verify  -->  /opsx:archive
```

---

## Configuration

OpenSpec is configured via `openspec/config.yaml`. The file controls schema selection, contextual information, and behavioral rules.

```yaml
schema: spec-driven

context: |
  Tech stack: TypeScript, Next.js, PostgreSQL
  API style: RESTful
  Testing: Jest + React Testing Library

rules:
  proposal:
    - Include rollback plan
    - Identify affected teams
  specs:
    - Use Given/When/Then format
  design:
    - Include sequence diagrams
  tasks:
    - Group by component
```

The `context` field is a free-form string block injected into all artifact prompts. The `rules` field is keyed per artifact type, constraining how the AI generates each one.

### Profile and Delivery Options

**Profile** controls which slash commands are available:
- `core` -- minimal set (propose, explore, apply, archive)
- Custom profiles enabled via `openspec config profile`

**Delivery** controls how commands are surfaced to AI tools:
- `skills` -- generates skill files only
- `commands` -- generates command files only
- `both` -- generates both skills and commands

### Schema Resolution Order

When determining which schema to use for a change:

1. CLI flag (explicit `--schema` argument)
2. Change metadata (schema specified in the change folder)
3. Project config (`schema` field in `config.yaml`)
4. Default (`spec-driven`)

---

## Customization

OpenSpec supports three levels of customization, from lightweight to fully bespoke.

### Level 1: Project Config

Inject context and rules into `config.yaml`. This shapes how the AI generates artifacts without changing the workflow structure.

### Level 2: Custom Schemas

Fork an existing schema and modify it:

```bash
openspec schema fork spec-driven my-team-workflow
```

This creates `openspec/schemas/my-team-workflow.yaml` which you can edit. For example, adding a research phase before the proposal:

```yaml
name: my-team-workflow
artifacts:
  - id: research
    generates: research.md
    requires: []
  - id: proposal
    generates: proposal.md
    requires: [research]
  - id: specs
    generates: specs/
    requires: [proposal]
  - id: design
    generates: design.md
    requires: [specs]
    apply-required: false
  - id: tasks
    generates: tasks.md
    requires: [specs]
    apply-required: true
```

### Level 3: Global Overrides

For organization-wide standards, schemas and configuration can be shared across projects. Create schemas from scratch with `openspec schema init <name>` for workflows that diverge significantly from the built-in default.

---

## AI Tool Integration

OpenSpec generates tool-specific configuration files so that AI coding assistants can discover and invoke its commands.

**Claude Code** receives:
- `.claude/skills/openspec-*/SKILL.md` -- skill definitions
- `.claude/commands/opsx/<id>.md` -- command definitions

After changing your profile or delivery settings, regenerate these files:

```bash
openspec update
```

**Supported tools** (25+): Claude Code, Cursor, Windsurf, GitHub Copilot, Gemini CLI, Amazon Q, Cline, Codex, Continue, Kiro, RooCode, and more. Each tool receives configuration in its native format.

---

## See Also

- [OpenSpec + SDLC Handover Workflow](openspec-sdlc-handover.md) -- how OpenSpec and SDLC utilities work together
- [OpenSpec Integration (Technical Reference)](openspec-integration.md) -- technical details on integrating OpenSpec with the SDLC plugin
