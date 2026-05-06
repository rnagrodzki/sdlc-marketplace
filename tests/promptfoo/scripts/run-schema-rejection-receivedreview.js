#!/usr/bin/env node
/**
 * run-schema-rejection-receivedreview.js
 * Test harness asserting that schemas/sdlc-config.schema.json structurally
 * rejects a `receivedReview` property at the top level (issue #233, R19).
 *
 * The project schema must:
 *   1. Have top-level `additionalProperties: false` (a precondition).
 *   2. NOT declare `receivedReview` under top-level `properties` — this would
 *      legitimize project-level configuration of the field, contradicting R19
 *      (which requires `.sdlc/local.json` exclusively).
 *
 * This is a structural assertion — we do not invoke a JSON Schema validator
 * because the project does not depend on `ajv` at runtime. The combination of
 * (1) and (2) is what causes a real validator (e.g., the JSON Schema Web UI,
 * or a CI-installed `ajv-cli`) to reject `{ receivedReview: {...} }` in the
 * project config.
 *
 * Output (stdout, JSON):
 *   {
 *     "topLevelAdditionalPropertiesFalse": true|false,
 *     "receivedReviewDeclaredInProjectSchema": true|false,
 *     "rejectsReceivedReviewAtProjectLevel": true|false  // (1) AND NOT (2)
 *   }
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const projectSchemaPath = path.join(REPO_ROOT, 'schemas', 'sdlc-config.schema.json');

const schema = JSON.parse(fs.readFileSync(projectSchemaPath, 'utf8'));

const topLevelAdditionalPropertiesFalse = schema.additionalProperties === false;
const receivedReviewDeclaredInProjectSchema =
  Object.prototype.hasOwnProperty.call(schema.properties || {}, 'receivedReview');

const result = {
  topLevelAdditionalPropertiesFalse,
  receivedReviewDeclaredInProjectSchema,
  rejectsReceivedReviewAtProjectLevel:
    topLevelAdditionalPropertiesFalse && !receivedReviewDeclaredInProjectSchema,
};

process.stdout.write(JSON.stringify(result) + '\n');
