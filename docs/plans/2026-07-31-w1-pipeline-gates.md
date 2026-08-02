# W1 Pipeline Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CI a real merge gate — typecheck, tests, migration-numbering lint, and a Vercel function-count guard all block bad code from reaching `main` or production.

**Architecture:** Two small standalone Node lint scripts (`scripts/lint-migrations.js`, `scripts/lint-api-functions.js`), each exporting a pure function that is unit-tested and a CLI wrapper that exits non-zero. Both are wired into `.github/workflows/ci.yml` alongside the existing `typecheck` and `test` scripts. Because Vercel Hobby deploys on push independently of GitHub Actions, a `vercel-build` npm script re-runs the same gate at deploy time. A GitHub ruleset then makes the CI check required for merge.

**Tech Stack:** Node 24 (ESM — `package.json` has `"type": "module"`), vitest 4, TypeScript (`tsc --noEmit`), GitHub Actions, GitHub CLI (`gh`), Vercel.

> **Amendment (2026-08-01, Task 4):** originally written against Node 20. Wiring
> the CI gate surfaced a two-week-old `npm ci` EUSAGE failure on Node 20/npm 10
> (an unsatisfiable optional peer dep in `@sentry/node`'s bundled
> `@sentry/server-utils`, tolerated by npm 11 but not npm 10). CI's
> `actions/setup-node` was bumped to Node 24 to fix it; project-owner-approved.
> Task 5 (the `vercel-build` gate) must confirm Vercel's own project Node
> version is also 24 before relying on the same `npm ci` succeeding there.

**Source spec:** `docs/specs/2026-07-31-infra-9-plus-program-design.md` §7 (W1).

## Global Constraints

- **Free tier only.** No Vercel Pro, no Supabase Pro, no paid GitHub plan. (Spec §2)
- **ESM everywhere.** `package.json` declares `"type": "module"` — use `import`, never `require`, in new `.js` files.
- **Vercel serverless function ceiling is 12.** Currently exactly 12 entrypoints. Adding a 13th breaks deploys. (Spec §2)
- **Repo is PUBLIC** (`AyeniTaiwoSPC270/FYpro-v2`) — GitHub rulesets and branch protection are free. (Spec §7)
- **Verified baseline, 2026-07-31:** `npm run typecheck` passes clean. Real test suite is **41 files / 507 tests / ~25s**. A naive `npm run test` reports 74 files / 936 tests because of stale `api/.worktrees/` duplicates — Task 1 fixes this.
- **Never commit `.env.local` or real keys.** (CLAUDE.md §17)
- **Commit one logical change per commit.** (CLAUDE.md §17)
- **Work on a branch, not `main`.** Before Task 1, run `git checkout -b feat/w1-pipeline-gates` from an up-to-date `main`. Tasks 1–5 commit to that branch; Task 4 Step 7 pushes it and opens a PR so CI runs against the PR. Merge that PR **before** starting Task 6 — Task 6 creates the ruleset that requires the CI check, and the check must already exist on `main` for the ruleset to bind to it.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `vite.config.js` (modify) | Exclude `**/.worktrees/**` from vitest collection | 1 |
| `scripts/lint-migrations.js` (create) | Pure `findDuplicatePrefixes()` + CLI that exits 1 on duplicates | 2 |
| `scripts/lint-migrations.test.js` (create) | Unit tests for `findDuplicatePrefixes()` | 2 |
| `migrations/0040_express_defense_tier.sql` (rename from `0029_`) | Resolve `0029` collision | 2 |
| `migrations/0041_user_ratings.sql` (rename from `0034_`) | Resolve `0034` collision | 2 |
| `scripts/lint-api-functions.js` (create) | Pure `countApiEntrypoints()` + CLI that exits 1 above 12 | 3 |
| `scripts/lint-api-functions.test.js` (create) | Unit tests for `countApiEntrypoints()` | 3 |
| `package.json` (modify) | Add `lint:migrations`, `lint:api`, `vercel-build` scripts | 2, 3, 5 |
| `.github/workflows/ci.yml` (modify) | Run typecheck, test, and both lints; update success comment | 4 |
| GitHub ruleset (no file) | Make the CI check required to merge | 6 |

---

### Task 1: Stop vitest running stale worktree duplicates

**Why:** `api/.worktrees/` holds two orphaned worktree copies (`feat-onboarding-questions`, `login-notifications`) containing 43 duplicate test files. They are gitignored, so CI never sees them — but local runs do. Until local and CI collect the same files, "tests pass" means two different things and the gate is not trustworthy.

**Files:**
- Modify: `vite.config.js:21-23`
- Delete: `api/.worktrees/` (local, untracked — nothing to commit)

**Interfaces:**
- Consumes: nothing.
- Produces: a test suite of exactly 41 files / 507 tests that is identical locally and in CI. Every later task's expected test output assumes this.

- [ ] **Step 1: Record the pre-change baseline**

Run: `npx vitest run 2>&1 | tail -5`
Expected: `Test Files  74 passed (74)` and `Tests  936 passed (936)`. Note these numbers — Step 4 must show them drop.

- [ ] **Step 2: Add the exclude to vitest config**

In `vite.config.js`, replace the `test` block:

```js
  test: {
    environment: 'node',
  },
```

with:

```js
  test: {
    environment: 'node',
    // Orphaned git worktrees under api/.worktrees/ hold stale duplicates of the
    // real suite. They are gitignored, so CI never collects them — excluding them
    // here keeps a local `npm run test` honest about what CI will actually run.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**'],
  },
```

Note: vitest's default `exclude` is replaced, not extended, so `node_modules` and `dist` must be listed explicitly.

- [ ] **Step 3: Delete the orphaned worktree directories**

These are not registered git worktrees (confirm with `git worktree list` — only `.claude/worktrees/fix+list1-ui-issues` should appear) and are untracked, so this removes nothing that git is tracking.

Run:
```bash
git worktree list
rm -rf api/.worktrees
```

- [ ] **Step 4: Verify the suite is now the real one**

Run: `npx vitest run 2>&1 | tail -5`
Expected: `Test Files  41 passed (41)` and `Tests  507 passed (507)`. If any test now *fails* that previously passed, stop — that means a real test depended on worktree files, which is a genuine bug to investigate before continuing.

- [ ] **Step 5: Confirm nothing tracked was removed**

Run: `git status --short vite.config.js api/`
Expected: `M vite.config.js` only. No deletions listed.

- [ ] **Step 6: Commit**

```bash
git add vite.config.js
git commit -m "test: exclude stale worktree duplicates from vitest collection

Local runs collected 74 files/936 tests; 43 files were stale duplicates under
the gitignored api/.worktrees/. CI only ever saw the real 41 files/507 tests.
Aligning the two so a green local run means a green CI run."
```

---

### Task 2: Migration-numbering lint, and fix the two existing collisions

**Why:** `migrations/` has two `0029_*` files and two `0034_*` files. Nothing prevents a third collision. Spec §7 criterion 2 requires the lint and the fix to land together so `main` is never knowingly left red.

**Renumbering decision (do not improvise):** the earlier-committed file of each pair keeps its number; the later one moves to the end of the sequence. Verified via `git log --diff-filter=A`:
- `0029_dismissed_banners.sql` (2026-06-13) **keeps** `0029`.
- `0029_express_defense_tier.sql` (2026-06-14) **becomes** `0040_express_defense_tier.sql`.
- `0034_add_defense_brief_step_type.sql` (commit `1dd939f`) **keeps** `0034`.
- `0034_user_ratings.sql` (commit `9ed53cf`, later) **becomes** `0041_user_ratings.sql`.

Moving to the end (rather than into the unused `0011`/`0020` slots) preserves replay order: a migration created later must never replay earlier. Both renamed migrations are already applied in production and are independent of later ones, so replaying them last on a fresh database is safe.

**Files:**
- Create: `scripts/lint-migrations.js`
- Test: `scripts/lint-migrations.test.js`
- Rename: `migrations/0029_express_defense_tier.sql` → `migrations/0040_express_defense_tier.sql`
- Rename: `migrations/0034_user_ratings.sql` → `migrations/0041_user_ratings.sql`
- Modify: `package.json` (scripts block)

**Interfaces:**
- Consumes: nothing.
- Produces: `findDuplicatePrefixes(filenames: string[]) => Array<{ prefix: string, files: string[] }>` exported from `scripts/lint-migrations.js`. Task 4 calls the CLI form via `npm run lint:migrations`.

- [ ] **Step 1: Write the failing test**

Create `scripts/lint-migrations.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { findDuplicatePrefixes } from './lint-migrations.js';

describe('findDuplicatePrefixes', () => {
  it('returns an empty array when every prefix is unique', () => {
    const files = ['0002_a.sql', '0003_b.sql', '0004_c.sql'];
    expect(findDuplicatePrefixes(files)).toEqual([]);
  });

  it('reports a prefix used by two files', () => {
    const files = ['0029_dismissed_banners.sql', '0029_express_defense_tier.sql', '0030_x.sql'];
    expect(findDuplicatePrefixes(files)).toEqual([
      { prefix: '0029', files: ['0029_dismissed_banners.sql', '0029_express_defense_tier.sql'] },
    ]);
  });

  it('reports multiple colliding prefixes sorted by prefix', () => {
    const files = ['0034_b.sql', '0029_b.sql', '0029_a.sql', '0034_a.sql'];
    expect(findDuplicatePrefixes(files)).toEqual([
      { prefix: '0029', files: ['0029_a.sql', '0029_b.sql'] },
      { prefix: '0034', files: ['0034_a.sql', '0034_b.sql'] },
    ]);
  });

  it('ignores files that do not start with a four-digit prefix', () => {
    const files = ['README.md', 'staging-schema.sql', '0002_a.sql'];
    expect(findDuplicatePrefixes(files)).toEqual([]);
  });

  it('reports three files sharing one prefix as a single entry', () => {
    const files = ['0005_a.sql', '0005_b.sql', '0005_c.sql'];
    expect(findDuplicatePrefixes(files)).toEqual([
      { prefix: '0005', files: ['0005_a.sql', '0005_b.sql', '0005_c.sql'] },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/lint-migrations.test.js`
Expected: FAIL — cannot resolve `./lint-migrations.js`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lint-migrations.js`:

```js
#!/usr/bin/env node
// Fails the build when two files in migrations/ share a four-digit prefix.
// Duplicate numbering makes replay order ambiguous, which breaks the schema-drift
// check in W4 and makes "which migration ran first" unanswerable.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', 'migrations');

/**
 * Groups migration filenames by their four-digit prefix and returns only the
 * prefixes claimed by more than one file.
 * @param {string[]} filenames - bare filenames, e.g. ['0029_a.sql', '0030_b.sql']
 * @returns {Array<{ prefix: string, files: string[] }>} sorted by prefix, files sorted
 */
export function findDuplicatePrefixes(filenames) {
  const byPrefix = new Map();

  for (const name of filenames) {
    const match = /^(\d{4})_/.exec(name);
    if (!match) continue;
    const prefix = match[1];
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(name);
  }

  return [...byPrefix.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([prefix, files]) => ({ prefix, files: [...files].sort() }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

function main() {
  const filenames = readdirSync(MIGRATIONS_DIR).filter(n => n.endsWith('.sql'));
  const duplicates = findDuplicatePrefixes(filenames);

  if (duplicates.length === 0) {
    console.log(`✓ migrations: ${filenames.length} files, no duplicate prefixes`);
    return;
  }

  console.error('✗ migrations: duplicate numeric prefixes found\n');
  for (const { prefix, files } of duplicates) {
    console.error(`  ${prefix}: ${files.join(', ')}`);
  }
  console.error('\nRenumber the later-created file to the next free number at the end of the sequence.');
  process.exit(1);
}

// Run main() only when invoked directly, not when imported by tests.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/lint-migrations.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the CLI against the real tree and watch it fail correctly**

Run: `node scripts/lint-migrations.js`
Expected: exits 1, printing:
```
  0029: 0029_dismissed_banners.sql, 0029_express_defense_tier.sql
  0034: 0034_add_defense_brief_step_type.sql, 0034_user_ratings.sql
```
This is the lint proving itself against a real defect before we fix it.

- [ ] **Step 6: Rename the two later migrations**

```bash
git mv migrations/0029_express_defense_tier.sql migrations/0040_express_defense_tier.sql
git mv migrations/0034_user_ratings.sql migrations/0041_user_ratings.sql
```

- [ ] **Step 7: Add a provenance note to each renamed file**

At the top of `migrations/0040_express_defense_tier.sql`, insert as the first line:

```sql
-- Renumbered 2026-07-31 from 0029_express_defense_tier.sql (prefix collided with 0029_dismissed_banners.sql). Already applied in production.
```

At the top of `migrations/0041_user_ratings.sql`, insert as the first line:

```sql
-- Renumbered 2026-07-31 from 0034_user_ratings.sql (prefix collided with 0034_add_defense_brief_step_type.sql). Already applied in production.
```

- [ ] **Step 8: Verify the lint now passes**

Run: `node scripts/lint-migrations.js`
Expected: exit 0, printing `✓ migrations: 38 files, no duplicate prefixes`.

- [ ] **Step 9: Add the npm script**

In `package.json`, add to `"scripts"`:

```json
    "lint:migrations": "node scripts/lint-migrations.js",
```

- [ ] **Step 10: Verify via npm and confirm the regression guard works**

Run: `npm run lint:migrations`
Expected: exit 0.

Then prove it catches a new collision:
```bash
cp migrations/0030_project_mode.sql migrations/0030_temp_collision.sql
npm run lint:migrations; echo "exit=$?"
rm migrations/0030_temp_collision.sql
```
Expected: `exit=1` with `0030:` listed, then clean up. Re-run `npm run lint:migrations` and confirm exit 0 again.

- [ ] **Step 11: Commit**

```bash
git add scripts/lint-migrations.js scripts/lint-migrations.test.js package.json migrations/
git commit -m "build: add migration prefix lint and renumber colliding migrations

0029_express_defense_tier -> 0040, 0034_user_ratings -> 0041. Later-created file
of each pair moves to the end so replay order still matches creation order. Both
are already applied in production; renaming affects fresh-database replay only."
```

---

### Task 3: Vercel function-count guard

**Why:** the Hobby plan allows 12 serverless functions and `api/` currently has exactly 12. A 13th breaks production deploys. Spec §7 criterion 3 turns that into a CI error instead of a deploy-time surprise.

**Files:**
- Create: `scripts/lint-api-functions.js`
- Test: `scripts/lint-api-functions.test.js`
- Modify: `package.json` (scripts block)

**Interfaces:**
- Consumes: nothing.
- Produces: `countApiEntrypoints(filenames: string[]) => string[]` exported from `scripts/lint-api-functions.js`, returning the sorted entrypoint filenames. Task 4 calls the CLI form via `npm run lint:api`.

**Counting rule:** only top-level files directly in `api/` ending `.js` or `.ts` count. Excluded: anything containing `.test.`, and anything in a subdirectory (`api/_lib/`, `api/_emails/`) — Vercel treats underscore-prefixed directories as non-routes. The current 12 are: `admin.js`, `ai.js`, `auth.js`, `certificate.js`, `notify.js`, `payments.js`, `project-reviewer.js`, `referral.js`, `research.js`, `send-nurture-email.ts`, `share-card.js`, `speak.js`.

- [ ] **Step 1: Write the failing test**

Create `scripts/lint-api-functions.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { countApiEntrypoints, MAX_FUNCTIONS } from './lint-api-functions.js';

describe('countApiEntrypoints', () => {
  it('counts .js and .ts files as entrypoints', () => {
    expect(countApiEntrypoints(['ai.js', 'send-nurture-email.ts'])).toEqual([
      'ai.js',
      'send-nurture-email.ts',
    ]);
  });

  it('excludes test files', () => {
    expect(countApiEntrypoints(['payments.js', 'payments.test.js', 'auth.test.js'])).toEqual([
      'payments.js',
    ]);
  });

  it('excludes non-JS/TS files', () => {
    expect(countApiEntrypoints(['ai.js', 'README.md', 'schema.sql'])).toEqual(['ai.js']);
  });

  it('returns results sorted', () => {
    expect(countApiEntrypoints(['speak.js', 'admin.js', 'notify.js'])).toEqual([
      'admin.js',
      'notify.js',
      'speak.js',
    ]);
  });

  it('exposes the Vercel Hobby ceiling as 12', () => {
    expect(MAX_FUNCTIONS).toBe(12);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/lint-api-functions.test.js`
Expected: FAIL — cannot resolve `./lint-api-functions.js`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lint-api-functions.js`:

```js
#!/usr/bin/env node
// Guards the Vercel Hobby 12-serverless-function ceiling.
// api/ is at exactly 12; a 13th entrypoint fails the deploy, so catch it in CI.
// Underscore-prefixed directories (api/_lib, api/_emails) are shared modules,
// not routes, and are never counted — only top-level files in api/.

import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(HERE, '..', 'api');

export const MAX_FUNCTIONS = 12;

/**
 * Filters a list of bare filenames down to Vercel serverless entrypoints.
 * @param {string[]} filenames - bare filenames from the top level of api/
 * @returns {string[]} sorted entrypoint filenames
 */
export function countApiEntrypoints(filenames) {
  return filenames
    .filter(name => /\.(js|ts)$/.test(name))
    .filter(name => !name.includes('.test.'))
    .sort();
}

function main() {
  const topLevel = readdirSync(API_DIR).filter(name =>
    statSync(join(API_DIR, name)).isFile()
  );
  const entrypoints = countApiEntrypoints(topLevel);

  if (entrypoints.length <= MAX_FUNCTIONS) {
    console.log(`✓ api: ${entrypoints.length}/${MAX_FUNCTIONS} serverless functions`);
    return;
  }

  console.error(
    `✗ api: ${entrypoints.length} serverless functions exceeds the Vercel Hobby limit of ${MAX_FUNCTIONS}\n`
  );
  for (const name of entrypoints) console.error(`  ${name}`);
  console.error('\nMerge an existing endpoint before adding a new one (see CLAUDE.md section 12).');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/lint-api-functions.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the CLI against the real tree**

Run: `node scripts/lint-api-functions.js`
Expected: exit 0, printing `✓ api: 12/12 serverless functions`.

- [ ] **Step 6: Prove it catches a 13th function**

```bash
echo "export default function handler(req, res) { res.status(200).end(); }" > api/temp-guard-check.js
node scripts/lint-api-functions.js; echo "exit=$?"
rm api/temp-guard-check.js
```
Expected: `exit=1` listing 13 files. Then re-run `node scripts/lint-api-functions.js` and confirm exit 0.

- [ ] **Step 7: Add the npm script**

In `package.json`, add to `"scripts"`:

```json
    "lint:api": "node scripts/lint-api-functions.js",
```

- [ ] **Step 8: Verify via npm**

Run: `npm run lint:api`
Expected: exit 0, `✓ api: 12/12 serverless functions`.

- [ ] **Step 9: Commit**

```bash
git add scripts/lint-api-functions.js scripts/lint-api-functions.test.js package.json
git commit -m "build: add Vercel function-count guard

api/ sits at exactly 12 of 12 allowed Hobby functions. A 13th breaks deploys;
this turns that into a CI failure instead of a deploy-time surprise."
```

---

### Task 4: Wire the full gate into CI

**Why:** spec §7 criterion 1. `ci.yml` currently runs audit → lint → build only. `typecheck` and `test` exist and pass but are never invoked, so a PR that breaks every test merges green.

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run lint:migrations` (Task 2), `npm run lint:api` (Task 3), the aligned test suite (Task 1).
- Produces: a CI job named `Audit · Lint · Typecheck · Test · Build`. Task 6 requires this exact job name in the ruleset.

- [ ] **Step 1: Rename the job to reflect what it now does**

In `.github/workflows/ci.yml`, change:

```yaml
    name: Audit · Lint · Build
```

to:

```yaml
    name: Audit · Lint · Typecheck · Test · Build
```

- [ ] **Step 2: Insert the new steps between Lint and Build**

After the existing `- name: Lint` step and before `- name: Build`, insert:

```yaml
      # Structural guards — cheap, and they fail fast before the slower steps.
      - name: Lint migration numbering
        run: npm run lint:migrations

      - name: Guard Vercel function count
        run: npm run lint:api

      # tsc --noEmit with strictNullChecks + noImplicitAny (tsconfig.json).
      - name: Typecheck
        run: npm run typecheck

      # vitest run — 41 files / 507 tests at time of writing (~25s).
      - name: Test
        run: npm run test
```

- [ ] **Step 3: Update the success comment table**

In the `Post success comment` step, replace the table rows array:

```js
                '| Check | Result |',
                '|-------|--------|',
                '| Security audit (`--audit-level=moderate`) | ✅ Clean |',
                '| ESLint | ✅ No errors |',
                '| Vite build | ✅ Success |',
```

with:

```js
                '| Check | Result |',
                '|-------|--------|',
                '| Security audit (`--audit-level=moderate`) | ✅ Clean |',
                '| ESLint | ✅ No errors |',
                '| Migration numbering | ✅ No duplicate prefixes |',
                '| Vercel function count | ✅ Within 12 |',
                '| Typecheck (`tsc --noEmit`) | ✅ No errors |',
                '| Tests (`vitest run`) | ✅ Passing |',
                '| Vite build | ✅ Success |',
```

- [ ] **Step 4: Verify the workflow file is valid YAML**

Run: `npx --yes yaml-lint .github/workflows/ci.yml`
Expected: `.github/workflows/ci.yml is valid YAML.`

Do not skip this. A malformed workflow silently never runs, which is indistinguishable from "no CI configured" — you would believe you had a gate when you had none.

- [ ] **Step 5: Run the whole gate locally exactly as CI will**

Run:
```bash
npm run lint && npm run lint:migrations && npm run lint:api && npm run typecheck && npm run test && npm run build
```
Expected: every command exits 0. This must pass before pushing — otherwise the first CI run fails on `main`.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: gate on typecheck, tests, migration lint, and function count

CI ran audit/lint/build only, so a PR breaking every test could merge green.
Closes the P0 CI gating item from the 2026-07-28 architecture ledger."
```

- [ ] **Step 7: Push the branch, open a PR, and confirm CI runs the new steps**

```bash
git push -u origin feat/w1-pipeline-gates
gh pr create --title "ci: gate on typecheck, tests, migration lint, function count" \
  --body "Implements W1 of the infrastructure 9+ program. See docs/plans/2026-07-31-w1-pipeline-gates.md"
gh pr checks --watch
```
Expected: the run shows all seven steps, all green. If `Test` or `Typecheck` does not appear in the step list, the workflow edit did not take effect — fix before continuing. Task 6 depends on this exact job existing on `main`.

---

### Task 5: Make the Vercel deploy honour the same gate

**Why:** spec §7 criterion 5. Vercel Hobby builds on push to `main` independently of GitHub Actions, and deployment protection is a Pro feature. Without this, a red CI still ships to production. Running the gate inside the build is the only free mechanism.

**Design note:** use a `vercel-build` script rather than changing `build`. Vercel runs `vercel-build` when present and falls back to `build` otherwise, so local `npm run build` and `npm run dev` stay fast while deploys get the full gate.

**Files:**
- Modify: `package.json` (scripts block)

**Interfaces:**
- Consumes: `typecheck`, `test`, `lint:migrations`, `lint:api` scripts.
- Produces: a `vercel-build` script. No later task depends on it.

- [ ] **Step 1: Add the script**

In `package.json`, add to `"scripts"`:

```json
    "vercel-build": "npm run lint:migrations && npm run lint:api && npm run typecheck && npm run test && vite build",
```

Leave `"build": "vite build"` unchanged — local builds stay fast.

- [ ] **Step 2: Verify it runs the full gate**

Run: `npm run vercel-build`
Expected: migration lint ✓, function guard ✓, `tsc` clean, `41 passed (41)` / `507 passed (507)`, then a successful `vite build`. Total roughly 60–90 seconds.

- [ ] **Step 3: Confirm the plain build is still fast**

Run: `npm run build`
Expected: `vite build` only — no tests, no typecheck.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "build: run the CI gate inside vercel-build

Vercel Hobby deploys on push independently of GitHub Actions and deployment
protection is a Pro feature, so a red CI could still ship. Vercel prefers
vercel-build over build, so deploys get the gate while local builds stay fast."
```

- [ ] **Step 5: Verify against a real deploy**

Merge the PR from Task 4 Step 7 to `main`, then check the Vercel deployment log for the build step.
Expected: the log shows the migration lint, function guard, typecheck, and vitest output before `vite build`. If it shows only `vite build`, Vercel is using the wrong script — check for a Build Command override in the Vercel project settings, which takes precedence over `vercel-build`.

---

### Task 6: Require the CI check to merge

**Why:** spec §7 criterion 4. CI that reports but does not block is advisory. The repo is **public**, so rulesets are free.

**Files:** none — this is GitHub repository configuration.

**Interfaces:**
- Consumes: the CI job name from Task 4 (`Audit · Lint · Typecheck · Test · Build`).
- Produces: nothing consumed by later tasks. This is the terminal task of W1.

- [ ] **Step 1: Confirm the exact check name GitHub sees**

Run: `gh api repos/AyeniTaiwoSPC270/FYpro-v2/commits/main/check-runs --jq '.check_runs[].name'`
Expected: a name matching the job from Task 4. Use the string this returns verbatim in Step 2 — the ruleset matches on the *check run* name, and a mismatch silently protects nothing.

- [ ] **Step 2: Create the ruleset**

Substitute `<CHECK_NAME>` with the exact string from Step 1:

```bash
gh api --method POST repos/AyeniTaiwoSPC270/FYpro-v2/rulesets \
  -f name='Require CI on main' \
  -f target='branch' \
  -f enforcement='active' \
  -F 'conditions[ref_name][include][]=~DEFAULT_BRANCH' \
  -F 'rules[0][type]=pull_request' \
  -F 'rules[1][type]=required_status_checks' \
  -f 'rules[1][parameters][required_status_checks][0][context]=<CHECK_NAME>' \
  -F 'rules[1][parameters][strict_required_status_checks_policy]=true'
```

- [ ] **Step 3: Verify the ruleset is active**

Run: `gh api repos/AyeniTaiwoSPC270/FYpro-v2/rulesets --jq '.[] | {name, enforcement, target}'`
Expected: `Require CI on main`, `enforcement: active`, `target: branch`.

- [ ] **Step 4: Prove the gate blocks a bad merge**

This is the criterion's actual verification — do not skip it.

```bash
git checkout -b test/ci-gate-proof
```

Add a deliberate type error to `src/lib/storage.ts` — append this line at the end of the file:

```ts
export const __ciGateProof: number = "this is a string, not a number";
```

Then:
```bash
git add src/lib/storage.ts
git commit -m "test: deliberate type error to verify CI gate blocks merge"
git push -u origin test/ci-gate-proof
gh pr create --title "TEST: verify CI gate blocks merge" --body "Deliberate type error. Expected: CI fails, merge blocked. Delete after verification."
gh pr checks --watch
```

Expected: the CI check fails at the Typecheck step, and `gh pr view --json mergeStateStatus --jq .mergeStateStatus` returns `BLOCKED`.

- [ ] **Step 5: Clean up the proof**

```bash
gh pr close test/ci-gate-proof --delete-branch
git checkout main
git branch -D test/ci-gate-proof
```

Confirm the type error is gone: `npm run typecheck` exits 0.

- [ ] **Step 6: Record the result in the spec checklist**

Append to `docs/specs/2026-07-31-infra-9-plus-program-design.md` under §7, a short "Verified" note stating the date, the ruleset name, and that the blocked-merge drill passed with the PR number.

```bash
git add docs/specs/2026-07-31-infra-9-plus-program-design.md
git commit -m "docs: record W1 gate verification result"
git push
```

---

## Verification: W1 exit criteria

Run this after Task 6. Every row must pass before W1 is marked complete and W2 planning begins.

| Spec §7 criterion | Verified by | Expected |
|---|---|---|
| 1. CI runs typecheck + test, both block | `gh run view` on any PR | Typecheck and Test steps present and required |
| 2. Migration-prefix lint fails on duplicates | Task 2 Step 10 regression check | `exit=1` on an injected collision |
| 3. Function-count guard fails above 12 | Task 3 Step 6 regression check | `exit=1` on a 13th file |
| 4. Red CI blocks merge on `main` | Task 6 Step 4 drill | `mergeStateStatus: BLOCKED` |
| 5. Production deploy cannot bypass the gate | Task 5 Step 5 deploy log | Gate output precedes `vite build` |
| 6. Local and CI runs cover the same files | `npx vitest run` | `41 passed (41)` / `507 passed (507)` |

**On completion:** CI/CD moves 5.0 → 9 (spec §13), and three ledger items close — the P0 CI gating item, the P1 migration-numbering item, and part of the Testing criteria in W6.
