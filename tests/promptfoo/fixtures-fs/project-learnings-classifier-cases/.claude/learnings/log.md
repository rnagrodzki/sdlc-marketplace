# Learnings Log

Append-only learnings log.

## 2026-05-01 — pr-sdlc: PR #42 opened for feat/add-auth — merged successfully
Operational release note. PR opened, review passed, merged to main.

## 2026-05-02 — version-sdlc: v0.19.0 released — changelog generated
Version bump to 0.19.0. Changelog updated. Tag pushed.

## 2026-05-03 — ship-sdlc: ship pipeline complete for feat/add-auth
Ship pipeline ran: execute → commit → review → pr. All steps passed.

## 2026-05-04 — setup-sdlc: SSH alias resolution fails when IdentityFile absent
When ~/.ssh/config has a Host block without an IdentityFile line, the SSH
alias resolver throws. Fixed by checking for undefined before reading the field.
Fixes #100

## 2026-05-05 — setup-sdlc: worktree creation race on concurrent runs
Two concurrent worktree-create invocations can pick the same directory name.
Added a lock file to serialize. See abc1234567890abcdef1234567890abcdef12345

## 2026-05-06 — setup-sdlc: PR #999 open — still investigating
The fix for this issue is proposed in https://github.com/owner/repo/pull/999 but
it is not yet merged. Keeping this entry until the fix lands.

## 2026-05-07 — setup-sdlc: real bug with no fix reference
This is a genuine bug that has not been fixed yet. No SHA or PR reference.
It should be classified as draft.

## Tracked in GH Issues
