# TypeScript Typecheck Gate — Spec
**Date:** 2026-05-24
**Approach:** 1 — Install + typecheck script
**Scope:** Install the missing `typescript` dev dependency, run `tsc --noEmit`, fix any errors in `.ts`/`.tsx` files, add a `typecheck` script to package.json

---

## 1. Problem

FYPro v2 has 19 `.ts`/`.tsx` files and a `tsconfig.json` configured correctly (`strict: false`, `allowJs: true`, `noEmit: true`), but the `typescript` package is not installed. The `tsc` binary does not exist, so `tsc --noEmit` cannot run and there is no type-check gate.

---

## 2. Solution

Install `typescript` as a dev dependency, run `tsc --noEmit` to surface any real type errors, fix them in `.ts`/`.tsx` files only, and add a repeatable `typecheck` script.

---

## 3. Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `typescript` to devDependencies; add `"typecheck": "tsc --noEmit"` to scripts |
| `package-lock.json` | Updated by npm automatically |
| Any `.ts`/`.tsx` file with errors | Fix type errors (scope determined at runtime by `tsc --noEmit` output) |

### Files NOT touched
- All `.jsx` files
- `tsconfig.json` (already correct — no changes needed)
- `vite.config.js`
- Any file in `api/`

---

## 4. Implementation Steps

1. Run `npm install --save-dev typescript`
2. Run `npx tsc --noEmit` and capture all errors
3. Fix each error in the relevant `.ts`/`.tsx` file — minimal fixes only (type annotations, missing imports, incorrect return types). Do not refactor surrounding code.
4. Add `"typecheck": "tsc --noEmit"` to the `scripts` block in `package.json`
5. Re-run `npx tsc --noEmit` — must exit with code 0
6. Commit: `chore: install typescript and add typecheck script`

---

## 5. Constraints

- `strict` stays `false` — do not flip it
- `.jsx` files are not touched — `allowJs: true` means tsc sees them but does not enforce types on them
- No new dependencies beyond `typescript` itself
- No changes to `tsconfig.json`
- Pre-audit estimated 0–2 errors — if more than ~10 errors are found, pause and report rather than fixing blindly

---

## 6. Success Criteria

- `npm run typecheck` exits with code 0
- `typescript` appears in `devDependencies` in `package.json`
- No `.jsx` files modified
- `tsconfig.json` unchanged
