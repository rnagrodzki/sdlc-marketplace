# Plan Template (Custom)

Project-specific override of the default `plan-sdlc` template. Adds a `## Security Impact` section
and drops `## Research Findings`, which this project tracks separately in its security review
process.

## Required Sections
- Context <!-- narrative: true -->
- Deviations & assumptions
- Key Decisions <!-- narrative: true -->
- Security Impact <!-- narrative: true -->
- Final Shape <!-- narrative: true -->
- Tasks
- Verification Scorecard
- OpenSpec Appendix <!-- conditional: source matches openspec/changes/ -->
- Contract Examples

## Discovery Questions

Questions the Step 1 exploration phase answers before decomposition begins; the answers become the
`## Context` section.
- What problem does this change solve?
- What prompted this change now?
- What does success look like?

## Verification Patterns

Verification approaches a plan's tasks should draw from when filling in each task's `**Verify:**`
field and the `## Verification Scorecard`.
- Run existing test suite for regression
- Verify new checks against fixtures
