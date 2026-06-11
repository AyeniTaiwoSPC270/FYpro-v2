/**
 * find-dead-css.mjs
 *
 * Scans src/styles/*.css for custom class selectors and checks whether each
 * class name appears anywhere in the project source (src/, api/, public/,
 * index.html). Reports classes with zero usage.
 *
 * Usage: node scripts/find-dead-css.mjs
 *
 * IMPORTANT: This is a usage-frequency scan, not a guarantee. Review the
 * output before deleting anything. Dynamic class names (e.g. template
 * literals, JS string concatenation) will show as "unused" even if they are.
 * Look for those manually before pruning.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'fs'; // node 22+ — fall back if not available

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ── 1. Collect all source text to search against ────────────────────────────

function readFilesRecursive(dir, exts) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
      results.push(...readFilesRecursive(full, exts));
    } else if (entry.isFile() && exts.some(e => full.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

const SOURCE_EXTS = ['.jsx', '.tsx', '.js', '.ts', '.html', '.css'];
const SKIP_STYLES = path.join(root, 'src', 'styles');

const sourceFiles = [
  ...readFilesRecursive(path.join(root, 'src'), SOURCE_EXTS),
  ...readFilesRecursive(path.join(root, 'api'), SOURCE_EXTS),
  ...readFilesRecursive(path.join(root, 'public'), ['.html', '.js']),
  path.join(root, 'index.html'),
].filter(f => !f.startsWith(SKIP_STYLES)); // exclude the styles themselves

const allSourceText = sourceFiles
  .filter(f => fs.existsSync(f))
  .map(f => fs.readFileSync(f, 'utf8'))
  .join('\n');

// ── 2. Extract custom class selectors from each styles file ─────────────────

// Only scan custom step files (not base.css which contains Tailwind directives)
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

// Extract class names from a CSS selector string
// e.g. ".tv-card:hover .tv-label" → ["tv-card", "tv-label"]
function extractClasses(selector) {
  const classes = new Set();
  // Match .classname — capture the name part
  for (const match of selector.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
    classes.add(match[1]);
  }
  return [...classes];
}

// Parse CSS text and return all unique class names found in selectors
function extractClassesFromCSS(css) {
  const classes = new Set();
  // Remove comments
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Match selector blocks: text before { that isn't @media/@keyframes etc
  for (const match of stripped.matchAll(/([^{}@][^{}]*)\{/g)) {
    const selector = match[1].trim();
    if (!selector) continue;
    for (const cls of extractClasses(selector)) {
      classes.add(cls);
    }
  }
  return [...classes];
}

// ── 3. Check usage ───────────────────────────────────────────────────────────

const results = {}; // file → { used: [], unused: [] }

for (const filename of CUSTOM_FILES) {
  const filepath = path.join(root, 'src', 'styles', filename);
  if (!fs.existsSync(filepath)) continue;

  const css = fs.readFileSync(filepath, 'utf8');
  const classes = extractClassesFromCSS(css);

  const used = [];
  const unused = [];

  for (const cls of [...new Set(classes)].sort()) {
    // Search for exact class name as a whole word in source
    // Matches: "tv-card", "tv-card--active", className="tv-card", etc.
    const regex = new RegExp(`\\b${cls.replace(/-/g, '[-_]?')}\\b`);
    if (regex.test(allSourceText)) {
      used.push(cls);
    } else {
      unused.push(cls);
    }
  }

  results[filename] = { total: classes.length, used, unused };
}

// ── 4. Report ────────────────────────────────────────────────────────────────

let totalUnused = 0;

for (const [file, data] of Object.entries(results)) {
  const pct = data.total ? Math.round((data.unused.length / data.total) * 100) : 0;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${file}  [${data.unused.length} unused / ${data.total} total — ${pct}%]`);
  console.log(`${'─'.repeat(60)}`);
  if (data.unused.length === 0) {
    console.log('  ✓ No unused classes found');
  } else {
    for (const cls of data.unused) {
      console.log(`  ✗ .${cls}`);
    }
  }
  totalUnused += data.unused.length;
}

const totalClasses = Object.values(results).reduce((s, d) => s + d.total, 0);
console.log(`\n${'═'.repeat(60)}`);
console.log(`TOTAL: ${totalUnused} unused / ${totalClasses} custom classes across ${CUSTOM_FILES.length} files`);
console.log(`${'═'.repeat(60)}`);
console.log('\nNOTE: check dynamic class names manually before pruning.');
console.log('      grep -rn "tv-\\|dp-\\|ca-\\|ma-" src/ for template-literal usage.');
