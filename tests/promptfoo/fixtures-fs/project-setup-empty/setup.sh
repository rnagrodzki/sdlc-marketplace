#!/bin/bash
git init -q
git config user.email "test@test.com"
git config user.name "Test"
git commit -q --allow-empty -m "init"
