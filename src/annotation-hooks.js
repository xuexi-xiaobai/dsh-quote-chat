/**
 * React bindings over the plain annotation store.
 *
 * The store in `annotation-store.js` deliberately knows nothing about React: it exposes
 * `snapshot(sessionId)` and `subscribe(sessionId, listener)`, which is exactly the shape
 * `useSyncExternalStore` wants, but assembled here so the store stays testable without a renderer.
 *
 * ## Why this is a separate module rather than three pass-through functions in the entry
 *
 * The entry used to declare `addAnnotation`, `removeAnnotation` and `updateAnnotation`, each of the
 * form `(a, b) => store.some(a, b)` — same name, same arity, same argument order as the store's own
 * methods. They carried no logic and no default, so they were pure indirection: a reader had to
 * open two files to learn that `addAnnotation` is `add`.
 *
 * Only this hook does something the store cannot: it memoises the two callbacks per session, which
 * `useSyncExternalStore` requires — a fresh `subscribe` identity on every render would resubscribe
 * every time, and a fresh `snapshot` would loop.
 */
import React from 'react'

/**
 * Subscribe a component to one session's annotations.
 *
 * @param store - the annotation store instance.
 * @param sessionId - the session key (may be undefined, for the "no session" bucket).
 * @returns the current annotation list.
 */
export function makeUseAnnotations(store) {
  /**
   * @param sessionId - the session key (may be undefined).
   * @returns the current list.
   */
  return function useAnnotations(sessionId) {
    // Memoised per session: useSyncExternalStore compares these by identity, so a new function on
    // every render would resubscribe (or, for the snapshot, re-render forever).
    const subscribe = React.useCallback(
      (listener) => store.subscribe(sessionId, listener),
      [sessionId],
    )
    const snapshot = React.useCallback(
      () => store.snapshot(sessionId),
      [sessionId],
    )
    return React.useSyncExternalStore(subscribe, snapshot, snapshot)
  }
}
