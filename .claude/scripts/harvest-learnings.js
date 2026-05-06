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
 *   --commit <approved-clusters.json>
 *     Input file shape: { approvedClusterIds: [string] }. Atomically rewrites
 *     log.md removing only the [sourceStartLine..sourceEndLine] ranges for
 *     those cluster ids. Headings, trailer ("## Tracked in GH Issues") and
 *     unaffected entries are preserved. Empty approved list → no-op.
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
 *       dedupReason?,     // 'source-range-overlap' | 'fuzzy-title-match'
 *       existingIssue?    // { number, title, state }
 *     }],
 *     skippedTrivial: [{ dateISO, skill, summary, sourceStartLine, sourceEndLine }],
 *     gh: { listError? }  // populated if gh invocation failed
 *   }
 *
 * Env vars:
 *   GH_HARVEST_FAKE_LIST  Path to a JSON file matching `gh issue list --json
 *                         number,title,body,state,closedAt` shape. When set,
 *                         the helper reads this file instead of invoking gh.
 *                         Used for tests.
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

function classifyCluster(cluster, issues) {
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

  const clusters = filtered.map((c) => {
    const verdict = classifyCluster(c, issues);
    return Object.assign({}, c, verdict);
  });

  const out = {
    logPath,
    harvestDate: todayISO(),
    totalEntries,
    dryRun,
    clusters,
    skippedTrivial,
    gh: listError ? { listError } : {},
  };

  writeOutput(out);
  process.exit(0);
}

function modeCommit(args) {
  const approvedPath = args[args.indexOf('--commit') + 1];
  if (!approvedPath) {
    process.stderr.write(`harvest-learnings: --commit requires a file path\n`);
    process.exit(1);
  }
  if (!fs.existsSync(approvedPath)) {
    process.stderr.write(`harvest-learnings: approved-json not found at ${approvedPath}\n`);
    process.exit(1);
  }

  let approvedDoc;
  try {
    approvedDoc = JSON.parse(fs.readFileSync(approvedPath, 'utf8'));
  } catch (e) {
    process.stderr.write(`harvest-learnings: malformed approved-json: ${e.message}\n`);
    process.exit(1);
  }

  const approvedClusterIds = Array.isArray(approvedDoc.approvedClusterIds)
    ? approvedDoc.approvedClusterIds
    : null;
  if (!approvedClusterIds) {
    process.stderr.write(`harvest-learnings: approved-json missing approvedClusterIds[]\n`);
    process.exit(1);
  }

  if (approvedClusterIds.length === 0) {
    // No-op
    process.exit(0);
  }

  const cwd = process.cwd();
  const logPath = path.join(cwd, '.claude', 'learnings', 'log.md');
  if (!fs.existsSync(logPath)) {
    process.stderr.write(`harvest-learnings: log not found at ${logPath}\n`);
    process.exit(1);
  }

  // Re-parse the log to map approved ids to current line ranges (round-trip
  // via the same id mint). Anything not found is silently ignored — caller
  // already got their issues, so we just skip the line-range removal.
  const { clusters } = parseLog(logPath);
  const idToCluster = new Map(clusters.map((c) => [c.id, c]));
  const ranges = [];
  for (const id of approvedClusterIds) {
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

// ─────────────────────────────────────────────────────────────────────────
// Entrypoint
// ─────────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--commit')) {
    return modeCommit(args);
  }
  if (args.includes('--output-file')) {
    return modeOutputFile(args);
  }

  process.stderr.write(
    'Usage: harvest-learnings.js --output-file [--dry-run] [--since YYYY-MM-DD]\n' +
      '       harvest-learnings.js --commit <approved-clusters.json>\n'
  );
  process.exit(1);
}

main();
