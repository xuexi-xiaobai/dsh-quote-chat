/**
 * Navigation: bring a stored passage back into view.
 *
 * An annotation stores an anchor — a text quote plus the path to its block. Restoring it means
 * turning that back into a `Range`, which means the nodes have to exist. They often do not: the
 * transcript is virtualized, so rows that scrolled far away are unmounted.
 *
 * ## The search, as shipped
 *
 * 1. Try to resolve immediately. Usually the passage is still mounted, so this is the whole job.
 * 2. Otherwise sweep UP from where the user is, giving the virtualizer two frames per step
 *    (one for the scroll to apply, one to mount the page it just admitted).
 * 3. If up finds nothing, restore the original scroll position, wait one frame, and sweep DOWN.
 *
 * Each direction stops after 40 steps, or after two consecutive steps in which the scroller did
 * not move — that second condition is how a transcript that has reached its end stops the sweep
 * instead of burning all 40 attempts.
 *
 * **Deliberately unchanged:** there is no restore-on-failure. A sweep that finds nothing leaves
 * the transcript wherever the search ended. Adding a "put it back" step would be a behaviour
 * change, not a refactor.
 *
 * ## What this does NOT do
 *
 * Paint. It returns a `Range`; the caller decides whether to flash it, hold it, or neither. That
 * is why navigation depends on layout and the anchor module but never on the highlighter, and
 * never on the entry that wires them together.
 */

import { elementOf } from './dom.js'
import { resolveAnchor } from './text-ranges.js'

/** Steps per direction before the sweep gives up. */
const MAX_STEPS = 40

/** Frames to wait after each step: one for the scroll, one for the virtualizer to mount. */
const FRAMES_PER_STEP = 2

/** How far above the readable area's top a restored passage is placed, in px. */
const ANCHOR_TOP_GAP = 28

/** The smallest useful sweep step, in px; larger viewports step by 80% of their height. */
const MIN_STEP = 160

/**
 * Wait for the next animation frame.
 * @returns a promise resolved on the next frame.
 */
function nextFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      resolve()
      return
    }
    requestAnimationFrame(() => resolve())
  })
}

/**
 * Create one navigation helper set.
 *
 * One per Host factory call, and it takes the instance's own layout rather than creating a
 * second one: two layout instances would mean two sets of caches over the same DOM.
 *
 * @param options - `{ layout, findFlow, resolve }`. `findFlow` defaults to the layout's own lookup
 *   (the virtualizer can replace the flow element mid-sweep). `resolve` defaults to the real
 *   `resolveAnchor`; it is a named parameter so the search policy can be tested without building
 *   a DOM, not because production varies it.
 * @returns `{ reveal, scrollToRange, nextFrame }`.
 */
export function createNavigation({
  layout,
  findFlow = () => layout.findFlow(),
  resolve = resolveAnchor,
} = {}) {
  /**
   * Bring one resolved range into view and hand it back.
   *
   * Only the scroll happens here; the glow is painted by the caller.
   *
   * @param range - the resolved passage range.
   * @param flow - the chat flow.
   * @returns the same range.
   */
  function scrollToRange(range, flow) {
    const scroller = layout.scrollContainerOf(flow)
    const rect = range.getBoundingClientRect()
    if (scroller === null) {
      // No explicit scroller: let the browser pick, but ask for minimum movement rather than
      // `center` — a row can be taller than the viewport, and centring such a row scrolls to its
      // middle, which is not where the passage is.
      const host = elementOf(range.startContainer)?.closest('[data-chat-node-key]') ?? flow
      host.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
      return range
    }
    // Align the passage's TOP edge with the top of the readable area, less a small gap.
    //
    // Centring was the earlier behaviour, and it wastes the upper half of the view for a long
    // passage: the annotated text should BEGIN just under the top bar and then flow downward, so
    // as much of it as possible is on screen at once. The readable area is measured each time
    // because the composer is height-fluid — it grows with multi-line input and attachments.
    const area = layout.visibleChatArea(scroller)
    const target = scroller.scrollTop + (rect.top - area.top) - ANCHOR_TOP_GAP
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
    scroller.scrollTop = Math.min(Math.max(0, target), max)
    return range
  }

  /**
   * Resolve an annotation's passage, scrolling the transcript until its row loads.
   *
   * @param flow - the chat flow element.
   * @param annotation - the annotation to reveal.
   * @returns the resolved range, or null when it is truly gone.
   */
  async function reveal(flow, annotation) {
    const immediate = resolve(flow, annotation.anchor)
    if (immediate !== null) return scrollToRange(immediate, flow)

    const scroller = layout.scrollContainerOf(flow)
    if (scroller === null) return null
    const start = scroller.scrollTop
    const step = Math.max(MIN_STEP, Math.round(scroller.clientHeight * 0.8))

    /**
     * Sweep one direction, giving the virtualizer time to mount each step.
     * @param direction - -1 for up, 1 for down.
     * @returns the resolved range, or null.
     */
    const sweep = async (direction) => {
      let barren = 0
      for (let attempt = 0; attempt < MAX_STEPS; attempt += 1) {
        const before = scroller.scrollTop
        scroller.scrollTop = before + step * direction
        // Two frames: one for the scroll to apply, one for the virtualizer to mount the page it
        // just admitted.
        for (let frame = 0; frame < FRAMES_PER_STEP; frame += 1) await nextFrame()
        // Re-read the flow: the virtualizer may have replaced the element the caller passed.
        const live = findFlow() ?? flow
        const hit = resolve(live, annotation.anchor)
        if (hit !== null) return scrollToRange(hit, live)
        if (scroller.scrollTop === before) {
          // Hit an end; two attempts in a row with no movement means done.
          barren += 1
          if (barren > 1) return null
        } else {
          barren = 0
        }
      }
      return null
    }

    // Sweep outward from where the user is now: older passages are usually above, but a passage
    // from a later answer is below, so both run.
    const up = await sweep(-1)
    if (up !== null) return up
    scroller.scrollTop = start
    await nextFrame()
    return sweep(1)
  }

  return { reveal, scrollToRange, nextFrame }
}
