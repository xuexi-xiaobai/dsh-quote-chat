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
  findFlow, anchorInTranscript, anchorAboveSelection, snapPosition,
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
    const [size, setSize] = React.useState({ width: 0, height: 0 })

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

    // Positioned in VIEWPORT space, mounted on document.body.
    //
    // Three things forced this away from the scroller:
    //
    //   - the scroll container is 417px wide and the panel is 420, so a `left` computed inside it
    //     clamps to the inset and the panel reads 142px left of the window's centre;
    //   - the requirement is expressed in window terms ("above the selected text", "never covered by
    //     the chat box"), which is viewport reasoning;
    //   - the panel now docks against the header or the composer once the user types, and both of
    //     those are viewport-anchored chrome.
    const width = size.width || 420
    // The first paint has no measurement; 170 is a rough guess that survives one frame only. Every
    // later render uses the real height, which is what the placement needs to be exact.
    const height = size.height || 170

    // The resting place: centred, just above the PASSAGE.
    //
    // Not `source.rect`: for a mouse gesture that is the pointer release point, which can sit anywhere
    // inside the passage. Placing "above the pointer" therefore put the panel over the text it was
    // describing. `source.passage` is the selection's own box, which is the thing the requirement
    // refers to. Falls back to the pointer only when no passage box exists.
    // The passage box lives INSIDE rect (selection.js sets rect.passage), not on the source itself.
    // Reading source.passage silently fell back to the pointer rect, which is why three attempts at
    // this fix changed nothing at all.
    // The BLOCK, not the selection range: a drag usually selects part of a paragraph, and aligning to
    // the range put the panel over that paragraph's earlier lines. `source.block` is the element the
    // selection started in, resolved with `closest(BLOCK_SELECTOR)`.
    // The snapshot taken when the selection was read, not a live measurement at render time.
    const blockBox = source.blockRect ?? source.rect?.passage ?? source.rect
    const resting = anchorAboveSelection
      ? anchorAboveSelection(blockBox, { width, height })
      : placeNear(passageBox, { width, height })

    // Once the user has typed something, the panel glides to the nearer edge of the band. The
    // resting position is kept as the "no input yet" answer, so clearing the text puts it back.
    const hasInput = comment.trim() !== ''
    const docked = hasInput && snapPosition
      ? snapPosition(resting.top, { width, height })
      : null
    const target = docked ?? { left: resting.left, top: resting.top }

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
          position: 'fixed',
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
      // Mounted on body: a fixed dialog whose coordinates are viewport coordinates.
      document.body,
    )
  }

  return { ActionPopup, ComposerPopover }
}
