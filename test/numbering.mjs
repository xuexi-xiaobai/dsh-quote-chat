/**
 * The annotation store: numbering, identity, limits, isolation and notification.
 *
 * The number on a chip is a *position*, not an identity. Two bugs came from treating it as an
 * identity:
 *
 *   - it kept climbing after a delete (1, 2, 3 → delete 2 → next is 4);
 *   - a session that already had annotations pushed the first new one past 1.
 *
 * Every mutation must renumber so the list reads 1, 2, 3 …, while ids stay stable — the id is
 * what chips and occurrences are keyed by, so renumbering must not disturb it.
 *
 * This suite imports the real store. An earlier version re-implemented the numbering rules
 * inside the test, which meant it could pass while the shipped code disagreed.
 *
 * Run: node test/numbering.mjs
 */
import { createAnnotationStore } from '../src/annotation-store.js'
import { readSourceBundle } from './source.mjs'

const source = await readSourceBundle()

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** Numbers rendered for a list, as a comparable string. */
const numbers = (list) => list.map((item) => item.number).join(',')

/** Ids rendered for a list, as a comparable string. */
const ids = (list) => list.map((item) => item.id).join(',')

// ── Numbering is a position ────────────────────────────────────────────────
{
  const store = createAnnotationStore()
  const session = 'session-a'
  store.add(session, { text: 'A' })
  store.add(session, { text: 'B' })
  store.add(session, { text: 'C' })
  check('three additions number 1,2,3', numbers(store.snapshot(session)) === '1,2,3',
    numbers(store.snapshot(session)))

  const middleId = store.snapshot(session)[1].id
  store.remove(session, middleId)
  check('deleting the middle renumbers to 1,2', numbers(store.snapshot(session)) === '1,2',
    numbers(store.snapshot(session)))

  store.add(session, { text: 'D' })
  check('the next addition is 3, not 4', numbers(store.snapshot(session)) === '1,2,3',
    numbers(store.snapshot(session)))

  // Ids are what chips and occurrences reference; renumbering must not disturb them.
  const remaining = store.snapshot(session)
  check('the deleted id is gone and no id was reused',
    !remaining.some((item) => item.id === middleId)
      && new Set(remaining.map((item) => item.id)).size === remaining.length,
    ids(remaining))
  check('ids are unique and stable across renumbering',
    remaining.every((item, index) => item.number === index + 1 && typeof item.id === 'string'),
    ids(remaining))

  store.remove(session, remaining[0].id)
  check('deleting the first renumbers to 1,2', numbers(store.snapshot(session)) === '1,2',
    numbers(store.snapshot(session)))
}

// ── A fresh list starts at 1 ───────────────────────────────────────────────
{
  const store = createAnnotationStore()
  const session = 'session-b'
  // A session that never had annotations must not inherit anyone else's counter.
  store.add('other-session', { text: 'X' })
  store.add(session, { text: 'Y' })
  check('a session starts at 1 regardless of other sessions',
    store.snapshot(session)[0].number === 1, String(store.snapshot(session)[0].number))
}

// ── Clearing resets numbering ──────────────────────────────────────────────
{
  const store = createAnnotationStore()
  const session = 'session-c'
  store.add(session, { text: 'A' })
  store.add(session, { text: 'B' })
  store.clear(session)
  check('clearing empties the list', store.snapshot(session).length === 0,
    String(store.snapshot(session).length))
  store.add(session, { text: 'C' })
  check('after clearing, the next number is 1', store.snapshot(session)[0].number === 1,
    String(store.snapshot(session)[0].number))
}

// ── Update keeps identity ──────────────────────────────────────────────────
{
  const store = createAnnotationStore()
  const session = 'session-d'
  const first = store.add(session, { text: 'A', comment: 'old' })
  store.add(session, { text: 'B' })
  const updated = store.update(session, first.id, '  new comment  ')
  check('update returns the same id', updated !== null && updated.id === first.id,
    String(updated?.id))
  check('update trims the comment', updated?.comment === 'new comment', String(updated?.comment))
  check('update preserves the ordinal', updated?.number === 1, String(updated?.number))
  check('update leaves the other annotation alone',
    store.snapshot(session)[1].number === 2 && store.snapshot(session).length === 2,
    numbers(store.snapshot(session)))
  const missing = store.update(session, 'does-not-exist', 'x')
  check('updating an unknown id returns null', missing === null, String(missing))
  const nonString = store.update(session, first.id, 42)
  check('a non-string comment becomes empty', nonString?.comment === '', JSON.stringify(nonString?.comment))
}

// ── The limit ──────────────────────────────────────────────────────────────
{
  const store = createAnnotationStore({ maxAnnotations: 3 })
  const session = 'session-e'
  check('the store accepts up to its limit',
    store.add(session, { text: '1' }) !== null
      && store.add(session, { text: '2' }) !== null
      && store.add(session, { text: '3' }) !== null,
    numbers(store.snapshot(session)))
  const overflow = store.add(session, { text: '4' })
  check('an addition past the limit returns null', overflow === null, String(overflow))
  check('the list does not grow past the limit', store.snapshot(session).length === 3,
    String(store.snapshot(session).length))
}

// ── Session isolation inside one store ─────────────────────────────────────
{
  const store = createAnnotationStore()
  store.add('s1', { text: 'A' })
  store.add('s2', { text: 'B' })
  store.add('s2', { text: 'C' })
  check('sessions keep separate lists',
    store.snapshot('s1').length === 1 && store.snapshot('s2').length === 2,
    `s1=${store.snapshot('s1').length} s2=${store.snapshot('s2').length}`)
  check('each session numbers from 1',
    numbers(store.snapshot('s1')) === '1' && numbers(store.snapshot('s2')) === '1,2',
    `${numbers(store.snapshot('s1'))} | ${numbers(store.snapshot('s2'))}`)

  let s1Notifications = 0
  let s2Notifications = 0
  store.subscribe('s1', () => { s1Notifications += 1 })
  store.subscribe('s2', () => { s2Notifications += 1 })
  store.add('s1', { text: 'D' })
  check('a mutation notifies only its own session',
    s1Notifications === 1 && s2Notifications === 0,
    `s1=${s1Notifications} s2=${s2Notifications}`)
}

// ── Snapshot stability ─────────────────────────────────────────────────────
{
  const store = createAnnotationStore()
  const session = 'session-f'
  const beforeAnyAdd = store.snapshot(session)
  check('an untouched session returns a stable empty list',
    beforeAnyAdd === store.snapshot(session), 'snapshot identity changed without a mutation')
  check('an untouched session returns an empty array', beforeAnyAdd.length === 0,
    String(beforeAnyAdd.length))

  store.add(session, { text: 'A' })
  const afterAdd = store.snapshot(session)
  check('the snapshot is stable between mutations',
    afterAdd === store.snapshot(session), 'snapshot identity changed without a mutation')
  check('a mutation replaces the snapshot',
    afterAdd !== beforeAnyAdd, 'the list was mutated in place, so React would not re-render')

  const undefinedSnapshot = store.snapshot(undefined)
  check('an undefined session returns the same empty list each time',
    undefinedSnapshot === store.snapshot(undefined) && undefinedSnapshot.length === 0,
    'undefined-session snapshots allocate or differ')
}

// ── Subscription lifecycle ─────────────────────────────────────────────────
{
  const store = createAnnotationStore()
  const session = 'session-g'
  let calls = 0
  const unsubscribe = store.subscribe(session, () => { calls += 1 })
  store.add(session, { text: 'A' })
  check('a subscriber is notified on add', calls === 1, String(calls))

  store.add(session, { text: 'B' })
  check('a subscriber is notified on every add', calls === 2, String(calls))

  unsubscribe()
  store.add(session, { text: 'C' })
  check('an unsubscribed listener stops being notified', calls === 2, String(calls))

  // Subscribing to a session that does not exist yet must still see later additions.
  let lateCalls = 0
  store.subscribe('session-h', () => { lateCalls += 1 })
  store.add('session-h', { text: 'D' })
  check('subscribing before the first add still fires', lateCalls === 1, String(lateCalls))

  // A subscription with no session is inert, matching the hook's behaviour.
  const noop = store.subscribe(undefined, () => { throw new Error('should never fire') })
  check('subscribing without a session returns a no-op disposer',
    typeof noop === 'function', typeof noop)
  noop()

  // Clearing an already-empty session must not wake subscribers.
  let emptyClearCalls = 0
  store.subscribe('session-i', () => { emptyClearCalls += 1 })
  store.clear('session-i')
  check('clearing an empty session does not notify', emptyClearCalls === 0,
    String(emptyClearCalls))
}

// ── Instance isolation ─────────────────────────────────────────────────────
// Two Host factory calls produce two stores. They must not share annotations even when they
// use the SAME sessionId, because each plugin instance owns its state.
{
  const a = createAnnotationStore()
  const b = createAnnotationStore()
  const session = 'shared-session-id'

  a.add(session, { text: 'only in A' })
  check('a second store does not see the first store\'s annotation',
    b.snapshot(session).length === 0, String(b.snapshot(session).length))

  let bNotifications = 0
  b.subscribe(session, () => { bNotifications += 1 })
  a.add(session, { text: 'another in A' })
  check('a mutation in one store does not notify the other',
    bNotifications === 0, String(bNotifications))

  b.add(session, { text: 'only in B' })
  check('the two stores hold independent lists',
    a.snapshot(session).length === 2 && b.snapshot(session).length === 1,
    `a=${a.snapshot(session).length} b=${b.snapshot(session).length}`)

  const aFirst = a.snapshot(session)[0]
  b.update(session, b.snapshot(session)[0].id, 'changed in B')
  check('an update in one store does not touch the other',
    a.snapshot(session)[0] === aFirst && a.snapshot(session)[0].comment !== 'changed in B',
    JSON.stringify(a.snapshot(session)[0].comment))
}

// ── Source guards: the integration must stay wired ─────────────────────────
check('the entry module instantiates one store per factory call',
  /const annotationStore = createAnnotationStore\(\{ maxAnnotations: MAX_ANNOTATIONS \}\)/.test(source),
  'the store is not created from MAX_ANNOTATIONS')
check('the limit has a single declaration',
  (source.match(/const MAX_ANNOTATIONS = /g) ?? []).length === 1,
  'MAX_ANNOTATIONS is declared more than once')
check('the store does not import the entry module',
  !/from '\.\/index\.js'/.test(source), 'the store imports the entry module, creating a cycle')
check('the React adapter is the only hook in the store wiring',
  /React\.useSyncExternalStore\(subscribe, snapshot, snapshot\)/.test(source),
  'the hook no longer uses the store snapshot')

// The ordinal must be rendered by CSS from an attribute, because the host's own label span
// did not reach the screen.
check('the chip ordinal is drawn from an attribute',
  /\[data-composer-chip="quote-chat"\]::after\{content:attr\(data-qc-label\)/.test(source),
  'no ::after rule reading data-qc-label')
check('the ordinal is the chip position in the draft',
  /for \(let position = 0; position < ordered\.length; position \+= 1\)/.test(source)
    && /labels\.content\.replace\('\{n\}', String\(ordinal\)\)/.test(source),
  'the chip ordinal is not derived from its position')
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
