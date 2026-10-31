/**
 * The annotation collection: per-session lists, mutations, snapshots and subscriptions.
 *
 * One question, one module: "what annotations exist in this session, and who needs to hear
 * when that changes?" Everything the UI does with annotations — the gutter bubbles, the dock
 * cards, the comment panel — reads from here and writes through here.
 *
 * ## Instances
 *
 * `createAnnotationStore()` returns an independent store. The caller decides the scope: the
 * plugin creates exactly ONE per Host factory call, so two plugin instances never share
 * annotations, while a single instance fans one plugin's components out across sessions by
 * `sessionId`. Creating a store per component mount would be wrong — the dock and the gutter
 * must see the same list.
 *
 * ## Privacy
 *
 * The session map, the listener sets and the publication path are private. Callers get a
 * handful of named operations, which is what makes the storage strategy replaceable later
 * without touching a component. Nothing here should ever hand out the internal map.
 *
 * ## Snapshots
 *
 * `snapshot(sessionId)` returns the SAME array reference until something changes, because
 * `useSyncExternalStore` compares by identity and would re-render forever if every read
 * produced a fresh array. Sessions that never annotated share one frozen empty array.
 *
 * What this module does NOT do: React, rendering, persistence, or reclamation. Nothing is
 * written to storage and nothing is evicted — annotations live for the page's lifetime, as
 * they always have. `useAnnotations` in the React layer adapts this store to a hook; the store
 * itself stays usable without React, which is what makes it testable directly.
 */

/**
 * Create one annotation store.
 *
 * `maxAnnotations` is required. The limit is a product rule, not a storage detail, so it has
 * exactly one declaration — in the plugin's entry module — and is passed in here. Defaulting
 * it would create a second source of truth that could drift silently.
 *
 * @param options - `{ maxAnnotations }`, a positive integer.
 * @returns the store's public operations.
 */
export function createAnnotationStore({ maxAnnotations } = {}) {
  if (!Number.isInteger(maxAnnotations) || maxAnnotations <= 0) {
    throw new Error('dsh-quote-chat: createAnnotationStore requires a positive maxAnnotations')
  }

  /** Per-session state. Private: never returned, never iterated by callers. */
  const sessions = new Map()

  /** Shared empty snapshot, so an unannotated session never allocates. */
  const EMPTY = Object.freeze([])

  /**
   * The mutable record for one session, created on demand.
   * @param sessionId - the session key.
   * @returns the record.
   */
  function stateFor(sessionId) {
    let state = sessions.get(sessionId)
    if (state === undefined) {
      state = { list: EMPTY, listeners: new Set(), seq: 0 }
      sessions.set(sessionId, state)
    }
    return state
  }

  /**
   * Replace a session's list and notify its readers.
   * @param state - the session record being written.
   * @param list - the replacement list.
   */
  function publish(state, list) {
    state.list = list
    // Copy first: a listener may unsubscribe during notification, and mutating the set
    // mid-iteration would skip entries.
    for (const listener of [...state.listeners]) listener()
  }

  /**
   * Renumber a list so visible numbers are always 1, 2, 3 … in order.
   *
   * The number is a position, not an identity. A monotonic counter produced 1, 2, 3 → delete
   * the second → 4, and a session that already had annotations pushed its first new one past
   * 1. Renumbering on every mutation keeps each session's numbering starting at 1.
   *
   * Items whose number is already correct are returned unchanged, so identity is preserved
   * where nothing moved.
   *
   * @param list - annotations in insertion order.
   * @returns annotations with fresh `number` values.
   */
  function renumber(list) {
    return list.map((item, index) => (item.number === index + 1
      ? item
      : { ...item, number: index + 1 }))
  }

  return {
    /**
     * The current list for one session.
     *
     * Identity-stable: the previous array is returned until a mutation replaces it.
     *
     * @param sessionId - the session key (may be undefined).
     * @returns the list, or a shared frozen empty array.
     */
    snapshot(sessionId) {
      if (sessionId === undefined) return EMPTY
      return sessions.get(sessionId)?.list ?? EMPTY
    },

    /**
     * Subscribe to one session's changes.
     *
     * Subscribing before any annotation exists is supported and is not the same as
     * subscribing to a non-existent session: the session is materialized on subscribe, so a
     * later add still notifies.
     *
     * @param sessionId - the session key (may be undefined).
     * @param listener - called after each mutation of that session.
     * @returns an unsubscribe function.
     */
    subscribe(sessionId, listener) {
      if (sessionId === undefined) return () => {}
      const state = stateFor(sessionId)
      state.listeners.add(listener)
      return () => { state.listeners.delete(listener) }
    },

    /**
     * Add one annotation.
     * @param sessionId - the session key.
     * @param draft - the annotation draft, without id or number.
     * @returns the stored annotation, or null when the session's list is full.
     */
    add(sessionId, draft) {
      const state = stateFor(sessionId)
      if (state.list.length >= maxAnnotations) return null
      state.seq += 1
      const annotation = {
        ...draft,
        id: `qc-${Date.now()}-${state.seq}`,
        number: state.list.length + 1,
      }
      publish(state, renumber([...state.list, annotation]))
      return annotation
    },

    /**
     * Remove one annotation.
     *
     * Ids are never reused, so remaining annotations keep their identity even though their
     * displayed numbers shift.
     *
     * @param sessionId - the session key.
     * @param id - the annotation id.
     */
    remove(sessionId, id) {
      const state = stateFor(sessionId)
      publish(state, renumber(state.list.filter((item) => item.id !== id)))
    },

    /**
     * Change one annotation's comment, keeping everything else.
     *
     * The comment is the only editable part: the passage it points at is fixed by the
     * selection and the ordinal is a position. Editing replaces rather than re-adds, so the
     * chip, its id and its place in the draft all survive.
     *
     * @param sessionId - the session key.
     * @param id - the annotation id.
     * @param comment - the new comment text; anything non-string becomes an empty comment.
     * @returns the updated annotation, or null when it is gone.
     */
    update(sessionId, id, comment) {
      const state = stateFor(sessionId)
      let updated = null
      publish(state, state.list.map((item) => {
        if (item.id !== id) return item
        updated = { ...item, comment: typeof comment === 'string' ? comment.trim() : '' }
        return updated
      }))
      return updated
    },

    /**
     * Look up one annotation.
     *
     * Implemented against the private record rather than through `snapshot`, so the method
     * keeps working when destructured off the store object.
     *
     * @param sessionId - the session key.
     * @param id - the annotation id.
     * @returns the annotation, or null.
     */
    find(sessionId, id) {
      if (sessionId === undefined) return null
      const state = sessions.get(sessionId)
      if (state === undefined) return null
      return state.list.find((item) => item.id === id) ?? null
    },

    /**
     * Install a list that came from storage.
     *
     * Distinct from `add` because it must not mint ids or re-run the limit: the entries already carry their ids, and
     * the numbers they were saved with are recomputed here so a session that lost an entry to a bad write still shows
     * 1, 2, 3 rather than a gap.
     *
     * Nothing is validated here — the persistence layer does that, and it is the only caller. Callers that did not
     * validate would be able to publish an annotation with no anchor, which the marker layer reads without a guard.
     *
     * @param sessionId - the session key.
     * @param list - annotations read from storage.
     * @returns how many were installed.
     */
    restore(sessionId, list) {
      if (sessionId === undefined || !Array.isArray(list) || list.length === 0) return 0
      const state = stateFor(sessionId)
      const capped = list.slice(0, maxAnnotations)
      // Keep `seq` ahead of the restored ids, or the next `add` could mint an id that is already in the list.
      for (const item of capped) {
        const tail = /-(\d+)$/.exec(item.id)
        if (tail !== null) state.seq = Math.max(state.seq, Number(tail[1]))
      }
      publish(state, renumber(capped))
      return capped.length
    },

    /**
     * Remove every annotation of one session.
     *
     * Notifies only when the list was non-empty, so a clear on an empty session does not wake
     * subscribers for nothing.
     *
     * @param sessionId - the session key.
     */
    clear(sessionId) {
      const state = stateFor(sessionId)
      if (state.list.length > 0) publish(state, EMPTY)
    },
  }
}
