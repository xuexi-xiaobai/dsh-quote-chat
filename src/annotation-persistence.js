/**
 * Keeping annotations across a page reload.
 *
 * The Host persists the composer draft — text plus `references` — so a reload does not lose the chips. The plugin's
 * side did not persist at all, and the two are useless apart: a restored chip can only be serialized by its owner, so
 * every restored chip came back dead, blocked the whole send, and had to be removed again.
 *
 * ## What is stored, and why nothing else
 *
 * Only the annotations. The chip payloads are NOT stored separately: `chipRegistry.register` derives a payload from
 * an annotation (kind, number, text, comment, label), so re-registering the restored annotations rebuilds exactly
 * what a fresh page needs. Storing both would be two copies of one truth, free to disagree after any change to the
 * payload's shape.
 *
 * ## Storage is a cache, never a source of truth
 *
 * Every read is validated: a truncated write, an older version, or a hand-edited entry yields "no annotations" rather
 * than a half-populated dock. A wrong list is worse than an empty one — an annotation whose anchor is missing would
 * crash the marker layer, and a list with duplicate ids would break the ordinal pairing.
 *
 * Writes are best effort. A full disk, a private-mode window, or a storage that throws must not take the annotation
 * feature down with them: the page keeps working for as long as it is open, which is what it did before.
 *
 * What this module does NOT do: decide when to save, know which session is open, or touch the chip registry.
 */

/**
 * Versioned key prefix.
 *
 * The version is part of the key, not a field inside the value: a future format change then simply does not read the
 * old entries, instead of needing to detect and migrate them on every load.
 */
export const STORAGE_PREFIX = 'dsh-quote-chat:v1:annotations:'

/**
 * The storage key for one session.
 * @param sessionId - the session key.
 * @returns the key.
 */
export function storageKey(sessionId) {
  return `${STORAGE_PREFIX}${sessionId}`
}

/**
 * Whether one stored entry has every field the dock, the marker layer and the codec read.
 *
 * Checked field by field rather than by a schema library: there are four fields, and a missing `anchor` is the one that
 * would crash furthest from here.
 *
 * @param value - a decoded entry.
 * @returns true when the entry can be used as an annotation.
 */
function isAnnotation(value) {
  if (typeof value !== 'object' || value === null) return false
  if (typeof value.id !== 'string' || value.id === '') return false
  if (typeof value.kind !== 'string') return false
  if (typeof value.text !== 'string') return false
  if (typeof value.number !== 'number' || !Number.isFinite(value.number)) return false
  if (typeof value.anchor !== 'object' || value.anchor === null) return false
  if (typeof value.anchor.quote !== 'string') return false
  return true
}

/**
 * Create the annotation persistence adapter.
 *
 * @param options - `{ storage, key }`. `storage` defaults to `localStorage`; passing `undefined` explicitly turns
 *   persistence off, which is what a host without web storage gets.
 * @returns `{ load, save }`.
 */
export function createAnnotationPersistence({ storage = globalThis.localStorage, max = 12 } = {}) {
  /**
   * Read one session's annotations.
   *
   * Anything that is not a well-formed list of well-formed entries is treated as "nothing stored" — see the module
   * note. A single bad entry does not discard its neighbours: it is dropped and the rest are kept.
   *
   * @param sessionId - the session key.
   * @returns the annotations, newest numbering recomputed by the store; empty when nothing usable is stored.
   */
  function load(sessionId) {
    if (storage === undefined || storage === null || sessionId === undefined) return []
    let raw = null
    try {
      raw = storage.getItem(storageKey(sessionId))
    } catch (failure) {
      // A storage that throws on read is a storage this page cannot use; there is nothing to recover.
      return []
    }
    if (typeof raw !== 'string' || raw === '') return []
    let parsed = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
    const list = Array.isArray(parsed) ? parsed : parsed?.annotations
    if (!Array.isArray(list)) return []
    const seen = new Set()
    const kept = []
    for (const entry of list) {
      if (!isAnnotation(entry)) continue
      // Duplicate ids would make the ordinal pairing and the payload registry disagree about which chip is which.
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      kept.push(entry)
      if (kept.length >= max) break
    }
    return kept
  }

  /**
   * Write one session's annotations.
   *
   * @param sessionId - the session key.
   * @param annotations - the list to store; an empty list removes the entry.
   * @returns whether the write was accepted by storage.
   */
  function save(sessionId, annotations) {
    if (storage === undefined || storage === null || sessionId === undefined) return false
    try {
      if (!Array.isArray(annotations) || annotations.length === 0) {
        storage.removeItem(storageKey(sessionId))
        return true
      }
      // Plain JSON of the entries, no wrapper: an array is the smallest thing that can be written, and `load` accepts
      // it. A wrapper object would only add a place for the two sides to disagree.
      storage.setItem(storageKey(sessionId), JSON.stringify(annotations.slice(0, max)))
      return true
    } catch (failure) {
      console.error('[dsh-quote-chat] annotations could not be saved:', failure)
      return false
    }
  }

  return { load, save }
}
