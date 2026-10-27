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
 * Located by what it does rather than by a class name, since the app's class names are generated: it is the
 * element that actually scrolls and contains the chat flow.
 *
 * @returns the scrolling element, or null when there is none.
 */
function findScroller() {
  if (typeof document === 'undefined') return null
  const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
  if (flow === null) return null
  for (const element of document.querySelectorAll('*')) {
    if (element.scrollHeight <= element.clientHeight + 8) continue
    if (!element.contains(flow)) continue
    if (element === document.body || element === document.documentElement) continue
    return element
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
  function ComposerPopover(props) {
    const { source, labels, onConfirm, onCancel } = props
    const ref = React.useRef(null)
    const inputRef = React.useRef(null)
    const [comment, setComment] = React.useState('')
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

    // Re-place whenever anything that moves the text happens.
    //
    // The panel is position: fixed and its position is derived from the block's box. Scrolling the transcript
    // or resizing the window moves that box; without this the panel stayed at the old viewport coordinate
    // while the passage slid away — the reported "it does not stick to the text".
    //
    // Registered in the CAPTURE phase: the transcript scrolls an inner container, and a bubble-phase
    // listener on document would never see that event.
    React.useEffect(() => {
      const reposition = () => setViewportTick((tick) => tick + 1)
      window.addEventListener('scroll', reposition, true)
      window.addEventListener('resize', reposition)
      return () => {
        window.removeEventListener('scroll', reposition, true)
        window.removeEventListener('resize', reposition)
      }
    }, [])

    // Only Enter and the confirm button commit; EVERY other dismissal cancels.
    //
    // Clicking elsewhere in the transcript, or on the composer, used to leave the box open with the
    // passage still lit, which read as "my comment is being kept". An outside click is a dismissal
    // like any other, so it cancels — and cancelling clears the highlight.
    React.useEffect(() => {
      const onDown = (event) => {
        if (ref.current !== null && event.target instanceof Node
          && ref.current.contains(event.target)) return
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
    const width = size.width || 420
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
    const fullyVisible = resting.top >= scrollerBox.top - 1 && restingBottom <= scrollerBox.bottom + 1
    const needsRescue = hasInput && !fullyVisible
    const docked = needsRescue && snapPosition
      ? snapPosition(resting.top, { width, height })
      : null
    const inViewport = docked ?? { left: resting.left, top: resting.top }

    // Convert to the container's content space: content = viewport - containerTop + scrollOffset.
    const target = scroller === null
      ? inViewport
      : {
        left: Math.round(inViewport.left - scrollerBox.left + scroller.scrollLeft),
        top: Math.round(inViewport.top - scrollerBox.top + scroller.scrollTop),
      }

    return createPortal(
      h('div', {
        ref,
        className: 'qc-compose',
        role: 'dialog',
        'aria-label': labels.title,
        // The docked slot is a data attribute so the stylesheet can add the transition only when a
        // move is actually happening — the first paint must not animate from the origin.
        'data-docked': docked === null ? 'false' : docked.edge,
        style: {
          left: `${target.left}px`,
          top: `${target.top}px`,
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
      source.kind === 'table'
        ? null
        : h('textarea', {
          ref: inputRef,
          value: comment,
          rows: 2,
          placeholder: labels.placeholder,
          onChange: (event) => setComment(event.target.value),
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
      ),
      // Inside the transcript's scroll container, so the panel is covered and clipped exactly as the text is.
      // Falls back to `body` when there is no container, where `position: fixed` and viewport coordinates apply.
      scroller ?? document.body,
    )
  }

  return { ActionPopup, ComposerPopover }
}
