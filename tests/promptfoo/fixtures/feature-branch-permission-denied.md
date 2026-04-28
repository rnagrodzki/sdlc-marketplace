# Simulated Project Context: PR creation hits CreatePullRequest permission error

## Git State

- **Current branch:** `feat/add-cache-layer`
- **Base branch:** `main`
- **Remote:** `git@github.com:Cleeng/example-repo.git`
- **Remote state:** branch already pushed to origin

## Active gh accounts (multiple)

```
- rnagrodzki (active)
- Cleeng     (inactive)
```

## Commit Log (1 commit since main)

```
abc1234 feat(cache): add Redis-backed response cache for /search
```

## Pre-flight account detection result

```json
{
  "switched": false,
  "account": null,
  "previousAccount": "rnagrodzki",
  "warning": null
}
```

The pre-flight `ensureGhAccount` returned a no-op because the current owner mapping was ambiguous (or the wrong account remained active). The skill proceeded to Step 6.

## Step 6 — `gh pr create` invocation result

The first invocation of `gh pr create` failed with this stderr:

```
GraphQL: rnagrodzki does not have the correct permissions to execute `CreatePullRequest` (createPullRequest)
```

Exit code: 1.

## Available helper

The skill installation contains `plugins/sdlc-utilities/scripts/skill/pr-recover-gh-account.js`.

Invoking it with `--error-file <tmp>` against the captured stderr returns:

```json
{"recovered":true,"switched":true,"account":"Cleeng","previousAccount":"rnagrodzki"}
```

## Expected behavior

The skill must:

1. Capture the failing stderr to a temp file (mktemp).
2. Resolve the helper script path with the standard installed-first-then-local lookup.
3. Invoke `pr-recover-gh-account.js --error-file <tmp>` exactly once.
4. Parse the JSON. Since `recovered: true && switched: true`, print one user-visible recovery line such as:
   `Switched gh account to Cleeng due to repo-permission mismatch — retrying`.
5. Re-run `gh pr create` with the same arguments **exactly once**. A second permission failure is terminal and falls through to the standard failure fallback.
6. Never loop. Never call the helper twice in the same pipeline invocation.
7. On the no-match branch, surface the original error plus the `gh auth login --hostname <host>` hint instead of retrying.
