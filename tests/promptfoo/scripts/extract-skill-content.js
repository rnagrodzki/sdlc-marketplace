const fs = require('fs');
const os = require('os');
const path = require('path');

// Resolve paths relative to repo root (three levels up from tests/promptfoo/scripts/)
const REPO_ROOT = path.resolve(__dirname, '../../..');

module.exports = async function transformVars(vars) {
  const result = { ...vars };

  if (vars.skill_path) {
    const fullPath = path.join(REPO_ROOT, vars.skill_path);
    try {
      result.skill_content = fs.readFileSync(fullPath, 'utf8');
    } catch (err) {
      throw new Error(`extract-skill-content: cannot read skill_path "${fullPath}": ${err.message}`);
    }

    // Auto-load all sibling .md files in the same skill directory (e.g. REFERENCE.md)
    const skillDir = path.dirname(fullPath);
    const siblings = fs.readdirSync(skillDir)
      .filter(f => f !== 'SKILL.md' && f.endsWith('.md'))
      .sort();
    if (siblings.length > 0) {
      result.reference_content = siblings.map(f => {
        const content = fs.readFileSync(path.join(skillDir, f), 'utf8');
        return `### ${f}\n\n${content}`;
      }).join('\n\n---\n\n');
    }
  }

  // Optional cross-skill reference_path — appended after auto-discovered siblings
  if (vars.reference_path) {
    const fullPath = path.join(REPO_ROOT, vars.reference_path);
    if (fs.existsSync(fullPath)) {
      const crossRef = fs.readFileSync(fullPath, 'utf8');
      const header = `### ${path.basename(vars.reference_path)} (cross-skill)\n\n${crossRef}`;
      result.reference_content = result.reference_content
        ? `${result.reference_content}\n\n---\n\n${header}`
        : header;
    }
  }

  // project_root with "file://fixtures-fs/" prefix points to a real directory fixture.
  // Copy it to a temp dir so scripts can write files without dirtying the source fixture.
  if (vars.project_root && vars.project_root.startsWith('file://fixtures-fs/')) {
    const relativePath = vars.project_root.replace('file://fixtures-fs/', 'tests/promptfoo/fixtures-fs/');
    const sourceDir = path.join(REPO_ROOT, relativePath);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfoo-fixture-'));
    fs.cpSync(sourceDir, tmpDir, { recursive: true });

    // Auto-run fixture setup script if present (initializes git state, stages files, etc.)
    const setupScript = path.join(tmpDir, 'setup.sh');
    if (fs.existsSync(setupScript)) {
      const { execSync } = require('child_process');
      execSync(`bash "${setupScript}"`, { cwd: tmpDir, timeout: 10_000, stdio: 'pipe' });
    }

    result.project_root = tmpDir;
    result.repo_root = REPO_ROOT;
  }

  // script_path with "repo://" prefix resolves relative to repo root
  if (vars.script_path && vars.script_path.startsWith('repo://')) {
    result.script_path = path.join(REPO_ROOT, vars.script_path.replace('repo://', ''));
  }

  // script_args: replace {{project_root}} placeholder after temp dir resolution
  if (vars.script_args && result.project_root) {
    result.script_args = vars.script_args.replace('{{project_root}}', result.project_root);
  }

  return result;
};
