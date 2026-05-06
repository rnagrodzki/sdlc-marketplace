<!-- 
  Skill Specification Template
  
  Three-layer relationship:
  - Spec (docs/specs/<name>.md)  — WHAT the skill must do (behavioral contract, testable requirements)
  - SKILL.md (plugins/.../skills/<name>/SKILL.md) — HOW the skill does it (implementation steps, prompts, tool usage)
  - Docs (docs/skills/<name>.md) — Usage reference for end users (flags, examples, prerequisites)
  
  The spec is the source of truth. Changes to SKILL.md must reference spec requirement numbers.
  New skills need an accepted spec before writing SKILL.md.
  
  Prefix legend:
    R = Core Requirement    A = Argument       G = Quality Gate
    P = Prepare Contract    E = Error Handling  C = Constraint
    I = Integration
  
  Omit sections that have no entries (e.g., no prepare script → omit Prepare Script Contract).
-->

# <skill-name> Specification

> One-line purpose statement describing what this skill does and why it exists.

**User-invocable:** yes | no
**Model:** haiku | sonnet | opus
**Prepare script:** `<name>.js` | none

## Arguments

<!-- List every flag and positional argument the skill accepts. -->

- A1: `--flag` — behavior description (default: value)

## Core Requirements

<!-- Testable behavioral requirements. Each must be verifiable — if you can't write a test assertion for it, it's too vague. Focus on WHAT, not HOW. -->
<!-- MANDATORY when Prepare script is not "none" — include the following as the last R-item:
- R[N]: Prepare script output is the single authoritative source for all contracted fields (P-fields) — script-provided values take unconditional precedence over skill-generated content, and all factual context (git state, config, flags, metadata) must originate from script output to ensure deterministic behavior
-->

- R1: [Testable behavioral requirement]
- R2: [Testable behavioral requirement]

## Workflow Phases

<!-- Name the phases the skill follows. Describe what each phase accomplishes, not the step-by-step procedure (that belongs in SKILL.md).
     When a phase executes a script, add indented sub-items documenting the execution:
       - **Script:** `script-name.js` (or `script-name.js --subcommand` for multi-mode scripts)
       - **Params:** reference A-fields forwarded + any internal params
       - **Output:** JSON → P-field range (brief summary of key fields)
     Phases that do not execute scripts have no sub-items. -->

1. CONSUME — [what inputs are consumed and validated]
   - **Script:** `example-prepare.js`
   - **Params:** A1-A3 forwarded (`--flag1`, `--flag2`, `--flag3`)
   - **Output:** JSON → P1-P5 (field summary)
2. DO — [what transformation or action is performed]

## Quality Gates

<!-- Pass/fail criteria that must hold before the skill reports success. -->

- G1: [Gate name] — [pass/fail criteria]

## Prepare Script Contract

<!-- Output fields from the prepare script that the skill depends on. This is an interface boundary — if the script changes output shape, the skill breaks. -->

- P1: `fieldName` (type) — [what the skill uses this field for]

## Error Handling

<!-- How the skill behaves under specific failure conditions. -->

- E1: [condition] → [behavior]

## Constraints

<!-- What the skill must NOT do. Explicit prohibitions. -->
<!-- MANDATORY when Prepare script is not "none" — include the following four constraints (renumber to follow existing C-items):
- C[N]:   Must not skip, bypass, or defer prepare script execution — the script must run and exit successfully before any skill phase begins
- C[N+1]: Must not override, reinterpret, or discard prepare script output — for every P-field, the script return value is authoritative and final; the skill must not substitute LLM-generated alternatives
- C[N+2]: Must not independently compute, infer, or fabricate values for any field the prepare script is contracted to provide — if the script fails or a field is absent, the skill must stop rather than fill in data
- C[N+3]: Must not re-derive data the prepare script already computes via shell commands, tool calls, or LLM inference — script output is the sole source for all factual context, preserving deterministic behavior
-->

- C1: [What the skill must not do]

## Integration

<!-- How this skill interacts with other skills, tools, or external systems. -->

- I1: [Other skill/tool] — [nature of interaction]
