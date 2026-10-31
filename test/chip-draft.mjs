/**
 * The draft's chip plumbing: serialization, label, append and remove.
 *
 * These four functions decide what the model actually receives and what the user sees in the
 * composer, so they are pinned here before the code moves into its own module. The suite is
 * written against the CURRENT implementation — including its exact newline placement — rather
 * than against what the comments claim, because a "tidy" change to the fencing would alter
 * every submitted message.
 *
 * Two of the four are pure and are imported directly. `chipReference` is NOT pure: it writes
 * into the payload registry, so it is exercised only through its observable effects and is
 * not part of the pure module.
 *
 * Run: node test/chip-draft.mjs
 */
import {
  serializeChipForModel,
  chipLabel,
  withAppendedChip,
  withChipAt,
  chipRemovalSite,
  withoutChip,
} from '../src/chip-draft.js'
import { zh, en } from '../src/locales.js'

/** The chip source this plugin owns; `withoutChip` matches on it. */
const CHIP_SOURCE = 'quote-chat'

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** A payload in the shape the registry stores. */
const payload = (overrides = {}) => ({
  kind: 'text',
  number: 1,
  text: 'passage text',
  comment: '',
  label: '注释 1',
  ...overrides,
})

// ── Serialization: the model-facing block ──────────────────────────────────
// The exact shape is pinned because it is what the model reads. The fence exists so a chip
// mid-sentence cannot run into the surrounding prose.
check('a payload with no comment fences the passage',
  serializeChipForModel(payload()) === '\n[注释 1]\npassage text\n',
  JSON.stringify(serializeChipForModel(payload())))

check('a comment sits between the label and the passage',
  serializeChipForModel(payload({ comment: 'my note' })) === '\n[注释 1]\nmy note\npassage text\n',
  JSON.stringify(serializeChipForModel(payload({ comment: 'my note' }))))

check('the block starts and ends with exactly one newline',
  /^\n[^\n]/.test(serializeChipForModel(payload()))
    && /[^\n]\n$/.test(serializeChipForModel(payload())),
  JSON.stringify(serializeChipForModel(payload())))

check('the label is bracketed',
  serializeChipForModel(payload({ label: 'Note 2' })).includes('[Note 2]'),
  JSON.stringify(serializeChipForModel(payload({ label: 'Note 2' }))))

check('an empty comment adds no blank line',
  !serializeChipForModel(payload({ comment: '' })).includes('\n\n'),
  JSON.stringify(serializeChipForModel(payload({ comment: '' }))))

check('multi-line passages are preserved verbatim',
  serializeChipForModel(payload({ text: 'line one\nline two' })) === '\n[注释 1]\nline one\nline two\n',
  JSON.stringify(serializeChipForModel(payload({ text: 'line one\nline two' }))))

check('CJK and emoji survive serialization',
  serializeChipForModel(payload({ text: '中文🙂混合', comment: '说明' })) === '\n[注释 1]\n说明\n中文🙂混合\n',
  JSON.stringify(serializeChipForModel(payload({ text: '中文🙂混合', comment: '说明' }))))

// ── The label ──────────────────────────────────────────────────────────────
const labels = { content: '注释 {n}' }

check('the label substitutes the ordinal',
  chipLabel({ number: 3 }, labels) === '注释 3', chipLabel({ number: 3 }, labels))
// Pinned as-is, not as an aspiration: `replace` with a string pattern substitutes only the
// first occurrence. Every shipped label happens to contain `{n}` exactly once, so this is
// currently harmless — but a second `{n}` in a future string would render literally, so the
// behaviour is recorded rather than assumed away.
check('the label substitutes the first placeholder only',
  chipLabel({ number: 2 }, { content: '{n}-{n}' }) === '2-{n}',
  chipLabel({ number: 2 }, { content: '{n}-{n}' }))

check('every shipped label contains at most one placeholder',
  [zh, en].every((dictionary) => Object.values(dictionary)
    .every((value) => (String(value).match(/\{n\}/g) ?? []).length <= 1)),
  'a label now has two {n} placeholders, which chipLabel would not fill')
check('the label does not depend on the passage text',
  chipLabel({ number: 1, text: 'ignored' }, labels) === chipLabel({ number: 1 }, labels),
  'the label read the passage')

// ── Appending ──────────────────────────────────────────────────────────────
const ref = (id, extra = {}) => ({
  source: 'quote-chat',
  ref: id,
  offset: 0,
  length: 1,
  label: 'x',
  clipboardText: '\uFFFC',
  ...extra,
})

check('an empty draft becomes just the chip',
  withAppendedChip('', [], '\uFFFC', ref('a')).text === '\uFFFC',
  JSON.stringify(withAppendedChip('', [], '\uFFFC', ref('a')).text))

// A chip contributes NO separator.
//
// It used to insert a newline, which made the second chip always wrap and let the host add a leading space to the new
// paragraph. Spacing between a chip and the words around it is a CSS concern now, because anything in the draft reaches
// the model and would have to be stripped again at submit time.
check('appending to prose adds no separator',
  withAppendedChip('hello', [], '\uFFFC', ref('a')).text === 'hello\uFFFC',
  JSON.stringify(withAppendedChip('hello', [], '\uFFFC', ref('a')).text))

check('a trailing newline is respected as-is',
  withAppendedChip('hello\n', [], '\uFFFC', ref('a')).text === 'hello\n\uFFFC',
  JSON.stringify(withAppendedChip('hello\n', [], '\uFFFC', ref('a')).text))

check('two chips append back to back',
  (() => {
    const first = withAppendedChip('x', [], '\uFFFC', ref('a'))
    return withAppendedChip(first.text, first.references, '\uFFFC', ref('b')).text === 'x\uFFFC\uFFFC'
  })(),
  'a separator crept in between two chips')

check('the appended reference offset matches its place in the text',
  (() => {
    const snapshot = withAppendedChip('hello', [], '\uFFFC', ref('a'))
    return snapshot.text.indexOf('\uFFFC') === snapshot.references[0].offset
  })(),
  'the offset does not locate the placeholder')

check('existing references are preserved and the new one appended last',
  (() => {
    const first = ref('a', { offset: 0 })
    const snapshot = withAppendedChip('\uFFFC\nhello', [first], '\uFFFC', ref('b'))
    return snapshot.references.length === 2
      && snapshot.references[0] === first
      && snapshot.references[1].ref === 'b'
  })(),
  'existing references were disturbed')

check('appending offsets the new reference after the whole draft',
  (() => {
    const snapshot = withAppendedChip('abc', [], '\uFFFC', ref('a'))
    return snapshot.references[0].offset === 3
  })(),
  'the offset does not point just past the existing text')

check('references of other sources are carried through',
  (() => {
    const foreign = { source: 'command-chip', ref: 'c', offset: 0, length: 1 }
    const snapshot = withAppendedChip('\uFFFC', [foreign], '\uFFFC', ref('b'))
    return snapshot.references.length === 2 && snapshot.references[0] === foreign
  })(),
  'a foreign reference was dropped or rewritten')

// ── Inserting at a point ───────────────────────────────────────────────────
// Undo puts a removed chip back where it came from. The module used to have only `withAppendedChip`, so the chip
// came back at the end of the draft and the passage appeared to have been shuffled.
check('inserting at a point splits the text there',
  withChipAt('head tail', [], '\uFFFC', ref('a'), 4).text === 'head\uFFFC tail',
  JSON.stringify(withChipAt('head tail', [], '\uFFFC', ref('a'), 4).text))

check('the inserted reference points at its placeholder',
  (() => {
    const snapshot = withChipAt('head tail', [], '\uFFFC', ref('a'), 4)
    return snapshot.text.indexOf('\uFFFC') === snapshot.references[0].offset
  })(),
  'the offset does not locate the placeholder')

check('references at or after the point shift right by the inserted length',
  (() => {
    const snapshot = withChipAt('ab\uFFFC', [ref('b', { offset: 2 })], '\uFFFC', ref('a'), 0)
    return snapshot.text === '\uFFFCab\uFFFC'
      && snapshot.references.find((item) => item.ref === 'b').offset === 3
  })(),
  JSON.stringify(withChipAt('ab\uFFFC', [ref('b', { offset: 2 })], '\uFFFC', ref('a'), 0)))

check('references before the point keep their offset and their identity',
  (() => {
    const first = ref('a', { offset: 0 })
    const snapshot = withChipAt('\uFFFC tail', [first], '\uFFFC', ref('b'), 1)
    return snapshot.references[0] === first && snapshot.references[0].offset === 0
  })(),
  'an earlier reference was rewritten')

// `pairs()` in cards.js zips the DOM's chips — always in document order — against `occurrences` BY ARRAY POSITION and
// takes the ordinal from that pairing. A reference appended to the array for a chip restored to the front would be
// numbered as the last chip in the draft, so the array has to stay ordered by offset.
check('the new reference is spliced in by offset, not appended to the array',
  (() => {
    const snapshot = withChipAt('ab\uFFFC', [ref('b', { offset: 2 })], '\uFFFC', ref('a'), 0)
    return snapshot.references.map((item) => item.ref).join(',') === 'a,b'
  })(),
  withChipAt('ab\uFFFC', [ref('b', { offset: 2 })], '\uFFFC', ref('a'), 0).references
    .map((item) => item.ref).join(','))

check('an insertion point past the end is clamped to the draft',
  withChipAt('abc', [], '\uFFFC', ref('a'), 99).text === 'abc\uFFFC',
  JSON.stringify(withChipAt('abc', [], '\uFFFC', ref('a'), 99).text))

check('a negative insertion point is clamped to the start',
  withChipAt('abc', [], '\uFFFC', ref('a'), -5).text === '\uFFFCabc',
  JSON.stringify(withChipAt('abc', [], '\uFFFC', ref('a'), -5).text))

// ── Removing ───────────────────────────────────────────────────────────────
// Offsets are UTF-16 indices into the draft string, which is what the composer reports.
check('removing the only chip empties the draft',
  (() => {
    const snapshot = withoutChip('\uFFFC', [ref('a', { offset: 0 })], CHIP_SOURCE, 'a')
    return snapshot !== null && snapshot.text === '' && snapshot.references.length === 0
  })(),
  'a lone chip did not clear cleanly')

// A chip does not own a line break any more.
//
// Since a chip no longer inserts a separator when appended, removal must not swallow a newline either — doing so ate a
// line the user had typed themselves. Only the placeholder character goes; the text around it, newlines included, is
// exactly what the user wrote. The one remaining case where a break goes is a chip alone on its own middle line, where
// leaving both newlines would open a blank line (covered below).
check('removing a chip at the start leaves the following break',
  (() => {
    const snapshot = withoutChip('\uFFFC\ntail', [ref('a', { offset: 0 })], CHIP_SOURCE, 'a')
    return snapshot.text === '\ntail'
  })(),
  JSON.stringify(withoutChip('\uFFFC\ntail', [ref('a', { offset: 0 })], CHIP_SOURCE, 'a')?.text))

check('removing a chip at the end leaves the preceding break',
  (() => {
    const snapshot = withoutChip('head\n\uFFFC', [ref('a', { offset: 5 })], CHIP_SOURCE, 'a')
    return snapshot.text === 'head\n'
  })(),
  JSON.stringify(withoutChip('head\n\uFFFC', [ref('a', { offset: 5 })], CHIP_SOURCE, 'a')?.text))

check('removing a chip alone on a middle line joins without a blank line',
  (() => {
    const draft = 'head\n\uFFFC\ntail'
    const snapshot = withoutChip(draft, [ref('a', { offset: 5 })], CHIP_SOURCE, 'a')
    return snapshot.text === 'head\ntail'
  })(),
  JSON.stringify((() => {
    const draft = 'head\n\uFFFC\ntail'
    return withoutChip(draft, [ref('a', { offset: 5 })], CHIP_SOURCE, 'a')?.text
  })()))

check('removing a mid-line chip leaves the surrounding prose on its line',
  (() => {
    const draft = 'a\uFFFCb'
    const snapshot = withoutChip(draft, [ref('a', { offset: 1 })], CHIP_SOURCE, 'a')
    return snapshot.text === 'ab'
  })(),
  JSON.stringify(withoutChip('a\uFFFCb', [ref('a', { offset: 1 })], CHIP_SOURCE, 'a')?.text))

check('later references shift left by exactly the removed length',
  (() => {
    const draft = '\uFFFC\nb\uFFFC'
    const snapshot = withoutChip(draft, [
      ref('a', { offset: 0 }),
      ref('b', { offset: 3 }),
    ], CHIP_SOURCE, 'a')
    // Only the placeholder goes (1 unit), so the second chip moves from 3 to 2 and the newline stays.
    return snapshot.text === '\nb\uFFFC' && snapshot.references[0].offset === 2
  })(),
  JSON.stringify((() => {
    const draft = '\uFFFC\nb\uFFFC'
    return withoutChip(draft, [ref('a', { offset: 0 }), ref('b', { offset: 3 })], CHIP_SOURCE, 'a')
  })()))

check('references before the removed chip keep their offsets',
  (() => {
    const draft = '\uFFFC\nx\n\uFFFC'
    const snapshot = withoutChip(draft, [
      ref('a', { offset: 0 }),
      ref('b', { offset: 4 }),
    ], CHIP_SOURCE, 'b')
    return snapshot.references[0].offset === 0
  })(),
  'an earlier reference was shifted')

check('user prose between chips survives removal',
  (() => {
    const draft = '\uFFFC\nmy own words\n\uFFFC'
    const snapshot = withoutChip(draft, [
      ref('a', { offset: 0 }),
      ref('b', { offset: 15 }),
    ], CHIP_SOURCE, 'a')
    return snapshot.text.includes('my own words')
  })(),
  'removal took the user\'s prose with it')

check('removing an unknown chip returns null',
  withoutChip('\uFFFC', [ref('a', { offset: 0 })], CHIP_SOURCE, 'missing') === null,
  'an unknown ref produced a snapshot')

check('a chip of another source with the same id is not removed',
  withoutChip('\uFFFC', [{ ...ref('a', { offset: 0 }), source: 'other' }], CHIP_SOURCE, 'a') === null,
  'the source was not checked')

check('removal does not mutate the input references',
  (() => {
    const references = [ref('a', { offset: 0 }), ref('b', { offset: 3 })]
    const before = references.map((item) => item.offset).join(',')
    withoutChip('\uFFFC\nb\uFFFC', references, CHIP_SOURCE, 'a')
    return references.map((item) => item.offset).join(',') === before
  })(),
  'the caller\'s reference array was mutated in place')

// ── UTF-16 offsets ─────────────────────────────────────────────────────────
// The composer counts UTF-16 code units, so a chip after an emoji must be offset by 2 for
// that emoji, not by 1.
check('offsets count UTF-16 code units, not code points',
  (() => {
    const draft = '🙂\uFFFC'
    const snapshot = withoutChip(draft, [ref('a', { offset: 2 })], CHIP_SOURCE, 'a')
    return snapshot !== null && snapshot.text === '🙂'
  })(),
  'an emoji shifted the offset incorrectly')

check('a CJK passage does not disturb its own offsets',
  (() => {
    const draft = '中文\uFFFC'
    const snapshot = withoutChip(draft, [ref('a', { offset: 2 })], CHIP_SOURCE, 'a')
    return snapshot !== null && snapshot.text === '中文'
  })(),
  'CJK characters were counted incorrectly')

// ── Cut, then put back ─────────────────────────────────────────────────────
// The property undo depends on: cutting a chip out and putting it back at the site the cut reported reproduces the
// draft exactly — text and every offset. The chip alone on its line is the case that catches a naive restore, because
// the cut takes the break before it; a restore that ignores `lead` lands the chip at the end of the line above.
const roundTrip = (draft, references, target) => {
  const site = chipRemovalSite(draft, references, CHIP_SOURCE, target)
  if (site === null) return null
  const cut = withoutChip(draft, references, CHIP_SOURCE, target)
  const removed = references.find((item) => item.ref === target)
  const back = withChipAt(cut.text, cut.references, `${site.lead}\uFFFC`, removed, site.start)
  return { site, cut, back }
}

const roundTrips = [
  ['a chip in the middle of a line', 'head \uFFFC tail', [ref('a', { offset: 5 })]],
  ['a chip alone on its own line', 'head\n\uFFFC\ntail', [ref('a', { offset: 5 })]],
  ['a chip at the very start', '\uFFFC\ntail', [ref('a', { offset: 0 })]],
  ['a chip at the very end', 'head\n\uFFFC', [ref('a', { offset: 5 })]],
  ['the first of two chips on one line', '\uFFFC\uFFFC', [ref('a', { offset: 0 }), ref('b', { offset: 1 })]],
  ['a chip after an emoji', '🙂\uFFFC', [ref('a', { offset: 2 })]],
]

for (const [label, draft, references] of roundTrips) {
  const trip = roundTrip(draft, references, references[0].ref)
  check(`cut then put back restores the text: ${label}`,
    trip !== null && trip.back.text === draft,
    JSON.stringify(trip?.back.text))
  check(`cut then put back restores every offset: ${label}`,
    trip !== null
      && trip.back.references.length === references.length
      && references.every((item) => trip.back.references
        .find((back) => back.ref === item.ref)?.offset === item.offset),
    JSON.stringify(trip?.back.references.map((item) => `${item.ref}@${item.offset}`)))
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
