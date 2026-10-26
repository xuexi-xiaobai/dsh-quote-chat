/**
 * Layout: where the transcript is, how much of it is readable, where a surface goes.
 *
 * Three things live here because they answer one question each and depend on each other in one
 * direction only:
 *
 *   1. **Finding** — the chat flow anchor, its scroll container, the composer dock.
 *   2. **Measuring** — the readable band (between the top of the transcript and the top of the
 *      composer) and the text column derived from the rows.
 *   3. **Placing** — a popover against a selection, or a panel above a gutter bubble.
 *
 * Navigation depends on this module, never the reverse: finding the anchor and restoring a
 * range is a caller's job, and it uses these lookups rather than re-deriving them.
 *
 * ## Why it is a factory
 *
 * The caches are per instance. A `WeakMap` at module scope would be shared by every plugin
 * instance and would survive a Host factory call, which is not the lifecycle this package has.
 * `createLayout()` is called once per factory call, so a fresh instance starts with empty
 * caches.
 *
 * ## Caches, as they actually are
 *
 * `containerCache` maps a flow to its scroll container, and `columnCache` maps a flow to the
 * text column. Both are `WeakMap`s keyed by the flow element, so a rebuilt transcript leaves the
 * old entries to be collected.
 *
 * Validity is decided per read, not by an observer:
 *   - a cached container is reused only while it still `contains` the flow;
 *   - a cached column is reused only while its element is still `isConnected`.
 *
 * An earlier comment claimed a ResizeObserver cleared `columnCache` on resize. No such call
 * exists, and this module does not add one — that would be a new mechanism, not a move. The
 * `isConnected` check is what actually invalidates a stale column today.
 *
 * ## Side effects
 *
 * `anchorInTranscript` and `anchorAboveBubble` are not pure geometry: they give the scroll
 * container `position: relative` when it computes to `static`, so absolute children have a
 * containing block. That happens once per container, recorded by `data-qc-positioned`, and the
 * marker is set even when the style already allowed absolute children — the marker means "this
 * container has been prepared", not "we changed it".
 *
 * What this module does NOT do: paint highlights, scroll to anything, schedule timers, or read
 * the selection. It reports geometry and the mount target; the caller decides what to do next.
 *
 * ## A recorded nondeterminism, cause unconfirmed
 *
 * OBSERVATION: a surface placed against a selection can land 2px off. Measured in the browser,
 * the same build run repeatedly puts the surface 8px below the selection on some runs and 10px
 * on others, while every input that feeds the arithmetic — selection box, scrollTop, column
 * width, readable band — is identical between those runs. It reproduces on the pre-extraction
 * build at the same rate.
 *
 * CAUSE: not established. An earlier note here claimed the first paint reports a height that
 * later grows; that was an inference from one measurement, not evidence. There is at least one
 * other candidate that has not been excluded: the popover has a `translateY(2px)` entrance
 * animation, so a rect read during the animation and a rect read after it differ by exactly 2px.
 * Excluding it requires sampling the same placement both during and after the animation, which
 * has not been done.
 *
 * Not fixed in this stage, and the explanation should stay "unconfirmed" until the animation is
 * ruled in or out.
 */

/** Never let an anchored surface touch the edges of the readable band. */
const ANCHOR_INSET = 8

/** Gap between the bubble's top edge and the panel's bottom edge, in px. */
const PANEL_BUBBLE_GAP = 10

import { FLOW_SELECTOR } from './text-ranges.js'

/** Surfaces that must never be mistaken for the transcript. */
const SIDEBAR_TAB_SELECTOR = '[data-sidebar-right-tab]'

/** Candidate composer docks, most specific first. */
const COMPOSER_SELECTORS = [
  '[data-slot="conversation.composer.dock"]',
  '[data-slot="conversation.input.dock"]',
  '[data-composer-root]',
]

/**
 * The subtree that can contain annotation chips.
 *
 * Scoping the composer watcher to this instead of `document.body` is what keeps a pane drag from
 * waking it on every frame: the transcript re-renders constantly during a drag, but the composer
 * does not.
 *
 * @returns the element to observe, or null when there is no composer yet.
 */
export function composerContainer() {
  if (typeof document === 'undefined') return null
  const selectors = [
    '[data-slot="conversation.composer.dock"]',
    '[data-slot="conversation.input.dock"]',
    '[data-composer-root]',
    '[contenteditable="true"]',
  ]
  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      if (element.closest('[data-sidebar-right-tab]') !== null) continue
      if (element.getClientRects().length > 0) {
        // Climb to the nearest ancestor that also holds the chips, so a chip
        // inserted next to the editor is still seen.
        return element.closest('[data-composer-root]') ?? element.parentElement ?? element
      }
    }
  }
  return null
}

/**
 * Create one layout helper set.
 * @returns the lookups, measurements and placements.
 */
export function createLayout() {
  /** Cached text-column box per flow element. */
  const columnCache = new WeakMap()

  /** Cached scroll container per flow element. */
  const containerCache = new WeakMap()

  /**
   * The chat flow anchor, excluding anything inside a sidebar tab.
   * @returns the flow element, or null.
   */
  function findFlow() {
    if (typeof document === 'undefined') return null
    let fallback = null
    for (const element of document.querySelectorAll(FLOW_SELECTOR)) {
      if (element.closest(SIDEBAR_TAB_SELECTOR) !== null) continue
      // `display: contents` gives the anchor no box of its own, so measure the rows it
      // contains instead.
      if (element.getClientRects().length > 0 || hasBoxedChild(element)) return element
      if (fallback === null) fallback = element
    }
    // An empty conversation legitimately has no rows yet; keep it rather than claiming the
    // flow does not exist.
    return fallback
  }

  /**
   * Whether an element contains any child that occupies layout.
   * @param element - the candidate container.
   * @returns true when at least one descendant renders a box.
   */
  function hasBoxedChild(element) {
    if (typeof element.getClientRects === 'function' && element.getClientRects().length > 0) return true
    for (const child of element.children) {
      if (hasBoxedChild(child)) return true
    }
    return false
  }

  /**
   * The nearest scrollable ancestor of the chat flow.
   *
   * The transcript is virtualized: rows far outside the viewport are removed from the DOM and
   * re-created when scrolled back into range. Finding the scroller is what makes "scroll until
   * the row comes back" possible.
   *
   * @param flow - the chat flow element.
   * @returns the scrolling element, or null.
   */
  function scrollContainerOf(flow) {
    if (flow === null || flow === undefined) return null
    let node = flow.parentElement
    while (node !== null) {
      const style = getComputedStyle(node)
      if (/(auto|scroll)/.test(`${style.overflowY}`) && node.scrollHeight > node.clientHeight + 4) {
        return node
      }
      node = node.parentElement
    }
    return null
  }

  /**
   * The scroll container of a flow, cached while it still contains the flow.
   * @param flow - the chat flow element.
   * @returns the container, or null.
   */
  function containerFor(flow) {
    if (flow === null || flow === undefined) return null
    const hit = containerCache.get(flow)
    if (hit !== undefined && hit.contains(flow)) return hit
    const found = scrollContainerOf(flow)
    if (found !== null) containerCache.set(flow, found)
    return found
  }

  /**
   * The composer's dock, which bounds the transcript from below.
   * @returns the element, or null when it is not in the DOM.
   */
  function findComposerDock() {
    if (typeof document === 'undefined') return null
    for (const selector of COMPOSER_SELECTORS) {
      for (const element of document.querySelectorAll(selector)) {
        if (element.closest(SIDEBAR_TAB_SELECTOR) !== null) continue
        const box = element.getBoundingClientRect()
        if (box.width > 0 && box.height > 0) return element
      }
    }
    return null
  }

  /**
   * The part of the transcript the user can actually read.
   *
   * Bounded above by the app's top bar and below by the composer, which is height-fluid: it
   * grows with multi-line input and with attachments. The union of both is derived from the
   * scroller's own box intersected with the viewport, then narrowed by whatever chrome sits over
   * it.
   *
   * @param scroller - the transcript's scroll container.
   * @returns the visible rectangle in viewport coordinates.
   */
  function visibleChatArea(scroller) {
    const box = scroller.getBoundingClientRect()
    let top = Math.max(0, box.top)
    let bottom = Math.min(window.innerHeight, box.bottom)
    // Anything docked over the bottom of the transcript clips what the user can see. Take the
    // highest such element that actually overlaps the scroller.
    const composer = findComposerDock()
    if (composer !== null) {
      const dock = composer.getBoundingClientRect()
      if (dock.height > 0 && dock.top > top && dock.top < bottom) bottom = dock.top
    }
    if (bottom - top < 120) {
      // The dock was not found or the arithmetic collapsed; fall back to the scroller's own box
      // so a jump still centres somewhere sensible.
      top = Math.max(0, box.top)
      bottom = Math.min(window.innerHeight, box.bottom)
    }
    return { top, height: Math.max(1, bottom - top) }
  }

  /**
   * Give the container a containing block for absolutely positioned children.
   *
   * Runs at most once per container, recorded by a data attribute. The marker is set even when
   * no style change was needed: it means "prepared", not "modified".
   *
   * @param scroller - the transcript's scroll container.
   */
  function prepareContainer(scroller) {
    if (scroller.dataset.qcPositioned !== '1') {
      if (getComputedStyle(scroller).position === 'static') {
        scroller.style.position = 'relative'
      }
      scroller.dataset.qcPositioned = '1'
    }
  }

  /**
   * Place a surface against the selection, inside the readable chat area.
   *
   * Placement follows the pointer: the surface opens just below the selection, and is only
   * flipped above when there is no room below. Both axes are clamped to the READABLE band, so a
   * surface can never be pushed under the composer or over the top bar, and can never be clipped
   * out of sight at an edge.
   *
   * @param flow - the chat flow anchor.
   * @param box - the selection's viewport box.
   * @param size - the surface's measured size.
   * @param prefer - 'below' to sit under the selection first.
   * @returns the mount target plus container-relative position, or null.
   */
  function anchorInTranscript(flow, box, size, prefer) {
    const scroller = containerFor(flow)
    if (scroller === null || scroller === undefined || box === null) return null
    prepareContainer(scroller)
    const rect = scroller.getBoundingClientRect()
    const width = size.width || 0
    const height = size.height || 0
    // The readable band, expressed in container coordinates.
    const area = visibleChatArea(scroller)
    const bandTop = area.top - rect.top + scroller.scrollTop
    const bandBottom = bandTop + area.height
    // The selection, in the same coordinates.
    const localTop = box.top - rect.top + scroller.scrollTop
    const localBottom = (box.bottom ?? box.top) - rect.top + scroller.scrollTop
    const localLeft = box.left - rect.left + scroller.scrollLeft

    const fitsBelow = localBottom + 8 + height + ANCHOR_INSET <= bandBottom
    const wantAbove = prefer === 'above' || !fitsBelow
    let top = wantAbove ? localTop - height - 8 : localBottom + 8
    // Clamp INSIDE the band: this is what stops a surface from being clipped away at an edge,
    // and equally what stops it from covering the composer.
    const maxTop = Math.max(bandTop + ANCHOR_INSET, bandBottom - height - ANCHOR_INSET)
    top = Math.min(Math.max(bandTop + ANCHOR_INSET, top), maxTop)

    // Horizontally: start at the pointer's left edge, then pull back inside.
    const maxLeft = Math.max(ANCHOR_INSET, scroller.clientWidth - width - ANCHOR_INSET)
    const left = Math.min(Math.max(ANCHOR_INSET, localLeft), maxLeft)

    return { scroller, position: { top, left } }
  }

  /**
   * The vertical space a floating surface may occupy, in viewport pixels.
   *
   * The top edge comes from the app's header when one is present; the bottom edge from the composer.
   * Both are found the same way the rest of this module finds them, so there is one notion of where
   * the chat chrome is.
   *
   * @returns `{ top, bottom, height }` in viewport pixels.
   */
  function readableBand() {
    const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight
    let top = 0
    if (typeof document !== 'undefined') {
      // The app's header: the first element that is fixed or sticky at the top of the page.
      const header = document.querySelector('header')
        ?? document.querySelector('[data-slot="conversation.chat.header"]')
      if (header !== null) {
        const box = header.getBoundingClientRect()
        if (box.height > 0 && box.top <= 0) top = Math.max(0, box.bottom)
      }
    }
    let bottom = viewportHeight
    const dock = findComposerDock()
    if (dock !== null) {
      const box = dock.getBoundingClientRect()
      if (box.height > 0 && box.top > top) bottom = box.top
    }
    return { top, bottom, height: Math.max(1, bottom - top) }
  }

  /**
   * The resting place for the compose panel: centred, with its bottom edge just above the BLOCK.
   *
   * Anchor is the block's top edge, not the selection range's. A drag usually selects part of a
   * paragraph; aligning to the range put the panel over the earlier lines of that same paragraph
   * (measured: -17px and -42px gaps, i.e. overlapping), or hundreds of pixels above it.
   *
   * When there is no room above the block, the panel goes BELOW the block, so it still never covers the
   * text it describes.
   *
   * @param blockBox - the block element's viewport box, from `source.block`.
   * @param size - the panel's width and height.
   * @param options - gap and margin; gap is the clearance kept from the block.
   * @returns the left and top, in viewport pixels.
   */
  function anchorAboveSelection(blockBox, size, options = {}) {
    const gap = options.gap ?? 10
    const margin = options.margin ?? 8
    const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth
    const band = readableBand()

    const left = Math.max(margin, Math.round((viewportWidth - size.width) / 2))

    const spaceAbove = blockBox.top - band.top
    const spaceBelow = band.bottom - blockBox.bottom
    const needed = size.height + gap + margin

    // Above the block: the panel's bottom edge sits one gap above the block's top edge.
    const above = blockBox.top - gap - size.height
    // Below the block: its top edge one gap under the block's bottom edge.
    const below = blockBox.bottom + gap

    if (spaceAbove >= needed) return { left, top: above, edge: 'above' }
    if (spaceBelow >= needed) return { left, top: below, edge: 'below' }

    // Neither side fits. Prefer the side with more room and clamp inside the band; a partly visible
    // panel beats one pushed off-screen.
    const preferred = spaceAbove >= spaceBelow ? above : below
    const highest = band.top + margin
    const lowest = Math.max(highest, band.bottom - size.height - margin)
    return {
      left,
      top: Math.min(Math.max(highest, preferred), lowest),
      edge: spaceAbove >= spaceBelow ? 'above-clamped' : 'below-clamped',
    }
  }

  /**
   * The docked place used once the user starts typing: flush against the nearer edge of the band.
   *
   * "Nearer" is decided from the panel's current resting position, so the panel moves the short way
   * and does not cross the text it belongs to.
   *
   * @param restingTop - where the panel currently sits, in viewport pixels.
   * @param size - `{ width, height }` of the panel.
   * @param options - `{ gap, margin }`; `gap` is the clearance kept from the header or composer.
   * @returns `{ left, top, edge }` in viewport pixels; `edge` is 'top' or 'bottom'.
   */
  function snapPosition(restingTop, size, options = {}) {
    const gap = options.gap ?? 8
    const margin = options.margin ?? 8
    const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth
    const band = readableBand()
    const top = band.top + gap
    const bottom = Math.max(band.top + gap, band.bottom - gap - size.height)
    // Distance to each docked slot from where it rests now.
    const toTop = Math.abs(restingTop - top)
    const toBottom = Math.abs(bottom - restingTop)
    return {
      left: Math.max(margin, Math.round((viewportWidth - size.width) / 2)),
      top: toTop <= toBottom ? top : bottom,
      edge: toTop <= toBottom ? 'top' : 'bottom',
    }
  }

  /**
   * Place the comment panel above a gutter bubble, right edges flush.
   *
   * The bubble is the thing the user clicked, so the panel is positioned against IT rather than
   * against the paragraph: the panel's right edge lines up with the bubble's, and its bottom edge
   * sits a fixed gap above the bubble's top.
   *
   * Offsets are expressed in the scroll container's coordinate space, so the panel rides with
   * the marker on scroll instead of tracking the viewport.
   *
   * @param flow - the chat flow anchor.
   * @param bubble - the bubble's viewport box.
   * @param size - the panel's measured (or assumed) size.
   * @returns the mount target plus container-relative position, or null.
   */
  function anchorAboveBubble(flow, bubble, size) {
    const scroller = containerFor(flow)
    if (scroller === null || scroller === undefined || bubble === null) return null
    prepareContainer(scroller)
    const rect = scroller.getBoundingClientRect()
    const width = size.width || 0
    const height = size.height || 0
    // The readable band, in container coordinates, so the panel cannot slide under the composer
    // or over the top bar.
    const area = visibleChatArea(scroller)
    const bandTop = area.top - rect.top + scroller.scrollTop
    const bandBottom = bandTop + area.height
    // The bubble, in the same space.
    const bubbleTop = bubble.top - rect.top + scroller.scrollTop
    const bubbleRight = bubble.right - rect.left + scroller.scrollLeft
    // EXACT right-edge alignment: the panel is anchored by its RIGHT edge, so its own width never
    // enters the arithmetic. `left` is only a fallback for the first paint, before the panel has
    // reported a width.
    const right = Math.max(ANCHOR_INSET, (rect.width + scroller.scrollLeft) - bubbleRight)
    // The panel finishes the vertical arithmetic itself, using its MEASURED height: only it
    // knows how tall it actually is, and the bottom edge has to clear the bubble exactly.
    const maxTop = Math.max(bandTop + ANCHOR_INSET, bandBottom - height - ANCHOR_INSET)
    const maxLeft = Math.max(ANCHOR_INSET, scroller.clientWidth - width - ANCHOR_INSET)
    const left = Math.min(Math.max(ANCHOR_INSET, bubbleRight - width), maxLeft)
    return {
      scroller,
      position: {
        // Fallback top, for the first paint before the panel has measured itself.
        top: Math.min(Math.max(bandTop + ANCHOR_INSET, bubbleTop - PANEL_BUBBLE_GAP - height), maxTop),
        right,
        left,
        // Everything the panel needs to place its own bottom edge.
        bubbleTop,
        gap: PANEL_BUBBLE_GAP,
        bandTop: bandTop + ANCHOR_INSET,
        bandBottom: bandBottom - ANCHOR_INSET,
      },
    }
  }

  /**
   * The text column's box, derived from the rows inside the flow.
   *
   * The flow element itself is the slot anchor with `display:contents`, so it has no box and
   * reports zeros. The rows it contains are ordinary boxes; the widest one approximates the
   * column, since a short line's box is narrower than the column that contains it.
   *
   * @param flow - the chat flow anchor.
   * @returns the column rectangle and the element it came from, or null.
   */
  function flowColumnBox(flow) {
    if (flow === null) return null
    // Measure the TEXT COLUMN, not the scroll container: the scroller spans the whole
    // conversation pane while the prose is a narrower centred column inside it.
    //
    // The column is the widest mounted row. That costs one rect per row, so it is cached per
    // flow element and reused while the measured element is still connected.
    const cached = columnCache.get(flow)
    if (cached !== undefined && cached.element.isConnected) return cached
    let best = null
    const consider = (element) => {
      const box = element.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return
      if (best === null || box.right > best.box.right) best = { box, element }
    }
    for (const child of flow.querySelectorAll('[data-chat-node-key]')) consider(child)
    if (best !== null) {
      columnCache.set(flow, best)
      return best
    }
    // No row wrappers (or none mounted): fall back to the widest boxed descendant, then to the
    // nearest ancestor that actually occupies layout.
    for (const child of flow.querySelectorAll('*')) {
      if (child.closest(SIDEBAR_TAB_SELECTOR) !== null) continue
      consider(child)
    }
    if (best !== null) {
      columnCache.set(flow, best)
      return best
    }
    let ancestor = flow.parentElement
    while (ancestor !== null) {
      const box = ancestor.getBoundingClientRect()
      if (box.width > 0 && box.height > 0) {
        const found = { box, element: ancestor }
        columnCache.set(flow, found)
        return found
      }
      ancestor = ancestor.parentElement
    }
    return null
  }

  /**
   * Just the column rectangle.
   * @param flow - the chat flow anchor.
   * @returns the rectangle, or null.
   */
  function flowColumn(flow) {
    const found = flowColumnBox(flow)
    return found === null ? null : found.box
  }

  /**
   * The element whose width defines the text column.
   * @param flow - the chat flow anchor.
   * @returns the element, or null.
   */
  function columnElement(flow) {
    const found = flowColumnBox(flow)
    return found === null ? null : found.element
  }

  return {
    composerContainer,
    findFlow,
    scrollContainerOf,
    containerFor,
    findComposerDock,
    visibleChatArea,
    anchorInTranscript,
    anchorAboveBubble,
    anchorAboveSelection,
    snapPosition,
    readableBand,
    flowColumnBox,
    flowColumn,
    columnElement,
  }
}
