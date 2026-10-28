/**
 * Dragging an annotation chip within the composer draft.
 *
 * The chip itself belongs to the Host's editor: it is a Lexical decorator node, so its DOM is rendered by code this
 * plugin does not own and moving that DOM directly would be undone on the next keystroke. What can be owned is the
 * DRAFT — the string the composer actually holds — so a drag is expressed as a rewrite of that draft, and the visual
 * dragging is drawn as an overlay on top of the editor.
 *
 * That split is the whole design:
 *
 *   - while the pointer is down, an overlay draws (a) a grab bar at the insertion point the drop would produce and
 *     (b) a floating copy of the chip that follows the cursor. Nothing in the editor is touched, so no typing state is
 *     disturbed and no re-render is fought;
 *   - on release, the draft is rebuilt with the same chips in the new order, through the same `setDraft` call the rest
 *     of the plugin already uses.
 *
 * ## Why an overlay instead of a native drag
 *
 * `draggable` is false on the host's chip and setting it would make the editor treat its own decorator as draggable
 * content — the browser would then try to move a node Lexical owns, which is the one thing that must not happen. A
 * pointer-driven overlay is also what the reference design shows: the chip does not teleport, a translucent copy follows
 * the cursor while a solid marker shows where it will land.
 */

/** The drag overlay's class names, so the stylesheet and the probes agree on them. */
export const DRAG_GRAB_CLASS = 'qc-chip-drag-grab'
export const DRAG_GHOST_CLASS = 'qc-chip-drag-ghost'

/** The source value the chips carry; the drag only ever acts on its own. */
const CHIP_SOURCE = 'quote-chat'

/** How far the pointer must travel before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 4

/**
 * The chip order implied by a pointer position.
 *
 * Each chip contributes its horizontal midpoint; the drop index is how many of those midpoints sit to the left of the
 * pointer. Rows are ignored deliberately: chips live in a wrapping inline flow, and a two-row draft read row by row
 * would be ambiguous under the cursor. Comparing `x` alone keeps the answer monotonic in the direction the user is
 * dragging, which is what makes the grab bar move predictably.
 *
 * @param chips - the chip elements, in draft order.
 * @param clientX - pointer position.
 * @returns index in `[0, chips.length]` where a chip would be inserted.
 */
export function dropIndexAt(chips, clientX) {
  let index = 0
  for (const chip of chips) {
    const box = chip.getBoundingClientRect()
    if (clientX > box.left + box.width / 2) index += 1
  }
  return index
}

/**
 * Rebuild a draft with one chip moved to a different slot.
 *
 * Works on the draft TEXT plus its reference offsets, because that pair is exactly what `setDraft` accepts. The moved
 * chip's placeholder is cut out and re-inserted, and every reference offset is recomputed from the result — an
 * incremental shift is easy to get subtly wrong when the insertion point straddles the removal point, and recomputing
 * from the final string is cheap for the handful of chips a draft ever holds.
 *
 * The neighbouring newlines that separate chips travel WITH their chip, so a move does not leave an empty paragraph
 * behind or glue two chips onto one line.
 *
 * @param draft - the current draft text.
 * @param references - references in that draft, each with `offset` and `length`.
 * @param source - the chip source this plugin owns; other sources are carried along untouched.
 * @param ref - the annotation id of the chip being moved.
 * @param target - the slot, counted among this plugin's own chips only.
 * @returns `{ text, references }` for `setDraft`, or null when the move is a no-op or the chip is missing.
 */
export function moveChipInDraft(draft, references, source, ref, target) {
  const own = references
    .filter((item) => item.source === source && item.ref !== undefined)
    .slice()
    .sort((left, right) => left.offset - right.offset)
  const current = own.findIndex((item) => item.ref === ref)
  if (current < 0) return null
  // `target` counts slots among the plugin's chips; clamp into range and ignore a drop that changes nothing.
  const to = Math.max(0, Math.min(own.length, target))
  const from = current
  // Removing the chip first shifts every later slot left by one, so a target past the original position means "one
  // further along" in the intermediate list.
  const insertAt = to > from ? to - 1 : to
  if (insertAt === from) return null

  const chip = own[from]
  // Take the placeholder, plus the line break that precedes it, so a moved chip carries its own line with it.
  let start = chip.offset
  const stop = chip.offset + chip.length
  if (start > 0 && draft[start - 1] === '\n') start -= 1
  const chunk = draft.slice(start, stop)

  // The draft without the chip; offsets after the cut move left.
  const removedLength = stop - start
  const rest = `${draft.slice(0, start)}${draft.slice(stop)}`
  const survivors = own
    .filter((item) => item.ref !== ref)
    .map((item) => (item.offset >= stop ? { ...item, offset: item.offset - removedLength } : { ...item }))

  // Where the chunk goes: before the chip that will hold the target slot, or at the end.
  const anchorChip = insertAt < survivors.length ? survivors[insertAt] : null
  const insertOffset = anchorChip === null ? rest.length : anchorChip.offset
  const text = `${rest.slice(0, insertOffset)}${chunk}${rest.slice(insertOffset)}`

  // Recompose the reference list from the final text, keeping the non-plugin references where they were.
  const movedIds = new Set(own.map((item) => item.ref))
  const rebuilt = []
  for (const item of references) {
    if (item.source === source && movedIds.has(item.ref)) continue
    // Foreign references are re-anchored by measuring the same distance from their old position to their new one.
    if (item.offset >= stop) rebuilt.push({ ...item, offset: item.offset + (text.length - draft.length) })
    else rebuilt.push({ ...item })
  }
  // Plugin chips, in their new order, positioned by searching the rewritten text for their placeholder from a moving
  // cursor: identical placeholders make a plain indexOf ambiguous, and the order is what disambiguates them.
  const order = [...own]
  const moved = order.splice(from, 1)[0]
  order.splice(insertAt, 0, moved)
  let searchFrom = 0
  for (const item of order) {
    const at = text.indexOf('\uFFFC', searchFrom)
    if (at < 0) break
    rebuilt.push({ ...item, offset: at })
    searchFrom = at + item.length
  }
  rebuilt.sort((left, right) => left.offset - right.offset)
  return { text, references: rebuilt }
}

/**
 * Attach chip dragging to the composer.
 *
 * Returns a teardown function. All listeners are on the document and are removed by it; the overlay elements are created
 * lazily on the first press and reused afterwards, so an idle composer costs nothing.
 *
 * @param options - `{ container, listChips, readDraft, setDraft, source, onMoved }`.
 * @returns a function that detaches everything.
 */
export function attachChipDragging({ listChips, readDraft, setDraft, source, onMoved }) {
  if (typeof document === 'undefined') return () => {}

  let ghost = null
  let grab = null
  let dragging = null

  const ensureOverlay = () => {
    if (ghost === null || ghost.isConnected === false) {
      ghost = document.createElement('div')
      ghost.className = DRAG_GHOST_CLASS
      ghost.setAttribute('aria-hidden', 'true')
      document.body.appendChild(ghost)
    }
    if (grab === null || grab.isConnected === false) {
      grab = document.createElement('div')
      grab.className = DRAG_GRAB_CLASS
      grab.setAttribute('aria-hidden', 'true')
      document.body.appendChild(grab)
    }
  }

  /**
   * Where the grab bar belongs for a given drop slot.
   *
   * Placed at the seam the chip would fall into: the left edge of the chip that currently occupies that slot, or the
   * right edge of the last chip when the slot is at the end.
   */
  const placeGrab = (chips, index) => {
    if (chips.length === 0) return
    const at = Math.min(index, chips.length)
    const anchorChip = at < chips.length ? chips[at] : chips[chips.length - 1]
    const box = anchorChip.getBoundingClientRect()
    const left = at < chips.length ? box.left : box.right
    grab.style.left = `${Math.round(left)}px`
    grab.style.top = `${Math.round(box.top)}px`
    grab.style.height = `${Math.round(box.height)}px`
  }

  const cleanup = () => {
    if (ghost !== null) ghost.remove()
    if (grab !== null) grab.remove()
    ghost = null
    grab = null
    if (dragging !== null && dragging.element !== null) {
      dragging.element.removeAttribute('data-qc-dragging')
    }
    dragging = null
    document.body.style.removeProperty('cursor')
  }

  const onPointerDown = (event) => {
    if (event.button !== 0) return
    const target = event.target instanceof Element
      ? event.target.closest('[data-composer-chip]') : null
    if (target === null) return
    // Membership is checked by the SOURCE attribute, not by containment in a captured container.
    //
    // `composerContainer()` resolves the composer's dock, and the chip lives one level deeper inside a `bar` element
    // that the dock wraps only when it is mounted a particular way. Requiring `container.contains(target)` rejected
    // every press — the drag never started — while the pointer events were arriving perfectly. The attribute is the
    // chip's own claim to belong to this plugin, and it cannot drift from the DOM the way a captured ancestor can.
    if (target.getAttribute('data-composer-chip') !== CHIP_SOURCE) return
    const chips = listChips()
    const index = chips.indexOf(target)
    if (index < 0) return
    dragging = {
      element: target,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      index,
      ref: target.getAttribute('data-qc-ref'),
      label: target.getAttribute('data-qc-label') ?? '',
      kind: target.getAttribute('data-qc-kind') ?? 'text',
    }
  }

  const onPointerMove = (event) => {
    if (dragging === null) return
    if (dragging.active === false) {
      const dx = event.clientX - dragging.startX
      const dy = event.clientY - dragging.startY
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      // The press became a drag. Suppress the click the editor would otherwise treat as an activation.
      dragging.active = true
      ensureOverlay()
      dragging.element.setAttribute('data-qc-dragging', 'true')
      ghost.textContent = dragging.label
      ghost.setAttribute('data-qc-kind', dragging.kind)
      document.body.style.cursor = 'grabbing'
    }
    event.preventDefault()
    ghost.style.left = `${Math.round(event.clientX)}px`
    ghost.style.top = `${Math.round(event.clientY)}px`
    const chips = listChips()
    dragging.slot = dropIndexAt(chips, event.clientX)
    placeGrab(chips, dragging.slot)
  }

  const finish = (commit) => {
    const state = dragging
    if (state === null) return
    if (state.active && commit) {
      const live = readDraft()
      const result = moveChipInDraft(live.draft, live.occurrences, source, state.ref, state.slot)
      if (result !== null && typeof setDraft === 'function') {
        setDraft(result)
        if (typeof onMoved === 'function') onMoved()
      }
    }
    cleanup()
  }

  const onPointerUp = () => finish(true)
  const onKeyDown = (event) => {
    if (event.key === 'Escape' && dragging !== null && dragging.active) {
      event.stopPropagation()
      finish(false)
    }
  }

  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('pointermove', onPointerMove, true)
  document.addEventListener('pointerup', onPointerUp, true)
  document.addEventListener('pointercancel', onPointerUp, true)
  document.addEventListener('keydown', onKeyDown, true)

  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('pointermove', onPointerMove, true)
    document.removeEventListener('pointerup', onPointerUp, true)
    document.removeEventListener('pointercancel', onPointerUp, true)
    document.removeEventListener('keydown', onKeyDown, true)
    cleanup()
  }
}
