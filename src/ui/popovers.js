/**
 * The two floating surfaces over a selection: the action pair and the comment editor.
 *
 * ## Why these are a factory
 *
 * Both place themselves through the plugin instance's layout — `findFlow` and
 * `anchorInTranscript` are per-instance capabilities, not module-level imports. Passing them as
 * props on every render would be noise, so they are bound once, here.
 *
 * `createPopovers` MUST be called once, during instance wiring, and its result reused. Creating
 * the components inside a render would mint a new component TYPE on every render, and React would
 * unmount and remount the subtree each time: the textarea would lose focus and the measured size
 * would reset on every keystroke. `popovers.js` therefore exports a factory that returns component
 * functions, and the caller holds them.
 *
 * ## Why `placeNear` lives here
 *
 * It is the fallback used only when there is no transcript to anchor into — the popover then falls
 * back to viewport coordinates. It is a pure function of a rect and a size, so it belongs with its
 * only caller rather than in the layout module, which is about the transcript.
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { IconAnnotate, IconSideChat, IconCheck } from '../icons.js'
import { findFlowElement, isInsideTranscript } from '../text-ranges.js'
import { panelMaxWidth } from '../layout.js'

/** createElement, bound once. */
const h = React.createElement

/** Never let a surface touch the viewport edge when it falls back to fixed positioning. */
const VIEWPORT_MARGIN = 8

/** Gap between an anchor and the surface below it, in px. */
const ANCHOR_GAP = 8

/**
 * Find the transcript's scroll container.
 *
 * The compose panel is mounted inside it so that it shares the text's layer: the container clips at its top edge
 * (its box begins at the header's bottom and it has `overflow: auto`) and the composer is sticky above it, so the
 * panel is covered exactly as the text is. Measurement confirmed both behaviours for a child of this container,
 * which is why the panel needs no clip-path and no z-index trick.
 *
 * Located by what it does rather than by a class name, since the app's class names are generated: it is the element
 * that actually scrolls and contains the chat flow. The flow itself is resolved through the shared selector list, so
 * this keeps working on a build that marks the transcript differently.
 *
 * @returns the scrolling element, or null when there is none.
 */
function findScroller() {
  if (typeof document === 'undefined') return null
  const flow = findFlowElement()
  if (flow === null) return null
  // The flow may itself be the scroller, or sit inside one. Walk up from it first, which is both cheaper than
  // scanning every element and bounded by the tree's depth.
  for (let node = flow; node !== null; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) break
    if (node.scrollHeight <= node.clientHeight + 8) continue
    if (node === flow || node.contains(flow)) return node
  }
  return null
}

/**
 * Place a surface near an anchor, inside the viewport.
 *
 * Only used when there is no transcript to anchor into. Coordinates are viewport-relative, which
 * is why the surface switches to `position: fixed` in that case.
 *
 * @param rect - the anchor rectangle.
 * @param size - the surface size.
 * @returns fixed-position coordinates.
 */
function placeNear(rect, size) {
  const width = size.width
  const height = size.height
  let left = rect.left + rect.width / 2 - width / 2
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN))
  let top = rect.top - height - ANCHOR_GAP
  if (top < VIEWPORT_MARGIN) {
    top = Math.min(rect.bottom + ANCHOR_GAP, window.innerHeight - height - VIEWPORT_MARGIN)
  }
  return { left: Math.max(VIEWPORT_MARGIN, left), top: Math.max(VIEWPORT_MARGIN, top) }
}

/**
 * Create the floating surfaces bound to one plugin instance.
 *
 * Call once per instance. The returned functions are stable component types.
 *
 * @param services - `{ findFlow, anchorInTranscript }` from the instance's layout.
 * @returns `{ ActionPopup, ComposerPopover }`.
 */
/**
 * Create the two selection-driven surfaces.
 *
 * @param services - findFlow, anchorInTranscript, anchorAboveSelection, snapPosition.
 *   The last two place the compose panel in viewport space: above the selection at rest, docked to
 *   the header or the composer once the user types.
 */
export function createPopovers({
  findFlow, anchorInTranscript, anchorAboveSelection, snapPosition, readableBand,
}) {
  /**
   * The floating action pair shown over a selected passage.
   * @param props - anchor rect, capability flags, labels, and handlers.
   */
  function ActionPopup(props) {
    const { anchor, canAnnotate, canAsk, labels, onAnnotate, onAsk } = props
    const ref = React.useRef(null)
    const [size, setSize] = React.useState({ width: 0, height: 0 })

    React.useLayoutEffect(() => {
      const element = ref.current
      if (element === null) return
      const rect = element.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    }, [])

    // Inside the transcript (so the container clips it against the chat chrome) and clamped to the
    // visible band (so it is never cut off at an edge).
    const flow = findFlow()
    const measured = { width: size.width || 210, height: size.height || 34 }
    const anchored = flow === null ? null : anchorInTranscript(flow, anchor, measured, 'below')
    const position = anchored === null ? placeNear(anchor, measured) : anchored.position
    return createPortal(
      h('div', {
        ref,
        className: 'qc-popup',
        role: 'toolbar',
        style: {
          left: `${position.left}px`,
          top: `${position.top}px`,
          position: anchored === null ? 'fixed' : 'absolute',
          visibility: size.width === 0 ? 'hidden' : 'visible',
        },
        // The selection must survive the click that chooses an action.
        onMouseDown: (event) => event.preventDefault(),
      },
      h('button', { type: 'button', disabled: !canAnnotate, onClick: onAnnotate },
        h(IconAnnotate, null), labels.annotate),
      h('button', { type: 'button', disabled: !canAsk, onClick: onAsk },
        h(IconSideChat, null), labels.askInSide),
      ),
      anchored === null ? document.body : anchored.scroller,
    )
  }

  /**
   * The annotation editor: a preview of what will be attached, an optional comment, and the
   * confirm pair.
   * @param props - the source, labels, and handlers.
   */
/**
 * The compose panel contents, memoised.
 *
 * The panel re-renders on EVERY animation frame while the transcript reflows: a pane drag re-wraps the text, the block
 * box changes, and the placement has to follow. Rebuilding the textarea, the hint string and the button row on all of
 * those frames was pure waste — none of it depends on the position, only on the comment and the labels.
 *
 * The callbacks are stabilised by the caller so this memo actually holds.
 */
const ComposeBody = React.memo(function ComposeBody(props) {
  const { comment, inputRef, labels, onCancel, onChange, onConfirm, source } = props
  return h(React.Fragment, null,
    source.kind === 'table'
      ? null
      : h('textarea', {
        ref: inputRef,
        value: comment,
        rows: 2,
        placeholder: labels.placeholder,
        onChange,
        onKeyDown: (event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
            event.preventDefault()
            onConfirm(comment)
          }
        },
      }),
    h('div', { className: 'qc-compose-row' },
      h('span', { className: 'qc-compose-hint' },
        source.kind === 'table'
          ? labels.table.replace('{rows}', String(source.rows ?? 0))
          : `${labels.selected.replace('{count}', String(source.previewText.length))} · ${labels.hint}`),
      h('button', { type: 'button', className: 'qc-compose-cancel', onClick: onCancel }, labels.cancel),
      h('button', {
        type: 'button',
        className: 'qc-compose-confirm',
        title: labels.confirm,
        'aria-label': labels.confirm,
        onClick: () => onConfirm(source.kind === 'table' ? '' : comment),
      }, h(IconCheck, null), h('span', { className: 'qc-compose-confirm-text' }, labels.confirm)),
    ),
  )
})

  function ComposerPopover(props) {
    const { source, labels, onConfirm, onCancel } = props
    const ref = React.useRef(null)
    const inputRef = React.useRef(null)
    const [comment, setComment] = React.useState('')
    /** Whether the panel was docked on the previous render; the hysteresis in the placement reads it. */
    const dockedRef = React.useRef(null)
    /**
     * The edge the panel docked to, kept until it is anchored again.
     *
     * Re-deciding "nearest edge" every frame let the choice flip from top to bottom while the anchor block slid around
     * during a drag, which moved the panel by the whole height of the readable band.
     */
    const dockedEdgeRef = React.useRef(null)
    /**
     * The anchor block's top on the previous render.
     *
     * A block that moved since last frame means a reflow is in progress (a pane drag re-wraps the text above the
     * passage). Dock transitions are frozen for as long as that lasts, so the panel cannot flicker between anchored and
     * docked while the content underneath it is being shoved around.
     */
    const previousBlockRef = React.useRef(null)
    /** The latched `top` of the docked slot, so a docked panel does not chase the chrome being re-measured around it. */
    const dockedSlotRef = React.useRef(null)
    /** The container's scroll offset on the previous render, so a scroll can be told from a reflow. */
    const previousScrollTopRef = React.useRef(null)
    // Stable callbacks, so the memoised body does not re-render merely because this component did.
    //
    // The panel re-renders on every animation frame during a reflow; without these, `onChange` would be a new function
    // identity each time and `ComposeBody` would rebuild the textarea and buttons anyway, which is exactly the cost this
    // is meant to remove.
    const onChangeComment = React.useCallback((event) => {
      setComment(event.target.value)
    }, [])
    const onCancelStable = React.useCallback(() => {
      onCancel()
    }, [onCancel])
    const onConfirmStable = React.useCallback((text) => {
      onConfirm(text)
    }, [onConfirm])
    // Bumped on scroll and resize, purely to force a re-render so the placement is recomputed against live
    // geometry. The value itself is never read.
    const [, setViewportTick] = React.useState(0)
    const [size, setSize] = React.useState({ width: 0, height: 0 })

    // The transcript's scroll container, resolved ONCE and cached across renders.
    //
    // The panel is mounted inside it so that it shares the text's layer: the container clips at its top edge (its
    // box begins at the header's bottom, with `overflow: auto`) and the composer is sticky above it, so the panel
    // is covered exactly as the text is. Measurement confirmed both behaviours for a child of this container.
    // This is what the user asked for: text is not clipped by a special effect, it is simply covered.
    //
    // Resolved during the FIRST render only, via a lazy initializer, and stored in a ref afterwards. Resolving it in
    // an effect and storing it in state caused the component to be torn down and remounted on the state update:
    // a mutation observer recorded `.qc-compose` added and removed in the same millisecond, so the panel never
    // became visible. A ref carries the value across renders without triggering one.
    const scrollerRef = React.useRef(undefined)
    if (scrollerRef.current === undefined) {
      scrollerRef.current = findScroller()
    }
    const scroller = scrollerRef.current

    // Make the container the panel's containing block.
    //
    // The container is `position: static`, so an absolutely positioned child would resolve against a distant
    // ancestor AND would not be clipped by the container's `overflow`. `position: relative` establishes the
    // containing block without moving anything, which is what makes the top edge clip exactly as it does for text.
    // Applied in a layout effect so it is in place before the panel is painted.
    React.useLayoutEffect(() => {
      if (scroller === null) return
      if (getComputedStyle(scroller).position === 'static') {
        scroller.style.position = 'relative'
      }
      // Disable scroll anchoring on the transcript while this panel is open.
      //
      // Re-wrapping the text during a pane drag changes the content height above the scroll position, and Chrome's scroll
      // anchoring then adjusts `scrollTop` to keep the visible content still. Measured across one width sweep: scrollTop
      // 893 -> 1441 -> 943. The panel sits at a fixed offset INSIDE this container, so every one of those adjustments
      // carried it up or down the viewport — up to 80px — while its dock state never changed. That is the up-and-down
      // wobble that was reported, and it is not the panel moving at all: it is the page scrolling by itself.
      //
      // Restoring the previous value on unmount keeps the rest of the transcript's behaviour untouched.
      const previousAnchor = scroller.style.overflowAnchor
      scroller.style.overflowAnchor = 'none'
      return () => {
        scroller.style.overflowAnchor = previousAnchor
      }
    }, [scroller])



    // Measured on mount AND whenever the content changes height: typing grows the textarea, and a
    // stale height would place the panel against a box that no longer exists — which is what produced
    // a 2px overlap with the passage.
    React.useLayoutEffect(() => {
      const element = ref.current
      if (element === null) return
      const rect = element.getBoundingClientRect()
      if (rect.width !== size.width || rect.height !== size.height) {
        setSize({ width: rect.width, height: rect.height })
      }
    })

    // Focus once, not on every measurement.
    //
    // `preventScroll` is essential: a plain focus() scrolls the nearest scrollable ancestor so the
    // element is visible, and opening the panel scrolled the transcript by a measured 184px. The panel
    // is fixed-positioned from a snapshot of the block's box, so that scroll left it drawn at the old
    // coordinates while the passage moved underneath — the panel then covered the very text it was
    // describing.
    React.useEffect(() => {
      inputRef.current?.focus({ preventScroll: true })
    }, [])

    // Keep the panel on its passage by watching the passage's POSITION, every frame.
    //
    // The panel's coordinates are derived from the block's live box, so the panel has to be re-placed whenever that box
    // moves. Two separate defects lived here:
    //
    //   1. Only `scroll` and `resize` were listened for. Dragging the transcript's width divider re-wraps the prose and
    //      slides the passage — by a measured 98px during one drag — while `scrollTop` and `window.innerWidth` both
    //      stay put, so neither listener fired. The panel kept its old coordinates and the first scroll afterwards
    //      re-placed it, which the user saw as the panel jumping "like a refresh" (measured: +94px, then -64px).
    //
    //   2. `ResizeObserver` was then tried, on the scroll container and then on the block. That cannot work in general:
    //      a ResizeObserver reports SIZE changes, and a reflow can move a box without changing its size at all. Five of
    //      this transcript's 29 paragraphs keep their exact height while everything after them shifts 25px.
    //
    // A per-frame comparison of the block's own rectangle has neither limitation: it fires for scrolling, for a window
    // resize, for a reflow, for the composer growing, for a sidebar closing, and for anything else that displaces the
    // passage — with no assumptions about which element changed or how. Reading three integers per frame is cheap, and
    // a re-render only happens when one of them actually differs, so an idle panel costs nothing.
    React.useEffect(() => {
      const block = source.block
      let frame = 0
      let primed = false
      let lastTop = null
      let lastLeft = null
      let lastHeight = null
      let lastWidth = null

      const watch = () => {
        frame = window.requestAnimationFrame(watch)
        if (block === null || block === undefined || block.isConnected !== true) return
        const box = block.getBoundingClientRect()
        const top = Math.round(box.top)
        const left = Math.round(box.left)
        const height = Math.round(box.height)
        // WIDTH matters as much as the rest. A sidebar narrowing the column re-wraps the paragraph — its width changes,
        // and therefore where the panel has to sit — while its top can stay put. Comparing only top/left/height missed
        // that entirely, so the panel kept its old placement until some unrelated scroll forced another pass. That is
        // the reported "it does not follow, and only scrolling or a refresh fixes it".
        const width = Math.round(box.width)
        // The first reading only records the baseline: the render that mounted the panel already placed it against
        // this box, so re-rendering here would be wasted work.
        if (primed === false) {
          primed = true
          lastTop = top
          lastLeft = left
          lastHeight = height
          lastWidth = width
          return
        }
        if (top === lastTop && left === lastLeft && height === lastHeight && width === lastWidth) return
        lastTop = top
        lastLeft = left
        lastHeight = height
        lastWidth = width
        setViewportTick((tick) => tick + 1)
      }

      frame = window.requestAnimationFrame(watch)
      return () => {
        if (frame !== 0) window.cancelAnimationFrame(frame)
      }
    }, [source.block])

    // Dismissal: only a click inside the transcript cancels; the surrounding chrome does not.
    //
    // The rule used to be "any click outside the panel cancels". That made the panel fragile in a way the user hit
    // immediately: adjusting a side panel, glancing at the header, or reaching for the composer all threw away the
    // comment being typed. The draft is the user's work, so chrome that is merely adjacent to the passage must not
    // destroy it.
    //
    // Now: a click INSIDE the transcript's scroll container cancels (the user has moved on to another passage, and
    // cancelling also clears the highlight, which is what they expect). A click anywhere else — the left rail, the
    // right sidebar, the header, the composer, the window's own chrome — leaves the panel and its text untouched.
    //
    // `scroller` is the container the panel is mounted into, so "inside it" is exactly the text flow. The panel itself
    // lives INSIDE that container, which is why its own clicks are excluded first.
    React.useEffect(() => {
      const onDown = (event) => {
        const target = event.target
        if (!(target instanceof Node)) return
        if (ref.current !== null && ref.current.contains(target)) return
        // The dock has its own handler that closes the surface; both call `isInsideTranscript`, so the region that
        // dismisses cannot differ between them. Kept here too because the popover can be mounted on its own (no
        // container), where the dock's rule is not enough to close it.
        if (isInsideTranscript(target) === false) return
        onCancel()
      }
      const onKey = (event) => {
        if (event.key === 'Escape') onCancel()
      }
      document.addEventListener('mousedown', onDown, true)
      document.addEventListener('keydown', onKey, true)
      return () => {
        document.removeEventListener('mousedown', onDown, true)
        document.removeEventListener('keydown', onKey, true)
      }
    }, [onCancel])

    // Placement is computed in VIEWPORT coordinates by the helpers below, then converted into the container's
    // content space at the very end. Keeping the helpers unchanged matters: they were measured and corrected
    // against real behaviour (above the BLOCK's top edge, never flipping sides), and rewriting them in container
    // coordinates would risk reintroducing faults that took several rounds to find.
    // The panel's width follows the TEXT COLUMN, not the viewport.
    //
    // It was `min(420px, 92vw)` in the stylesheet, which knows nothing about the transcript column. A sidebar sliding in
    // narrows the column to less than that, the panel overhangs it, and the sidebar paints over the panel's controls.
    //
    // `panelMaxWidth` reads the column's live box, so the panel shrinks with it. The measured width also feeds the
    // placement maths below, which keeps the panel inside the column instead of straddling the boundary.
    const columnLimit = panelMaxWidth(findFlowElement())
    const width = columnLimit === null ? (size.width || 420) : Math.min(size.width || 420, columnLimit)
    // The first paint has no measurement; 170 is a rough guess that survives one frame only. Every
    // later render uses the real height, which is what the placement needs to be exact.
    const height = size.height || 170

    // The LIVE box of the block being annotated, in viewport coordinates.
    //
    // Not the snapshot: a snapshot made the panel lag behind the text when the transcript scrolled, and made the
    // resting place depend on the drag direction, because it captured one rectangle at read time from whichever
    // end of the range the gesture started at.
    const liveBlock = source.block
    const blockBox = (liveBlock !== undefined && liveBlock !== null && liveBlock.isConnected === true)
      ? liveBlock.getBoundingClientRect()
      : (source.blockRect ?? source.rect?.passage ?? source.rect)
    const resting = anchorAboveSelection
      ? anchorAboveSelection(blockBox, { width, height })
      : placeNear(source.rect?.passage ?? source.rect, { width, height })

    // The container's box: needed both to decide whether the panel is visible and to convert the coordinates.
    //
    // With no container the panel is mounted on `document.body`, and the conversion below is the identity because
    // the offsets are zero. One conversion serves both cases, so there is no second code path to keep in step.
    const scrollerBox = scroller === null
      ? { top: 0, left: 0, bottom: typeof window === 'undefined' ? 0 : window.innerHeight }
      : scroller.getBoundingClientRect()

    // Typing moves the panel ONLY when it has drifted out of the visible area.
    //
    // The earlier rule was "once there is text, glide to the nearer edge". That was written when the panel was
    // fixed-positioned and could be parked anywhere on screen, including off it. Now the panel lives in the scroll
    // container, so it can be scrolled out of view like any text — and that is the only situation that needs
    // rescuing.
    //
    // When the panel is fully visible its position is already correct: its bottom edge sits just above the block it
    // annotates. Moving it in that state takes it AWAY from the passage the user is describing, and a measured 96px
    // jump reads as a misclick. So:
    //
    //   - fully visible -> stay put, keep the passage anchored;
    //   - any part outside the visible area -> glide to the nearer edge, bringing it back where it can be used.
    //
    // Clearing the text restores the resting position, unchanged from before.
    const hasInput = comment.trim() !== ''
    const restingBottom = resting.top + height

    // HYSTERESIS, not a single threshold.
    //
    // Re-wrapping while a pane boundary is dragged moves the ANCHOR BLOCK itself: measured, the block's top travelled
    // 148px as the column narrowed and widened again. That pushed the panel across the visibility threshold, which
    // docked it to the bottom edge, and the next frame pushed it back — the panel visibly oscillated up and down even
    // though the user never touched it. A single threshold cannot be stable there: the boundary is crossed by the
    // content moving under the panel, not by the user asking for anything.
    //
    // So the two directions use different thresholds. Once docked, the panel stays docked until it would be COMFORTABLY
    // visible again (a full panel-height of margin); once anchored, it only docks when it is clearly out of view. That
    // gap is wider than any single frame's reflow, so the state cannot flicker.
    const DOCK_MARGIN = 24
    const wasDocked = dockedRef.current !== null
    const clearlyOut = resting.top < scrollerBox.top - DOCK_MARGIN
      || restingBottom > scrollerBox.bottom + DOCK_MARGIN
    const comfortablyVisible = resting.top >= scrollerBox.top + DOCK_MARGIN
      && restingBottom <= scrollerBox.bottom - DOCK_MARGIN

    // FREEZE the dock decision while the anchor is being REFLOWED — not while it is merely scrolled.
    //
    // A pane drag re-wraps the text above the passage and moves the block by up to 150px, far more than any hysteresis
    // margin, so the panel kept crossing the threshold and alternating between anchored and docked (measured: 12 frames
    // where the panel moved while its block held still, dock state flipping between 'false' and 'bottom').
    //
    // A scroll also moves the block, but that is the normal case and the panel must be free to dock then — freezing on
    // any movement at all stopped the panel from ever docking while the transcript scrolled.
    //
    // So: freeze only when the block moved AND the scroll offset did not.
    const anchorMoved = blockBox !== undefined && blockBox !== null
      && previousBlockRef.current !== null
      && Math.abs(Math.round(blockBox.top) - previousBlockRef.current) > 1
    const scrollMoved = previousScrollTopRef.current !== null
      && Math.abs((scroller === null || scroller === undefined ? 0 : scroller.scrollTop)
        - previousScrollTopRef.current) > 1
    const frozen = anchorMoved && scrollMoved === false
    const needsRescue = frozen
      ? wasDocked
      : hasInput && wasDocked
        ? clearlyOut && comfortablyVisible === false
        : resting.top < scrollerBox.top - 1 || restingBottom > scrollerBox.bottom + 1
    previousBlockRef.current = blockBox === undefined || blockBox === null
      ? null : Math.round(blockBox.top)
    previousScrollTopRef.current = scroller === null || scroller === undefined ? 0 : scroller.scrollTop

    // Lock the CHOSEN EDGE while docked.
    //
    // `snapPosition` picks whichever edge is nearer to the panel's current position. With the anchor block sliding up
    // and down by 250px during a drag, that "nearer edge" flips between top and bottom — and the panel jumps the full
    // height of the readable band. The user reported exactly this: up and down, repeatedly, while only a pane boundary
    // moved.
    //
    // Once an edge is chosen it is kept until the panel is anchored again. Re-choosing every frame is what allowed the
    // flip; comparing the panel's live position to a band that is itself being re-measured cannot be stable.
    const lockedEdge = dockedEdgeRef.current
    // LATCH the docked slot's coordinates when the dock is entered, and keep them while it lasts.
    //
    // `snapPosition` derives the slot from `readableBand()`, which re-measures the top bar and the composer every frame.
    // The composer's height changes during a reflow (its own text re-wraps), so the derived slot moved by up to 80px
    // while the panel was supposed to be sitting still in it — measured as a 80px spread across 80 docked frames. A
    // docked panel must not chase the chrome that is being re-measured around it.
    let dockedSlot = null
    if (needsRescue && snapPosition) {
      const computed = snapPosition(resting.top, { width, height, edge: lockedEdge })
      const latched = dockedSlotRef.current
      // Only the VERTICAL slot is latched, and it is NOT keyed on the panel's width.
      //
      // Keying it on width looked reasonable and was wrong: while a boundary is dragged the panel's width changes every
      // frame (it follows the column), so the latch was invalidated on every frame and re-derived `top` from a band that
      // was being re-measured mid-reflow. That is what produced the stray 132 and 109 readings on a panel whose
      // neighbours were steady at 84. The horizontal position may follow the column; the vertical slot must be a
      // constant once docked.
      if (latched !== null && latched.edge === computed.edge) {
        dockedSlot = { left: computed.left, top: latched.top, edge: computed.edge }
      } else {
        dockedSlot = computed
      }
    }
    const docked = dockedSlot
    dockedRef.current = docked
    dockedEdgeRef.current = docked === null ? null : docked.edge
    dockedSlotRef.current = docked === null
      ? null
      : { top: docked.top, edge: docked.edge }
    const inViewport = docked ?? { left: resting.left, top: resting.top }

    // Convert to the container's content space: content = viewport - containerTop + scrollOffset.
    const target = scroller === null
      ? inViewport
      : {
        left: Math.round(inViewport.left - scrollerBox.left + scroller.scrollLeft),
        top: Math.round(inViewport.top - scrollerBox.top + scroller.scrollTop),
      }

    // Glide across a dock-state change; track scroll frame-by-frame.
    //
    // `docked` flips between null and {edge} exactly when the panel starts or stops being pinned to an edge. Only that
    // discrete move is animated: while docked the target is an edge that shifts with every scroll frame, and a
    // transition there makes the panel trail the content — the "inertia" that was reported.
    //
    // A REFLOW is different again, and it is what the user sees as up-and-down wobbling. Dragging a pane boundary
    // re-wraps the text ABOVE the passage, which shoves the anchor block up or down by a measured 150px; the panel
    // follows it, because staying glued to the passage is the required behaviour. But following it frame by frame, with
    // no interpolation, reads as the panel shaking. So a reflow-driven move is animated too, with the SAME WAAPI call
    // used for a dock change — while a scroll-driven move stays instant, since it must not trail the text.
    //
    // The two are told apart by whether the container's scroll offset changed: a reflow moves the block without
    // scrolling, a scroll moves it by scrolling.
    //
    // The animation uses the Web Animations API rather than a CSS transition on `top`. A CSS transition cannot work
    // here: the attribute that would enable it and the new position are committed together, so the browser has no
    // previous value to interpolate from and the move lands instantly (measured: 84 -> 97 within one frame, no
    // intermediate positions painted). WAAPI takes the previous VIEWPORT top explicitly, so it does not depend on
    // stylesheet timing at all.
    const dockedEdge = docked === null ? null : docked.edge
    const previousEdgeRef = React.useRef(undefined)
    const previousTopRef = React.useRef(null)
    const previousScrollRef = React.useRef(null)
    /** The running glide, so it can be stopped before measuring. */
    const glideRef = React.useRef(null)
    React.useLayoutEffect(() => {
      const element = ref.current
      if (element === null) return

      // Measure the position WITHOUT any running glide's transform.
      //
      // `getBoundingClientRect()` includes the transform an in-flight animation is painting, so reading it while a glide
      // was running fed the interpolated offset back into the next `delta`. That is a positive feedback loop: each frame
      // computed a larger delta than the last and the panel's top exploded — measured 101 -> 1252 -> 53171 -> 2492324 ->
      // 16777216 in five frames, after which the element was unmounted.
      //
      // Cancelling the previous glide first makes every reading the true layout position, so `delta` describes only the
      // movement that actually happened since the last frame.
      const running = glideRef.current
      glideRef.current = null
      if (running !== null && running !== undefined) {
        try { running.cancel() } catch { /* already finished */ }
      }
      const viewportTop = element.getBoundingClientRect().top
      const previousEdge = previousEdgeRef.current
      const previousTop = previousTopRef.current
      const previousScroll = previousScrollRef.current
      const scrollNow = scroller === null || scroller === undefined ? 0 : scroller.scrollTop
      // A scroll moves the block by changing the scroll offset; a reflow moves it without touching the offset.
      const scrolled = previousScroll !== null && scrollNow !== previousScroll
      const edgeChanged = previousEdge !== undefined && previousEdge !== dockedEdge
      if (previousTop !== null) {
        const delta = previousTop - viewportTop
        // Animate when the dock state changed (a deliberate move), or when the block was shoved by a REFLOW while the
        // scroll offset stayed put. A scroll-driven move is left alone: it must track the text exactly, and easing it is
        // the "panel trails the content" defect that was already fixed once.
        const reflowed = scrolled === false && previousEdge === dockedEdge
        // Animate the MOVE INTO or OUT OF a dock (edgeChanged), and a reflow-driven move while anchored. While the panel
        // is docked the target is a constant screen slot that does not follow the reflow at all, so a glide there only
        // smears a settled position — measured stray tops of 132 and 109 on frames whose neighbours were steady at 84.
        const settledDocked = dockedEdge !== null && edgeChanged === false
        if (Math.abs(delta) > 2 && Math.abs(delta) < 400
          && typeof element.animate === 'function'
          && settledDocked === false && (edgeChanged || reflowed)) {
          // A reflow can shove the block by 150px in one frame; easing that over 260ms would visibly lag the passage. The
          // reflow glide is therefore short — enough to remove the frame-to-frame shake without detaching from the text.
          // The 400px ceiling is a guard: a real move is never that large, so a bigger `delta` means the measurement is
          // untrustworthy and animating it would make things worse.
          glideRef.current = element.animate(
            [{ transform: `translateY(${delta}px)` }, { transform: 'none' }],
            { duration: edgeChanged ? 260 : 90, easing: 'cubic-bezier(.22,.61,.36,1)' },
          )
        }
      }
      previousEdgeRef.current = dockedEdge
      previousTopRef.current = viewportTop
      previousScrollRef.current = scrollNow
    })

    return createPortal(
      h('div', {
        ref,
        className: 'qc-compose',
        role: 'dialog',
        'aria-label': labels.title,
        // The docked slot, exposed for the stylesheet and for probes. The glide itself is done with WAAPI above.
        'data-docked': docked === null ? 'false' : docked.edge,
        style: {
          left: `${target.left}px`,
          top: `${target.top}px`,
          // Capped by the text column when it can be measured. The stylesheet's `min(420px, 92vw)` is a viewport rule:
          // with a sidebar open the column can be narrower than that, and the panel then overhangs it.
          width: columnLimit === null ? undefined : `${Math.round(width)}px`,
          // Absolute inside the transcript's scroll container, so the panel shares the text's layer. The container
          // clips it at its top edge and the composer covers it at the bottom, exactly as happens to text — no
          // clip-path, no z-index trick, and no scroll listener needed for the resting position.
          position: scroller === null ? 'fixed' : 'absolute',
        },
        onMouseDown: (event) => event.stopPropagation(),
        onKeyDown: (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onCancel()
          }
        },
      },
      h(ComposeBody, {
        comment,
        inputRef,
        labels,
        onCancel: onCancelStable,
        onChange: onChangeComment,
        onConfirm: onConfirmStable,
        source,
      }, `qc-compose-body-${source.kind}`),
      ),
      // Inside the transcript's scroll container, so the panel is covered and clipped exactly as the text is.
      // Falls back to `body` when there is no container, where `position: fixed` and viewport coordinates apply.
      scroller ?? document.body,
    )
  }

  return { ActionPopup, ComposerPopover }
}




