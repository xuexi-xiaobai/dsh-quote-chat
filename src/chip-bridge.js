/**
 * The draft bridge: where a chip meets the Host's composer.
 *
 * Two operations, both of which touch the Host's input interface:
 *
 *   - **place**: register the payload, then rewrite the draft with one more chip appended.
 *   - **release**: rewrite the draft with one chip removed, leaving the payload alone.
 *
 * `placeAt` is `place` for a chip going back where it came from: same ordering and the same
 * failure behaviour, different point of insertion.
 *
 * Everything else about a chip — its label, its serialized form, its payload — is decided
 * elsewhere. This module exists so the *ordering* of the side effects is written down in one
 * place instead of being implied by the shape of two callbacks in a component.
 *
 * ## Ordering and failure, both deliberate
 *
 * `place` registers BEFORE it writes. If `setDraft` throws, the payload stays registered: the
 * draft may or may not have accepted the chip, and a payload with no chip is harmless while a
 * chip with no payload is unrenderable and unserializable. This module therefore reports
 * failure without rolling anything back.
 *
 * `release` does not catch. A throwing `setDraft` propagates to the caller, which aborts its
 * own follow-up work — that is the existing behaviour and it is what keeps the annotation store
 * and the draft from silently diverging.
 *
 * What this module does NOT do: render, decide what to show when placement fails, pick
 * highlight ranges, or remove annotations. It reports outcome and lets the caller act on it.
 */

import { CHIP_PLACEHOLDER, chipLabel, withAppendedChip, withChipAt, withoutChip } from './chip-draft.js'

/**
 * Create the draft bridge for one plugin instance.
 *
 * The registry and the chip source are fixed at construction: both are per-instance facts, and
 * passing them per call would invite a mismatch between the chip that was registered and the
 * source the reference claims.
 *
 * @param options - `{ registry, source }`.
 * @returns the bridge's operations.
 */
export function createDraftBridge({ registry, source }) {
  /**
   * Read the live draft and its occurrences through a getter.
   *
   * A getter rather than stored values: the composer's state changes on every keystroke, and a
   * bridge that captured the draft at construction would keep appending to the first render's
   * text. The caller owns when the read happens, which is what preserves the existing timing.
   *
   * @param read - returns `{ draft, occurrences }` for the current render.
   */
  function liveDraft(read) {
    const state = read()
    return {
      draft: typeof state?.draft === 'string' ? state.draft : '',
      occurrences: Array.isArray(state?.occurrences) ? state.occurrences : [],
    }
  }

  return {
    /**
     * Place one annotation in the draft as a chip.
     *
     * Registers the payload first, then asks the Host to accept the new draft. A failure to
     * write leaves the payload in place — see the module note.
     *
     * @param port - `{ setDraft }` from the Host's input actions; may be absent.
     * @param read - getter for `{ draft, occurrences }`.
     * @param annotation - the annotation to place.
     * @param labels - the active locale's card labels.
     * @returns true when the draft accepted the chip.
     */
    place(port, read, annotation, labels) {
      if (typeof port?.setDraft !== 'function') return false
      const { draft, occurrences } = liveDraft(read)
      try {
        const reference = registry.register(annotation, chipLabel(annotation, labels))
        port.setDraft(withAppendedChip(draft, occurrences, CHIP_PLACEHOLDER, reference))
        return true
      } catch (failure) {
        // Reported, not rethrown: the caller shows a notice and keeps the annotation, which is
        // what the existing UI does. The payload registered above is intentionally left behind.
        console.error('[dsh-quote-chat] chip insertion failed:', failure)
        return false
      }
    },

    /**
     * Place one annotation in the draft at a chosen point rather than at the end.
     *
     * This is `place` for a chip that is going back where it came from. The ordering rule is
     * the same one — register first, write second, report failure without rolling the payload
     * back — because it protects the same invariant: a payload with no chip is harmless, a chip
     * with no payload is unrenderable.
     *
     * @param port - `{ setDraft }` from the Host's input actions; may be absent.
     * @param read - getter for `{ draft, occurrences }`.
     * @param annotation - the annotation to place.
     * @param labels - the active locale's card labels.
     * @param site - `{ start, lead }` from `chipRemovalSite`: where the chip came out, and the
     *   line break the cut took with it. Without one the chip is appended, since a caller with
     *   no site has no place to restore to.
     * @returns true when the draft accepted the chip.
     */
    placeAt(port, read, annotation, labels, site) {
      if (typeof port?.setDraft !== 'function') return false
      const { draft, occurrences } = liveDraft(read)
      try {
        const reference = registry.register(annotation, chipLabel(annotation, labels))
        const addition = `${site?.lead ?? ''}${CHIP_PLACEHOLDER}`
        port.setDraft(withChipAt(draft, occurrences, addition, reference, site?.start ?? draft.length))
        return true
      } catch (failure) {
        console.error('[dsh-quote-chat] chip insertion failed:', failure)
        return false
      }
    },

    /**
     * Remove one annotation's chip from the draft.
     *
     * The payload is not touched and not deleted: the draft is not the only thing that can
     * reintroduce the reference, so removing its payload here would be premature.
     *
     * @param port - `{ setDraft }` from the Host's input actions; may be absent.
     * @param read - getter for `{ draft, occurrences }`.
     * @param ref - the annotation id the chip carries.
     * @returns true when a chip was found and the draft accepted the rewrite.
     */
    release(port, read, ref) {
      const { draft, occurrences } = liveDraft(read)
      const snapshot = withoutChip(draft, occurrences, source, ref)
      // No chip in the draft: the annotation can still be removed from the store, so this is
      // not a failure — it simply has nothing to write.
      if (snapshot === null) return false
      if (typeof port?.setDraft !== 'function') return false
      // Deliberately unguarded: a throwing setDraft must abort the caller's follow-up work.
      port.setDraft(snapshot)
      return true
    },
  }
}
