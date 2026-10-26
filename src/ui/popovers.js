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
export function createPopovers({ findFlow, anchorInTranscript }) {
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

    React.useLayoutEffect(() => {
      const element = ref.current
      if (element === null) return
      const rect = element.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
      inputRef.current?.focus()
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

    // Pinned to the annotated block, not to the viewport.
    //
    // The popover used to be position:fixed at a viewport coordinate, so scrolling the page left it
    // hovering over unrelated text. It now mounts as a SIBLING of the annotated block and is
    // positioned from that block's own offset, so it travels with the passage. Being a sibling also
    // keeps it outside the paragraph, and therefore outside any passage highlight.
    const width = size.width || 420
    const height = size.height || 170
    // Same placement rule as the action toolbar: inside the transcript so the container clips it
    // against the chat chrome, clamped to the visible band so it is never cut off at an edge.
    const flow = findFlow()
    const anchored = flow === null
      ? null
      : anchorInTranscript(flow, source.rect, { width, height }, 'below')
    const position = anchored === null
      ? placeNear(source.rect, { width, height })
      : anchored.position

    return createPortal(
      h('div', {
        ref,
        className: 'qc-compose',
        role: 'dialog',
        'aria-label': labels.title,
        style: {
          left: `${position.left}px`,
          top: `${position.top}px`,
          position: anchored === null ? 'fixed' : 'absolute',
        },
        onMouseDown: (event) => event.stopPropagation(),
        onKeyDown: (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onCancel()
          }
        },
      },
      source.previewHtml !== ''
        // The model's own markup, replayed: the preview shows the passage the way the answer showed
        // it, emphasis and math included.
        ? h('div', {
          className: 'qc-compose-preview',
          dangerouslySetInnerHTML: { __html: source.previewHtml },
        })
        : h('div', { className: 'qc-compose-preview' }, source.previewText),
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
      anchored === null ? document.body : anchored.scroller,
    )
  }

  return { ActionPopup, ComposerPopover }
}
