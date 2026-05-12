#!/bin/bash
# Fixture for lib-worktree-exec.yaml — resolveMainWorktreeSafe from non-git cwd.
# This is NOT a git repo — the safe variant should return cwd as fallback.
# No git init intentionally.
mkdir -p not-a-git-dir
echo "not-git" > not-a-git-dir/marker.txt
