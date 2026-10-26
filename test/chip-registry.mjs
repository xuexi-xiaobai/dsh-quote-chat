/**
 * The chip payload registry, including the parts that look like defects.
 *
 * Payloads are never removed. Deleting an annotation does not delete its payload, and a failed
 * draft insertion does not roll back the payload it already registered. Those are the current
 * behaviours, and this suite pins them so a future "cleanup" commit has to argue with a test
 * rather than slip through review.
 *
 * Run: node test/chip-registry.mjs
 */
import { createChipRegistry } from '../src/chip-registry.js'
import { CHIP_PLACEHOLDER, CHIP_SOURCE, serializeChipForModel } from '../src/chip-draft.js'

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** An annotation in the shape the dock holds. */
const annotation = (overrides = {}) => ({
  id: 'qc-1',
  kind: 'text',
  number: 1,
  text: 'passage',
  comment: '',
  ...overrides,
})

// ── Registration ───────────────────────────────────────────────────────────
{
  const registry = createChipRegistry()
  const reference = registry.register(annotation(), '注释 1')

  check('registering returns a reference for this source',
    reference.source === CHIP_SOURCE, String(reference.source))
  check('the reference carries the annotation id',
    reference.ref === 'qc-1', String(reference.ref))
  check('the reference carries the label it was given',
    reference.label === '注释 1', String(reference.label))
  check('the reference uses the shared placeholder',
    reference.clipboardText === CHIP_PLACEHOLDER,
    JSON.stringify(reference.clipboardText))
  check('the reference length matches the placeholder length',
    reference.length === CHIP_PLACEHOLDER.length,
    `${reference.length} vs ${CHIP_PLACEHOLDER.length}`)
  check('the reference leaves the offset for the bridge',
    reference.offset === 0, String(reference.offset))

  const payload = registry.get('qc-1')
  check('the payload records the passage', payload?.text === 'passage', String(payload?.text))
  check('the payload records the kind', payload?.kind === 'text', String(payload?.kind))
  check('the payload records the ordinal', payload?.number === 1, String(payload?.number))
  check('the payload records the label', payload?.label === '注释 1', String(payload?.label))
  check('the payload records the comment', payload?.comment === '', JSON.stringify(payload?.comment))
  check('the payload holds exactly the five documented fields',
    payload !== undefined && Object.keys(payload).sort().join(',') === 'comment,kind,label,number,text',
    JSON.stringify(Object.keys(payload ?? {}).sort()))
}

// ── Unknown refs ───────────────────────────────────────────────────────────
{
  const registry = createChipRegistry()
  check('an unknown ref reads as undefined', registry.get('nope') === undefined,
    String(registry.get('nope')))
  check('an unknown ref is reported as absent', registry.has('nope') === false,
    String(registry.has('nope')))
  check('updating an unknown ref is a no-op, not an error',
    registry.updateComment('nope', 'x') === false, 'the update threw or claimed success')
}

// ── Comment updates ────────────────────────────────────────────────────────
{
  const registry = createChipRegistry()
  registry.register(annotation(), '注释 1')
  const updated = registry.updateComment('qc-1', '  trimmed  ')
  check('updating a comment reports success', updated === true, String(updated))
  check('the comment is trimmed', registry.get('qc-1').comment === 'trimmed',
    JSON.stringify(registry.get('qc-1').comment))
  check('updating the comment preserves the passage',
    registry.get('qc-1').text === 'passage', String(registry.get('qc-1').text))
  check('updating the comment preserves the label',
    registry.get('qc-1').label === '注释 1', String(registry.get('qc-1').label))

  registry.updateComment('qc-1', 42)
  check('a non-string comment becomes empty', registry.get('qc-1').comment === '',
    JSON.stringify(registry.get('qc-1').comment))
}

// ── Lifecycle: payloads are never removed ──────────────────────────────────
// This is the behaviour, not an oversight to fix here. There is deliberately no delete/clear.
{
  const registry = createChipRegistry()
  registry.register(annotation(), '注释 1')
  const api = Object.keys(registry).sort()
  check('the registry exposes no removal operation',
    !api.some((name) => /delete|remove|clear|dispose/i.test(name)),
    api.join(','))
  check('the registry keeps a payload indefinitely',
    registry.has('qc-1') === true, 'the payload vanished without being asked to')
}

// ── Instance isolation ─────────────────────────────────────────────────────
{
  const first = createChipRegistry()
  const second = createChipRegistry()
  first.register(annotation({ id: 'shared-id' }), '注释 1')
  check('a second registry cannot read the first one\'s payload',
    second.get('shared-id') === undefined, String(second.get('shared-id')))
  check('a second registry reports the ref as absent',
    second.has('shared-id') === false, String(second.has('shared-id')))
  check('the two registries can hold different payloads under the same id',
    (() => {
      second.register(annotation({ id: 'shared-id', text: 'other passage' }), 'Note 1')
      return first.get('shared-id').text === 'passage'
        && second.get('shared-id').text === 'other passage'
    })(),
    'the two registries shared storage')
}

// ── Serialization reads the current payload ────────────────────────────────
// The chain that matters: place a chip, change its comment, serialize, and get the NEW text.
{
  const registry = createChipRegistry()
  registry.register(annotation({ comment: '' }), '注释 1')
  const before = serializeChipForModel(registry.get('qc-1'))
  registry.updateComment('qc-1', 'revised note')
  const after = serializeChipForModel(registry.get('qc-1'))

  check('serialization before an edit carries no comment',
    before === '\n[注释 1]\npassage\n', JSON.stringify(before))
  check('serialization after an edit carries the new comment',
    after === '\n[注释 1]\nrevised note\npassage\n', JSON.stringify(after))
  check('serialization reads the live payload, not a snapshot',
    before !== after, 'the edit did not reach the serialized form')
}

// ── A payload registered then abandoned stays ──────────────────────────────
// A failed draft insertion leaves the payload behind. The registry has no rollback, and the
// bridge must not add one.
{
  const registry = createChipRegistry()
  registry.register(annotation({ id: 'abandoned' }), '注释 1')
  // Simulate the caller giving up: nothing reads it, nothing deletes it.
  check('an abandoned payload is still present',
    registry.has('abandoned') === true, 'the payload was reclaimed without an explicit call')
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
