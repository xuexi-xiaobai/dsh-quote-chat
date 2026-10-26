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
 * ## Why these four live together
 *
 * They all answer "how is a chip represented in the draft?" — the label it shows, the block it
 * becomes, the snapshot that adds it, the snapshot that removes it. None of them needs React,
 * a DOM, or a mutable registry, so all four are directly testable.
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
 * Rebuild the whole draft with one more chip appended.
 *
 * A chip's `offset` is measured in the final draft text, so every insertion rebuilds the text
 * and re-computes the existing references from the same string the composer will parse.
 *
 * No separator is inserted beyond a single break: an empty draft becomes just the chip, and a
 * draft the user already ended with a newline keeps that newline as the only break. Adding
 * `\n\n` here used to leave a blank paragraph above the first chip, which is where the stray
 * empty line in the composer came from.
 *
 * @param draft - current draft text.
 * @param existing - references already in that draft.
 * @param addition - the placeholder text (and trailing comment) to append.
 * @param reference - the new reference without its offset filled in.
 * @returns the complete snapshot for the Host's `setDraft`.
 */
export function withAppendedChip(draft, existing, addition, reference) {
  const base = draft === '' || draft.endsWith('\n') ? draft : `${draft}\n`
  return {
    text: `${base}${addition}`,
    references: [...existing, { ...reference, offset: base.length }],
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
  const index = references.findIndex((item) => item.source === source && item.ref === ref)
  if (index < 0) return null
  const target = references[index]
  let start = target.offset
  let stop = target.offset + target.length
  // When the chip occupies a line by itself, removing it would leave that line empty.
  // "Occupies a line" means it is bounded by a break or the draft edge on both sides; exactly
  // one break then goes with it, preferring the one before when both exist.
  const brokenBefore = start > 0 && draft[start - 1] === '\n'
  const brokenAfter = stop < draft.length && draft[stop] === '\n'
  const ownsLine = (start === 0 || brokenBefore) && (stop === draft.length || brokenAfter)
  if (ownsLine) {
    if (brokenBefore) start -= 1
    else if (brokenAfter) stop += 1
  }
  const removed = draft.slice(start, stop)
  const nextText = `${draft.slice(0, start)}${draft.slice(stop)}`
  // Everything after the cut moves left by the removed length.
  const shift = removed.length
  const kept = references
    .filter((_, position) => position !== index)
    .map((item) => (item.offset >= stop ? { ...item, offset: item.offset - shift } : item))
  return { text: nextText, references: kept }
}
