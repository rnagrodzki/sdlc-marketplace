#!/bin/bash
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git remote add origin git@github.com:test-user/test-repo.git
git commit -q --allow-empty -m "init"
