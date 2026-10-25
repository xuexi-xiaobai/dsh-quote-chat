/**
 * Guard the annotation ordinal.
 *
 * The number on a chip is a *position*, not an identity. Two bugs came from
 * treating it as an identity:
 *
 *   - it kept climbing after a delete (1, 2, 3 → delete 2 → next is 4);
 *   - a session that already had annotations pushed the first new one past 1.
 *
 * Every mutation must renumber so the list reads 1, 2, 3 … while ids stay stable
 * (the id is what chips and occurrences are keyed by, so renumbering must not
 * disturb it).
 *
 * Run: node test/numbering.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'src', 'index.js'), 'utf8')

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

/** The same rules client.js implements, exercised directly. */
const renumber = (list) => list.map((item, index) => (item.number === index + 1
  ? item
  : { ...item, number: index + 1 }))

function makeStore() {
  return { list: [], seq: 0 }
}
function add(store, draft) {
  if (store.list.length >= 12) return null
  store.seq += 1
  const annotation = { ...draft, id: `qc-${store.seq}`, number: store.list.length + 1 }
  store.list = renumber([...store.list, annotation])
  return annotation
}
function remove(store, id) {
  store.list = renumber(store.list.filter((item) => item.id !== id))
}

const store = makeStore()
add(store, { text: 'A' })
add(store, { text: 'B' })
add(store, { text: 'C' })
check('three additions number 1,2,3',
  store.list.map((item) => item.number).join(',') === '1,2,3',
  store.list.map((item) => item.number).join(','))

const middle = store.list[1].id
remove(store, middle)
check('deleting the middle renumbers to 1,2',
  store.list.map((item) => item.number).join(',') === '1,2',
  store.list.map((item) => item.number).join(','))

add(store, { text: 'D' })
check('the next addition is 3, not 4',
  store.list.map((item) => item.number).join(',') === '1,2,3',
  store.list.map((item) => item.number).join(','))

check('ids stay stable across renumbering',
  store.list.map((item) => item.id).join(',') === 'qc-1,qc-3,qc-4',
  store.list.map((item) => item.id).join(','))

remove(store, store.list[0].id)
check('deleting the first renumbers to 1,2',
  store.list.map((item) => item.number).join(',') === '1,2',
  store.list.map((item) => item.number).join(','))

const fresh = makeStore()
fresh.seq = 99
add(fresh, { text: 'X' })
check('a fresh list starts at 1 regardless of seq', fresh.list[0].number === 1,
  String(fresh.list[0].number))

store.list = []
add(store, { text: 'E' })
check('after clearing, the next number is 1', store.list[0].number === 1,
  String(store.list[0].number))

// ── Source-level guards ────────────────────────────────────────────────────
check('addAnnotation renumbers',
  /publish\(store, renumber\(\[\.\.\.store\.list, annotation\]\)\)/.test(source),
  'addAnnotation no longer renumbers')
check('removeAnnotation renumbers',
  /publish\(store, renumber\(store\.list\.filter/.test(source),
  'removeAnnotation no longer renumbers')
check('the new annotation number is list length + 1',
  /number: store\.list\.length \+ 1/.test(source),
  'addAnnotation derives its number some other way')
// The ordinal must be rendered by CSS from an attribute, because the host's own
// label span did not reach the screen.
check('the chip ordinal is drawn from an attribute',
  /\[data-composer-chip="quote-chat"\]::after\{content:attr\(data-qc-label\)/.test(source),
  'no ::after rule reading data-qc-label')
check('the ordinal is the chip position in the draft',
  /for \(let position = 0; position < ordered\.length; position \+= 1\)/.test(source)
    && /labels\.content\.replace\('\{n\}', String\(ordinal\)\)/.test(source),
  'the chip ordinal is not derived from its position')
// The chip's ordinal must come from the live chip list, never from a stored
// counter — that is what drifted upward across messages.
check('the chip ordinal does not read annotation.number',
  /const ordinal = position \+ 1/.test(source)
    && /chip\.dataset\.qcLabel = labels\.content\.replace\('\{n\}', String\(ordinal\)\)/.test(source),
  'the chip still renders annotation.number')
check('an unrendered card shows no ordinal',
  /dangerouslySetInnerHTML/.test(source) && !/qc-card-num/.test(source),
  'the card still builds a number badge')
check('the ordinal attribute is cleared on unmark',
  /delete chip\.dataset\.qcLabel/.test(source),
  'data-qc-label is left behind when a chip is released')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
