'use strict';

/**
 * Content extraction utilities for markdown skill/agent files.
 * Used by verify-setup.js to extract structured data for mechanical verification.
 * All functions return arrays of objects with at minimum a lineNumber field.
 */

// Words that look like paths/symbols in code but are not — filtered out
const PATH_NOISE = new Set([
  'PASS', 'FAIL', 'N/A', 'YES', 'NO', 'NULL', 'TRUE', 'FALSE',
  'TODO', 'NOTE', 'WARN', 'INFO', 'ERROR',
]);

// ---------------------------------------------------------------------------
// extractFilePaths
// ---------------------------------------------------------------------------

/**
 * Extract file paths from markdown content.
 * Captures:
 *   - Backtick-wrapped paths: `src/foo/bar.go` or `path/to/file.ext`
 *   - Explicit .claude/ references
 *   - Lines inside code blocks that look like paths
 *
 * Filters out URLs, version strings, and short tokens.
 * Returns: Array<{path: string, lineNumber: number, context: string}>
 */
function extractFilePaths(content) {
  const results = [];
  const seen = new Set();
  const lines = content.split('\n');

  function addPath(p, lineNumber, context) {
    // Must contain / (path separator) or have a file extension
    if (!p.includes('/') && !/\.[a-z]{1,6}$/.test(p)) return;
    // Filter out URLs
    if (/^https?:\/\//.test(p)) return;
    // Filter out noise words
    if (PATH_NOISE.has(p.toUpperCase())) return;
    // Minimum length
    if (p.length < 4) return;
    // Deduplicate
    if (seen.has(p)) return;
    seen.add(p);
    results.push({ path: p, lineNumber, context });
  }

  // Regex for backtick-wrapped paths
  const backtickPath = /`([a-zA-Z0-9_./-]+(?:\.[a-zA-Z]{1,10}|\/[a-zA-Z0-9_./-]+))`/g;
  // Regex for .claude/ references outside backticks
  const claudeRef = /(?<![`\w])(\.claude\/[a-zA-Z0-9_/.-]+)/g;

  let inCodeBlock = false;
  let lineNum = 0;
  for (const line of lines) {
    lineNum++;
    // Track fenced code blocks
    if (/^```|^~~~/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      // Inside code blocks: look for lines that are just a path or start with common path prefixes
      const trimmed = line.trim();
      if (/^[./]/.test(trimmed) || /^[a-zA-Z][a-zA-Z0-9_-]*\//.test(trimmed)) {
        // Take up to first space
        const candidate = trimmed.split(/\s/)[0];
        addPath(candidate, lineNum, line.trim());
      }
    } else {
      // Outside code blocks: backtick-wrapped paths
      let m;
      backtickPath.lastIndex = 0;
      while ((m = backtickPath.exec(line)) !== null) {
        addPath(m[1], lineNum, line.trim());
      }
      claudeRef.lastIndex = 0;
      while ((m = claudeRef.exec(line)) !== null) {
        addPath(m[1], lineNum, line.trim());
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// extractSymbols
// ---------------------------------------------------------------------------

// Common noise words to exclude from symbol extraction
const SYMBOL_NOISE = new Set([
  'PASS', 'FAIL', 'NOTE', 'TODO', 'WARN', 'NULL', 'TRUE', 'FALSE',
  'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS',
  'HTTP', 'HTTPS', 'URL', 'API', 'JSON', 'XML', 'YAML', 'CSV',
  'AND', 'OR', 'NOT', 'FOR', 'IF', 'IN', 'IS', 'IT', 'AT',
  'Error', 'String', 'Number', 'Boolean', 'Object', 'Array',
  'Map', 'Set', 'List', 'Type', 'Interface',
]);

/**
 * Extract code symbols (functions, types, constants) from markdown content.
 * Only scans inline code spans and fenced code blocks to reduce false positives.
 * Returns: Array<{symbol: string, lineNumber: number, kind: 'function'|'type'|'constant'|'unknown'}>
 */
function extractSymbols(content) {
  const results = [];
  const seen = new Set();
  const lines = content.split('\n');

  function addSymbol(sym, lineNum, kind) {
    if (sym.length < 3) return;
    if (SYMBOL_NOISE.has(sym)) return;
    if (seen.has(sym)) return;
    seen.add(sym);
    results.push({ symbol: sym, lineNumber: lineNum, kind });
  }

  let inCodeBlock = false;
  let lineNum = 0;

  // Patterns
  const funcCall = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  const pascalCase = /\b([A-Z][a-zA-Z0-9]{2,})\b/g;
  const constPattern = /\b(const|var|let)\s+([A-Z_][A-Z0-9_]{2,})\b/g;
  const typeDecl = /\b(type|interface|class|struct)\s+([A-Z][a-zA-Z0-9]+)/g;
  const inlineCode = /`([^`]+)`/g;

  for (const line of lines) {
    lineNum++;
    if (/^```|^~~~/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      // Inside code blocks: extract function calls, type declarations, constants
      let m;
      funcCall.lastIndex = 0;
      while ((m = funcCall.exec(line)) !== null) {
        addSymbol(m[1], lineNum, 'function');
      }
      constPattern.lastIndex = 0;
      while ((m = constPattern.exec(line)) !== null) {
        addSymbol(m[2], lineNum, 'constant');
      }
      typeDecl.lastIndex = 0;
      while ((m = typeDecl.exec(line)) !== null) {
        addSymbol(m[2], lineNum, 'type');
      }
    } else {
      // Outside code blocks: only scan inline code spans, use conservative PascalCase
      let m;
      inlineCode.lastIndex = 0;
      while ((m = inlineCode.exec(line)) !== null) {
        const inner = m[1].trim();
        // Function call pattern: foo(
        const funcM = inner.match(/^([a-zA-Z_][a-zA-Z0-9_.]*)\s*\(/);
        if (funcM) { addSymbol(funcM[1], lineNum, 'function'); continue; }
        // PascalCase type/constructor
        if (/^[A-Z][a-zA-Z0-9]{2,}$/.test(inner)) {
          addSymbol(inner, lineNum, 'type');
        }
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// extractCodeBlocks
// ---------------------------------------------------------------------------

/**
 * Extract fenced code blocks with language tags and line numbers.
 * Returns: Array<{language: string, code: string, lineStart: number, lineEnd: number}>
 */
function extractCodeBlocks(content) {
  const results = [];
  const lines = content.split('\n');
  let inBlock = false;
  let blockStart = 0;
  let language = '';
  let blockLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^(`{3,}|~{3,})(\S*)/);
    if (fenceMatch) {
      if (!inBlock) {
        inBlock = true;
        blockStart = i + 1; // 1-indexed
        language = fenceMatch[2] || '';
        blockLines = [];
      } else {
        results.push({
          language,
          code: blockLines.join('\n'),
          lineStart: blockStart,
          lineEnd: i + 1,
        });
        inBlock = false;
        blockLines = [];
      }
    } else if (inBlock) {
      blockLines.push(line);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// extractErrorCodes
// ---------------------------------------------------------------------------

/**
 * Extract error codes and named constants from markdown content.
 * Looks for ALL_CAPS_SNAKE identifiers, ErrXxx, ErrorXxx patterns.
 * Returns: Array<{code: string, lineNumber: number, context: string}>
 */
function extractErrorCodes(content) {
  const results = [];
  const seen = new Set();
  const lines = content.split('\n');

  const allCapsSnake = /\b([A-Z][A-Z0-9_]{2,})\b/g;
  const errPrefix = /\b(Err[A-Z][a-zA-Z0-9]+)\b/g;

  // Noise: skip common markdown/protocol words
  const noise = new Set([
    'PASS', 'FAIL', 'CURRENT', 'OUTDATED', 'STALE', 'CRITICAL',
    'YES', 'NO', 'NULL', 'TRUE', 'FALSE', 'NONE', 'OK',
    'GET', 'POST', 'PUT', 'DELETE', 'PATCH',
    'HTTP', 'HTTPS', 'JSON', 'YAML', 'XML',
    'TODO', 'NOTE', 'INFO', 'WARN',
    'AND', 'OR', 'NOT', 'IN_SOURCE', 'SPEC_ONLY', 'NONEXISTENT',
    'HIGH', 'LOW', 'MED', 'MEDIUM',
  ]);

  let lineNum = 0;
  for (const line of lines) {
    lineNum++;
    let m;

    allCapsSnake.lastIndex = 0;
    while ((m = allCapsSnake.exec(line)) !== null) {
      const code = m[1];
      if (!noise.has(code) && !seen.has(code) && code.includes('_')) {
        seen.add(code);
        results.push({ code, lineNumber: lineNum, context: line.trim() });
      }
    }

    errPrefix.lastIndex = 0;
    while ((m = errPrefix.exec(line)) !== null) {
      const code = m[1];
      if (!seen.has(code)) {
        seen.add(code);
        results.push({ code, lineNumber: lineNum, context: line.trim() });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// extractApiRoutes
// ---------------------------------------------------------------------------

/**
 * Extract HTTP API routes from markdown content.
 * Matches: GET /api/..., POST /users, router.Get("/path"), app.post("/path")
 * Returns: Array<{method: string, path: string, lineNumber: number}>
 */
function extractApiRoutes(content) {
  const results = [];
  const seen = new Set();
  const lines = content.split('\n');

  // Direct HTTP method + path pattern: GET /api/v1/...
  const directRoute = /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\/[a-zA-Z0-9/_:{}?=&.-]*)/gi;
  // Router registration: router.Get("/path"), app.post("/path"), r.GET("/path", ...)
  const routerReg = /\.\s*(get|post|put|delete|patch|head|options)\s*\(\s*["'](\/?[a-zA-Z0-9/_:{}?=&.-]+)["']/gi;

  let lineNum = 0;
  for (const line of lines) {
    lineNum++;
    let m;

    directRoute.lastIndex = 0;
    while ((m = directRoute.exec(line)) !== null) {
      const key = `${m[1].toUpperCase()} ${m[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ method: m[1].toUpperCase(), path: m[2], lineNumber: lineNum });
      }
    }

    routerReg.lastIndex = 0;
    while ((m = routerReg.exec(line)) !== null) {
      const key = `${m[1].toUpperCase()} ${m[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ method: m[1].toUpperCase(), path: m[2], lineNumber: lineNum });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// extractSkillReferences
// ---------------------------------------------------------------------------

/**
 * Extract .claude/skills/X and .claude/agents/X references from agent content.
 * Used for check 3f (skill references valid).
 * Returns: Array<{reference: string, lineNumber: number}>
 */
function extractSkillReferences(content) {
  const results = [];
  const seen = new Set();
  const lines = content.split('\n');
  const refPattern = /\.claude\/(?:skills|agents)\/([a-zA-Z0-9_/-]+(?:\.md)?)/g;

  let lineNum = 0;
  for (const line of lines) {
    lineNum++;
    refPattern.lastIndex = 0;
    let m;
    while ((m = refPattern.exec(line)) !== null) {
      const ref = m[0];
      if (!seen.has(ref)) {
        seen.add(ref);
        results.push({ reference: ref, lineNumber: lineNum });
      }
    }
  }

  return results;
}

module.exports = {
  extractFilePaths,
  extractSymbols,
  extractCodeBlocks,
  extractErrorCodes,
  extractApiRoutes,
  extractSkillReferences,
};
