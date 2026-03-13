---
name: promptfoo-results
description: "Query Promptfoo behavioral test results from the local SQLite database. Use when asked about test results, eval outcomes, failures, what passed or failed, test comparisons, or promptfoo reports."
---

# Promptfoo Results Reader

Query behavioral test results directly from the Promptfoo SQLite database without
launching the web UI. All queries use the `sqlite3` CLI.

## When to Use This Skill

- User asks about test results, eval outcomes, or what passed/failed
- User wants to see recent Promptfoo eval runs
- User wants to drill into specific test failures or grading reasons
- User wants to compare results across multiple eval runs
- After running `promptfoo eval` and wanting a quick summary

## Configuration

```
DB=tests/promptfoo/.promptfoo-data/promptfoo.db
```

Verify the file exists before querying:

```bash
test -f tests/promptfoo/.promptfoo-data/promptfoo.db \
  && echo "DB exists" \
  || echo "DB not found — run: cd tests/promptfoo && promptfoo eval --env-file .env"
```

## Workflow

### Step 1 — List All Eval Runs

```bash
sqlite3 tests/promptfoo/.promptfoo-data/promptfoo.db \
  "SELECT id,
          datetime(created_at/1000, 'unixepoch', 'localtime') AS run_time,
          description
   FROM evals
   ORDER BY created_at DESC;"
```

### Step 2 — Latest Run Summary (Pass/Fail Counts)

```bash
sqlite3 -header -column tests/promptfoo/.promptfoo-data/promptfoo.db \
  "SELECT
     SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS passed,
     SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed,
     COUNT(*) AS total,
     ROUND(AVG(latency_ms)) AS avg_latency_ms,
     ROUND(SUM(cost), 4) AS total_cost
   FROM eval_results
   WHERE eval_id = (SELECT id FROM evals ORDER BY created_at DESC LIMIT 1);"
```

### Step 3 — Per-Test Breakdown

```bash
sqlite3 -header -column tests/promptfoo/.promptfoo-data/promptfoo.db \
  "SELECT
     CASE WHEN success = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
     json_extract(test_case, '$.description') AS test_name,
     score,
     latency_ms
   FROM eval_results
   WHERE eval_id = (SELECT id FROM evals ORDER BY created_at DESC LIMIT 1)
   ORDER BY success ASC, test_idx ASC;"
```

### Step 4 — Drill Into Failures

```bash
sqlite3 -header -column tests/promptfoo/.promptfoo-data/promptfoo.db \
  "SELECT
     json_extract(test_case, '$.description') AS test_name,
     json_extract(grading_result, '$.reason') AS fail_reason,
     substr(response, 1, 400) AS response_preview
   FROM eval_results
   WHERE eval_id = (SELECT id FROM evals ORDER BY created_at DESC LIMIT 1)
     AND success = 0
   ORDER BY test_idx;"
```

For per-assertion detail on a specific failed test:

```bash
sqlite3 tests/promptfoo/.promptfoo-data/promptfoo.db \
  "SELECT json_extract(grading_result, '$.componentResults') AS assertions
   FROM eval_results
   WHERE eval_id = (SELECT id FROM evals ORDER BY created_at DESC LIMIT 1)
     AND success = 0
   LIMIT 1;"
```

`componentResults` is a JSON array. Each element has:
- `pass` — boolean, whether this assertion passed
- `score` — 0 or 1
- `reason` — human-readable explanation
- `assertion.type` — e.g. `icontains`, `regex`, `llm-rubric`
- `assertion.value` — the expected value or rubric text

### Step 5 — Full Response for a Specific Test

```bash
sqlite3 tests/promptfoo/.promptfoo-data/promptfoo.db \
  "SELECT response
   FROM eval_results
   WHERE eval_id = (SELECT id FROM evals ORDER BY created_at DESC LIMIT 1)
     AND json_extract(test_case, '$.description') LIKE '%<search-term>%';"
```

Replace `<search-term>` with a keyword from the test name (e.g. `rebuild`, `scaffolder`).

### Step 6 — Compare Two Most Recent Runs

Pass/fail counts side by side:

```bash
sqlite3 -header -column tests/promptfoo/.promptfoo-data/promptfoo.db \
  "WITH recent AS (
     SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
     FROM evals
   )
   SELECT
     r.rn AS run_num,
     datetime(e.created_at/1000, 'unixepoch', 'localtime') AS run_time,
     SUM(CASE WHEN er.success = 1 THEN 1 ELSE 0 END) AS passed,
     SUM(CASE WHEN er.success = 0 THEN 1 ELSE 0 END) AS failed
   FROM recent r
   JOIN evals e ON e.id = r.id
   JOIN eval_results er ON er.eval_id = e.id
   WHERE r.rn <= 2
   GROUP BY r.rn, e.id, e.created_at
   ORDER BY r.rn ASC;"
```

Find regressions (passed before, fail now):

```bash
sqlite3 -header -column tests/promptfoo/.promptfoo-data/promptfoo.db \
  "WITH recent AS (
     SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn FROM evals
   ),
   curr AS (
     SELECT json_extract(test_case, '$.description') AS name, success
     FROM eval_results WHERE eval_id = (SELECT id FROM recent WHERE rn = 1)
   ),
   prev AS (
     SELECT json_extract(test_case, '$.description') AS name, success
     FROM eval_results WHERE eval_id = (SELECT id FROM recent WHERE rn = 2)
   )
   SELECT curr.name, prev.success AS was, curr.success AS now
   FROM curr JOIN prev ON curr.name = prev.name
   WHERE prev.success = 1 AND curr.success = 0;"
```

### Step 7 — Query a Specific Eval by ID

```bash
sqlite3 -header -column tests/promptfoo/.promptfoo-data/promptfoo.db \
  "SELECT
     CASE WHEN success = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
     json_extract(test_case, '$.description') AS test_name,
     json_extract(grading_result, '$.reason') AS reason
   FROM eval_results
   WHERE eval_id = '<eval-id>'
   ORDER BY success ASC, test_idx ASC;"
```

### Step 8 — Test Variables and Metadata

See which skill and fixture each test used:

```bash
sqlite3 -header -column tests/promptfoo/.promptfoo-data/promptfoo.db \
  "SELECT
     json_extract(test_case, '$.description') AS test_name,
     json_extract(test_case, '$.vars.skill_path') AS skill,
     json_extract(test_case, '$.vars.project_context') AS fixture
   FROM eval_results
   WHERE eval_id = (SELECT id FROM evals ORDER BY created_at DESC LIMIT 1);"
```

## Best Practices

1. Start with Steps 1+2 every time — know which run you are inspecting before drilling down
2. Use `-header -column` flags for readable output; omit when piping to other tools
3. Use `substr(response, 1, N)` to avoid dumping large LLM responses
4. For `llm-rubric` assertion failures, the `reason` field has the grader's explanation — most useful debugging signal
5. `componentResults` shows exactly which assertion in a multi-assert test failed
6. `created_at` is Unix epoch milliseconds — always divide by 1000 for `datetime()`

## DO NOT

- Do not modify or vacuum the database — read-only only
- Do not query `evals.results` for per-test data — it only contains `durationMs`; use `eval_results`
- Do not assume `named_scores` has data — it is typically `{}` for this project
- Do not run `promptfoo view` when the user asks for results — use sqlite3 queries instead

## Error Recovery

> **Flow**: detect → diagnose → auto-recover (retry once if transient) → invoke `error-report-sdlc` for persistent actionable failures.

| Error | Recovery | Invoke error-report-sdlc? |
|-------|----------|---------------------------|
| DB file not found | Show `promptfoo eval` instructions; stop | No — user setup |
| `sqlite3` not installed | Show install instructions (`brew install sqlite3`); stop | No — user setup |
| `sqlite3` query fails with schema error | Try `promptfoo eval --list` to verify DB schema version; stop | No — environment issue |
| No results for latest eval | List all available evals; ask user to pick one | No — expected (empty run) |
| `sqlite3` crashes unexpectedly | Show full error; ask user to verify DB is not corrupted | Yes if persistent |

When invoking `error-report-sdlc`, provide:
- **Skill**: promptfoo-results
- **Step**: whichever step failed (Step 1–8)
- **Operation**: sqlite3 query against promptfoo.db
- **Error**: Full sqlite3 error output
- **Suggested investigation**: Verify DB schema with `.schema eval_results`; check promptfoo version compatibility

---

## Quality Gates

Before presenting results to the user:

- [ ] Verified DB file exists
- [ ] Confirmed which eval run is being inspected (show eval ID and timestamp)
- [ ] For failure analysis: showed both `fail_reason` AND a response preview
- [ ] For comparisons: verified both runs cover the same test names

## Learning Capture

If analysis reveals patterns (e.g. "llm-rubric assertions flaky on skill X",
"latency spikes correlate with fixture size"), append entries to
`.claude/learnings/log.md`.
