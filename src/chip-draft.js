/**
 * The draft's chip plumbing — the pure half.
 *
 * Two things happen to an annotation once it is placed in the composer:
 *
 *   1. **It becomes a token.** The draft carries one placeholder character per chip; the
 *      passage and comment live in the payload registry, keyed by the chip's id. This module
 *      owns the arithmetic that keeps that token and its reference offsets consistent as the
 *      draft grows and shrinks.
 *   2. **It is unfolded at submit time.** `serializeChipForModel` turns a payload into the
 *      text the model reads. That shape is a wire format: changing a newline changes every
 *      submitted message, which is why the suite pins it byte for byte.
 *
 * ## Why these five live together
 *
 * They all answer "how is a chip represented in the draft?" — the label it shows, the block it
 * becomes, the snapshots that add it (at the end, or back where it came from), the place a
 * removal cuts, the snapshot that removes it. None of them needs React, a DOM, or a mutable
 * registry, so all five are directly testable.
 *
 * What this module does NOT do: mint ids, write the payload registry, call the Host's
 * `setDraft`, or decide when a chip should jump. Those are effects with their own lifecycle
 * and they stay with the code that owns that lifecycle.
 */

/**
 * The source name this plugin registers its chips under.
 *
 * The Host's reference system identifies a chip by (source, ref). This string is that source,
 * so it is part of the wire contract: changing it orphans every chip already in a draft.
 */
export const CHIP_SOURCE = 'quote-chat'

/** The trigger this source registers under; `@` and `/` belong to the host. */
export const CHIP_TRIGGER = '#'

/** One character standing in for the chip in the draft text. */
export const CHIP_PLACEHOLDER = '\uFFFC'

/**
 * The text one chip contributes to the message the model receives.
 *
 * The block is fenced with newlines because a chip can sit mid-sentence: the expansion is
 * spliced into the draft text, so without the fence the passage would run straight into the
 * words around it ("…如下和这里"), and the model could not tell the user's prose from the
 * quoted passage. The leading and trailing breaks collapse harmlessly when the chip is at
 * either end because the assembled message is trimmed.
 *
 * @param payload - the recorded annotation content.
 * @returns the model-facing text.
 */
export function serializeChipForModel(payload) {
  const head = `[${payload.label}]`
  const note = payload.comment === '' ? '' : `\n${payload.comment}`
  return `\n${head}${note}\n${payload.text}\n`
}

/**
 * The label a chip shows in the composer: `注释 1`, `注释 2`, …
 *
 * This is a named block, not a preview of the passage: the passage itself lives in the hover
 * card, and the model receives it through the codec. An earlier revision put the truncated
 * passage here after reading a screenshot too literally; the numbered block is what was asked
 * for.
 *
 * @param annotation - the annotation being placed.
 * @param labels - the active locale's card labels.
 * @returns the inline label.
 */
export function chipLabel(annotation, labels) {
  return labels.content.replace('{n}', String(annotation.number))
}

/**
 * Which chip this is, counting from one in reading order.
 *
 * The number a chip shows is a POSITION: the third chip in the draft is "注释 3" no matter when it was created. The
 * annotation store also carries a `number`, but that is a different thing — it is the annotation's index in the STORE,
 * and it stops matching the draft as soon as a chip is deleted or restored in the middle. Both numbers agreed only
 * while chips could only be appended and removed from the end.
 *
 * ## Why the Host's array order is trusted here
 *
 * The order is NOT re-sorted by `offset`, even though that is what reading order means. `pairs()` in `cards.js` and
 * `chipOrdinals()` in `markers.js` both zip the DOM's chips — always in document order — against this same array by
 * index, and that is where the number on the screen comes from. Deriving a different order here would make the model's
 * number disagree with the screen's in exactly the case this function exists to fix. If the Host's order ever turns
 * out to be unreliable, all three have to change together.
 *
 * @param occurrences - the Host's current chip list, in the Host's order.
 * @param source - the chip source this plugin owns; other sources are not counted.
 * @param ref - the chip id.
 * @returns the 1-based position, or null when the chip is not in the draft.
 */
export function chipOrdinal(occurrences, source, ref) {
  const mine = (Array.isArray(occurrences) ? occurrences : []).filter((item) => item.source === source)
  const index = mine.findIndex((item) => item.ref === ref)
  return index < 0 ? null : index + 1
}

/**
 * Which chips in the draft have no payload behind them.
 *
 * The Host persists the composer draft; the payload registry does not — it is built when the plugin loads. After a
 * reload the chip is still drawn (the Host restores its own label), but nothing can serialize it, and the Host treats
 * an unresolvable reference as a hard error: it refuses the whole send and puts the draft back.
 *
 * Such a chip cannot be repaired. The passage it stood for is gone with the page, so the only useful thing to do with
 * it is to take it out of the draft — and that has to be decided from the same list the removal will edit.
 *
 * @param occurrences - the Host's live chip list.
 * @param has - whether this page load still holds a payload for a ref.
 * @param source - the chip source this plugin owns; other sources are not ours to judge.
 * @returns the refs of chips with no payload, in list order.
 */
export function staleChipRefs(occurrences, has, source) {
  return (Array.isArray(occurrences) ? occurrences : [])
    .filter((item) => item.source === source && !has(item.ref))
    .map((item) => item.ref)
}

/**
 * Which annotations no longer have a chip in the draft.
 *
 * An annotation is supposed to live as long as its chip. Two paths break that promise and neither one tells the
 * plugin: the Host clears the draft after a send, and Backspace removes a chip without calling back. The store keeps
 * those entries — `markers.js` says so in a comment — and they are invisible: no chip means no marker bubble and no
 * hover card, so there is nothing on screen to delete them from.
 *
 * That mattered because the annotation limit counted the STORE, not the draft: a session that had sent a dozen
 * annotations could not add another, the notice only restated the limit, and the only way out was a page reload.
 *
 * Returning ids rather than entries keeps the decision here and the removal in the caller, which owns the store.
 *
 * @param annotations - the session's stored annotations.
 * @param occurrences - the Host's live chip list.
 * @param source - the chip source this plugin owns; other sources are not chips of ours.
 * @returns the ids of annotations with no chip, in list order.
 */
export function orphanedIds(annotations, occurrences, source) {
  const live = new Set(
    (Array.isArray(occurrences) ? occurrences : [])
      .filter((item) => item.source === source)
      .map((item) => item.ref),
  )
  return (Array.isArray(annotations) ? annotations : [])
    .filter((item) => !live.has(item.id))
    .map((item) => item.id)
}

/**
 * Rebuild the whole draft with one more chip appended.
 *
 * A chip's `offset` is measured in the final draft text, so every insertion rebuilds the text
 * and re-computes the existing references from the same string the composer will parse.
 *
 * ## One line, unless the user made a new one
 *
 * An earlier revision always inserted a line break first, so every chip after the first landed on
 * its own line. Two things were wrong with that:
 *
 *   - the user could not put two chips on one line at all, and
 *   - the editor renders a new paragraph with a leading space, so each extra chip also arrived
 *     preceded by a stray space (measured: chips at x 456 and x 464, and the draft read
 *     "@注释 1  @注释 2" with two spaces).
 *
 * Chips are now appended WITH NO SEPARATOR. They sit next to each other in the same line, and a
 * newline is only ever present because the user typed one. The 6px margins the stylesheet gives
 * the chip provide the visual gap, which is the right place for it: a space in the draft would
 * become part of the message the model reads and would have to be stripped again at submit time.
 *
 * @param draft - current draft text.
 * @param existing - references already in that draft.
 * @param addition - the placeholder text (and trailing comment) to append.
 * @param reference - the new reference without its offset filled in.
 * @returns the complete snapshot for the Host's `setDraft`.
 */
export function withAppendedChip(draft, existing, addition, reference) {
  // A draft the user ended with a newline is respected as-is: the chip starts that new line, which is what they asked
  // for by pressing Enter. Anything else is appended in place.
  const base = draft
  return {
    text: `${base}${addition}`,
    references: [...existing, { ...reference, offset: base.length }],
  }
}

/**
 * Rebuild the whole draft with one chip inserted at a chosen point.
 *
 * This is `withAppendedChip`'s counterpart and it exists because undo has to put a chip back where it came from: the
 * only insertion the plugin had was the append above, so undoing the removal of a chip in the middle of a draft
 * dropped that chip at the end of the draft instead. The passage and the comment went with it, which made undo look
 * like it had shuffled the draft rather than restored it.
 *
 * ## The reference list stays ordered by offset
 *
 * The Host may hand references back in any order, but `pairs()` in `cards.js` zips the DOM's chips — always in
 * document order — against `occurrences` **by array position**, and derives the ordinal from that pairing. Appending
 * the new reference to the end of the array (the obvious thing, and safe for `withAppendedChip` because that one
 * appends to the text too) would number a chip restored to the front as the last chip in the draft. So the new
 * reference is spliced in at the point that keeps the list ordered.
 *
 * @param draft - current draft text.
 * @param existing - references already in that draft.
 * @param addition - the text to insert; its LAST `reference.length` units are the chip's placeholder.
 * @param reference - the new reference without its offset filled in.
 * @param at - where to insert, in the current draft's coordinates.
 * @returns the complete snapshot for the Host's `setDraft`.
 */
export function withChipAt(draft, existing, addition, reference, at) {
  // The offset a caller holds was measured in a draft that may have been typed in since. Clamping keeps a stale index
  // from writing a snapshot the composer cannot parse; it cannot recover the exact spot, and nothing here pretends to.
  const point = Math.max(0, Math.min(Number.isFinite(at) ? at : draft.length, draft.length))
  const shift = addition.length
  const moved = existing.map((item) => (
    item.offset >= point ? { ...item, offset: item.offset + shift } : item
  ))
  const placed = { ...reference, offset: point + shift - reference.length }
  // Everything that was at or after `point` has just moved past the new chip, so the first reference with a greater
  // offset is exactly where this one belongs.
  const index = moved.findIndex((item) => item.offset > placed.offset)
  const references = [...moved]
  references.splice(index < 0 ? references.length : index, 0, placed)
  return {
    text: `${draft.slice(0, point)}${addition}${draft.slice(point)}`,
    references,
  }
}

/**
 * Where removing one chip would cut the draft, and what that cut takes with it.
 *
 * Split out of `withoutChip` so the undo record is built from the SAME arithmetic that performs the removal. A caller
 * that re-derived the cut would drift from it the first time either side changed.
 *
 * The cut is not always the placeholder alone. A chip standing by itself on its line takes the break before it as
 * well, or the removal would leave an empty paragraph behind — so `lead` reports that break, and putting the chip
 * back without it lands the chip at the end of the line above.
 *
 * @param draft - current draft text.
 * @param references - the references in that draft.
 * @param source - the chip source this plugin owns; other sources are never touched.
 * @param ref - the annotation id the chip carries.
 * @returns `{ index, start, stop, removed, lead }`, or null when the chip is no longer in the draft.
 */
export function chipRemovalSite(draft, references, source, ref) {
  const index = references.findIndex((item) => item.source === source && item.ref === ref)
  if (index < 0) return null
  const target = references[index]
  let start = target.offset
  const stop = target.offset + target.length
  // When the chip occupies a line by itself, removing it would leave that line empty.
  // "Occupies a line" means it is bounded by a break or the draft edge on both sides; exactly
  // one break then goes with it, preferring the one before when both exist.
  const brokenBefore = start > 0 && draft[start - 1] === '\n'
  const brokenAfter = stop < draft.length && draft[stop] === '\n'
  // Only a chip that sits ALONE between two breaks owns its line.
  //
  // The earlier rule also accepted "at the start or end of the draft", which was right when every chip was appended on
  // its own line but is wrong now that chips share a line: removing the first of two chips on one line would have taken
  // the line break of the text above it with it, pulling that text down onto the chip's line.
  const ownsLine = brokenBefore && brokenAfter
  if (ownsLine) start -= 1
  return {
    index,
    // Where the cut begins — and, once it is made, where the seam is. A chip put back goes here.
    start,
    stop,
    removed: draft.slice(start, stop),
    // The break the cut took, if any. A chip put back has to bring it along.
    lead: ownsLine ? '\n' : '',
  }
}

/**
 * Remove one chip occurrence from a draft and reference list.
 *
 * Only the chip and its placeholder go: the comment lives inside the chip's payload rather
 * than as loose prose after it, so there is no trailing text to sweep up. One adjacent line
 * break is removed as well when it would otherwise leave an empty paragraph, and every later
 * reference shifts left by exactly what was removed.
 *
 * Offsets are UTF-16 indices into the draft string — the unit the composer reports. An emoji
 * therefore counts as two, which the suite pins.
 *
 * @param draft - current draft text.
 * @param references - the references in that draft.
 * @param source - the chip source this plugin owns; other sources are never touched.
 * @param ref - the annotation id the chip carries.
 * @returns the snapshot with the chip gone, or null when the chip is no longer in the draft.
 */
export function withoutChip(draft, references, source, ref) {
  const site = chipRemovalSite(draft, references, source, ref)
  if (site === null) return null
  const nextText = `${draft.slice(0, site.start)}${draft.slice(site.stop)}`
  // Everything after the cut moves left by the removed length.
  const shift = site.removed.length
  const kept = references
    .filter((_, position) => position !== site.index)
    .map((item) => (item.offset >= site.stop ? { ...item, offset: item.offset - shift } : item))
  return { text: nextText, references: kept }
}
