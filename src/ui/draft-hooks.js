/**
 * Reading the composer draft through the slot's standard `useInput` seat.
 *
 * These are hooks in the React sense — they take `useInput` and return a subscription — but they
 * carry no state and no instance dependency. Both the annotation dock and the side chat read the
 * draft this way, and both must read it identically or their chips disagree about numbering.
 */

import React from 'react'

/**
 * Read the live composer draft through the standard `useInput` seat.
 * @param useInput - the slot's standard `useInput` prop, when present.
 * @param fallback - value reported when the seat is missing.
 * @returns the current draft text.
 */
export function useDraft(useInput, fallback = '') {
  const inert = (selector) => selector({ draft: fallback })
  return (typeof useInput === 'function' ? useInput : inert)(
    (state) => state.draft,
    (left, right) => left === right,
  )
}

/**
 * Read the draft's reference occurrences (the inline chips) through the same
 * seat.
 *
 * `InputState.occurrences` is the editor's own projection of the chips in
 * the draft, in clipboard order. It is what lets a removal cut exactly the
 * right span instead of re-deriving one from text offsets the user may have
 * edited around.
 * @param useInput - the slot's standard `useInput` prop, when present.
 * @returns the occurrence list, empty when unavailable.
 */
export function useDraftOccurrences(useInput) {
  const empty = React.useMemo(() => [], [])
  const inert = () => empty
  const picked = (typeof useInput === 'function' ? useInput : inert)(
    (state) => state.occurrences,
    (left, right) => left === right,
  )
  return Array.isArray(picked) ? picked : empty
}
