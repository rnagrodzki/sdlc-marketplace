#!/bin/bash
# Project with pr.labels.mode=rules and one rule — section-menu summary
# should render `[set]` and `rules: 1 rule` (issue #205 regression guard).
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "init"
