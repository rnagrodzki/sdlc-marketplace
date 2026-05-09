#!/usr/bin/env node
'use strict';

/**
 * harvest-learnings.js — repo-local helper for /harvest-learnings.
 *
 * Self-contained: Node built-ins + `gh` subprocess only. No imports from
 * plugins/sdlc-utilities or other plugin code.
 *
 * Modes:
 *   --output-file [--dry-run] [--since YYYY-MM-DD]
 *     Parses <cwd>/.claude/learnings/log.md, calls
 *       gh issue list --state all --limit 200 \
 *         --search "Source: learnings/log.md" \
 *         --json number,title,body,state,closedAt
 *     (no --repo flag — relies on cwd's resolved repo via origin or
 *     `gh repo set-default`), performs dedup, writes the drafts JSON to a
 *     temp file in os.tmpdir(). Stdout = absolute path to that temp file.
 *
 *   --commit <processed-clusters.json>
 *     Input file shape: { processedClusterIds: [string] }. Atomically rewrites
 *     log.md removing the [sourceStartLine..sourceEndLine] ranges for ALL
 *     processed cluster ids (approved drafts, rejected drafts, operational-note,
 *     already-fixed, tracked, possibly-tracked-confirmed-dupe). Headings,
 *     trailer ("## Tracked in GH Issues") and unaffected entries are preserved.
 *     Empty list → no-op.
 *
 *   --close-stale [--dry-run]
 *     Reads open 'harvested'-labelled issues from gh, runs parseFixReferences +
 *     verifyFixOnMain per issue, emits closure JSON to a temp file. Stdout =
 *     absolute path to that temp file. Slash command reads the JSON and runs
 *     `gh issue close` after user approval.
 *
 * Output JSON shape (--output-file mode):
 *   {
 *     logPath,            // absolute path to log.md
 *     harvestDate,        // YYYY-MM-DD (UTC) of this run
 *     totalEntries,       // count of parsed clusters before filters
 *     dryRun,             // boolean
 *     clusters: [{
 *       id,               // 12-hex stable hash of (dateISO, skill, sourceStartLine)
 *       dateISO,          // YYYY-MM-DD
 *       skill,            // skill name from header
 *       summary,          // header summary text
 *       bodyLines,        // body content (joined with \n, no header)
 *       sourceStartLine,  // 1-indexed line number of `## ` header in log.md
 *       sourceEndLine,    // 1-indexed last body line of cluster
 *       status,           // 'draft' | 'tracked' | 'possibly-tracked'
 *                         //   | 'operational-note' | 'already-fixed'
 *       dedupReason?,     // 'source-range-overlap' | 'fuzzy-title-match'
 *                         //   | 'skill-prefix' | 'fix-on-main'
 *       existingIssue?,   // { number, title, state }
 *       fixRef?           // { type: 'pr'|'sha', value: number|string }
 *                         //   present when status === 'already-fixed'
 *     }],
 *     skippedTrivial: [{ dateISO, skill, summary, sourceStartLine, sourceEndLine }],
 *     gh: { listError?, verifyError? }  // populated if gh invocations failed
 *   }
 *
 * Output JSON shape (--close-stale mode):
 *   {
 *     harvestDate,        // YYYY-MM-DD
 *     dryRun,             // boolean
 *     closures: [{ number, reason, fixRef }],
 *     skipped: [{ number, reason }],
 *     gh: { listError? }
 *   }
 *
 * Env vars:
 *   GH_HARVEST_FAKE_LIST          Path to JSON array matching `gh issue list` shape.
 *                                 Used by --output-file mode. Tests only.
 *   GH_HARVEST_FAKE_LIST_HARVESTED Path to JSON array of open harvested-label issues.
 *                                 Used by --close-stale mode. Tests only.
 *   GIT_HARVEST_FAKE_MERGE_BASE   Path to JSON { "<sha>": true|false }. When set,
 *                                 verifyFixOnMain reads this instead of invoking git.
 *   GH_HARVEST_FAKE_PR            Path to JSON { "<num>": { state, mergeCommit } }.
 *                                 When set, verifyFixOnMain reads this instead of gh.
 *
 * Exit codes:
 *   0 — success
 *   1 — user-facing error (log missing, malformed approved-json)
 *   2 — internal error (filesystem failure during commit, etc.)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function writeOutput(jsonValue) {
  const dir = os.tmpdir();
  const name = `harvest-learnings-${Date.now()}-${process.pid}.json`;
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(jsonValue, null, 2), 'utf8');
  process.stdout.write(p + '\n');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function clusterId(dateISO, skill, sourceStartLine) {
  return crypto
    .createHash('sha1')
    .update(`${dateISO}|${skill}|${sourceStartLine}`)
    .digest('hex')
    .slice(0, 12);
}

const HEADER_RE = /^## (\d{4}-\d{2}-\d{2}) [—-]{1,2} ([^:]+): (.+)$/;
const TRAILER_RE = /^## Tracked in GH Issues\b/;

function parseLog(logPath) {
  const raw = fs.readFileSync(logPath, 'utf8');
  const lines = raw.split('\n');

  // Find trailer (terminates harvestable region). Trailer line index is exclusive.
  let trailerIdx = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (TRAILER_RE.test(lines[i])) {
      trailerIdx = i;
      break;
    }
  }

  // Collect cluster header positions (1-indexed) within harvestable region.
  const headers = [];
  for (let i = 0; i < trailerIdx; i++) {
    const m = lines[i].match(HEADER_RE);
    if (m) {
      headers.push({
        idx: i, // 0-indexed
        dateISO: m[1],
        skill: m[2].trim(),
        summary: m[3].trim(),
      });
    }
  }

  const clusters = [];
  const skippedTrivial = [];

  for (let h = 0; h < headers.length; h++) {
    const cur = headers[h];
    const next = headers[h + 1];
    const endIdx = next ? next.idx - 1 : trailerIdx - 1;

    // Body = lines (cur.idx+1) .. endIdx, trim trailing blank lines off the end
    let bodyEnd = endIdx;
    while (bodyEnd > cur.idx && lines[bodyEnd].trim() === '') bodyEnd--;
    const bodyArr = lines.slice(cur.idx + 1, bodyEnd + 1);
    const body = bodyArr.join('\n');

    const sourceStartLine = cur.idx + 1; // 1-indexed
    const sourceEndLine = bodyEnd + 1; // 1-indexed (== sourceStartLine if body empty)

    if (body.trim() === '') {
      skippedTrivial.push({
        dateISO: cur.dateISO,
        skill: cur.skill,
        summary: cur.summary,
        sourceStartLine,
        sourceEndLine,
      });
      continue;
    }

    clusters.push({
      id: clusterId(cur.dateISO, cur.skill, sourceStartLine),
      dateISO: cur.dateISO,
      skill: cur.skill,
      summary: cur.summary,
      bodyLines: body,
      sourceStartLine,
      sourceEndLine,
      status: 'draft',
    });
  }

  return { clusters, skippedTrivial };
}

function fetchExistingIssues() {
  const fake = process.env.GH_HARVEST_FAKE_LIST;
  if (fake) {
    try {
      const txt = fs.readFileSync(fake, 'utf8');
      const arr = JSON.parse(txt);
      if (!Array.isArray(arr)) {
        return { issues: [], listError: 'GH_HARVEST_FAKE_LIST: expected JSON array' };
      }
      return { issues: arr };
    } catch (e) {
      return { issues: [], listError: `GH_HARVEST_FAKE_LIST: ${e.message}` };
    }
  }

  const res = spawnSync(
    'gh',
    [
      'issue',
      'list',
      '--state',
      'all',
      '--limit',
      '200',
      '--search',
      'Source: learnings/log.md',
      '--json',
      'number,title,body,state,closedAt',
    ],
    { encoding: 'utf8' }
  );

  if (res.error) {
    return { issues: [], listError: `gh: ${res.error.message}` };
  }
  if (res.status !== 0) {
    const msg = (res.stderr || '').trim() || `exit ${res.status}`;
    return { issues: [], listError: `gh: ${msg}` };
  }
  try {
    const arr = JSON.parse(res.stdout || '[]');
    return { issues: Array.isArray(arr) ? arr : [] };
  } catch (e) {
    return { issues: [], listError: `gh: parse error: ${e.message}` };
  }
}

const SOURCE_RANGE_RE = /Source: learnings\/log\.md \(lines (\d+)[–-](\d+)/;

function parseSourceRange(body) {
  if (typeof body !== 'string') return null;
  const m = body.match(SOURCE_RANGE_RE);
  if (!m) return null;
  return { start: parseInt(m[1], 10), end: parseInt(m[2], 10) };
}

function rangesOverlap(a, b) {
  return a.start <= b.end && b.start <= a.end;
}

const STOPWORDS = new Set(
  'the,a,an,and,or,for,to,of,in,on,is,was'.split(',')
);

function tokenize(s) {
  if (typeof s !== 'string') return new Set();
  const toks = s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t));
  return new Set(toks);
}

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ─────────────────────────────────────────────────────────────────────────
// Operational-note and already-fixed classifiers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Skills whose log entries are operational success notes, not actionable bugs.
 * Entries with these skill prefixes are silently filtered before issue creation.
 */
const OPERATIONAL_SKILLS = new Set(['pr-sdlc', 'version-sdlc', 'ship-sdlc']);

/**
 * Parse fix references from a body string.
 * Recognises (case-insensitive):
 *   Fixes #NNN, Closes #NNN, Fixed in <sha7+>,
 *   bare 40-hex SHAs at word boundaries,
 *   github.com/.../pull/NNN URLs.
 *
 * @param {string} body
 * @returns {{ shas: string[], prs: number[] }}
 */
function parseFixReferences(body) {
  if (typeof body !== 'string') return { shas: [], prs: [] };
  const shas = new Set();
  const prs = new Set();

  // Fixes #NNN, Closes #NNN
  const fixIssueRe = /(?:fixes|closes)\s+#(\d+)/gi;
  let m;
  while ((m = fixIssueRe.exec(body)) !== null) {
    prs.add(parseInt(m[1], 10));
  }

  // Fixed in <sha7+> (not a bare 40-hex — that's caught below)
  const fixedInRe = /fixed\s+in\s+([0-9a-f]{7,40})\b/gi;
  while ((m = fixedInRe.exec(body)) !== null) {
    shas.add(m[1].toLowerCase());
  }

  // Bare 40-hex SHAs at word boundaries
  const sha40Re = /\b([0-9a-f]{40})\b/gi;
  while ((m = sha40Re.exec(body)) !== null) {
    shas.add(m[1].toLowerCase());
  }

  // GitHub pull URLs: github.com/<owner>/<repo>/pull/<num>
  const prUrlRe = /github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+)/gi;
  while ((m = prUrlRe.exec(body)) !== null) {
    prs.add(parseInt(m[1], 10));
  }

  return { shas: Array.from(shas), prs: Array.from(prs) };
}

/**
 * Verify whether any fix reference has landed on main.
 * Uses fake-file env vars for deterministic tests.
 *
 * @param {{ shas: string[], prs: number[] }} refs
 * @returns {{ verified: boolean, fixRef?: { type: 'sha'|'pr', value: string|number }, verifyError?: string }}
 */
function verifyFixOnMain(refs) {
  const fakeMergeBaseFile = process.env.GIT_HARVEST_FAKE_MERGE_BASE;
  const fakePrFile = process.env.GH_HARVEST_FAKE_PR;

  // Check SHAs
  for (const sha of refs.shas) {
    if (fakeMergeBaseFile) {
      try {
        const table = JSON.parse(fs.readFileSync(fakeMergeBaseFile, 'utf8'));
        if (table[sha] === true) return { verified: true, fixRef: { type: 'sha', value: sha } };
        // explicitly false = not on main; skip
      } catch (e) {
        return { verified: false, verifyError: `GIT_HARVEST_FAKE_MERGE_BASE: ${e.message}` };
      }
    } else {
      try {
        const res = spawnSync('git', ['merge-base', '--is-ancestor', sha, 'main'], { encoding: 'utf8' });
        if (res.status === 0) return { verified: true, fixRef: { type: 'sha', value: sha } };
        if (res.error) return { verified: false, verifyError: `git: ${res.error.message}` };
        // status !== 0 means not an ancestor — continue to next ref
      } catch (e) {
        return { verified: false, verifyError: `git: ${e.message}` };
      }
    }
  }

  // Check PRs
  for (const pr of refs.prs) {
    if (fakePrFile) {
      try {
        const table = JSON.parse(fs.readFileSync(fakePrFile, 'utf8'));
        const entry = table[String(pr)];
        if (entry && entry.state === 'MERGED') {
          return { verified: true, fixRef: { type: 'pr', value: pr } };
        }
        // Not merged or not found — continue
      } catch (e) {
        return { verified: false, verifyError: `GH_HARVEST_FAKE_PR: ${e.message}` };
      }
    } else {
      const res = spawnSync(
        'gh',
        ['pr', 'view', String(pr), '--json', 'state,mergeCommit'],
        { encoding: 'utf8' }
      );
      if (res.error) return { verified: false, verifyError: `gh: ${res.error.message}` };
      if (res.status === 0) {
        try {
          const data = JSON.parse(res.stdout || '{}');
          if (data.state === 'MERGED') return { verified: true, fixRef: { type: 'pr', value: pr } };
        } catch (e) {
          return { verified: false, verifyError: `gh: parse error: ${e.message}` };
        }
      }
      // PR not merged or not found — continue
    }
  }

  return { verified: false };
}

function classifyCluster(cluster, issues, ghErrors) {
  // 0) Operational-note: skill-prefix match — must precede fuzzy-title check
  if (OPERATIONAL_SKILLS.has(cluster.skill)) {
    return { status: 'operational-note', dedupReason: 'skill-prefix' };
  }

  // 0b) Already-fixed: explicit fix reference verified on main
  const refs = parseFixReferences(cluster.bodyLines);
  if (refs.shas.length > 0 || refs.prs.length > 0) {
    const result = verifyFixOnMain(refs);
    if (result.verified) {
      return { status: 'already-fixed', dedupReason: 'fix-on-main', fixRef: result.fixRef };
    }
    // If verifyError, treat as unverified (stays draft); record first error
    // for surfacing via the manifest's gh.verifyError field.
    if (result.verifyError && ghErrors && !ghErrors.verifyError) {
      ghErrors.verifyError = result.verifyError;
    }
  }

  // 1) Source-range overlap → tracked
  for (const issue of issues) {
    const range = parseSourceRange(issue.body);
    if (!range) continue;
    if (
      rangesOverlap(
        { start: cluster.sourceStartLine, end: cluster.sourceEndLine },
        range
      )
    ) {
      return {
        status: 'tracked',
        dedupReason: 'source-range-overlap',
        existingIssue: {
          number: issue.number,
          title: issue.title,
          state: issue.state,
        },
      };
    }
  }
  // 2) Fuzzy title match against open issues → possibly-tracked
  const summaryTokens = tokenize(cluster.summary);
  let best = null;
  for (const issue of issues) {
    if (issue.state && String(issue.state).toUpperCase() !== 'OPEN') continue;
    const issueTokens = tokenize(issue.title);
    const score = jaccard(summaryTokens, issueTokens);
    if (score >= 0.6 && (!best || score > best.score)) {
      best = { score, issue };
    }
  }
  if (best) {
    return {
      status: 'possibly-tracked',
      dedupReason: 'fuzzy-title-match',
      existingIssue: {
        number: best.issue.number,
        title: best.issue.title,
        state: best.issue.state,
      },
    };
  }
  return { status: 'draft' };
}

// ─────────────────────────────────────────────────────────────────────────
// Modes
// ─────────────────────────────────────────────────────────────────────────

function modeOutputFile(args) {
  const dryRun = args.includes('--dry-run');
  let since = null;
  const sinceIdx = args.indexOf('--since');
  if (sinceIdx !== -1) {
    since = args[sinceIdx + 1];
    if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
      process.stderr.write(`harvest-learnings: --since requires YYYY-MM-DD\n`);
      process.exit(1);
    }
  }

  const cwd = process.cwd();
  const logPath = path.join(cwd, '.claude', 'learnings', 'log.md');
  if (!fs.existsSync(logPath)) {
    process.stderr.write(`harvest-learnings: log not found at ${logPath}\n`);
    process.exit(1);
  }

  const { clusters: rawClusters, skippedTrivial } = parseLog(logPath);
  const totalEntries = rawClusters.length;

  const filtered = since
    ? rawClusters.filter((c) => c.dateISO >= since)
    : rawClusters;

  const { issues, listError } = fetchExistingIssues();

  const ghErrors = {};
  const clusters = filtered.map((c) => {
    const verdict = classifyCluster(c, issues, ghErrors);
    return Object.assign({}, c, verdict);
  });

  const gh = {};
  if (listError) gh.listError = listError;
  if (ghErrors.verifyError) gh.verifyError = ghErrors.verifyError;

  const out = {
    logPath,
    harvestDate: todayISO(),
    totalEntries,
    dryRun,
    clusters,
    skippedTrivial,
    gh,
  };

  writeOutput(out);
  process.exit(0);
}

function modeCommit(args) {
  const processedPath = args[args.indexOf('--commit') + 1];
  if (!processedPath) {
    process.stderr.write(`harvest-learnings: --commit requires a file path\n`);
    process.exit(1);
  }
  if (!fs.existsSync(processedPath)) {
    process.stderr.write(`harvest-learnings: processed-json not found at ${processedPath}\n`);
    process.exit(1);
  }

  let processedDoc;
  try {
    processedDoc = JSON.parse(fs.readFileSync(processedPath, 'utf8'));
  } catch (e) {
    process.stderr.write(`harvest-learnings: malformed processed-json: ${e.message}\n`);
    process.exit(1);
  }

  // Accept processedClusterIds only. Fail loud if the key is missing.
  const processedClusterIds = Array.isArray(processedDoc.processedClusterIds)
    ? processedDoc.processedClusterIds
    : null;
  if (!processedClusterIds) {
    process.stderr.write(
      `harvest-learnings: processed-json missing processedClusterIds[] — ` +
        `pass { "processedClusterIds": [...] } (not approvedClusterIds)\n`
    );
    process.exit(1);
  }

  if (processedClusterIds.length === 0) {
    // No-op
    process.exit(0);
  }

  const cwd = process.cwd();
  const logPath = path.join(cwd, '.claude', 'learnings', 'log.md');
  if (!fs.existsSync(logPath)) {
    process.stderr.write(`harvest-learnings: log not found at ${logPath}\n`);
    process.exit(1);
  }

  // Re-parse the log to map processed ids to current line ranges (round-trip
  // via the same id mint). Anything not found is silently ignored — the id
  // may have been removed by a prior run.
  const { clusters } = parseLog(logPath);
  const idToCluster = new Map(clusters.map((c) => [c.id, c]));
  const ranges = [];
  for (const id of processedClusterIds) {
    const c = idToCluster.get(id);
    if (c) ranges.push({ start: c.sourceStartLine, end: c.sourceEndLine });
  }

  if (ranges.length === 0) {
    // Nothing matched → no mutation
    process.exit(0);
  }

  // Sort by start asc and remove [start..end] inclusive line ranges.
  ranges.sort((a, b) => a.start - b.start);
  const raw = fs.readFileSync(logPath, 'utf8');
  const lines = raw.split('\n');
  const remove = new Array(lines.length).fill(false);
  for (const r of ranges) {
    for (let i = r.start - 1; i <= r.end - 1 && i < lines.length; i++) {
      remove[i] = true;
    }
  }
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (!remove[i]) kept.push(lines[i]);
  }
  // Atomic write via tmp + rename
  const tmp = logPath + '.harvest-tmp-' + process.pid;
  try {
    fs.writeFileSync(tmp, kept.join('\n'), 'utf8');
    fs.renameSync(tmp, logPath);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    process.stderr.write(`harvest-learnings: commit failed: ${e.message}\n`);
    process.exit(2);
  }
  process.exit(0);
}

function modeCloseStale(args) {
  // Note: --dry-run only flags the output JSON (consumer suppresses
  // `gh issue close`); the gh issue list + verifyFixOnMain calls below
  // are read-only and always run so the consumer has data to preview.
  const dryRun = args.includes('--dry-run');

  const fakeListEnv = process.env.GH_HARVEST_FAKE_LIST_HARVESTED;
  let issues = [];
  let listError;

  if (fakeListEnv) {
    try {
      const txt = fs.readFileSync(fakeListEnv, 'utf8');
      const arr = JSON.parse(txt);
      if (!Array.isArray(arr)) {
        listError = 'GH_HARVEST_FAKE_LIST_HARVESTED: expected JSON array';
      } else {
        issues = arr;
      }
    } catch (e) {
      listError = `GH_HARVEST_FAKE_LIST_HARVESTED: ${e.message}`;
    }
  } else {
    const res = spawnSync(
      'gh',
      [
        'issue',
        'list',
        '--label',
        'harvested',
        '--state',
        'open',
        '--limit',
        '200',
        '--json',
        'number,title,body',
      ],
      { encoding: 'utf8' }
    );
    if (res.error) {
      listError = `gh: ${res.error.message}`;
    } else if (res.status !== 0) {
      const msg = (res.stderr || '').trim() || `exit ${res.status}`;
      listError = `gh: ${msg}`;
    } else {
      try {
        const arr = JSON.parse(res.stdout || '[]');
        issues = Array.isArray(arr) ? arr : [];
      } catch (e) {
        listError = `gh: parse error: ${e.message}`;
      }
    }
  }

  const closures = [];
  const skipped = [];

  if (!listError) {
    for (const issue of issues) {
      const refs = parseFixReferences(issue.body || '');
      if (refs.shas.length === 0 && refs.prs.length === 0) {
        skipped.push({ number: issue.number, reason: 'no verified fix reference in body' });
        continue;
      }
      const result = verifyFixOnMain(refs);
      if (result.verified) {
        const ref = result.fixRef;
        const refDesc =
          ref.type === 'pr'
            ? `PR #${ref.value}`
            : `commit ${String(ref.value).slice(0, 7)}`;
        closures.push({
          number: issue.number,
          reason: `Fix merged in ${refDesc} — landed on main.`,
          fixRef: ref,
        });
      } else {
        skipped.push({ number: issue.number, reason: result.verifyError || 'fix reference not verified on main' });
      }
    }
  }

  const out = {
    harvestDate: todayISO(),
    dryRun,
    closures: listError ? [] : closures,
    skipped: listError ? [] : skipped,
    gh: listError ? { listError } : {},
  };

  writeOutput(out);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────
// Entrypoint
// ─────────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--commit')) {
    return modeCommit(args);
  }
  if (args.includes('--close-stale')) {
    return modeCloseStale(args);
  }
  if (args.includes('--output-file')) {
    return modeOutputFile(args);
  }

  process.stderr.write(
    'Usage: harvest-learnings.js --output-file [--dry-run] [--since YYYY-MM-DD]\n' +
      '       harvest-learnings.js --commit <processed-clusters.json>\n' +
      '       harvest-learnings.js --close-stale [--dry-run]\n'
  );
  process.exit(1);
}

main();
