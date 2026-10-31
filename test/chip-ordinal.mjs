/**
 * A chip's number is a position, and the model must read the same one the user sees.
 *
 * Two numbers existed and they only agreed by accident:
 *
 *   - the UI's, derived from the chip's place in the draft (`cards.js` `pairs()`), and
 *   - the model's, taken from the payload's `label`, written once at registration from the annotation store's
 *     `number` — which is the annotation's index in the STORE, not in the draft.
 *
 * Deleting a chip in the middle shifted every later chip in the UI while the payload kept its old number, so the
 * model read "注释 3" for a chip displayed as "注释 2", and two chips could carry the same number.
 *
 * This suite pins both halves: the pure ordinal, and the codec's use of it at serialize time.
 *
 * Run: node test/chip-ordinal.mjs
 */
import { chipOrdinal, CHIP_SOURCE, serializeChipForModel } from '../src/chip-draft.js'
import { createChipRegistry } from '../src/chip-registry.js'
import { registerReferenceSource } from '../src/registrations.js'

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** One chip as the Host reports it. */
const occurrence = (ref, offset, source = CHIP_SOURCE) => ({ source, ref, offset, length: 1 })

// ── The ordinal ────────────────────────────────────────────────────────────
check('the first chip is number one',
  chipOrdinal([occurrence('a', 0), occurrence('b', 1)], CHIP_SOURCE, 'a') === 1,
  String(chipOrdinal([occurrence('a', 0), occurrence('b', 1)], CHIP_SOURCE, 'a')))

check('a later chip counts from the start',
  chipOrdinal([occurrence('a', 0), occurrence('b', 1), occurrence('c', 2)], CHIP_SOURCE, 'c') === 3,
  String(chipOrdinal([occurrence('a', 0), occurrence('b', 1), occurrence('c', 2)], CHIP_SOURCE, 'c')))

// The number follows the Host's array order, NOT the offsets — pinned deliberately.
//
// `pairs()` in cards.js and `chipOrdinals()` in markers.js both zip the DOM's chips against this same array by index,
// so that is where the number on the screen comes from. Sorting by offset here would be defensible on its own, but it
// would make the model's number disagree with the screen's whenever the two orders differ — which is the exact class of
// bug this whole suite exists to close. If the Host's order is ever found to be unreliable, all three change together.
check('the number follows the Host\'s order, the same one the screen uses',
  chipOrdinal([occurrence('c', 2), occurrence('a', 0), occurrence('b', 1)], CHIP_SOURCE, 'b') === 3,
  String(chipOrdinal([occurrence('c', 2), occurrence('a', 0), occurrence('b', 1)], CHIP_SOURCE, 'b')))

check('chips of other sources are not counted',
  chipOrdinal([occurrence('cmd', 0, 'command-chip'), occurrence('a', 1)], CHIP_SOURCE, 'a') === 1,
  String(chipOrdinal([occurrence('cmd', 0, 'command-chip'), occurrence('a', 1)], CHIP_SOURCE, 'a')))

check('a chip that is not in the draft has no number',
  chipOrdinal([occurrence('a', 0)], CHIP_SOURCE, 'gone') === null,
  String(chipOrdinal([occurrence('a', 0)], CHIP_SOURCE, 'gone')))

check('a missing or malformed list yields null rather than throwing',
  chipOrdinal(undefined, CHIP_SOURCE, 'a') === null && chipOrdinal(null, CHIP_SOURCE, 'a') === null,
  'a missing occurrence list threw')

check('the caller\'s array is left alone',
  (() => {
    const list = [occurrence('c', 2), occurrence('a', 0)]
    const before = list.map((item) => item.ref).join(',')
    chipOrdinal(list, CHIP_SOURCE, 'a')
    return list.map((item) => item.ref).join(',') === before
  })(),
  'the Host\'s occurrence array was reordered in place')

// ── The codec uses it ──────────────────────────────────────────────────────
/**
 * Mount the reference source over a stand-in context.
 *
 * `registerReferenceSource` opens an effect and waits for `inputTriggers`; both are reduced to their observable
 * result here — the registered source — so the codec can be called directly.
 *
 * @param options - `{ registry, labelHandler }`.
 * @returns the registered source, with `codec.serialize`.
 */
function mountSource({ registry, labelHandler }) {
  let source
  registerReferenceSource({
    ctx: {
      effect(fn) { fn(); return () => {} },
      inject(_deps, fn) {
        return fn({ inputTriggers: { registerSource(spec) { source = spec; return () => {} } } })
      },
    },
    registry,
    jumpHandler: { current: null },
    labelHandler,
    CHIP_TRIGGER: '#',
    CHIP_SOURCE,
    CHIP_PLACEHOLDER: '\uFFFC',
    serializeChipForModel,
  })
  return source
}

// The payload is registered with number 7, which is what the store said when the chip was created and is now wrong:
// the chip sits second in the draft.
const registry = createChipRegistry()
registry.register({
  id: 'qc-1', kind: 'text', number: 7, text: '被引用的段落', comment: '说明',
}, '注释 7')

const labelHandler = { current: null }
const source = mountSource({ registry, labelHandler })

const fallback = await source.codec.serialize('qc-1')
check('with no mounted dock the stored label is used',
  fallback === '\n[注释 7]\n说明\n被引用的段落\n', JSON.stringify(fallback))

labelHandler.current = (ref) => {
  const ordinal = chipOrdinal([occurrence('qc-0', 0), occurrence('qc-1', 1)], CHIP_SOURCE, ref)
  return ordinal === null ? null : `注释 ${ordinal}`
}
const live = await source.codec.serialize('qc-1')
check('the live position wins over the number stored at registration',
  live === '\n[注释 2]\n说明\n被引用的段落\n', JSON.stringify(live))

check('resolving the label does not rewrite the payload',
  registry.get('qc-1').label === '注释 7', String(registry.get('qc-1').label))

// A handler that cannot place the chip (the dock is looking at another session) must not blank the label out.
labelHandler.current = () => null
const unplaced = await source.codec.serialize('qc-1')
check('a handler that cannot place the chip falls back to the stored label',
  unplaced === '\n[注释 7]\n说明\n被引用的段落\n', JSON.stringify(unplaced))

labelHandler.current = () => ''
const empty = await source.codec.serialize('qc-1')
check('an empty answer also falls back rather than emitting an empty label',
  empty === '\n[注释 7]\n说明\n被引用的段落\n', JSON.stringify(empty))

// The whole point: two chips whose payloads disagree with their positions still come out in reading order.
labelHandler.current = (ref) => {
  const ordinal = chipOrdinal([occurrence('qc-1', 0), occurrence('qc-2', 1)], CHIP_SOURCE, ref)
  return ordinal === null ? null : `注释 ${ordinal}`
}
registry.register({ id: 'qc-2', kind: 'text', number: 1, text: '第二段', comment: '' }, '注释 1')
const [first, second] = await Promise.all([
  source.codec.serialize('qc-1'),
  source.codec.serialize('qc-2'),
])
check('two chips get consecutive numbers in reading order',
  first.startsWith('\n[注释 1]\n') && second.startsWith('\n[注释 2]\n'),
  `${JSON.stringify(first)} / ${JSON.stringify(second)}`)

let rejected = null
try {
  await source.codec.serialize('missing')
} catch (error) {
  rejected = error
}
check('an unknown chip still rejects',
  rejected !== null && /unknown chip/.test(String(rejected?.message)), String(rejected))

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
