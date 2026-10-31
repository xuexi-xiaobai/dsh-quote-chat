/**
 * An annotation lives as long as its chip — and the limit has to count what the user can see.
 *
 * The store outlives the chip in two ways the plugin never hears about: the Host clears the draft after a send, and
 * Backspace deletes a chip without calling back. What remains is invisible — no chip means no marker bubble and no
 * hover card, so there is nothing on screen to delete it from — while still occupying a slot.
 *
 * Measured consequence: a session that had sent a dozen annotations could not add another, the notice only restated
 * the limit, and the only way out was a reload.
 *
 * Run: node test/annotation-lifetime.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { orphanedIds, CHIP_SOURCE } from '../src/chip-draft.js'

const here = dirname(fileURLToPath(import.meta.url))
const dock = await readFile(join(here, '..', 'src', 'ui', 'dock.js'), 'utf8')
const locales = await readFile(join(here, '..', 'src', 'locales.js'), 'utf8')

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** One chip as the Host reports it. */
const occurrence = (ref, offset, source = CHIP_SOURCE) => ({ source, ref, offset, length: 1 })

// ── Which annotations lost their chip ──────────────────────────────────────
check('an annotation with a chip in the draft is not orphaned',
  orphanedIds([{ id: 'a' }], [occurrence('a', 0)], CHIP_SOURCE).length === 0,
  JSON.stringify(orphanedIds([{ id: 'a' }], [occurrence('a', 0)], CHIP_SOURCE)))

check('an annotation with no chip is orphaned',
  orphanedIds([{ id: 'a' }, { id: 'b' }], [occurrence('a', 0)], CHIP_SOURCE).join(',') === 'b',
  JSON.stringify(orphanedIds([{ id: 'a' }, { id: 'b' }], [occurrence('a', 0)], CHIP_SOURCE)))

check('an empty draft orphans every annotation',
  orphanedIds([{ id: 'a' }, { id: 'b' }], [], CHIP_SOURCE).join(',') === 'a,b',
  JSON.stringify(orphanedIds([{ id: 'a' }, { id: 'b' }], [], CHIP_SOURCE)))

// A `command-chip` occurrence with the same ref must not keep a quote-chat annotation alive: the ids are minted by two
// different owners and only the source says which one a chip belongs to.
check('a chip of another source does not keep an annotation alive',
  orphanedIds([{ id: 'a' }], [occurrence('a', 0, 'command-chip')], CHIP_SOURCE).join(',') === 'a',
  JSON.stringify(orphanedIds([{ id: 'a' }], [occurrence('a', 0, 'command-chip')], CHIP_SOURCE)))

check('the result follows the annotation order, not the chip order',
  orphanedIds([{ id: 'x' }, { id: 'y' }, { id: 'z' }], [occurrence('y', 1)], CHIP_SOURCE).join(',') === 'x,z',
  JSON.stringify(orphanedIds([{ id: 'x' }, { id: 'y' }, { id: 'z' }], [occurrence('y', 1)], CHIP_SOURCE)))

check('a missing list is treated as empty rather than crashing',
  orphanedIds(undefined, [occurrence('a', 0)], CHIP_SOURCE).length === 0
    && orphanedIds([{ id: 'a' }], undefined, CHIP_SOURCE).join(',') === 'a',
  'a missing annotation list did not come back empty, or a missing chip list did not orphan the annotation')

// ── The dock prunes before it lets the limit block ─────────────────────────
// Pruning on every commit would churn the store for nothing: it is bounded by the limit either way. It runs only when
// the limit is about to refuse the annotation.
check('the limit is checked against the store before pruning',
  /if \(annotations\.length >= MAX_ANNOTATIONS\) pruneOrphans\(\)/.test(dock),
  'pruning is unconditional, or the limit is not what triggers it')

check('pruning reads the live chips, not a captured list',
  /orphanedIds\(annotations, occurrences, CHIP_SOURCE\)/.test(dock),
  'the orphan set is not derived from the current occurrences')

check('pruning runs before the annotation is added',
  dock.indexOf('pruneOrphans()') !== -1
    && dock.indexOf('pruneOrphans()') < dock.indexOf('const stored = addAnnotation('),
  'the store is still full when the annotation is added, so the limit still blocks')

check('an undo restore is guarded the same way',
  dock.lastIndexOf('pruneOrphans()') > dock.indexOf('const stored = addAnnotation(')
    && dock.lastIndexOf('pruneOrphans()') < dock.indexOf('const restored = addAnnotation('),
  'restoring a removed annotation can still be blocked by entries the user cannot see')

// ── The notice has to say what to do ───────────────────────────────────────
// The old text was "最多 12 条注释" — a statement of the limit and nothing else. It appeared at the one moment the user
// needed a next step, and the plugin knew the step.
check('the limit notice tells the user to delete one',
  /'card\.limit': '[^']*最多 \{max\} 条注释[^']*删/.test(locales),
  'the Chinese notice still only restates the limit')

check('the English notice says the same thing',
  /'card\.limit': '[^']*At most \{max\} annotations[^']*delete/.test(locales),
  'the English notice still only restates the limit')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
