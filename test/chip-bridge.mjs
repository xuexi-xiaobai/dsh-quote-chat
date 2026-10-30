/**
 * The draft bridge: side-effect order, and what survives a failure.
 *
 * The Host's input interface is a stand-in here, recording every `setDraft` call in order with
 * its argument and any error it was told to throw. That is enough to pin the behaviour this
 * stage is about: what happens before what, and what is left behind when a step fails.
 *
 * Three things are deliberately preserved rather than tidied:
 *
 *   - placement registers the payload BEFORE writing, and a failed write leaves it registered;
 *   - release does not catch — a throwing `setDraft` propagates and aborts the caller;
 *   - neither operation deletes a payload.
 *
 * Run: node test/chip-bridge.mjs
 */
import { createDraftBridge } from '../src/chip-bridge.js'
import { createChipRegistry } from '../src/chip-registry.js'
import { CHIP_PLACEHOLDER, CHIP_SOURCE, serializeChipForModel } from '../src/chip-draft.js'

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

const LABELS = { content: '注释 {n}' }

/** An annotation in the shape the dock holds. */
const annotation = (overrides = {}) => ({
  id: 'qc-1',
  kind: 'text',
  number: 1,
  text: 'passage',
  comment: '',
  ...overrides,
})

/**
 * A Host input stand-in that records every write.
 * @param options - `{ draft, occurrences, throws }`.
 * @returns `{ port, calls }`.
 */
function makePort({ draft = '', occurrences = [], throws = null } = {}) {
  const calls = []
  const port = {
    setDraft(snapshot) {
      calls.push(snapshot)
      if (throws !== null) throw throws
    },
  }
  return { port, calls, read: () => ({ draft, occurrences }) }
}

// ── Placing ────────────────────────────────────────────────────────────────
{
  const registry = createChipRegistry()
  const bridge = createDraftBridge({ registry, source: CHIP_SOURCE })
  const { port, calls, read } = makePort({ draft: 'hello' })

  const okPlaced = bridge.place(port, read, annotation(), LABELS)
  check('placing a chip reports success', okPlaced === true, String(okPlaced))
  check('placing writes the draft exactly once', calls.length === 1, String(calls.length))
  check('the draft text gains the placeholder with no separator',
    calls[0].text === `hello${CHIP_PLACEHOLDER}`, JSON.stringify(calls[0].text))
  check('the reference offset locates the placeholder',
    calls[0].references[0].offset === calls[0].text.indexOf(CHIP_PLACEHOLDER),
    `${calls[0].references[0].offset} vs ${calls[0].text.indexOf(CHIP_PLACEHOLDER)}`)
  check('the reference names this plugin as its source',
    calls[0].references[0].source === CHIP_SOURCE, String(calls[0].references[0].source))
  check('the payload is registered before the draft is written',
    registry.has('qc-1') === true, 'the payload was missing after a successful write')
}

// The registry must be filled BEFORE setDraft runs: the Host can serialize as soon as the chip
// exists, so a payload written afterwards would be too late. Observation: the stand-in checks
// the registry at call time.
{
  const registry = createChipRegistry()
  const bridge = createDraftBridge({ registry, source: CHIP_SOURCE })
  let registeredAtWrite = null
  const port = {
    setDraft() {
      registeredAtWrite = registry.has('qc-1')
    },
  }
  bridge.place(port, () => ({ draft: '', occurrences: [] }), annotation(), LABELS)
  check('the payload already exists when setDraft is called',
    registeredAtWrite === true, String(registeredAtWrite))
}

// ── Placing with no port ───────────────────────────────────────────────────
{
  const registry = createChipRegistry()
  const bridge = createDraftBridge({ registry, source: CHIP_SOURCE })
  const placed = bridge.place(undefined, () => ({ draft: '', occurrences: [] }), annotation(), LABELS)
  check('placing without a setDraft reports failure', placed === false, String(placed))
  check('placing without a setDraft registers nothing',
    registry.has('qc-1') === false, 'a payload was registered with nowhere to place it')
}

// ── A failing write leaves the payload behind ──────────────────────────────
{
  const boom = new Error('setDraft refused')
  const registry = createChipRegistry()
  const bridge = createDraftBridge({ registry, source: CHIP_SOURCE })
  const { port } = makePort({ draft: 'x', throws: boom })

  const placed = bridge.place(port, () => ({ draft: 'x', occurrences: [] }), annotation(), LABELS)
  check('a throwing setDraft makes placement report failure', placed === false, String(placed))
  check('a failed placement keeps the registered payload',
    registry.has('qc-1') === true,
    'the payload was rolled back, which changes the existing behaviour')
  check('the failure does not propagate out of place',
    placed === false, 'place() rethrew instead of reporting')
}

// ── Releasing ──────────────────────────────────────────────────────────────
{
  const registry = createChipRegistry()
  const bridge = createDraftBridge({ registry, source: CHIP_SOURCE })
  registry.register(annotation(), '注释 1')
  const { port, calls } = makePort({ draft: `\uFFFC\ntail`, occurrences: [{
    source: CHIP_SOURCE, ref: 'qc-1', offset: 0, length: 1,
  }] })

  const released = bridge.release(port, () => ({
    draft: `\uFFFC\ntail`,
    occurrences: [{ source: CHIP_SOURCE, ref: 'qc-1', offset: 0, length: 1 }],
  }), 'qc-1')
  check('releasing a present chip reports success', released === true, String(released))
  check('releasing writes the draft once', calls.length === 1, String(calls.length))
  check('the chip is gone and the newline it sat after stays', calls[0].text === '\ntail',
    JSON.stringify(calls[0].text))
  check('releasing does not delete the payload',
    registry.has('qc-1') === true,
    'the payload was removed, which changes the existing behaviour')
}

// ── Releasing an absent chip ───────────────────────────────────────────────
{
  const registry = createChipRegistry()
  const bridge = createDraftBridge({ registry, source: CHIP_SOURCE })
  const { port, calls } = makePort({ draft: 'no chips here' })
  const released = bridge.release(port, () => ({ draft: 'no chips here', occurrences: [] }), 'qc-9')
  check('releasing an absent chip reports false', released === false, String(released))
  check('releasing an absent chip writes nothing', calls.length === 0, String(calls.length))
}

{
  const registry = createChipRegistry()
  const bridge = createDraftBridge({ registry, source: CHIP_SOURCE })
  const occurrences = [{ source: CHIP_SOURCE, ref: 'qc-1', offset: 0, length: 1 }]
  const released = bridge.release(undefined, () => ({ draft: '\uFFFC', occurrences }), 'qc-1')
  check('releasing without a setDraft reports false', released === false, String(released))
}

// ── A failing release propagates ───────────────────────────────────────────
// This is the behaviour that keeps the store and the draft from diverging: the caller's next
// step (removing the annotation) must not run when the draft rewrite failed.
{
  const boom = new Error('setDraft refused')
  const registry = createChipRegistry()
  const bridge = createDraftBridge({ registry, source: CHIP_SOURCE })
  const { port } = makePort({ draft: '\uFFFC', occurrences: [], throws: boom })
  let propagated = null
  let followUpRan = false
  try {
    bridge.release(port, () => ({
      draft: '\uFFFC',
      occurrences: [{ source: CHIP_SOURCE, ref: 'qc-1', offset: 0, length: 1 }],
    }), 'qc-1')
    followUpRan = true
  } catch (error) {
    propagated = error
  }
  check('a throwing release propagates', propagated === boom, String(propagated))
  check('the caller can abort its follow-up work',
    followUpRan === false, 'the release swallowed the error')
}

// ── Live draft reads, not a captured snapshot ──────────────────────────────
// The bridge must read the draft through the getter on every call. A stored copy would append
// to the first render's text for the rest of the session.
{
  const registry = createChipRegistry()
  const bridge = createDraftBridge({ registry, source: CHIP_SOURCE })
  const { port, calls } = makePort()
  let draft = 'first'
  const read = () => ({ draft, occurrences: [] })

  bridge.place(port, read, annotation({ id: 'a' }), LABELS)
  draft = 'second'
  bridge.place(port, read, annotation({ id: 'b' }), LABELS)

  check('a second placement appends to the draft as it is now',
    calls[1].text.includes('second') && !calls[1].text.includes('first'),
    JSON.stringify(calls[1].text))
}

// ── The full chain ─────────────────────────────────────────────────────────
// Create a reference, write the draft, change the comment, serialize, and check the text the
// model would receive. This is the chain every other assertion supports.
{
  const registry = createChipRegistry()
  const bridge = createDraftBridge({ registry, source: CHIP_SOURCE })
  const { port, calls } = makePort({ draft: '请问：' })

  bridge.place(port, () => ({ draft: '请问：', occurrences: [] }), annotation({
    id: 'chain', number: 1, text: '被引用的段落', comment: '',
  }), LABELS)

  const written = calls[0]
  const ref = written.references[0].ref
  check('the chain: the draft holds one placeholder',
    written.text === `请问：${CHIP_PLACEHOLDER}`, JSON.stringify(written.text))

  const initial = serializeChipForModel(registry.get(ref))
  check('the chain: serialization before the edit',
    initial === '\n[注释 1]\n被引用的段落\n', JSON.stringify(initial))

  registry.updateComment(ref, '补充说明')
  const edited = serializeChipForModel(registry.get(ref))
  check('the chain: serialization after the edit carries the new comment',
    edited === '\n[注释 1]\n补充说明\n被引用的段落\n', JSON.stringify(edited))

  check('the chain: the draft text is unchanged by the edit',
    written.text === `请问：${CHIP_PLACEHOLDER}`, 'the comment leaked into the draft')
}

// ── Instance isolation ─────────────────────────────────────────────────────
{
  const firstRegistry = createChipRegistry()
  const secondRegistry = createChipRegistry()
  const firstBridge = createDraftBridge({ registry: firstRegistry, source: CHIP_SOURCE })
  const secondBridge = createDraftBridge({ registry: secondRegistry, source: CHIP_SOURCE })
  const firstPort = makePort({ draft: '' })
  const secondPort = makePort({ draft: '' })

  firstBridge.place(firstPort.port, firstPort.read, annotation({ id: 'only-a' }), LABELS)
  check('a second bridge cannot resolve the first instance\'s chip',
    secondRegistry.get('only-a') === undefined, String(secondRegistry.get('only-a')))
  check('the second bridge still works on its own registry',
    secondBridge.place(secondPort.port, secondPort.read, annotation({ id: 'only-b' }), LABELS) === true,
    'the second bridge failed independently')
  check('the two instances hold separate payloads',
    firstRegistry.get('only-a').text === 'passage'
      && secondRegistry.get('only-b').text === 'passage',
    'the registries shared storage')
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
