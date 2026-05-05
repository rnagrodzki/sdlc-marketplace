#!/bin/bash
# Project with pr.labels.mode=off — section-menu summary should render
# `[set]` and `off — no automatic labels` (issue #205 regression guard).
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "init"
