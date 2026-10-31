/**
 * Both directions of one rule: an annotation and its chip live and die together.
 *
 *   - an annotation whose chip is gone must not keep occupying a slot (see the first half), and
 *   - a chip whose payload is gone must not stay in the draft, where it blocks every send (see the second half).
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
import { orphanedIds, staleChipRefs, CHIP_SOURCE } from '../src/chip-draft.js'

const here = dirname(fileURLToPath(import.meta.url))
const dock = await readFile(join(here, '..', 'src', 'ui', 'dock.js'), 'utf8')
const locales = await readFile(join(here, '..', 'src', 'locales.js'), 'utf8')
const registrations = await readFile(join(here, '..', 'src', 'registrations.js'), 'utf8')

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

// ── A chip whose payload is gone ───────────────────────────────────────────
// The Host persists the draft; the payload registry is rebuilt empty on every page load. A restored chip can therefore
// never be serialized again, and the Host treats that as a hard error: it refuses the whole send and restores the
// draft, so the draft becomes a landmine that fails on every attempt.
const payloads = new Set(['kept'])
const has = (ref) => payloads.has(ref)

check('a chip whose payload survived is left alone',
  staleChipRefs([occurrence('kept', 0)], has, CHIP_SOURCE).length === 0,
  JSON.stringify(staleChipRefs([occurrence('kept', 0)], has, CHIP_SOURCE)))

check('a chip with no payload is stale',
  staleChipRefs([occurrence('kept', 0), occurrence('gone', 1)], has, CHIP_SOURCE).join(',') === 'gone',
  JSON.stringify(staleChipRefs([occurrence('kept', 0), occurrence('gone', 1)], has, CHIP_SOURCE)))

check('a chip of another source is not judged by this plugin',
  staleChipRefs([occurrence('gone', 0, 'command-chip')], has, CHIP_SOURCE).length === 0,
  JSON.stringify(staleChipRefs([occurrence('gone', 0, 'command-chip')], has, CHIP_SOURCE)))

check('a missing list is treated as empty rather than crashing',
  staleChipRefs(undefined, has, CHIP_SOURCE).length === 0, 'a missing chip list threw')

// ── The dock clears them, in one write ─────────────────────────────────────
check('the dock asks the registry which chips still have a payload',
  /staleChipRefs\(occurrences, \(ref\) => chipRegistry\.has\(ref\), CHIP_SOURCE\)/.test(dock),
  'the stale set is not derived from the registry and the live chips')

// `chipBridge.release` reads the live draft on every call, so removing several chips one call at a time would cut at
// offsets computed from a draft that still holds the earlier placeholders.
check('several stale chips are removed in one snapshot, not one release each',
  /for \(const ref of stale\)[\s\S]{0,240}withoutChip\(/.test(dock)
    && /inputActions\.setDraft\(snapshot\)/.test(dock),
  'the chips are removed one release at a time, so the later offsets are stale')

// The notice read `labels.stale`, which the `labels` memo did not define — so the effect removed the chips and then
// threw on `undefined.replace`, leaving the removal silent. Every `labels.<key>` the dock uses has to be in the memo.
check('every labels key the dock reads is defined in the labels memo',
  (() => {
    const used = new Set([...dock.matchAll(/labels\.([A-Za-z]\w*)/g)].map((match) => match[1]))
    const start = dock.indexOf('const labels = React.useMemo')
    const memo = start < 0 ? '' : dock.slice(start, dock.indexOf('}), [t])', start))
    const defined = new Set([...memo.matchAll(/^\s*([A-Za-z]\w*):/gm)].map((match) => match[1]))
    return [...used].every((key) => defined.has(key))
  })(),
  `missing from the memo: ${(() => {
    const used = new Set([...dock.matchAll(/labels\.([A-Za-z]\w*)/g)].map((match) => match[1]))
    const start = dock.indexOf('const labels = React.useMemo')
    const memo = start < 0 ? '' : dock.slice(start, dock.indexOf('}), [t])', start))
    const defined = new Set([...memo.matchAll(/^\s*([A-Za-z]\w*):/gm)].map((match) => match[1]))
    return [...used].filter((key) => !defined.has(key)).join(', ') || '(none)'
  })()}`)

check('the removal is announced, not silent',
  /setNotice\(labels\.stale\.replace\('\{n\}', String\(removed\)\)\)/.test(dock),
  'the chips disappear without telling the user')

// ── The fallback message has to be human ───────────────────────────────────
// This is what the Host shows when a send is refused. It used to be `quote-chat: unknown chip "qc-1793416604954-1"`.
check('a refused send explains itself instead of naming an internal id',
  /t\('card\.staleSend'\)/.test(registrations)
    && /`quote-chat: unknown chip/.test(registrations) === false,
  'the failure still surfaces the raw id')

check('both new strings exist in both languages',
  (locales.match(/'card\.stale':/g) ?? []).length === 2
    && (locales.match(/'card\.staleSend':/g) ?? []).length === 2,
  'a key is missing from one of the dictionaries')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
