/**
 * harden-surfaces.js
 *
 * Per-surface loaders for harden-prepare.js. Extracted from the prepare script
 * to honor docs/specs/harden-sdlc.md C2 (≤200 lines for prepare). Each loader
 * is deterministic and tolerates missing files (R4 + E2 — empty arrays, not
 * crashes; parse errors recorded into the shared `errors[]` array).
 *
 * Zero external deps — Node.js built-ins only, plus existing lib/ helpers.
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const { readSection } = require('./config');
const { extractFrontmatter, parseSimpleYaml } = require('./dimensions');

// ---------------------------------------------------------------------------
// Plan / Execute guardrails — sourced from .claude/sdlc.json
// ---------------------------------------------------------------------------

function loadGuardrailsSection(projectRoot, sectionName, errors) {
  let section;
  try {
    section = readSection(projectRoot, sectionName);
  } catch (err) {
    errors.push({ surface: `${sectionName}-guardrails`, message: `readSection failed: ${err.message}` });
    return [];
  }
  const list = section?.guardrails;
  if (!Array.isArray(list)) return [];
  return list.map(g => ({
    id:          typeof g.id === 'string' ? g.id : '',
    severity:    typeof g.severity === 'string' ? g.severity : 'error',
    description: typeof g.description === 'string' ? g.description : '',
  }));
}

function loadPlanGuardrails(projectRoot, errors) {
  return loadGuardrailsSection(projectRoot, 'plan', errors);
}

function loadExecuteGuardrails(projectRoot, errors) {
  return loadGuardrailsSection(projectRoot, 'execute', errors);
}

// ---------------------------------------------------------------------------
// Review dimensions — .claude/review-dimensions/*.md frontmatter
// ---------------------------------------------------------------------------

function loadReviewDimensions(projectRoot, errors) {
  const dir = path.join(projectRoot, '.claude', 'review-dimensions');
  if (!fs.existsSync(dir)) return [];
  let files;
  try {
    files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  } catch (err) {
    errors.push({ surface: 'review-dimensions', message: `readdir failed: ${err.message}` });
    return [];
  }

  const out = [];
  for (const f of files) {
    const filePath = path.join(dir, f);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fmRaw = extractFrontmatter(content);
      if (!fmRaw) {
        errors.push({ surface: 'review-dimensions', message: `Missing frontmatter: ${f}` });
        continue;
      }
      const fm = parseSimpleYaml(fmRaw);
      out.push({
        name:        typeof fm.name === 'string' ? fm.name : '',
        severity:    typeof fm.severity === 'string' ? fm.severity : '',
        description: typeof fm.description === 'string' ? fm.description : '',
        triggers:    Array.isArray(fm.triggers) ? fm.triggers : [],
        model:       typeof fm.model === 'string' ? fm.model : '',
        path:        filePath,
      });
    } catch (err) {
      errors.push({ surface: 'review-dimensions', message: `Read/parse failed for ${f}: ${err.message}` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Copilot instructions — .github/instructions/*.instructions.md
// ---------------------------------------------------------------------------

function loadCopilotInstructions(projectRoot, errors) {
  const dir = path.join(projectRoot, '.github', 'instructions');
  if (!fs.existsSync(dir)) return [];
  let files;
  try {
    files = fs.readdirSync(dir).filter(f => f.endsWith('.instructions.md'));
  } catch (err) {
    errors.push({ surface: 'copilot-instructions', message: `readdir failed: ${err.message}` });
    return [];
  }

  const out = [];
  for (const f of files) {
    const filePath = path.join(dir, f);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fmRaw = extractFrontmatter(content);
      const fm = fmRaw ? parseSimpleYaml(fmRaw) : {};
      out.push({
        applyTo: typeof fm.applyTo === 'string' ? fm.applyTo : '',
        name:    f.replace(/\.instructions\.md$/, ''),
        path:    filePath,
      });
    } catch (err) {
      errors.push({ surface: 'copilot-instructions', message: `Read failed for ${f}: ${err.message}` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sibling skill resolution — error-report-sdlc REFERENCE.md
// ---------------------------------------------------------------------------

function resolveErrorReportSkill(projectRoot, errors) {
  // Primary: in-repo path (fast path when running from a checkout).
  const inRepo = path.join(
    projectRoot,
    'plugins',
    'sdlc-utilities',
    'skills',
    'error-report-sdlc',
    'REFERENCE.md',
  );
  if (fs.existsSync(inRepo)) return inRepo;

  // Fallback: locate via __dirname (lib/) → skill peer.
  const peer = path.join(
    __dirname,
    '..',
    '..',
    'skills',
    'error-report-sdlc',
    'REFERENCE.md',
  );
  if (fs.existsSync(peer)) return path.resolve(peer);

  errors.push({ surface: 'error-report-skill', message: 'REFERENCE.md not found via in-repo or peer path' });
  return '';
}

module.exports = {
  loadPlanGuardrails,
  loadExecuteGuardrails,
  loadReviewDimensions,
  loadCopilotInstructions,
  resolveErrorReportSkill,
};
