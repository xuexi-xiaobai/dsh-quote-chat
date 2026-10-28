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
 * Where a drop would land, as a TEXT OFFSET in the draft.
 *
 * Counting chip slots (the earlier approach) could only ever place a chip between other chips: the draft
 * "chip1 text" has one chip and therefore two slots, so dropping in the middle of "text" was not expressible at all.
 * The user asked for exactly that — 【chip】text → text【chip】 — and it is not reachable through slot arithmetic.
 *
 * The host editor already knows where the caret would go for a pointer position, and a Lexical decorator is
 * `contenteditable=false`, so `caretRangeFromPoint` reports the nearest legal text position on either side of it. That
 * position, converted to an offset in the draft string, is the drop.
 *
 * @param root - the editable element.
 * @param clientX - pointer position.
 * @param clientY - pointer position.
 * @param draft - the draft text, so the DOM position can be turned into a string offset.
 * @returns the offset in `draft` where the chip would be inserted, or null when the point is not over editable text.
 */
export function dropOffsetAt(root, clientX, clientY, draft) {
  if (typeof document === 'undefined' || root === null) return null
  const range = document.caretRangeFromPoint?.(clientX, clientY)
  if (range === undefined || range === null) return null
  if (root.contains(range.startContainer) === false) return null

  // Walk ELEMENT children, not text nodes.
  //
  // A chip is a decorator whose own subtree contains text ("@", "注释 1") that is not in the draft at all — the draft
  // holds a single placeholder character for the whole thing. A text-node walk therefore counted five characters for
  // every chip and the computed offset drifted further out of step with the draft with each one; measured, a drop aimed
  // at the middle of "abcdefghij" landed after it, at "@注释 2abcdefghij@注释 1".
  //
  // Treating each chip as exactly one character is what the draft actually contains, so the arithmetic lines up.
  const offsetOf = (node, within) => {
    let offset = 0
    let reached = false
    const visit = (parent) => {
      for (const child of parent.childNodes) {
        if (child === node) {
          reached = true
          if (node.nodeType === Node.TEXT_NODE) {
            offset += Math.min(within, node.data.length)
            return true
          }
          // The caret landed ON an element. Inside a chip that still means one placeholder character, and the side the
          // caret sits on decides whether the chip is counted or not.
          if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute?.('data-composer-chip')) {
            if (within > 0) offset += 1
            return true
          }
          return true
        }
        if (child.nodeType === Node.TEXT_NODE) {
          offset += child.data.length
          continue
        }
        if (child.nodeType !== Node.ELEMENT_NODE) continue
        // One placeholder character per chip, regardless of what it renders inside.
        if (child.hasAttribute('data-composer-chip')) {
          // The caret's own node may be INSIDE this chip; treat that as one character at the chip's position.
          if (child.contains(node)) {
            offset += 1
            reached = true
            return true
          }
          offset += 1
          continue
        }
        // A line break in the DOM is a newline in the draft.
        if (child.tagName === 'BR') {
          offset += 1
          continue
        }
        if (visit(child)) return true
      }
      return false
    }
    visit(root)
    return reached ? offset : null
  }

  const computed = offsetOf(range.startContainer, range.startOffset)
  if (computed === null) return null
  return Math.max(0, Math.min(computed, draft.length))
}

/**
 * Rebuild a draft with one chip moved to a different position.
 *
 * Works on the draft TEXT plus its reference offsets, because that pair is exactly what `setDraft` accepts. The moved
 * chip's placeholder is cut out and re-inserted at a TEXT OFFSET, and every reference offset is recomputed from the
 * result — an incremental shift is easy to get subtly wrong when the insertion point straddles the removal point, and
 * recomputing from the final string is cheap for the handful of chips a draft ever holds.
 *
 * A text offset rather than a chip slot is what makes a drop INSIDE prose possible: with slots, "chip text" has exactly
 * two places a chip can go, so 【chip】text → text【chip】 could not be expressed at all.
 *
 * The newline that separates a chip from the text above it travels WITH the chip, so a move does not leave an empty
 * paragraph behind. A trailing newline does not, or a chip dropped at the start of a line would push that line down.
 *
 * @param draft - the current draft text.
 * @param references - references in that draft, each with `offset` and `length`.
 * @param source - the chip source this plugin owns; other sources are carried along untouched.
 * @param ref - the annotation id of the chip being moved.
 * @param target - the drop position, as an offset into `draft`.
 * @returns `{ text, references }` for `setDraft`, or null when the move is a no-op or the chip is missing.
 */
export function moveChipInDraft(draft, references, source, ref, target) {
  const own = references
    .filter((item) => item.source === source && item.ref !== undefined)
    .slice()
    .sort((left, right) => left.offset - right.offset)
  const current = own.findIndex((item) => item.ref === ref)
  if (current < 0) return null

  const chip = own[current]
  // Take the placeholder, plus the line break that precedes it when the chip owns that line, so a moved chip carries its
  // own line with it instead of leaving an empty paragraph behind.
  let start = chip.offset
  const stop = chip.offset + chip.length
  const ownsLeadingBreak = start > 0 && draft[start - 1] === '\n'
  if (ownsLeadingBreak) start -= 1
  const chunk = draft.slice(start, stop)

  const removedLength = stop - start
  const rest = `${draft.slice(0, start)}${draft.slice(stop)}`

  // The drop is a TEXT OFFSET in the original draft. Removing the chip may have shifted it left, so it is mapped onto
  // the shortened string before the insertion; when the drop sits beyond the cut, it moves by exactly what was removed.
  const clamped = Math.max(0, Math.min(target, draft.length))
  const insertion = Math.max(0, Math.min(
    clamped >= stop ? clamped - removedLength : clamped,
    rest.length,
  ))
  const text = `${rest.slice(0, insertion)}${chunk}${rest.slice(insertion)}`

  // "Did anything change?" cannot be answered by comparing strings.
  //
  // Every chip is the SAME placeholder character, so swapping two chips leaves the text byte-identical — and the
  // early-return below therefore rejected every reorder between chips that have nothing between them. Measured: moving
  // the second chip to offset 0 returned null for all three test offsets, while the reference order had in fact changed.
  // What must be compared is the ORDER of the references, which the rebuild below derives from the text.
  const movedIds = new Set(own.map((item) => item.ref))
  const rebuilt = []
  for (const item of references) {
    if (item.source === source && movedIds.has(item.ref)) continue
    // A foreign reference (another plugin's chip) has no placeholder this module can search for, so it is carried by the
    // same transformation its position underwent.
    if (item.offset >= stop) rebuilt.push({ ...item, offset: item.offset - removedLength + chunk.length })
    else if (item.offset > start) rebuilt.push({ ...item, offset: item.offset - chunk.length })
    else rebuilt.push({ ...item })
  }
  // This plugin's chips, placed by searching the rewritten text for their placeholder from a moving cursor. Every
  // placeholder is the same character, so the ORDER is what assigns references to positions — and the order is decided by
  // comparing the moved chip's new offset against each survivor's new offset.
  const survivors = own
    .filter((item) => item.ref !== ref)
    .map((item) => ({
      ...item,
      offset: item.offset >= stop ? item.offset - removedLength + chunk.length
        : item.offset > start ? item.offset - chunk.length : item.offset,
    }))
  const slots = [...survivors, { ...chip, offset: insertion }]
    .sort((left, right) => {
      if (left.offset !== right.offset) return left.offset - right.offset
      // An equal offset means "this chip and another want the same place". The moved chip loses the tie only when it is
      // moving FORWARD: dropping on a later chip's slot puts it after that chip, because it was carried past it.
      if (left.ref === ref) return insertion > chip.offset ? 1 : -1
      if (right.ref === ref) return insertion > chip.offset ? -1 : 1
      return 0
    })
  // The draft did not change when the chip's slot is exactly where it already was.
  //
  // Compared by OFFSET, not by index among the chips: with a single chip the index is 0 both before and after any move,
  // so an index comparison called every one-chip move a no-op — measured, dropping the only chip into the middle of a
  // sentence returned null while the recomputed text was clearly different.
  const slotNow = slots.findIndex((item) => item.ref === ref)
  if (slots[slotNow].offset === chip.offset) return null
  let searchFrom = 0
  for (const item of slots) {
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
   * The caret's box at a pointer position, so the grab bar can stand where the chip would actually go.
   *
   * A range's `getBoundingClientRect()` is empty when it is collapsed inside a text node, so the range is widened by one
   * character and its left edge taken. That is the same trick a text editor uses to draw its own caret.
   */
  const caretBoxAt = (root, clientX, clientY) => {
    if (root === null || typeof document.caretRangeFromPoint !== 'function') return null
    const range = document.caretRangeFromPoint(clientX, clientY)
    if (range === null || range === undefined) return null
    if (root.contains(range.startContainer) === false) return null
    const box = range.getBoundingClientRect()
    if (box.height > 0) {
      return { left: box.left, top: box.top, height: box.height }
    }
    // Collapsed: take the neighbour character's box and use the edge the caret is nearest.
    const widened = range.cloneRange()
    const container = range.startContainer
    if (container.nodeType === Node.TEXT_NODE && container.data.length > 0) {
      const at = Math.min(range.startOffset, container.data.length - 1)
      widened.setStart(container, at)
      widened.setEnd(container, at + 1)
      const charBox = widened.getBoundingClientRect()
      if (charBox.height > 0) {
        return {
          left: range.startOffset <= at ? charBox.left : charBox.right,
          top: charBox.top,
          height: charBox.height,
        }
      }
    }
    return null
  }

  /** The chip nearest a pointer position, used only when no text caret could be resolved. */
  const chipIndexNear = (chips, clientX) => {
    let best = 0
    let bestDistance = Infinity
    for (let index = 0; index < chips.length; index += 1) {
      const box = chips[index].getBoundingClientRect()
      const distance = Math.abs(clientX - (box.left + box.width / 2))
      if (distance < bestDistance) { bestDistance = distance; best = index }
    }
    return best
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
    // The drop is resolved as a TEXT position, so the grab bar can sit in the middle of a word rather than only at a
    // seam between two chips. `root` is resolved per move: the Host can re-create the editable.
    const root = dragging.element.closest('[contenteditable="true"]')
      ?? document.querySelector('[contenteditable="true"]')
    const draftNow = readDraft().draft ?? ''
    const offset = dropOffsetAt(root, event.clientX, event.clientY, draftNow)
    if (offset !== null) dragging.offset = offset
    const caret = offset === null ? null : caretBoxAt(root, event.clientX, event.clientY)
    if (caret === null) {
      const chips = listChips()
      placeGrab(chips, chipIndexNear(chips, event.clientX))
    } else {
      grab.style.left = `${Math.round(caret.left)}px`
      grab.style.top = `${Math.round(caret.top)}px`
      grab.style.height = `${Math.round(caret.height)}px`
    }
  }

  const finish = (commit) => {
    const state = dragging
    if (state === null) return
    if (state.active && commit) {
      const live = readDraft()
      const result = moveChipInDraft(live.draft, live.occurrences, source, state.ref, state.offset ?? 0)
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
