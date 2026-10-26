/**
 * Range highlights: painting a passage with the browser's highlight registry.
 *
 * `window.CSS.highlights` binds a painted decoration to a live `Range`. That is the whole reason
 * this is used instead of positioned divs: the browser re-projects the range onto the page on
 * every scroll and reflow, so the glow follows the text without anything being re-measured.
 *
 * Two kinds of highlight, sharing one registry name:
 *
 *   - **transient** (`flash`) — the jump glow. Cleared after a deadline.
 *   - **held** (`hold`) — stays while a bubble's editor is open, until cleared.
 *
 * Both re-resolve their range once, 90ms after being painted, because `scrollIntoView` only
 * starts a scroll: the transcript's virtualiser then rebuilds the rows around it, unmounting the
 * nodes the caller's range pointed at. A `Highlight` over dead nodes paints nothing.
 *
 * ## The identity guard, which is the point of this module
 *
 * Every deferred callback checks that the registry still holds **its own** highlight object
 * before acting:
 *
 *   - the re-resolve checks it, so a highlight replaced in the meantime is not overwritten;
 *   - the expiry checks it, so a newer highlight is not cleared by an older one's timer.
 *
 * `CSS.highlights.get(name) !== highlight` is the whole guard. Without it, a flash that expired
 * would delete the highlight a hold had just installed under the same name, and a replaced
 * highlight's stale range would come back.
 *
 * ## Timing, preserved exactly
 *
 * The re-resolve delay is 90ms and the flash duration is the caller's `ms`. The deadline is
 * computed ONCE, when the flash is painted — so a successful re-resolve does not restart the
 * full duration, it only shortens the remaining wait. That is the existing behaviour and it is
 * deliberate: the glow should not linger because a re-resolve happened to be slow.
 *
 * What this module does NOT do: scroll, find anchors, search the virtual list, or hold React
 * state. It receives a `Range` (or a callback that produces one) and paints it.
 */

import { elementOf } from './dom.js'
import { BLOCK_SELECTOR } from './text-ranges.js'

/** The registry name shared by both highlight kinds; pairs with `::highlight(quote-chat-flash)`. */
export const FLASH_HIGHLIGHT = 'quote-chat-flash'

/** How long a transient highlight lasts by default, in ms. */
export const FLASH_MS = 2600

/** Delay before re-resolving, in ms: lets the virtualiser finish rebuilding rows. */
const RESOLVE_DELAY = 90

/**
 * Whether this engine can paint range highlights.
 *
 * Reads the global off `window` rather than through a bare identifier: a module-scope binding of
 * the same name would shadow it, and a shadowed global is exactly how the flash once came to
 * never paint at all.
 *
 * @returns true when the highlight registry is available.
 */
export function canPaintHighlight() {
  const registry = typeof window === 'undefined' ? undefined : window.CSS
  return typeof registry === 'object'
    && registry !== null
    && typeof registry.highlights === 'object'
    && registry.highlights !== null
    && typeof window.Highlight === 'function'
}

/**
 * A copy of a range that stops before any plugin-owned node.
 *
 * The bubble is mounted INSIDE the paragraph it marks, so a range ending at the paragraph's end
 * also covers the bubble's ordinal — and the highlight registry paints every character a range
 * covers, including that digit. Shrinking the end back to the paragraph's own text keeps the
 * marker out of the fluorescent paint.
 *
 * If the range does not touch plugin chrome it is returned untouched: the previous version
 * extended the end to the block's last text node, which made the range LONGER and painted over
 * whatever sat beside the passage.
 *
 * @param range - the range to sanitise.
 * @returns a range covering the same prose, minus plugin nodes.
 */
export function paintSafeRange(range) {
  try {
    const endElement = elementOf(range.endContainer)
    // If the range already ends on prose, leave it exactly alone.
    if (endElement === null || endElement.closest('[data-qc-ignore]') === null) {
      const startElement = elementOf(range.startContainer)
      if (startElement === null || startElement.closest('[data-qc-ignore]') === null) {
        return range
      }
    }
    // The range touches plugin chrome. Rebuild it over prose only, preserving the original end
    // offset when that offset is in prose.
    const box = (endElement?.closest(BLOCK_SELECTOR)
      ?? elementOf(range.startContainer)?.closest(BLOCK_SELECTOR))
    if (box === null || box === undefined) return range
    const clean = document.createRange()
    // Prose text nodes of the block, in document order, skipping plugin subtrees.
    const texts = []
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (node.parentElement?.closest('[data-qc-ignore]') != null) continue
      texts.push(node)
    }
    if (texts.length === 0) return range
    const startIn = texts.findIndex((node) => node === range.startContainer)
    const endIn = texts.findIndex((node) => node === range.endContainer)
    // A start that sat in chrome: begin at the first prose node instead.
    const startNode = startIn >= 0 ? texts[startIn] : texts[0]
    const startOffset = startIn >= 0 ? range.startOffset : 0
    let endNode
    let endOffset
    if (endIn >= 0) {
      endNode = texts[endIn]
      endOffset = range.endOffset
    } else {
      // The end sat inside a plugin node. Stop at the LAST prose node that comes BEFORE the
      // range's end point — using the block's final text node would sweep up any chrome that
      // follows the passage, which is exactly the bug this guard exists to prevent.
      //
      // Because the end sits inside chrome, that subtree is excluded from `texts`. The correct
      // stop is the last PROSE node appearing before the excluded node in document order;
      // comparing against `comparePoint()` cannot work, since every prose node is inside the
      // range's span and would report "inside".
      const chromeNode = range.endContainer
      const proseNodesBefore = []
      const docWalker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT)
      for (let node = docWalker.nextNode(); node !== null; node = docWalker.nextNode()) {
        if (node === chromeNode) break
        if (node.parentElement?.closest('[data-qc-ignore]') != null) continue
        proseNodesBefore.push(node)
      }
      if (proseNodesBefore.length === 0) return range
      endNode = proseNodesBefore[proseNodesBefore.length - 1]
      endOffset = (endNode.textContent ?? '').length
    }
    // Guarantee a non-inverted range.
    if (endNode === startNode && endOffset < startOffset) {
      endOffset = startOffset
    }
    clean.setStart(startNode, startOffset)
    clean.setEnd(endNode, endOffset)
    return clean
  } catch {
    return range
  }
}

/**
 * Create one highlighter.
 *
 * One per Host factory call: the pending re-resolve timers belong to whichever instance started
 * them, and a shared registry entry across instances would let one plugin clear another's glow.
 *
 * @returns the paint, hold and clear operations.
 */
export function createHighlighter() {
  /**
   * Paint a transient highlight, then clear it when the deadline passes.
   *
   * @param range - the passage to highlight.
   * @param ms - how long it lasts, measured from this call.
   * @param resolve - optional re-resolution, called once after the paint settles. Returning null
   *   keeps the original range: a stale range is still better than no highlight.
   */
  function flash(range, ms = FLASH_MS, resolve = null) {
    if (!canPaintHighlight()) return
    try {
      // Strip plugin-owned nodes: the bubble's ordinal must never be painted.
      let highlight = new Highlight(paintSafeRange(range))
      window.CSS.highlights.set(FLASH_HIGHLIGHT, highlight)
      // Fixed at paint time: a re-resolve shortens the remaining wait, it does not restart it.
      const deadline = Date.now() + ms

      /**
       * Re-resolve once, shortly after the scroll settles, then expire.
       *
       * The guard at the top is what makes a replaced highlight safe: if the registry no longer
       * holds THIS object, a newer highlight owns the name and nothing here may touch it.
       */
      const settle = () => {
        if (window.CSS.highlights.get(FLASH_HIGHLIGHT) !== highlight) return
        if (resolve !== null) {
          const live = resolve()
          if (live !== null) {
            highlight = new Highlight(paintSafeRange(live))
            window.CSS.highlights.set(FLASH_HIGHLIGHT, highlight)
          }
        }
        setTimeout(() => {
          // Same guard, now for expiry: an older flash must never clear a newer highlight.
          if (window.CSS.highlights.get(FLASH_HIGHLIGHT) === highlight) {
            window.CSS.highlights.delete(FLASH_HIGHLIGHT)
          }
        }, Math.max(0, deadline - Date.now()))
      }
      if (resolve === null) settle()
      else setTimeout(settle, RESOLVE_DELAY)
    } catch (failure) {
      console.error('[dsh-quote-chat] highlight failed:', failure)
    }
  }

  /**
   * Paint a highlight that stays until cleared.
   *
   * Same registry name as the transient one, but no timer: an editor is open for as long as the
   * user needs, so the passage has to stay lit. It re-resolves once after the reveal settles for
   * the same reason the flash does, then leaves the highlight alone.
   *
   * @param range - the passage to keep lit.
   * @param resolve - re-resolution used once after the reveal settles.
   */
  function hold(range, resolve = null) {
    if (!canPaintHighlight()) return
    try {
      let highlight = new Highlight(paintSafeRange(range))
      window.CSS.highlights.set(FLASH_HIGHLIGHT, highlight)
      if (resolve === null) return
      setTimeout(() => {
        // Identity guard: a hold installed after this one must not be overwritten.
        if (window.CSS.highlights.get(FLASH_HIGHLIGHT) !== highlight) return
        const live = resolve()
        if (live === null) return
        highlight = new Highlight(paintSafeRange(live))
        window.CSS.highlights.set(FLASH_HIGHLIGHT, highlight)
      }, RESOLVE_DELAY)
    } catch (failure) {
      console.error('[dsh-quote-chat] hold highlight failed:', failure)
    }
  }

  /** Clear whatever highlight is currently painted. */
  function clear() {
    if (!canPaintHighlight()) return
    window.CSS.highlights.delete(FLASH_HIGHLIGHT)
  }

  return { flash, hold, clear }
}
