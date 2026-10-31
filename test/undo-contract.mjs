/**
 * Static checks for the undo feature's contract.
 *
 * These assert the things a browser run would otherwise be needed to discover, and the one thing that made the earlier
 * attempt destroy the draft: the restore must read the CURRENT draft, never a value captured by a callback.
 *
 * Run: node test/undo-contract.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dock = await readFile(join(here, '..', 'src', 'ui', 'dock.js'), 'utf8')
const css = await readFile(join(here, '..', 'src', 'stylesheet.js'), 'utf8')

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

// ── The restore must read live state ───────────────────────────────────────
// `chipBridge.place` rebuilds the whole draft from the string it is handed, so a stale string does not merely fail to
// update — it replaces the composer with an older version of itself. The first attempt at undo did exactly that:
// `writeChip` closed over the render-time draft, and pressing undo wiped whatever had been typed since.
check('the draft is read through inputStateRef at call time',
  /const readLiveDraft = React\.useCallback\(\(\) => \{\s*\n\s*const state = inputStateRef\.current/.test(dock),
  'undo captured the draft instead of reading the current one')

check('the restore does not call a callback that could hold a stale draft',
  /writeChip\(restored\)/.test(dock) === false,
  'the restore goes through writeChip, whose closure may be stale')

check('the restore writes through the bridge with the live read',
  /chipBridge\.placeAt\(inputActions, readLiveDraft/.test(dock),
  'the restore does not place the chip against the current draft')

// ── The restore goes back where the chip came from ─────────────────────────
// The chip used to come back at the end of the draft: `withAppendedChip` is the only insertion the plugin had, so the
// undo wrote `offset: base.length` no matter where the chip had been. The offset exists only until the rewrite, so the
// record has to be taken before it.
check('the undo record keeps where the chip came out, not just the annotation',
  /undoRef\.current = \{ annotation, site \}/.test(dock),
  'the record holds only the annotation, so the restore has no place to put the chip back')

check('the removal site is measured before the draft is rewritten',
  dock.indexOf('const site = chipRemovalSite(') !== -1
    && dock.indexOf('const site = chipRemovalSite(') < dock.indexOf('chipBridge.release('),
  'the site was read after the chip was already gone, so there was nothing to measure')

check('the restore inserts at that site instead of appending',
  /chipBridge\.placeAt\(inputActions, readLiveDraft, restored, labels, site\)/.test(dock),
  'the restore still goes through the append-only placement')

// ── One entry, five seconds ────────────────────────────────────────────────
check('exactly one removal is remembered',
  /undoRef\.current = \{ annotation, site \}/.test(dock) && /undoRef\.current\.push\(/.test(dock) === false,
  'the undo offer keeps more than the most recent removal')

check('the window is five seconds, defined once at module scope',
  /^const UNDO_MS = 5000$/m.test(dock),
  'the undo window is not a single module-level constant')

check('the window actually closes',
  /remaining <= 0[\s\S]{0,200}undoRef\.current = null[\s\S]{0,120}setUndoPending\(false\)/.test(dock),
  'the undo offer never expires')

check('the countdown drives a visible number of seconds',
  /setUndoLeft\(Math\.ceil\(remaining \/ 1000\)\)/.test(dock),
  'the remaining time is not computed from the same deadline')

// ── The whole bar is the control ───────────────────────────────────────────
check('the bar itself is a button',
  /className: 'qc-undo',\s*\n\s*onClick: onUndoRemove/.test(dock),
  'the bar is a container with a small button inside, so the middle is dead')

check('the bar is styled as a button, not a panel',
  /\.qc-undo\{[^}]*appearance:none/.test(css) && /\.qc-undo\{[^}]*cursor:pointer/.test(css),
  'the bar is not reset like a button')

check('the bar clears the hover card it used to sit under',
  /\.qc-undo\{[^}]*bottom:var\(--qc-composer-offset/.test(css),
  'the bar is positioned where the hover card overlaps it')

check('the countdown has a visible meter',
  /\.qc-undo-meter\{/.test(css) && /--qc-undo-left/.test(css),
  'the deadline has no visual')

// ── The collapse guard that protects chip attributes ───────────────────────
// Removing these attributes is what made a chip lose its label, and the trigger is the effect re-running for an
// unrelated reason. `apply` may still strip a chip whose annotation is genuinely gone.
const cards = await readFile(join(here, '..', 'src', 'ui', 'cards.js'), 'utf8')
// Anchored to a statement (leading whitespace, not a comment marker): the cleanup's old one-liner is described in a
// comment that must stay, and an unanchored pattern matched that prose instead of code.
check('the effect cleanup no longer strips every chip',
  /^\s{4}for \(const chip of \[\.\.\.marked\]\) unmark\(chip\)$/m.test(cards) === false,
  'the effect cleanup still unmarks every chip on a re-run')

check('a chip is stripped only when its annotation is gone',
  /const alive = new Set\(annotations\.map\(\(item\) => item\.id\)\)/.test(cards)
    && /alive\.has\(ref\)/.test(cards),
  'apply no longer distinguishes "unpaired this pass" from "annotation deleted"')

check('the countdown restarts for a removal that lands mid-window',
  // `undoPending` is already true on a second removal, so a dependency on it alone does not re-run the effect and the
  // new entry would inherit the previous deadline. A counter that always changes forces the restart.
  /setUndoToken\(\(value\) => value \+ 1\)/.test(dock)
    && /\}, \[undoPending, undoToken\]\)/.test(dock),
  'a second removal inside the window reuses the first removal\'s deadline')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
