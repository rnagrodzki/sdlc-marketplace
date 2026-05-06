#!/bin/bash
# Fixture for git-lib-exec.yaml — issue #239 fetchBaseRef test.
# Initializes a minimal git repo with an *unreachable* origin so that
# `git fetch origin <base>:<base>` fails — fetchBaseRef must NOT throw.
set -e
git init --quiet -b main
git config user.email "test@test.com"
git config user.name "Test"
echo "seed" > seed.txt
git add seed.txt
git commit --quiet -m "init"
# .invalid TLD is reserved by RFC 2606 and never resolves — guarantees fetch failure.
git remote add origin https://no-such-host.invalid/no/such/repo.git
