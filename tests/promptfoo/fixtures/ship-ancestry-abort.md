# Ship — post-version ancestry HARD GATE (R-post-version-ancestry, fixes #349)

## Scenario

ship-sdlc is running a pipeline in `--workspace branch` mode. The feature branch is
`feat/my-feature`. The version step ran successfully and emitted tag `v1.2.3`.

## Shell context at the time of the ancestry check

```
EXECUTE_BRANCH=feat/my-feature
NEW_TAG=v1.2.3
```

## verify-tag-ancestry.js output (exit code 1)

```json
{
  "ok": false,
  "tag": "v1.2.3",
  "branch": "feat/my-feature",
  "branchRef": "feat/my-feature",
  "message": "Tag 'v1.2.3' is not an ancestor of 'feat/my-feature'. The release commit landed on a different branch. Delete the tag (git push origin :refs/tags/v1.2.3; git tag -d v1.2.3) and re-run version step on the correct branch."
}
```

## Expected ship-sdlc behavior

According to `skills/ship-sdlc/SKILL.md` (section "After version — post-version ancestry
HARD GATE"), when `ANCESTRY_EXIT` is non-zero:

1. Print an error to stderr: "Pipeline halted: tag v1.2.3 is not an ancestor of feat/my-feature."
2. Print the remediation: "Remediation: delete the tag (git push origin :refs/tags/v1.2.3; git tag -d v1.2.3) and re-run version step on the correct branch."
3. Exit with code 1 — do NOT proceed to the pr step.
