/**
 * Annotations survive a reload — and a broken store never takes the feature down with it.
 *
 * The Host persists the composer draft but not the plugin's side of it. Without this the two halves disagreed after
 * every reload: a chip came back with no owner, the Host refused the send, and the chip had to be removed again.
 *
 * The load path is a parser, so it gets the treatment a parser gets: every malformed shape yields "nothing stored"
 * rather than a half-populated dock. A wrong list is worse than an empty one — an annotation with no anchor crashes
 * the marker layer far from here, and duplicate ids break the ordinal pairing.
 *
 * Run: node test/annotation-persistence.mjs
 */
import { createAnnotationPersistence, storageKey, STORAGE_PREFIX } from '../src/annotation-persistence.js'
import { createAnnotationStore } from '../src/annotation-store.js'

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** An annotation in the shape the store produces. */
const annotation = (overrides = {}) => ({
  id: 'qc-1-1',
  kind: 'text',
  number: 1,
  text: 'passage',
  previewText: 'passage',
  previewHtml: '<p>passage</p>',
  comment: 'a note',
  anchor: { nodeKey: 'k', startPath: [0], startOffset: 0, endPath: [0], endOffset: 7, quote: 'passage' },
  ...overrides,
})

/**
 * A `localStorage` stand-in.
 * @param options - `{ throws }`: throw on every operation, like a blocked/private storage.
 * @returns the storage and its backing map.
 */
function makeStorage({ throws = false } = {}) {
  const map = new Map()
  const guard = () => { if (throws) throw new Error('storage is not available') }
  return {
    map,
    getItem(key) { guard(); return map.has(key) ? map.get(key) : null },
    setItem(key, value) { guard(); map.set(key, String(value)) },
    removeItem(key) { guard(); map.delete(key) },
  }
}

const SESSION = 'session-1'

// ── Round trip ─────────────────────────────────────────────────────────────
{
  const storage = makeStorage()
  const persistence = createAnnotationPersistence({ storage })
  const saved = [annotation(), annotation({ id: 'qc-2-1', number: 2, comment: '' })]

  check('saving reports success', persistence.save(SESSION, saved) === true, 'save returned false')
  check('the entry lives under a versioned, session-scoped key',
    storage.map.has(storageKey(SESSION)) && storageKey(SESSION).startsWith(STORAGE_PREFIX),
    JSON.stringify([...storage.map.keys()]))

  const loaded = persistence.load(SESSION)
  check('what was saved comes back', loaded.length === 2, String(loaded.length))
  check('the comment survives', loaded[0].comment === 'a note', JSON.stringify(loaded[0]?.comment))
  check('the anchor survives, which is what the markers read',
    loaded[0].anchor.quote === 'passage', JSON.stringify(loaded[0]?.anchor))
  check('the ids survive, so a restored chip pairs with its payload',
    loaded[0].id === 'qc-1-1' && loaded[1].id === 'qc-2-1', JSON.stringify(loaded.map((item) => item.id)))
}

// ── Sessions do not see each other ─────────────────────────────────────────
{
  const storage = makeStorage()
  const persistence = createAnnotationPersistence({ storage })
  persistence.save('a', [annotation({ id: 'qc-a-1' })])
  persistence.save('b', [annotation({ id: 'qc-b-1' })])
  check('one session does not read another\'s annotations',
    persistence.load('a')[0].id === 'qc-a-1' && persistence.load('b')[0].id === 'qc-b-1',
    JSON.stringify([persistence.load('a')[0]?.id, persistence.load('b')[0]?.id]))
  check('an untouched session reads as empty',
    persistence.load('c').length === 0, JSON.stringify(persistence.load('c')))
}

// ── Nothing stored ─────────────────────────────────────────────────────────
{
  const persistence = createAnnotationPersistence({ storage: makeStorage() })
  check('an empty store reads as an empty list',
    Array.isArray(persistence.load(SESSION)) && persistence.load(SESSION).length === 0,
    JSON.stringify(persistence.load(SESSION)))

  const storage = makeStorage()
  const writing = createAnnotationPersistence({ storage })
  writing.save(SESSION, [annotation()])
  writing.save(SESSION, [])
  check('saving an empty list removes the entry rather than storing "[]"',
    storage.map.has(storageKey(SESSION)) === false, JSON.stringify([...storage.map.keys()]))
}

// ── Every malformed shape is refused ───────────────────────────────────────
// Each of these is a real state a storage can be left in: a write interrupted halfway, an older format, another tool
// writing the same key, or a hand-edit. None may produce a list the dock would try to render.
{
  const shapes = [
    ['not JSON at all', 'nope{'],
    ['a JSON string', '"just a string"'],
    ['a JSON number', '42'],
    ['null', 'null'],
    ['an object with no list', '{"annotations":"no"}'],
    ['an array of junk', '[1,2,3]'],
    ['an entry with no anchor', '[{"id":"a","kind":"text","text":"t","number":1}]'],
    ['an entry with no quote', '[{"id":"a","kind":"text","text":"t","number":1,"anchor":{}}]'],
    ['an entry with a non-numeric number', '[{"id":"a","kind":"text","text":"t","number":"1","anchor":{"quote":"q"}}]'],
    ['an entry with an empty id', '[{"id":"","kind":"text","text":"t","number":1,"anchor":{"quote":"q"}}]'],
  ]
  for (const [label, raw] of shapes) {
    const storage = makeStorage()
    storage.map.set(storageKey(SESSION), raw)
    const loaded = createAnnotationPersistence({ storage }).load(SESSION)
    check(`refuses ${label}`, loaded.length === 0, JSON.stringify(loaded))
  }
}

// A single bad entry must not discard its neighbours: losing one annotation is better than losing the list, and the
// good entries are not implicated in the bad one.
{
  const storage = makeStorage()
  storage.map.set(storageKey(SESSION), JSON.stringify([
    annotation({ id: 'qc-good-1' }),
    { id: 'qc-bad-1' },
    annotation({ id: 'qc-good-2', number: 2 }),
  ]))
  const loaded = createAnnotationPersistence({ storage }).load(SESSION)
  check('one malformed entry does not discard the others',
    loaded.length === 2 && loaded.map((item) => item.id).join(',') === 'qc-good-1,qc-good-2',
    JSON.stringify(loaded.map((item) => item.id)))
}

// Duplicate ids would make the payload registry and the ordinal pairing disagree about which chip is which.
{
  const storage = makeStorage()
  storage.map.set(storageKey(SESSION), JSON.stringify([
    annotation({ id: 'qc-same' }), annotation({ id: 'qc-same', comment: 'the other one' }),
  ]))
  const loaded = createAnnotationPersistence({ storage }).load(SESSION)
  check('duplicate ids are collapsed to one', loaded.length === 1, String(loaded.length))
}

// A stored list longer than the limit is truncated on read, so a limit that was lowered still holds.
{
  const storage = makeStorage()
  const many = Array.from({ length: 20 }, (_, index) => annotation({ id: `qc-${index}-1`, number: index + 1 }))
  storage.map.set(storageKey(SESSION), JSON.stringify(many))
  const loaded = createAnnotationPersistence({ storage, max: 12 }).load(SESSION)
  check('a stored list longer than the limit is truncated on read',
    loaded.length === 12, String(loaded.length))
}

// ── A storage that throws ──────────────────────────────────────────────────
// Private mode, a blocked origin, a full disk. The annotation feature has to keep working for as long as the page is
// open — that is what it did before persistence existed.
{
  const persistence = createAnnotationPersistence({ storage: makeStorage({ throws: true }) })
  let threw = null
  let saved = null
  let loaded = null
  try {
    saved = persistence.save(SESSION, [annotation()])
    loaded = persistence.load(SESSION)
  } catch (error) {
    threw = error
  }
  check('a throwing storage does not propagate out of save', threw === null, String(threw))
  check('a throwing storage reports the save failed', saved === false, String(saved))
  check('a throwing storage reads as empty', Array.isArray(loaded) && loaded.length === 0, JSON.stringify(loaded))
}

// ── No storage at all ──────────────────────────────────────────────────────
{
  const persistence = createAnnotationPersistence({ storage: undefined })
  check('without a storage the adapter is inert, not broken',
    persistence.load(SESSION).length === 0 && persistence.save(SESSION, [annotation()]) === false,
    'an absent storage was not handled')
}

// ── The store can install a restored list ──────────────────────────────────
{
  const store = createAnnotationStore({ maxAnnotations: 12 })
  const installed = store.restore(SESSION, [annotation({ id: 'qc-900-7', number: 5 })])
  check('the store installs a restored list', installed === 1, String(installed))
  check('the restored annotation keeps its id',
    store.snapshot(SESSION)[0]?.id === 'qc-900-7', JSON.stringify(store.snapshot(SESSION)[0]?.id))
  check('the restored list is renumbered from one',
    store.snapshot(SESSION)[0]?.number === 1, String(store.snapshot(SESSION)[0]?.number))

  // The restored ids encode a sequence number. A later `add` that started from zero would mint an id already present.
  const next = store.add(SESSION, { kind: 'text', text: 't', previewText: 't', previewHtml: '', comment: '', anchor: { quote: 't' } })
  check('an annotation added after a restore gets a fresh id',
    next !== null && next.id !== 'qc-900-7', JSON.stringify(next?.id))

  const full = createAnnotationStore({ maxAnnotations: 2 })
  check('a restored list is capped by the limit',
    full.restore(SESSION, [annotation({ id: 'a' }), annotation({ id: 'b' }), annotation({ id: 'c' })]) === 2,
    String(full.snapshot(SESSION).length))
  check('restoring nothing is a no-op',
    full.restore(SESSION, []) === 0, String(full.restore(SESSION, [])))
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
