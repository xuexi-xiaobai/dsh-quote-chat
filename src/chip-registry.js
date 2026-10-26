/**
 * The chip payload registry: what each chip in the draft actually stands for.
 *
 * A chip is a token. The composer only carries one placeholder character plus a reference id;
 * the passage, the comment and the label live here, keyed by that id. The Host pulls them out
 * at two moments — `codec.serialize` when the draft is submitted, and `openReference` when the
 * chip is clicked — and both receive only the ref string, so the lookup has to be synchronous
 * and local.
 *
 * ## Lifecycle: entries are never removed
 *
 * This is deliberate and it is the existing behaviour. Deleting an annotation does not remove
 * its payload; a failed draft insertion does not roll back the payload it registered. Entries
 * live for the page's lifetime.
 *
 * That looks like a leak and it partly is one, but removing them would change behaviour in
 * ways that are easy to get wrong: a draft is not the only consumer, the user can remove a
 * chip from the draft and put it back, and an undo or a re-render can reintroduce a reference
 * whose payload would then be gone. Wiring cleanup to "the annotation was deleted" would tie
 * two registries together that currently have independent lifetimes. So this module offers no
 * delete and no clear — not because they are hard, but because nothing should be calling them.
 *
 * What this module does NOT do: build references, build draft snapshots, touch the Host's
 * input interface, or serialize. `chipReference` needs a label and a payload; the reference it
 * returns is the bridge's job (see `chip-bridge.js`). Serialization belongs to `chip-draft.js`.
 */

import { CHIP_SOURCE, CHIP_PLACEHOLDER } from './chip-draft.js'

/**
 * Create one payload registry.
 *
 * One per Host factory call, so two plugin instances never see each other's chips. Within a
 * single instance the registry is shared across sessions, which is correct: a chip's ref is an
 * annotation id, and ids are unique per instance regardless of session.
 *
 * @returns the registry's operations.
 */
export function createChipRegistry() {
  /** Payloads by chip id. Private: callers go through the operations below. */
  const payloads = new Map()

  return {
    /**
     * Record what one chip stands for, and return the reference that places it in a draft.
     *
     * Registering here is what makes the chip resolvable later, so this must happen before the
     * draft is written — the Host can serialize as soon as the chip exists.
     *
     * @param annotation - the annotation being placed.
     * @param label - the inline label the chip shows.
     * @returns the reference record, without its offset (the bridge fills that in).
     */
    register(annotation, label) {
      payloads.set(annotation.id, {
        kind: annotation.kind,
        number: annotation.number,
        text: annotation.text,
        comment: annotation.comment,
        label,
      })
      return {
        source: CHIP_SOURCE,
        ref: annotation.id,
        offset: 0,
        // The placeholder's length in UTF-16 units; the composer counts in those.
        length: CHIP_PLACEHOLDER.length,
        label,
        clipboardText: CHIP_PLACEHOLDER,
      }
    },

    /**
     * The payload for one chip, or undefined.
     *
     * Returns the stored object itself rather than a copy: `serialize` runs inside the submit
     * attempt and the reference system compares nothing here, so copying on every read would
     * cost without buying isolation the callers need.
     *
     * @param ref - the chip id.
     * @returns the payload, or undefined when this instance never minted it.
     */
    get(ref) {
      return payloads.get(ref)
    },

    /**
     * Replace one chip's comment.
     *
     * The comment is the only part that changes after placement: the passage is fixed by the
     * selection and the ordinal is a position. When the chip was never registered this is a
     * no-op rather than an error — the caller may be updating an annotation whose chip the user
     * already removed from the draft, and that must not fail the edit.
     *
     * @param ref - the chip id.
     * @param comment - the new comment text; anything non-string becomes empty.
     * @returns true when a payload was updated.
     */
    updateComment(ref, comment) {
      const payload = payloads.get(ref)
      if (payload === undefined) return false
      payloads.set(ref, {
        ...payload,
        comment: typeof comment === 'string' ? comment.trim() : '',
      })
      return true
    },

    /**
     * Whether this instance minted the given chip.
     *
     * Exposed instead of the map so a caller can distinguish "unknown chip" from "payload with
     * empty fields" without reaching into storage.
     *
     * @param ref - the chip id.
     * @returns true when a payload exists.
     */
    has(ref) {
      return payloads.has(ref)
    },
  }
}
