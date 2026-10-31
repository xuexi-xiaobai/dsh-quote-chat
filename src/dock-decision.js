/**
 * Whether the compose panel should be held in a docked slot this frame.
 *
 * ## Why this is a module and not three lines in the component
 *
 * It used to be an inline expression in `ui/popovers.js`, and it was wrong in a way no amount of reading caught: the
 * two branches used thresholds that OVERLAP, so for a 23px band of scroll positions both "leave the dock" and "enter
 * the dock" were true on consecutive frames. Measured on the real app: the panel's `data-docked` flipped 23 times in
 * 23 pixels, and it was dragged from 2px to 24px above the header before snapping back into its slot.
 *
 * Nothing could test that while it was buried in a render body. Here it is a pure function of numbers, so the property
 * that matters — **one transition per crossing, never a flip-flop** — is asserted directly by sweeping the resting
 * position across the threshold (`test/dock-decision.mjs`).
 *
 * ## The two thresholds, and why they are not the same one
 *
 * The decision has to be hysteretic: a single threshold cannot be stable, because the resting position is driven by
 * the content moving under the panel (a pane drag re-wraps the text and moves the anchor by up to 150px), not by the
 * user asking for anything. So:
 *
 *   - ENTER a dock only when the panel would be cut by the chrome by more than `margin` — being barely out is not a
 *     reason to take the panel away from the passage the user is describing;
 *   - LEAVE only when the panel would sit fully inside the band with the same margin on BOTH sides.
 *
 * The gap between those two conditions (2 × margin of travel) is the hysteresis. The previous code asked "is it still
 * out by `margin`?" to leave, which is the same threshold as the entry rule shifted by one margin — so the middle
 * region satisfied both branches and the state alternated every frame.
 *
 * ## Coordinates
 *
 * Everything is in VIEWPORT pixels, the same space as `readableBand()` and `snapPosition()`. The caller converts to the
 * container's content space afterwards; mixing the two is what made one edge of the panel behave differently from the
 * other in the first place.
 */

/**
 * Clearance kept between the panel and the chrome at a docked edge, in px.
 *
 * Used for the dock slot's own gap and for the RELEASE threshold: a docked panel is only let go once it would sit this
 * far inside the band. It is deliberately NOT used for the entry threshold — see `ENTER_SLOP`.
 */
export const DOCK_MARGIN = 24

/**
 * How far out of the band the panel has to be before it is TAKEN, in px.
 *
 * One pixel, on purpose. The hysteresis lives on the other side of the pair: entry at 1px out, release at 24px inside,
 * so the decision cannot be re-taken by a sub-pixel wobble while the panel is only just out. Making this 24 too would
 * be symmetric and would look tidier, but it buys 24px of extra travel at the cost of letting the panel slide 24px
 * underneath the header before it snaps into the slot — which is the #9 complaint, and visible. 1px of overlap is not.
 */
const ENTER_SLOP = 1

/**
 * Fully inside the band, with the margin kept on both sides.
 *
 * A panel taller than the band minus two margins can never satisfy this, and demanding the margin anyway would trap it
 * in the dock forever. So when the panel cannot fit with margins, plain containment is the standard: it is the most
 * that panel can achieve. A panel taller than the whole band can satisfy neither, and then staying docked is the only
 * state that keeps any of it on screen — deliberately, not by accident.
 *
 * @param restingTop - the panel's top edge where it would rest, in viewport px.
 * @param restingBottom - the panel's bottom edge where it would rest.
 * @param bandTop - the readable band's top edge.
 * @param bandBottom - the readable band's bottom edge.
 * @param margin - clearance required from both edges.
 * @returns whether the panel would be usable where it belongs.
 */
function comfortablyVisible(restingTop, restingBottom, bandTop, bandBottom, margin) {
  const fitsWithMargin = bandBottom - bandTop >= (restingBottom - restingTop) + margin * 2
  if (fitsWithMargin) {
    return restingTop >= bandTop + margin && restingBottom <= bandBottom - margin
  }
  return restingTop >= bandTop && restingBottom <= bandBottom
}

/**
 * Cut by the chrome, by more than the margin, if left where it would rest.
 *
 * @param restingTop - the panel's top edge where it would rest, in viewport px.
 * @param restingBottom - the panel's bottom edge where it would rest.
 * @param bandTop - the readable band's top edge.
 * @param bandBottom - the readable band's bottom edge.
 * @param slop - how far out counts as out.
 * @returns whether the panel would be clipped by the header or covered by the composer.
 */
function outOfBand(restingTop, restingBottom, bandTop, bandBottom, slop) {
  return restingTop < bandTop - slop || restingBottom > bandBottom + slop
}

/**
 * Decide whether the panel is held in a docked slot.
 *
 * @param state - `{ hasInput, frozen, wasDocked, restingTop, restingBottom, bandTop, bandBottom, margin }`, all
 *   viewport px. `frozen` means the anchor is being reflowed right now, so the decision must not change; `wasDocked`
 *   is the previous frame's answer and selects which threshold applies.
 * @returns true when the panel should be pinned to an edge this frame.
 */
export function dockDecision(state) {
  const {
    hasInput, frozen, wasDocked, restingTop, restingBottom, bandTop, bandBottom,
    margin = DOCK_MARGIN,
  } = state
  // An empty panel is never rescued: it must be free to scroll out of view with the passage it belongs to, which is
  // the whole point of living inside the scroll container. Only once there is text to protect does leaving the screen
  // become a problem worth moving for.
  if (hasInput === false) return false
  // A reflow is in progress: keep whatever the panel is doing. Dragging a pane boundary moves the anchor by up to
  // 150px in one frame, far more than the hysteresis, so re-deciding here is exactly how the state used to flicker.
  if (frozen === true) return wasDocked === true
  if (wasDocked === true) {
    return comfortablyVisible(restingTop, restingBottom, bandTop, bandBottom, margin) === false
  }
  return outOfBand(restingTop, restingBottom, bandTop, bandBottom, ENTER_SLOP)
}

/**
 * The docked slot for a given edge, in viewport pixels.
 *
 * Rounded HERE, in the space the slot actually lives in. The panel is positioned in the container's CONTENT space, so
 * rounding there instead means an integer `top` fighting a fractional `scrollTop` — measured as a 1px drift-and-snap
 * per scroll step. A slot that is whole in the viewport keeps the painted edges crisp and stays exact under any scroll
 * offset, because the fractional part cancels.
 *
 * @param edge - 'top' or 'bottom'.
 * @param band - the readable band, in viewport pixels.
 * @param size - the panel's measured height.
 * @param gap - clearance from the chrome.
 * @returns the slot's top edge, in viewport pixels.
 */
export function dockSlotTop(edge, band, size, gap = 8) {
  if (edge === 'bottom') {
    return Math.round(Math.max(band.top + gap, band.bottom - gap - size.height))
  }
  return Math.round(band.top + gap)
}
