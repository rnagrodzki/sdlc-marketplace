---
name: initializing-review-dimensions
description: "Use this skill to initialize or expand review dimensions for a project. Scans the project's tech stack, dependencies, file patterns, and architecture to propose relevant review dimensions tailored to the specific project. Triggers on: initialize review dimensions, add review dimension, setup code review, create dimension files, expand review config, review-init."
user-invokable: false
---

# Initializing Review Dimensions

Project-aware dimension creator: scan tech stack, propose tailored dimensions with evidence,
let the user select, write files, and validate with the validation script.

Supporting references (dimension format spec, 5 example dimensions) are in
`reviewing-changes/REFERENCE.md` and `reviewing-changes/EXAMPLES.md`. Locate them with Glob:
`**/reviewing-changes/REFERENCE.md`.

---

## Arguments

- `--add` — expansion mode: propose only dimensions not already installed

---

## Workflow

### Step 1 (SCAN) — Analyze Project Tech Stack

Use Glob to discover and then Read in parallel to collect signals. Do NOT read entire
codebases — read only manifests, config files, and directory listings.

**Dependency manifests (read if they exist):**

- `package.json` — Node.js/JS/TS deps, devDeps, scripts
- `requirements.txt`, `pyproject.toml`, `setup.py` — Python
- `go.mod` — Go
- `Cargo.toml` — Rust
- `pom.xml`, `build.gradle` — Java/JVM
- `Gemfile` — Ruby

**Structural signals (Glob only — do not read content):**

```text
**/middleware/**      → auth / request pipeline
**/auth/**           → authentication
**/routes/**         → HTTP routing
**/controllers/**    → MVC controllers
**/handlers/**       → request handlers
**/migrations/**     → database migrations
**/models/**         → data models
**/repositories/**   → data access layer
**/workers/**        → background workers
**/queues/**         → message queues
**/jobs/**           → scheduled jobs
**/components/**     → UI components
**/pages/**          → page components (Next.js, Nuxt, etc.)
**/views/**          → view templates
**/*.scss            → CSS/styling
**/terraform/**      → infrastructure as code
**/k8s/**            → Kubernetes manifests
**/Dockerfile        → containerization
**/*.test.*          → test files
**/*.spec.*          → test files
docs/                → documentation directory
```

**Config files (read if they exist):**

- `.github/workflows/*.yml` → CI/CD
- `.eslintrc*`, `pylintrc`, `golangci.yml` → linting

From the scan, extract:

1. **Primary language(s)** and framework(s) (Express, FastAPI, Gin, Spring, Rails, etc.)
2. **Key dependency categories** — auth, ORM, HTTP, queues, caching
3. **Directory patterns** present in the repo (with file counts where useful)
4. **Infrastructure and tooling** signals

---

### Step 2 — Discover Existing Dimensions

Check `.claude/review-dimensions/` for already-installed dimension files.

In `--add` (expansion) mode:

- Locate the validation script with Glob: `**/sdlc-utilities/scripts/validate-dimensions.js`
- Run: `node <plugin-scripts-path>/validate-dimensions.js --project-root . --json`
- Extract the list of currently installed dimension names from the output
- Note their trigger patterns so new proposals avoid identical globs

If NOT in expansion mode: skip this step.

---

### Step 3 (PLAN) — Propose Dimension Catalog

Based on evidence from Step 1, select dimensions to propose using this table:

| Evidence found | Dimension | Severity |
| --- | --- | --- |
| Auth dirs, JWT/OAuth/session deps | `security-review` | high |
| ORM deps, migration files, SQL dirs | `data-integrity-review` | high |
| Route/controller/handler dirs, OpenAPI/Swagger files | `api-review` | high |
| Queue libs, worker dirs, async patterns, thread pools | `concurrency-review` | high |
| Cache libs (Redis, Memcached), service/repo layers | `performance-review` | medium |
| Test files present (`*.test.*`, `*.spec.*`) | `test-coverage-review` | medium |
| Multiple `.md` files, `docs/` directory | `documentation-review` | low |
| Docker, k8s, Terraform, CI/CD files | `infrastructure-review` | medium |
| UI components, CSS/SCSS, template files | `ui-review` | medium |
| Any project (always include) | `code-quality-review` | medium |

**Rules:**

- Only propose a dimension if there is concrete evidence — do NOT propose `api-review`
  for a CLI tool with no routes
- Always include `code-quality-review` as the baseline
- In `--add` mode: exclude dimensions already installed

For each proposed dimension, prepare:

- **Name**: lowercase-hyphenated (must match D2 constraints)
- **Description**: one sentence, max 256 chars
- **Why relevant**: cite specific evidence (file paths, dependency names, directory file counts)
- **Trigger patterns**: match the project's actual directory names (not generic defaults)
- **Skip-when patterns**: test/vendor/build/dist dirs
- **Body**: tailored checklist referencing the specific frameworks/libraries found

**Customization is mandatory** — do not generate generic dimensions. Reference the project's
actual stack in the body (e.g., "Check SQLAlchemy ORM usage — avoid raw `session.execute()`
with string concatenation", not just "avoid raw SQL").

---

### Step 4 (CRITIQUE) — Evaluate Proposals

Before presenting, self-review the full proposal set:

- **Trigger specificity**: any trigger that matches `**/*` or similarly broad? Tighten it to the actual directories found.
- **Overlap**: do two proposed dimensions share identical trigger file sets? Flag for merging.
- **Evidence quality**: is each proposal backed by concrete scan findings? Remove any without evidence.
- **Instructions tailored**: does each body reference the project's specific framework by name? If not, add project context.
- **Expansion gaps** (in `--add` mode): are there project patterns not covered by existing OR proposed dimensions?
- **Trigger validity**: do patterns conform to glob syntax (no `***`, balanced brackets)?

---

### Step 5 (IMPROVE) — Refine Proposals

Based on the critique:

- Tighten broad triggers to match the project's actual directory structure
- Resolve overlaps: merge into one dimension or split triggers so each has exclusive coverage
- Add project-specific framework/library names to each dimension's body
- Remove any dimension without concrete evidence

---

### Step 6 (DO) — Present and Create

**Present proposals** as a numbered list with evidence summaries:

```text
Proposed review dimensions for this project:

1. code-quality-review (medium severity) — always included
   Coverage: **/*.ts, **/*.tsx
   Why: TypeScript project with 47 source files

2. security-review (high severity)
   Coverage: **/middleware/**, **/auth/**, **/*auth*
   Why: Found `jsonwebtoken` and `passport` in package.json; src/auth/ with 8 files

3. api-review (high severity)
   Coverage: **/routes/**, **/controllers/**
   Why: Express.js routes in src/routes/ (12 files), OpenAPI spec at docs/api.yaml

Install which? (numbers comma-separated, or "all"):
```

Wait for user selection.

For each selected dimension:

1. Create `.claude/review-dimensions/` if it does not exist:

   ```bash
   mkdir -p .claude/review-dimensions
   ```

2. Write the full dimension file (frontmatter + tailored body). Use the corresponding
   example from `reviewing-changes/EXAMPLES.md` as the starting template, then
   customize with the project-specific evidence.
3. Confirm each file written with its path.

---

### Step 7 — Validate Installation

Run the validation script:

```bash
node <plugin-scripts-path>/validate-dimensions.js --project-root . --markdown
```

Present the markdown output table.

If any file has errors, show the error detail and offer to fix them automatically.

---

## Quality Gates

Before marking complete, verify:

- Every proposed dimension cites specific project evidence (file paths, dependency names, counts)
- Every created dimension passes all D1-D12 validation checks
- No duplicate dimension names (including against existing dimensions in `--add` mode)
- All trigger patterns reference the project's actual directory structure, not generic defaults

---

## Learning Capture

Log to `.claude/learnings/log.md` when:

- A tech stack pattern reliably mapped to a dimension that the user accepted — note the evidence-to-dimension mapping for future reuse
- User rejected a proposed dimension — note which dimension and the likely reason (triggers too broad? not relevant to their stack?)
- User requested a dimension that was not proposed — note what evidence was missed in the scan
- A created dimension failed validation — note which check failed and the root cause

## See Also

- `reviewing-changes/REFERENCE.md` — dimension file format spec and examples
- `reviewing-changes/EXAMPLES.md` — 5 copy-paste-ready dimension files to adapt
- `sdlc:reviewing-changes` — runs the dimensions created by this skill
