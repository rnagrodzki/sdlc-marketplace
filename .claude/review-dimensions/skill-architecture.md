---
name: skill-architecture
description: "Reviews skill, command, and agent definitions for structural consistency, cross-references, and adherence to architecture principles"
triggers:
  - "**/skills/**/SKILL.md"
  - "**/commands/*.md"
  - "**/agents/*.md"
  - "**/skills/**/REFERENCE.md"
  - "**/skills/**/EXAMPLES.md"
skip-when:
  - "**/node_modules/**"
  - "docs/**"
severity: high
model: opus
---

# Skill Architecture Review

Review skill definitions (SKILL.md), command files, and agent definitions for structural consistency and adherence to this project's architecture principles. These files are the core product — they define AI agent behavior and workflows.

## Architecture Principles to Verify

This project mandates (from AGENTS.md):
1. **Spec-driven development** — design before implementation
2. **Plan - Critique - Improve - Do - Critique - Improve** — mandatory dual critique gates in every pipeline
3. **Cache-first incremental scanning** — snapshot hashing where applicable
4. **Parallel execution** — independent steps must run concurrently
5. **Self-learning directives** — learnings flow into `.claude/learnings/log.md`
6. **Specificity over generics** — every skill targets a concrete task

## Checklist

- [ ] Skill has clear, descriptive name and description in frontmatter/header
- [ ] Workflow steps are numbered and follow a logical sequence
- [ ] Multi-step skills include Plan-Critique-Improve gates (not just Plan-Do)
- [ ] Cross-references to other skills/commands use correct paths and names (e.g., `See Also` sections)
- [ ] Skills that produce output define explicit output format
- [ ] Commands properly delegate to their corresponding skill
- [ ] Agent definitions specify clear role, constraints, and output format
- [ ] Learning capture sections reference `.claude/learnings/log.md` correctly
- [ ] Glob patterns used for file discovery (e.g., `**/scripts/*.js`) are valid and specific
- [ ] Independent steps within a workflow are marked for parallel execution
- [ ] Error handling steps specify what to do on failure (exit codes, user messages)
- [ ] REFERENCE.md and EXAMPLES.md files are consistent with their parent SKILL.md
- [ ] Within a single SKILL.md, gate conditions for the same behavioral concept (e.g., 'draft artifact' at one step vs 'write artifact' at a later step) use identical condition phrasing and reference the same field. Divergent phrasings for the same concept are flagged.

## Severity Guide

| Finding | Severity |
|---------|----------|
| Missing critique gate in a multi-step pipeline | high |
| Broken cross-reference (wrong skill name or path) | high |
| Command does not delegate to its skill | high |
| Missing error handling for script invocations | high |
| Inconsistent output format between skill and its reference | medium |
| Missing See Also / Learning Capture section | medium |
| Steps that could run in parallel are sequential | medium |
| Vague or generic instructions (not project-specific) | medium |
| Minor formatting inconsistency | low |
| Missing description in frontmatter | low |
| Two or more gates for the same concept use different conditions (e.g., one says `flags.X === true`, another says `config.X === true`, another says "if X is enabled") | high |
