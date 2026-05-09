// Unit-style wrapper around providers/script-runner.js for testing the
// `script_stub_bin` error branch through the same promptfoo harness.
//
// Why this exists: when the provider returns `{ error }`, promptfoo classifies
// the case as ERROR (not PASS/FAIL), so the standard assertion path can't
// verify the error message text. This wrapper invokes the provider directly
// and prints `result.error` to stdout, allowing a normal `contains` assertion.
const path = require('path');

(async () => {
  // Resolve provider relative to repo root via the first CLI arg
  // (passed by the dataset case via script_args so this works regardless of
  // where the fixture is copied at test time).
  const providerPath = process.argv[2];
  if (!providerPath) {
    process.stdout.write('error-runner: provider path arg is required\n');
    process.exit(1);
  }
  const Provider = require(path.resolve(providerPath));
  const provider = new Provider();
  const result = await provider.callApi('run', {
    vars: {
      script_path: '/dev/null',
      script_stub_bin: '/this/path/intentionally/does/not/exist',
    },
  });
  if (result.error) {
    process.stdout.write(result.error);
    process.exit(0);
  }
  process.stdout.write(`error-runner: expected provider error, got: ${JSON.stringify(result)}\n`);
  process.exit(1);
})();
