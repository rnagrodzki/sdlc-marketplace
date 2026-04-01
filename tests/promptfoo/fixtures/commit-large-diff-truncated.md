# Commit Context (from commit-prepare.js)

## Branch
feat/update-validation-logic

## Flags
- noStash: false
- scope: null
- type: null
- amend: false
- auto: false

## Staged Changes

**Files (20 total):**
- src/validators/email.js
- src/validators/phone.js
- src/validators/address.js
- src/validators/name.js
- src/validators/date.js
- src/utils/sanitize.js
- src/utils/format.js
- src/utils/parse.js
- src/config/validation-rules.json
- src/config/error-messages.json
- tests/validators/email.test.js
- tests/validators/phone.test.js
- tests/validators/address.test.js
- tests/validators/name.test.js
- tests/validators/date.test.js
- tests/utils/sanitize.test.js
- tests/utils/format.test.js
- tests/utils/parse.test.js
- tests/config/validation-rules.test.js
- docs/validation-api.md

**Diff Stat:**
 src/validators/email.js         | 42 ++++++++++++++++++++++--
 src/validators/phone.js         | 38 ++++++++++++++++++---
 src/validators/address.js       | 35 +++++++++++++++++--
 src/validators/name.js          | 28 +++++++++++++--
 src/validators/date.js          | 31 ++++++++++++++--
 src/utils/sanitize.js           | 22 +++++++++---
 src/utils/format.js             | 18 +++++++---
 src/utils/parse.js              | 15 ++++++--
 src/config/validation-rules.json| 45 ++++++++++++++++++++++++
 src/config/error-messages.json  | 32 +++++++++++++++++
 tests/validators/email.test.js  | 55 +++++++++++++++++++++++++++++
 tests/validators/phone.test.js  | 48 +++++++++++++++++++++++++
 tests/validators/address.test.js| 42 ++++++++++++++++++++++
 tests/validators/name.test.js   | 35 ++++++++++++++++++
 tests/validators/date.test.js   | 38 +++++++++++++++++++++
 tests/utils/sanitize.test.js    | 25 +++++++++++++
 tests/utils/format.test.js      | 20 ++++++++++++
 tests/utils/parse.test.js       | 18 ++++++++++
 tests/config/validation-rules.test.js | 30 +++++++++++++++
 docs/validation-api.md          | 15 ++++++--
 20 files changed, 580 insertions(+), 42 deletions(-)

**Diff Truncated:** true

**Truncated Files (15):**
- src/validators/name.js
- src/validators/date.js
- src/utils/sanitize.js
- src/utils/format.js
- src/utils/parse.js
- src/config/validation-rules.json
- src/config/error-messages.json
- tests/validators/name.test.js
- tests/validators/date.test.js
- tests/utils/sanitize.test.js
- tests/utils/format.test.js
- tests/utils/parse.test.js
- tests/config/validation-rules.test.js
- docs/validation-api.md
- tests/validators/address.test.js

**Included Diff (5 files):**

```diff
diff --git a/src/validators/email.js b/src/validators/email.js
--- a/src/validators/email.js
+++ b/src/validators/email.js
@@ -1,8 +1,42 @@
-function validateEmail(email) {
-  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
+const { sanitizeInput } = require('../utils/sanitize');
+
+const EMAIL_PATTERNS = {
+  standard: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
+  strict: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
+};
+
+function validateEmail(email, options = {}) {
+  const cleaned = sanitizeInput(email);
+  const pattern = options.strict ? EMAIL_PATTERNS.strict : EMAIL_PATTERNS.standard;
+  
+  if (!cleaned || typeof cleaned !== 'string') {
+    return { valid: false, error: 'INVALID_INPUT' };
+  }
+
+  if (cleaned.length > 254) {
+    return { valid: false, error: 'TOO_LONG' };
+  }
+
+  const [local, domain] = cleaned.split('@');
+  if (local && local.length > 64) {
+    return { valid: false, error: 'LOCAL_PART_TOO_LONG' };
+  }
+
+  return {
+    valid: pattern.test(cleaned),
+    normalized: cleaned.toLowerCase(),
+    error: pattern.test(cleaned) ? null : 'INVALID_FORMAT',
+  };
 }
 
-module.exports = { validateEmail };
+module.exports = { validateEmail, EMAIL_PATTERNS };

diff --git a/src/validators/phone.js b/src/validators/phone.js
--- a/src/validators/phone.js
+++ b/src/validators/phone.js
@@ -1,6 +1,38 @@
-function validatePhone(phone) {
-  return /^\+?[\d\s-()]+$/.test(phone);
+const { sanitizeInput } = require('../utils/sanitize');
+
+const PHONE_PATTERNS = {
+  us: /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
+  international: /^\+[1-9]\d{1,14}$/,
+};
+
+function validatePhone(phone, options = {}) {
+  const cleaned = sanitizeInput(phone);
+  const region = options.region || 'international';
+  const pattern = PHONE_PATTERNS[region] || PHONE_PATTERNS.international;
+
+  if (!cleaned) {
+    return { valid: false, error: 'INVALID_INPUT' };
+  }
+
+  const digitsOnly = cleaned.replace(/\D/g, '');
+  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
+    return { valid: false, error: 'INVALID_LENGTH' };
+  }
+
+  return {
+    valid: pattern.test(cleaned),
+    normalized: '+' + digitsOnly,
+    error: pattern.test(cleaned) ? null : 'INVALID_FORMAT',
+  };
 }
 
-module.exports = { validatePhone };
+module.exports = { validatePhone, PHONE_PATTERNS };

diff --git a/src/validators/address.js b/src/validators/address.js
--- a/src/validators/address.js
+++ b/src/validators/address.js
@@ -1,6 +1,35 @@
-function validateAddress(address) {
-  return address && address.street && address.city;
+const { sanitizeInput } = require('../utils/sanitize');
+
+const REQUIRED_FIELDS = ['street', 'city', 'country'];
+
+function validateAddress(address, options = {}) {
+  if (!address || typeof address !== 'object') {
+    return { valid: false, error: 'INVALID_INPUT', fields: {} };
+  }
+
+  const requiredFields = options.requiredFields || REQUIRED_FIELDS;
+  const fields = {};
+  const errors = [];
+
+  for (const field of requiredFields) {
+    const value = sanitizeInput(address[field]);
+    if (!value || value.trim().length === 0) {
+      errors.push({ field, error: 'REQUIRED' });
+      fields[field] = { valid: false, error: 'REQUIRED' };
+    } else {
+      fields[field] = { valid: true, value };
+    }
+  }
+
+  return {
+    valid: errors.length === 0,
+    errors,
+    fields,
+  };
 }
 
-module.exports = { validateAddress };
+module.exports = { validateAddress, REQUIRED_FIELDS };

diff --git a/tests/validators/email.test.js b/tests/validators/email.test.js
--- /dev/null
+++ b/tests/validators/email.test.js
@@ -0,0 +1,55 @@
+const { validateEmail } = require('../../src/validators/email');
+const assert = require('assert');
+
+// Valid emails
+assert.strictEqual(validateEmail('user@example.com').valid, true);
+assert.strictEqual(validateEmail('user+tag@example.com').valid, true);
+assert.strictEqual(validateEmail('user.name@example.co.uk').valid, true);
+
+// Invalid emails
+assert.strictEqual(validateEmail('not-an-email').valid, false);
+assert.strictEqual(validateEmail('@no-local.com').valid, false);
+assert.strictEqual(validateEmail('no-domain@').valid, false);
+assert.strictEqual(validateEmail('').valid, false);
+assert.deepStrictEqual(validateEmail('').error, 'INVALID_INPUT');
+
+// Length limits
+const longLocal = 'a'.repeat(65) + '@example.com';
+assert.strictEqual(validateEmail(longLocal).valid, false);
+assert.strictEqual(validateEmail(longLocal).error, 'LOCAL_PART_TOO_LONG');
+
+// Normalization
+assert.strictEqual(validateEmail('User@Example.COM').normalized, 'user@example.com');
+
+// Strict mode
+assert.strictEqual(validateEmail('user@example.com', { strict: true }).valid, true);
+
+console.log('All email validator tests passed');

diff --git a/tests/validators/phone.test.js b/tests/validators/phone.test.js
--- /dev/null
+++ b/tests/validators/phone.test.js
@@ -0,0 +1,48 @@
+const { validatePhone } = require('../../src/validators/phone');
+const assert = require('assert');
+
+// Valid phones
+assert.strictEqual(validatePhone('+1-555-123-4567').valid, true);
+assert.strictEqual(validatePhone('+44 20 7946 0958').valid, true);
+
+// Invalid phones
+assert.strictEqual(validatePhone('123').valid, false);
+assert.strictEqual(validatePhone('').valid, false);
+assert.deepStrictEqual(validatePhone('').error, 'INVALID_INPUT');
+
+// US format
+assert.strictEqual(validatePhone('(555) 123-4567', { region: 'us' }).valid, true);
+
+// Normalization
+assert.ok(validatePhone('+1-555-123-4567').normalized.startsWith('+'));
+
+console.log('All phone validator tests passed');
```

# --- Truncated ---
# The following 15 file(s) were omitted (see diffStat for summary):
# - src/validators/name.js
# - src/validators/date.js
# - src/utils/sanitize.js
# - src/utils/format.js
# - src/utils/parse.js
# - src/config/validation-rules.json
# - src/config/error-messages.json
# - tests/validators/name.test.js
# - tests/validators/date.test.js
# - tests/utils/sanitize.test.js
# - tests/utils/format.test.js
# - tests/utils/parse.test.js
# - tests/config/validation-rules.test.js
# - docs/validation-api.md
# - tests/validators/address.test.js

## Unstaged Changes
hasChanges: false

## Recent Commits
a1b2c3d feat(validators): add basic validation module structure
b2c3d4e chore: initial project setup
c3d4e5f docs: add README with project overview
d4e5f6g feat(config): add validation rules configuration
e5f6g7h fix(validators): correct email regex edge case
f6g7h8i refactor(utils): extract sanitize utility
g7h8i9j test(validators): add phone validation tests
h8i9j0k feat(validators): add address validation
i9j0k1l chore(deps): update dependencies
j0k1l2m docs: update API documentation

## Commit Config
null
