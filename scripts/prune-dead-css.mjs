/**
 * prune-dead-css.mjs
 *
 * Removes provably-dead class selectors from src/styles/*.css.
 *
 * A class is considered USED (and therefore kept) if EITHER:
 *   a) its exact name appears as a substring anywhere in project source
 *      (src/, api/, public/, index.html — excluding src/styles itself), OR
 *   b) it starts with a dynamic prefix extracted from template literals in
 *      source, e.g. `dp-summary-score--${label}` protects every
 *      dp-summary-score--* class.
 *
 * The substring test is deliberately STRICTER than find-dead-css.mjs's regex,
 * so borderline cases are kept, never deleted.
 *
 * Per-selector removal: in a multi-selector rule, only the dead selectors are
 * dropped; the rule survives if any selector is alive. @keyframes are never
 * touched. Empty at-rules left behind are cleaned up.
 *
 * Writes pruned files in place and saves the removed class list to
 * removed-classes.json (consumed by the bundle verification step).
 *
 * Usage: node scripts/prune-dead-css.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// ── 1. Collect source text ───────────────────────────────────────────────────

function readFilesRecursive(dir, exts) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
      results.push(...readFilesRecursive(full, exts));
    } else if (entry.isFile() && exts.some(e => full.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

const SKIP_STYLES = path.join(root, 'src', 'styles');
const sourceFiles = [
  ...readFilesRecursive(path.join(root, 'src'), ['.jsx', '.tsx', '.js', '.ts', '.html', '.css']),
  ...readFilesRecursive(path.join(root, 'api'), ['.jsx', '.tsx', '.js', '.ts']),
  ...readFilesRecursive(path.join(root, 'public'), ['.html', '.js']),
  path.join(root, 'index.html'),
].filter(f => !f.startsWith(SKIP_STYLES) && fs.existsSync(f));

const allSourceText = sourceFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

// ── 2. Extract dynamic class prefixes from template literals ────────────────
// e.g. `dp-summary-score--${label}` → prefix "dp-summary-score--"

const dynamicPrefixes = new Set();
for (const m of allSourceText.matchAll(/([A-Za-z][A-Za-z0-9-]*-)\$\{/g)) {
  dynamicPrefixes.add(m[1]);
}

// ── 3. Usage test ────────────────────────────────────────────────────────────

const usageCache = new Map();
function isUsed(cls) {
  if (usageCache.has(cls)) return usageCache.get(cls);
  let used = allSourceText.includes(cls);
  if (!used) {
    for (const p of dynamicPrefixes) {
      if (cls.startsWith(p)) { used = true; break; }
    }
  }
  usageCache.set(cls, used);
  return used;
}

// Extract class names from one selector, handling escaped chars (e.g. .hover\:x)
function classesInSelector(selector) {
  const out = [];
  // strip escaped sequences so ".hover\:text-white" yields "hover\:text-white" → treat
  // escaped colon as part of name (Tailwind-style); those names contain "\:" which
  // never appears in JSX, but the unescaped form does — so unescape before testing.
  for (const m of selector.matchAll(/\.((?:\\.|[A-Za-z0-9_-])+)/g)) {
    out.push(m[1].replace(/\\(.)/g, '$1'));
  }
  return out;
}

// ── 4. Prune each file ───────────────────────────────────────────────────────

const CUSTOM_FILES = [
  'steps-core.css',
  'writing-planner-email.css',
  'defense.css',
  'defense-premium.css',
  'design-system.css',
  'instrument-builder.css',
  'abstract-generator.css',
  'step-accents.css',
  'utilities-shared.css',
  'theme-responsive.css',
  'light-mode.css',
  'touch-targets.css',
];

const removedClasses = new Set();
let totalSelectorsRemoved = 0;
let totalRulesRemoved = 0;

for (const filename of CUSTOM_FILES) {
  const filepath = path.join(root, 'src', 'styles', filename);
  if (!fs.existsSync(filepath)) continue;
  const css = fs.readFileSync(filepath, 'utf8');
  const rootNode = postcss.parse(css, { from: filepath });

  let fileSelectorsRemoved = 0;
  let fileRulesRemoved = 0;

  rootNode.walkRules(rule => {
    // never touch keyframe steps
    if (rule.parent?.type === 'atrule' && /keyframes/i.test(rule.parent.name)) return;

    const selectors = rule.selectors;
    const alive = [];
    for (const sel of selectors) {
      const classes = classesInSelector(sel);
      const deadClass = classes.find(c => !isUsed(c));
      if (deadClass !== undefined) {
        classes.filter(c => !isUsed(c)).forEach(c => removedClasses.add(c));
        fileSelectorsRemoved++;
      } else {
        alive.push(sel);
      }
    }
    if (alive.length === 0) {
      rule.remove();
      fileRulesRemoved++;
    } else if (alive.length < selectors.length) {
      rule.selectors = alive;
    }
  });

  // clean empty at-rules (e.g. media queries whose every rule died)
  rootNode.walkAtRules(at => {
    if (/keyframes/i.test(at.name)) return;
    if (at.nodes && at.nodes.length === 0) at.remove();
  });

  totalSelectorsRemoved += fileSelectorsRemoved;
  totalRulesRemoved += fileRulesRemoved;

  if (fileSelectorsRemoved > 0) {
    console.log(`${filename}: removed ${fileSelectorsRemoved} selectors (${fileRulesRemoved} whole rules)`);
    if (!DRY_RUN) fs.writeFileSync(filepath, rootNode.toString(), 'utf8');
  } else {
    console.log(`${filename}: nothing to remove`);
  }
}

const sorted = [...removedClasses].sort();
console.log(`\nTOTAL: ${totalSelectorsRemoved} selectors / ${totalRulesRemoved} whole rules removed`);
console.log(`Dead classes removed: ${sorted.length}`);
if (!DRY_RUN) {
  fs.writeFileSync(path.join(root, 'removed-classes.json'), JSON.stringify(sorted, null, 2));
  console.log('Wrote removed-classes.json (for bundle verification)');
} else {
  console.log('\n(dry run — no files written)\n');
  console.log(sorted.map(c => `  .${c}`).join('\n'));
}
