#!/usr/bin/env node
/**
 * run-await-remote-review-evaluate.js
 *
 * Test driver for the pure helper `evaluateReviews` exported by
 * plugins/sdlc-utilities/scripts/skill/await-remote-review.js.
 *
 * Usage:
 *   node run-await-remote-review-evaluate.js --reviews '<json>' --reviewers '<csv>'
 *
 * Stdout: single JSON line with the verdict shape:
 *   {"status":"<actionable|approved-clean|null>","matchState":"<string>","matchLogin":"<string>"}
 *
 * Returns null in `match` keys when no review matched.
 */

'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const AR        = path.join(REPO_ROOT, 'plugins', 'sdlc-utilities', 'scripts', 'skill', 'await-remote-review.js');

function getArg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

const reviewsArg   = getArg('--reviews');
const reviewersArg = getArg('--reviewers');

const { evaluateReviews } = require(AR);

let reviews;
try { reviews = reviewsArg ? JSON.parse(reviewsArg) : []; } catch (e) { reviews = []; }

const reviewers = (reviewersArg || '').split(',').map((s) => s.trim()).filter(Boolean);

const verdict = evaluateReviews(reviews, reviewers);

const out = {
  status: verdict.status,
  matchState: verdict.match ? verdict.match.state : null,
  matchLogin: verdict.match ? verdict.match.authorLogin : null,
  matchSubmittedAt: verdict.match ? verdict.match.submittedAt : null,
};

process.stdout.write(JSON.stringify(out) + '\n');
