# TypeScript Foundations — Design

**Date:** 2026-07-31
**Status:** Approved, ready for implementation planning

---

## 1. Context and decision

FYPro v2 is ~25% TypeScript in `src/` and 0% in `api/`:

| Surface | JavaScript | TypeScript |
|---|---|---|
| `src/` | 104 `.jsx` + 28 `.js` (38,672 LOC) | 41 `.ts` + 5 `.tsx` |
| `api/` | 52 `.js` (14,125 LOC) | 2 `.ts` + 4 `.tsx` |

**A full JS→TS migration was considered and rejected.** Reviewing the project's actual
bug history — the gamification bugs, the Express Defence Brief bugs, the June 10 hunt,
the stale-chunk bug, the RLS leak — almost none are bugs TypeScript catches. They are
race conditions, stale UI, JSON truncation, service-worker caching, and RLS policy
errors: runtime, logic, and infrastructure failures.

Exactly one class in that history would have been caught: `final_score` vs
`total_score`, which silently broke every defense achievement. That is a database-shape
mismatch, and it is fixed by generating Supabase types and typing the client — **without
renaming a single `.jsx` file**. Roughly 90% of the available benefit sits in roughly 5%
of the work.

Supporting factors: the developer is solo (TS's largest win is protecting *other people*
from misusing your code); 936 tests already cover the runtime behaviour TS cannot reach;
and with ~0 external paying users against a 100-user goal, a multi-week migration ships
nothing a student can see.

**Scope of this work:** the 5% — generated DB types, a CI gate, lint coverage, and an
`api/` typecheck config. Plus two standing policies, stated here and not implemented:

- **v2.1 Workspace is written in TypeScript from day one.** A document model with Word
  export is exactly the complex nested state where types earn their keep.
- **Legacy files convert opportunistically** — only when already being edited for another
  reason. No scheduled conversion work.

**Revisit trigger:** a collaborator joining the codebase. At that point types stop being
documentation for one person and become a contract between two, and the calculus changes.

---

## 2. Baseline (measured 2026-07-31)

| Check | State |
|---|---|
| `npx tsc --noEmit` | Clean |
| `npm run test` | 936 passing, 74 files, ~45s |
| CI (`ci.yml`) | audit → lint → build. **No typecheck, no tests.** |
| ESLint scope | `**/*.{js,jsx}` only — 46 TS files unlinted |
| `tsconfig.json` | `include: ["src"]` — all of `api/` unchecked |
| Supabase surface in TS | 50 `.from()` calls across 19 files; `src/lib/db.ts` holds 39 refs |

Strictness is `strict: false` with `noImplicitAny: true` and `strictNullChecks: true`.
Those last two are the expensive ones — a file lands straight into the hard rules on
conversion, with no easing-in period.

**Vite builds with esbuild, which strips types without checking them.** Type errors
cannot break the production build. This is the central de-risking fact: a mistake here
fails `npm run typecheck`, not `fypro.com.ng`.

---

## 3. Sequencing

Ordered so the cheap certain win lands first and the expensive uncertain one lands last.
Two steps generate backlogs of unknown size; one is a free P0. If step 3 goes badly,
steps 1–2 are still banked. The reverse order risks banking nothing.

1. **CI gate + `tsconfig.api.json`** — §4. Both checks are green today, so this is free.
2. **typescript-eslint on a ratchet** — §5. Backlog of unknown size, made non-blocking.
3. **Generated `Database` types + typed client** — §6. The payoff, and the real risk.

Each step is a separate commit and can merge independently.

---

## 4. Step 1 — CI gate and `api/` config

### `tsconfig.api.json` (new, repo root)

Node-flavoured sibling to the root config:

- `lib: ["ES2022"]`, no DOM
- `types: ["node"]`
- `jsx: "react-jsx"` for the four `_emails/*.tsx` templates
- Same strictness as root (`strict: false`, `noImplicitAny`, `strictNullChecks`) so the
  two configs cannot drift
- `include: ["api/**/*.ts", "api/**/*.tsx"]`
- `checkJs: false` — the 52 JS files stay out

**Rationale for excluding the 52 JS files:** the 936 tests already protect the money
logic (`payments.js`, `credit-user.js`, `run-reservation.js`) better than `checkJs`
would, and `checkJs` over 14k LOC under `strictNullChecks` is a JSDoc project of its own
— the exact expensive-for-marginal-return work this design rejects.

### `package.json`

```
"typecheck": "tsc --noEmit && tsc -p tsconfig.api.json --noEmit"
```

One command covers both surfaces; CI needs no special knowledge.

### `.github/workflows/ci.yml`

Two blocking steps inserted between Lint and Build:

```yaml
- name: Typecheck
  run: npm run typecheck

- name: Test
  run: npm run test
```

Placed *before* Build so a failure reports the useful error rather than a downstream
build symptom. The success-comment table at `ci.yml:62-70` gains two rows.

### Prerequisite fix

Probing `tsconfig.api.json` against the current tree produces **exactly one error**:

```
api/send-nurture-email.ts(185,27): error TS2339: Property 'from' does not exist on type '{}'.
```

This is a **false positive from an intentional pattern**. `api/_lib/supabase-admin.js:33`
exports:

```js
export const supabaseAdmin = _client || new Proxy({}, {
  get() { throw _initError; },
});
```

The Proxy is a deliberate lazy-throw so a missing env var surfaces inside a request
handler's try/catch — as a clean logged 500 — instead of crashing the serverless module
at load time and yielding a bare 502 with no Sentry capture and no Telegram alert. TS
infers the union and narrows to `{}`.

**Fix:** a JSDoc type assertion typing the export as `SupabaseClient`. The file is `.js`,
so this is a comment — zero runtime change. The lazy-throw semantics documented in that
file's comment block are preserved exactly.

### Verification

- `npm run typecheck` green across both configs
- `npm run test` still 936 passing
- CI green on the PR

Both checks pass on `main` today, so this step cannot produce a backlog. If it goes red,
the change itself is wrong and is fixed before merge.

---

## 5. Step 2 — typescript-eslint on a ratchet

### Gap being closed

`eslint.config.js:10` scopes every rule to `**/*.{js,jsx}`. 46 TS files get no linting at
all, including five components that have never had `react-hooks/exhaustive-deps` run on
them: `AuthContext.tsx`, `OfflineBanner.tsx`, `AnonymousMigrationModal.tsx`,
`glyphs.tsx`, `frames.tsx`.

### Config shape

Add the `typescript-eslint` package and a second config block for `**/*.{ts,tsx}`:

- `tseslint.configs.recommended`
- `react-hooks` and `react-refresh` extended to TSX, so component rules finally cover
  those five files
- `@typescript-eslint/no-floating-promises` and `no-misused-promises`, enabled via
  `projectService: true` — which resolves each file to whichever of the two tsconfigs
  owns it, with no manual project wiring
- Base `no-unused-vars` **off** for TS files, replaced by
  `@typescript-eslint/no-unused-vars` carrying the existing
  `varsIgnorePattern: '^[A-Z_]'` so behaviour stays identical
- `vite.config.js`, `eslint.config.js` and `scripts/*.mjs` are plain JS and stay on the
  existing non-type-aware block — no `allowDefaultProject` needed

**Why the promise rules specifically, and not the full type-checked tier:** the full tier
(`no-unsafe-assignment`, `no-unsafe-member-access`, `no-explicit-any` et al.) on 46
never-linted files produces a backlog that competes with shipping v2.1. The two promise
rules are the highest-value subset for an app built almost entirely on async Supabase
calls.

### The ratchet

New findings land as **warnings**. `lint` becomes:

```
eslint . --max-warnings <baseline>
```

where `<baseline>` is the count measured at merge time. ESLint exits 0 on warnings, so
the backlog never blocks CI — but any *new* warning pushes the count past the ceiling and
fails the build. The number is lowered as the backlog burns down. No extra tooling, no
baseline file to maintain.

### Known unknown

The baseline count is unmeasured. 46 never-linted files will produce a wave, mostly
`exhaustive-deps`. The ratchet is precisely what makes that safe to not care about on day
one.

### Watch for, do not fix here

`no-floating-promises` findings should be read individually before being dismissed as
noise. A fire-and-forget Supabase insert whose failure vanishes silently is the exact
shape of the open "welcome bell notification drops for ~1/3 of signups" bug. If it
surfaces, it gets its own commit **outside this work** — scope here is the lint setup,
not the bug.

### Verification

- `npm run lint` exits 0 at the baseline
- Deliberately introducing a floating promise makes it exit non-zero

---

## 6. Step 3 — Generated types and the typed client

### Generated artifact

`src/types/database.ts`, generated from the production Supabase project
(`ayvunikgfwpylfrkpalj`), committed, with a header marking it generated and naming the
regeneration command. New npm script:

```
"types:db": "supabase gen types typescript --project-id ayvunikgfwpylfrkpalj > src/types/database.ts"
```

This requires the Supabase CLI and an authenticated session. The Supabase MCP server's
`generate_typescript_types` is the fallback for generating the file when the CLI is not
available locally.

It is a **snapshot**. The moment a migration lands without a regeneration, the types
quietly start lying. Regenerating therefore becomes a step in the migration workflow,
alongside the RLS verification that CLAUDE.md §6 already mandates.

### Wiring

One line in `src/lib/supabase.ts:6`:

```ts
createClient<Database>(supabaseUrl, supabaseAnonKey, { ... })
```

`api/_lib/supabase-admin.js` deliberately stays untyped — it is a `.js` file with
`checkJs` off, so it would gain nothing, and typing it would drag a `src/` import across
into `api/`. The option remains open later.

### Data flow

`Database` → `supabase` client → the 19 TS files. Every `.from('x').select()` stops
returning `any` and starts returning `T[] | null`. The 104 `.jsx` files are unaffected in
both directions — they are invisible to `tsc` (`allowJs` without `checkJs`), so their
call sites neither break nor gain protection. `src/lib/db.ts` is the hub with 39 of the
50 references and will absorb most of the change.

### Error handling — the rule that matters

Type errors are fixed **at the type level**: assertions, non-null narrowing, and guards
that preserve existing control flow exactly.

**No new early returns.** The tempting fix for a possibly-null `data` is
`if (!data) return`, and in the offline-snapshot path (`useProjectState.ts`, `db.ts`)
that silently changes runtime behaviour for exactly the low-network users the open
onboarding-redirect bug already affects. A compile-time change must stay compile-time.

### Expected error shapes

| Shape | Character |
|---|---|
| Null guards on `data` | The bulk. Mechanical. |
| Missing fields on `.insert()` payloads | Straightforward. |
| Genuine column typos | **The payoff class** — the `final_score` bug. |
| Complex `.select('a, b(c)')` joins | The ugly one. Can resolve to `never` and produce errors that read as nonsense. Give these an explicit return-type annotation rather than fighting them. |

### Fallback

Stated as a number so it is not relitigated mid-task: **if the fallout exceeds ~80 errors
or ~2 hours**, revert the one line, keep the generated types committed, and narrow
adoption to typed helpers inside `db.ts` only. Steps 1 and 2 stand on their own
regardless.

### Verification

- `npm run typecheck` green on both configs
- **936 tests still passing, unchanged** — nothing here touches runtime, so a single test
  failure means a fix altered behaviour and must be reworked
- Manual smoke: sign in, load `/dashboard`, open a project

---

## 7. Out of scope

- Converting any `.jsx` file to `.tsx`
- `checkJs` over the 52 `api/*.js` files
- The full `recommended-type-checked` ruleset
- Fixing the welcome-bell notification bug, even if lint surfaces it
- Typing `api/_lib/supabase-admin.js`
- CI-side verification that generated types match the live schema (would require DB
  credentials in CI)
