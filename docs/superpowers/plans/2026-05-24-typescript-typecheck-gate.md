# TypeScript Typecheck Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install the missing `typescript` dev dependency so `tsc --noEmit` runs, fix any type errors in `.ts`/`.tsx` files, and add a repeatable `npm run typecheck` script.

**Architecture:** TypeScript is already configured in `tsconfig.json` (`strict: false`, `allowJs: true`, `noEmit: true`, `moduleResolution: "bundler"`) — the only missing piece is the `typescript` package itself. Once installed, `tsc --noEmit` will validate all files in `src/`. `.jsx` files are not touched; `allowJs: true` means tsc sees them but does not enforce types on them.

**Tech Stack:** TypeScript 5.x (must be ≥5.0 for `moduleResolution: "bundler"`), npm

---

## File Map

| File | Change |
|------|--------|
| `package.json` | Add `typescript` to devDependencies; add `"typecheck"` script |
| `package-lock.json` | Updated automatically by npm — commit it |
| Any `.ts`/`.tsx` file with errors | Fix type errors (scope determined at runtime by `tsc --noEmit` output) |

**Files NOT touched:** all `.jsx` files, `tsconfig.json`, `vite.config.js`, anything in `api/`

---

## Task 1: Install TypeScript

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto-updated)

- [ ] **Step 1: Install typescript as a dev dependency**

```bash
npm install --save-dev typescript@^5.8.3
```

Expected output includes a line like:
```
added 1 package, and audited NNN packages in Xs
```

The version `^5.8.3` is required because `tsconfig.json` uses `moduleResolution: "bundler"`, which was introduced in TypeScript 5.0.

- [ ] **Step 2: Verify the binary exists**

```bash
npx tsc --version
```

Expected output:
```
Version 5.x.x
```

If you see `tsc: command not found` or an error, stop — the install failed.

- [ ] **Step 3: Run the first typecheck to see all errors**

```bash
npx tsc --noEmit 2>&1
```

Capture the full output. You will fix all reported errors in Task 2. If more than 10 distinct errors appear across different files, stop and report them without fixing — do not proceed.

Expected for a clean codebase: no output, exit code 0. Expected if minor issues exist: a handful of lines pointing to specific `.ts`/`.tsx` files.

- [ ] **Step 4: Commit the package change (before any fixes)**

```bash
git add package.json package-lock.json
git commit -m "chore: install typescript 5.x dev dependency"
```

---

## Task 2: Fix Type Errors

**Files:**
- Modify: whichever `.ts`/`.tsx` files `tsc --noEmit` reported errors in (determined at runtime)

> If Task 1 Step 3 produced zero errors, skip this task entirely and go to Task 3.

- [ ] **Step 1: Read each error line carefully**

`tsc --noEmit` output format is:
```
src/path/to/file.ts(LINE,COL): error TSXXXX: Description of the error
```

Group errors by file. Work through one file at a time.

- [ ] **Step 2: Fix errors using these patterns**

Common errors with `strict: false` and what to do:

**TS2307 — Cannot find module 'X' or its corresponding type declarations**
The module exists but has no types. Add `// @ts-ignore` on the import line only if there is genuinely no `@types/X` package. Otherwise install the `@types/X` package.

**TS2339 — Property 'X' does not exist on type 'Y'**
Add a type annotation to the variable/parameter. Example:
```typescript
// Before
function foo(event) { event.target.value }

// After
function foo(event: React.ChangeEvent<HTMLInputElement>) { event.target.value }
```

**TS2345 — Argument of type 'X' is not assignable to parameter of type 'Y'**
Add an explicit cast or narrow the type:
```typescript
// Before
someFunction(value)

// After
someFunction(value as ExpectedType)
```

**TS7006 — Parameter 'X' implicitly has an 'any' type**
Add an explicit `: any` annotation (acceptable with `strict: false`):
```typescript
// Before
function handler(data) { ... }

// After
function handler(data: any) { ... }
```

**TS2304 — Cannot find name 'X'**
Add the import. Example:
```typescript
import { X } from './path-to-x'
```

- [ ] **Step 3: After fixing each file, run tsc again to confirm that file's errors are gone**

```bash
npx tsc --noEmit 2>&1
```

The error count should decrease with each fix. Keep running until the output is empty.

- [ ] **Step 4: Commit all fixes**

```bash
git add src/
git commit -m "fix(types): resolve tsc --noEmit errors in .ts/.tsx files"
```

---

## Task 3: Add Typecheck Script

**Files:**
- Modify: `package.json` (scripts block only)

- [ ] **Step 1: Add the typecheck script to package.json**

Open `package.json`. The current scripts block is:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview"
},
```

Change it to:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "typecheck": "tsc --noEmit"
},
```

- [ ] **Step 2: Verify the script runs and exits cleanly**

```bash
npm run typecheck
```

Expected output:
```
> fypro-v2@0.0.0 typecheck
> tsc --noEmit

```
(empty body after the header — no errors, exit code 0)

If there are errors, fix them (using the patterns in Task 2 Step 2) before continuing.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add typecheck script to package.json"
```

---

## Self-Review Checklist (for the implementer)

After all tasks are complete, verify:

- [ ] `npm run typecheck` exits with code 0 and prints no errors
- [ ] `typescript` appears in `devDependencies` in `package.json`
- [ ] No `.jsx` files were modified
- [ ] `tsconfig.json` is unchanged
- [ ] Three commits exist: install, fixes (if any), script
