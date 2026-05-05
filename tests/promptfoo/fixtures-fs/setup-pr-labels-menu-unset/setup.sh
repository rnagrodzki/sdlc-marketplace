#!/bin/bash
# Project with no pr.labels block — section-menu summary should render
# `[not set]` (issue #205 regression guard: must NOT show "not configured").
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git add -A
git commit -q -m "init"
