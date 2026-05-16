#!/usr/bin/env node
/**
 * run-received-review-manifest-fields.js
 * Test harness that exercises the plugin_version and reply_footer fields
 * computed by received-review.js (issue #363) without invoking gh API or git.
 *
 * Directly calls getPluginVersion() from config-version.js and reproduces the
 * same manifest field computation as received-review.js after Task 1 and Task 4.
 *
 * Usage:
 *   node run-received-review-manifest-fields.js --field <plugin_version|reply_footer>
 *
 * Output:
 *   The raw value of the requested field (string, not JSON-encoded).
 *   For plugin_version: the version string or 'unknown'.
 *   For reply_footer: the full footer string including leading newlines.
 */

'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const configVersionPath = path.join(
  REPO_ROOT,
  'plugins',
  'sdlc-utilities',
  'scripts',
  'lib',
  'config-version.js'
);

const { getPluginVersion } = require(configVersionPath);

const argv = process.argv.slice(2);
let field = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--field' && argv[i + 1]) field = argv[++i];
}

if (!field) {
  process.stderr.write('Usage: run-received-review-manifest-fields.js --field <plugin_version|reply_footer>\n');
  process.exit(1);
}

const pluginVersion = getPluginVersion();
// Format mirrors the production source: plugins/sdlc-utilities/scripts/skill/received-review.js
// (the `reply_footer` field in the manifest). If the format changes there, update here too.
const replyFooter = '\n\n_via `received-review-sdlc` v' + pluginVersion + '_';

if (field === 'plugin_version') {
  process.stdout.write(pluginVersion);
} else if (field === 'reply_footer') {
  process.stdout.write(replyFooter);
} else {
  process.stderr.write('Unknown field: ' + field + '\n');
  process.exit(1);
}
