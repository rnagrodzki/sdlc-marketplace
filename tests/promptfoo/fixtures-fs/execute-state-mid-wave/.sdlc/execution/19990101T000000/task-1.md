# Task 1: orphaned fact sheet

This per-run directory has no matching `execute-*.json` state file, so its
run id is absent from `reapRunDirectories`' liveRunIds set. `setup.sh`
backdates the directory mtime, which makes `gc` classify it as
`stale+state-file-gone` and delete it.
