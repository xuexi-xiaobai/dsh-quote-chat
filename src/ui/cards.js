/**
 * The annotation strip above the composer: hover cards for the chips in the draft.
 *
 * A reference chip in the draft is one glyph. Its meaning — the quoted passage and the comment —
 * lives in a card that appears while the pointer is on the chip. The card is portalled to the body
 * and pinned to the chip's rectangle, so the composer never clips it.
 *
 * ## The one live dependency
 *
 * `composerContainer` decides which subtree the MutationObserver watches. Watching
 * `document.body` instead woke this component on every DOM change in the app — including the
 * app's own re-render during a pane drag — which is invisible with no annotations and expensive
 * as soon as one exists. Everything else here is React plus two timing constants.
 *
 * ## Lifetimes worth not breaking
 *
 * The observer, the four document/window listeners, the pending animation frame and both timers
 * are all torn down by the effect's cleanup, and every chip the effect marked is unmarked there
 * too. The hover card's exit animation is why a close re-renders as `closing` first and only
 * unmounts after CARD_EXIT_MS.
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { tableHtml } from '../html.js'
import { CHIP_SOURCE } from '../chip-draft.js'
import { attachChipDragging } from '../chip-drag.js'

/** createElement, bound once. */
const h = React.createElement

/** How long the card waits after the pointer leaves before it starts closing. */
const HOVER_LINGER_MS = 260

/** How long the exit animation runs before the card unmounts. */
const CARD_EXIT_MS = 130

/** Never let a card touch the viewport edge. */
const VIEWPORT_MARGIN = 8

/**
 * Create the annotation strip bound to one plugin instance.
 *
 * Call once during wiring: the returned components are stable types, and minting them per render
 * would remount the subtree on every keystroke.
 *
 * @param services - `{ composerContainer }` from the instance's layout.
 * @returns `{ ChipCards, AnnotationCard }`.
 */
export function createCards({ composerContainer }) {
  /**
   * Bind each annotation to its chip and show that chip's card on hover.
   *
   * The chip's look is entirely CSS (see the `[data-composer-chip="quote-chat"]`
   * rules): the host's own decorator renders the label, and a ::before badge fed by
   * `data-qc-num` draws the number. This pass never writes into a chip — its
   * children are the editor's React portal, and mutating them is what once broke
   * typing.
   *
   * The card appears on hover only. Showing it permanently meant it had to track
   * the chip's box at all times, and any drift between measurement and paint left
   * it straddling the wrong characters; on hover it is only ever briefly on screen.
   * @param props - the annotations, the live chip list, labels, and handlers.
   */
  function ChipCards(props) {
    const { annotations, occurrences, labels, onJump, onRemove, setDraft, draft } = props
    // Handlers live in a ref so the effect does not rebuild on every render.
    const actionsRef = React.useRef({ onJump, onRemove })
    actionsRef.current = { onJump, onRemove }
    const [hover, setHover] = React.useState(null)
    // The same value, readable from the DOM handlers without re-binding them.
    const hoverRef = React.useRef(null)
    hoverRef.current = hover

    React.useEffect(() => {
  if (typeof document === 'undefined') return undefined
  let frame = 0
  let timer = 0
  /**
   * When a drag last reordered the draft, so the click that ends that gesture does not also jump to the passage.
   *
   * A drop produces a `click` a few milliseconds later on the element the press started on. Acting on both would move
   * the transcript away from the spot the user just arranged.
   */
  let consumedClickAt = 0
  const dragConsumedClick = () => consumedClickAt !== 0 && Date.now() - consumedClickAt < 400
  /** Pending close, so leaving the chip can be undone by coming back. */
  let closeTimer = 0
  const marked = new Set()

  /** Drop our attributes from one chip. */
  const unmark = (chip) => {
    delete chip.dataset.qcNum
    delete chip.dataset.qcKind
    delete chip.dataset.qcLabel
    delete chip.dataset.qcRef
    marked.delete(chip)
  }

  /**
   * Pair each live chip with the annotation its occurrence names.
   *
   * Pairing is by reference id, not position: a chip the user deleted by hand
   * drops out of `occurrences`, and a positional pairing would then bind every
   * later card one chip to the left.
   * @returns the pairs in DOM order.
   */
  const pairs = () => {
    const refs = occurrences
      .filter((item) => item.source === CHIP_SOURCE)
      .map((item) => item.ref)
    const chips = [...document.querySelectorAll('[data-composer-chip="quote-chat"]')]
      .filter((element) => element.closest('[data-sidebar-right-tab]') === null)
    const result = []
    for (let index = 0; index < chips.length && index < refs.length; index += 1) {
      const annotation = annotations.find((item) => item.id === refs[index])
      if (annotation !== undefined) result.push({ chip: chips[index], annotation })
    }
    return result
  }

  const apply = () => {
    frame = 0
    if (typeof document === 'undefined') return
    const live = new Set()
    // The ordinal is the chip's position among the chips currently in the
    // draft — 1, 2, 3 in visual order — not a stored counter. Annotations that
    // were sent or deleted are still in the store, so numbering from the store
    // drifted upward from one message to the next. Deriving it from the live
    // chip list makes it count what the user can actually see.
    const ordered = pairs()
    for (let position = 0; position < ordered.length; position += 1) {
      const { chip, annotation } = ordered[position]
      const ordinal = position + 1
      live.add(chip)
      chip.dataset.qcNum = String(ordinal)
      chip.dataset.qcKind = annotation.kind === 'table' ? 'table' : 'text'
      chip.dataset.qcLabel = labels.content.replace('{n}', String(ordinal))
      // The chip's identity, for the drag layer: it needs to know which annotation it is moving, and the ordinal is a
      // position that changes as soon as the draft is rewritten.
      chip.dataset.qcRef = annotation.id
      marked.add(chip)
    }
    for (const chip of [...marked]) {
      if (!live.has(chip)) unmark(chip)
    }
  }

  const schedule = () => {
    if (frame !== 0) return
    frame = requestAnimationFrame(apply)
  }
  const debounced = () => {
    clearTimeout(timer)
    timer = setTimeout(schedule, 70)
  }
  schedule()
  /**
   * Watch only what this component actually reacts to.
   *
   * The first version observed `document.body` with `subtree`, so EVERY DOM
   * change anywhere — including the app's own re-render during a pane drag —
   * woke it up and ran `apply()`, which queries every chip and writes dataset
   * attributes. That is invisible when there are no annotations (the component
   * renders nothing and the effect never runs) and expensive the moment one
   * exists, which is exactly the "only slow after adding an annotation" report.
   *
   * The observer is scoped to the composer instead, and a mutation is ignored
   * unless it touches a chip or an attribute this component owns.
   */
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        // Our own dataset writes; there is nothing to recompute from them.
        if (record.attributeName?.startsWith('data-qc')) continue
        if (record.target instanceof Element
          && record.target.closest('[data-composer-chip="quote-chat"]') !== null) {
          debounced()
          return
        }
        continue
      }
      for (const node of record.addedNodes) {
        if (node instanceof Element
          && (node.matches?.('[data-composer-chip="quote-chat"]')
            || node.querySelector?.('[data-composer-chip="quote-chat"]') !== null)) {
          debounced()
          return
        }
      }
      for (const node of record.removedNodes) {
        if (node instanceof Element
          && (node.matches?.('[data-composer-chip="quote-chat"]')
            || node.querySelector?.('[data-composer-chip="quote-chat"]') !== null)) {
          debounced()
          return
        }
      }
    }
  })
  const composerHost = composerContainer()
  if (composerHost !== null) {
    observer.observe(composerHost, { childList: true, subtree: true })
  }

  /** The chip under a pointer event, or null. */
  const chipOf = (event) => (event.target instanceof Element
    ? event.target.closest('[data-composer-chip="quote-chat"]')
    : null)

  /**
   * The annotation a pointer is currently "on", in the loose sense that keeps
   * the × and the card reachable: the chip itself, the ×, or the card.
   * @param event - the pointer event.
   * @returns the annotation, null while inside a floating piece with nothing
   * open, or undefined when the pointer is elsewhere.
   */
  const hoverTargetOf = (event) => {
    const target = event.target instanceof Element ? event.target : null
    if (target === null) return undefined
    const inFloating = target.closest('.qc-card') !== null
      || target.closest('.qc-chip-remove') !== null
    if (inFloating) {
      // Inside the × or the card: keep whatever is showing (null = nothing).
      return hoverRef.current?.annotation ?? null
    }
    const chip = chipOf(event)
    if (chip === null) return undefined
    return pairs().find((pair) => pair.chip === chip)?.annotation
  }

  // One handler for the whole gesture. A pointer that is on neither the chip nor
  // either floating piece clears the hover; anything else keeps it, so moving
  // onto the × or up into the card never blinks the UI away. Handling this on
  // `mouseover` alone also covers leaving the ×, which a chip-scoped `mouseout`
  // could never see.
  const onPointer = (event) => {
    const annotation = hoverTargetOf(event)
    // `undefined` = pointer is elsewhere; `null` = inside a piece with nothing
    // open. Both mean there is nothing to show.
    if (annotation === undefined || annotation === null) {
      // Do not drop the card the instant the pointer leaves. A grace period
      // lets the user travel from the chip to the card (or to the ×) across the
      // gap between them, and returning inside the window cancels the close.
      if (closeTimer === 0) {
        closeTimer = setTimeout(() => {
          closeTimer = 0
          // Mark it closing so the exit animation can run before unmount; the
          // card would otherwise vanish between two frames.
          setHover((current) => (current === null
            ? current
            : { ...current, closing: true }))
          closeTimer = setTimeout(() => {
            closeTimer = 0
            setHover(null)
          }, CARD_EXIT_MS)
        }, HOVER_LINGER_MS)
      }
      return
    }
    if (closeTimer !== 0) {
      clearTimeout(closeTimer)
      closeTimer = 0
    }
    const chip = pairs().find((pair) => pair.annotation.id === annotation.id)?.chip
    if (chip === undefined) return
    const rect = chip.getBoundingClientRect()
    setHover((current) => {
      if (current !== null && current.annotation.id === annotation.id
        && current.anchor.left === Math.round(rect.left)
        && current.anchor.top === Math.round(rect.top)
        && current.anchor.width === Math.round(rect.width)
        && current.anchor.height === Math.round(rect.height)) return current
      return { annotation, anchor: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      } }
    })
  }
  // While open, follow the chip: the composer scrolls and grows as you type.
  const reposition = () => {
    setHover((current) => {
      if (current === null) return current
      const still = pairs().find((pair) => pair.annotation.id === current.annotation.id)
      if (still === undefined) return null
      const rect = still.chip.getBoundingClientRect()
      const next = {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
      if (current.anchor.left === next.left && current.anchor.top === next.top
        && current.anchor.width === next.width && current.anchor.height === next.height) {
        return current
      }
      return { annotation: current.annotation, anchor: next }
    })
  }
  document.addEventListener('mouseover', onPointer, true)
  document.addEventListener('scroll', reposition, true)
  window.addEventListener('resize', reposition)

  // Clicking the chip jumps. `openReference` covers the editor's own activation
  // path; this covers a plain click on the token itself.
  //
  // A click that ENDS a drag must not also jump: the pointer travelled, the draft was reordered, and landing on the
  // passage as well would move the transcript out from under the user's own result.
  const onClick = (event) => {
    if (dragConsumedClick()) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    const chip = chipOf(event)
    if (chip === null) return
    const annotation = pairs().find((pair) => pair.chip === chip)?.annotation
    if (annotation === undefined) return
    event.preventDefault()
    event.stopPropagation()
    actionsRef.current.onJump(annotation)
  }
  document.addEventListener('click', onClick, true)

  // Dragging a chip reorders the draft through the same `setDraft` the rest of the plugin uses; the editor's own DOM is
  // never moved. See `chip-drag.js` for why that split is required.
  //
  // `composerContainer()` is resolved here rather than passed in: the composer can be re-created by the Host without the
  // plugin re-rendering, and a captured element would then reject every later press.
  const detachDrag = attachChipDragging({
    listChips: () => pairs().map((pair) => pair.chip),
    readDraft: () => ({ draft, occurrences }),
    setDraft,
    source: CHIP_SOURCE,
    onMoved: () => {
      consumedClickAt = Date.now()
    },
  })

  return () => {
    if (frame !== 0) cancelAnimationFrame(frame)
    clearTimeout(timer)
    if (closeTimer !== 0) clearTimeout(closeTimer)
    observer.disconnect()
    detachDrag()
    document.removeEventListener('mouseover', onPointer, true)
    document.removeEventListener('scroll', reposition, true)
    window.removeEventListener('resize', reposition)
    document.removeEventListener('click', onClick, true)
    for (const chip of [...marked]) unmark(chip)
  }
    }, [annotations, occurrences, labels])

    if (hover === null) return null
    // The × is drawn inside the chip's left edge, in the slot the kind glyph
    // occupies — the two never show at once. It is a fixed overlay pinned to the
    // chip's own rectangle rather than a chip child, because the chip's contents
    // are the editor's and must not be written into.
    //
    // Positioned by its CENTRE, not its left edge: the glyph's centre is the pill's
    // left padding plus half the glyph, and centring the button there keeps the two
    // concentric at any button size. Anchoring the left edge instead is what made
    // the control sit visibly left of the icon.
    const GLYPH_CENTRE = 7 + (13 / 2) // padding-left + half the glyph box
    const REMOVE_SIZE = 15
    return createPortal(
  h(React.Fragment, null,
    h('button', {
      type: 'button',
      className: 'qc-chip-remove',
      title: labels.remove,
      'aria-label': labels.remove,
      style: {
        left: `${hover.anchor.left + GLYPH_CENTRE}px`,
        top: `${hover.anchor.top + (hover.anchor.height / 2)}px`,
        width: `${REMOVE_SIZE}px`,
        height: `${REMOVE_SIZE}px`,
      },
      onMouseDown: (event) => event.preventDefault(),
      onClick: (event) => {
        event.preventDefault()
        event.stopPropagation()
        setHover(null)
        onRemove(hover.annotation)
      },
    },
    // Two diagonal strokes on a 10×10 grid, meeting at the exact centre (5,5).
    // Drawn rather than typed so it is centred by construction.
    h('svg', { viewBox: '0 0 10 10', 'aria-hidden': 'true', focusable: 'false' },
      h('path', { d: 'M2.6 2.6 L7.4 7.4 M7.4 2.6 L2.6 7.4' }),
    )),
    h(AnnotationCard, {
      annotation: hover.annotation,
      anchor: hover.anchor,
      closing: hover.closing === true,
    }),
  ),
  document.body,
    )
  }

  /**
   * The preview card for one annotation.
   *
   * A compact panel floating above the chip, holding the passage rendered as it
   * appeared in the answer — a real table for a table, formatted text otherwise.
   *
   * Deliberately minimal: no ordinal (the chip already carries it), no removal
   * control (the chip's own × does that), and only as wide as its content needs.
   * @param props - the annotation and its chip rectangle.
   */
  function AnnotationCard(props) {
    const { annotation, anchor, closing = false } = props
    const ref = React.useRef(null)
    const [size, setSize] = React.useState({ width: 0, height: 0 })

    React.useLayoutEffect(() => {
  const element = ref.current
  if (element === null) return
  const box = element.getBoundingClientRect()
  setSize({ width: box.width, height: box.height })
    }, [annotation.id])

    const width = size.width || 280
    const height = size.height || 140
    // Prefer above the chip; drop below when there is no room up there.
    const above = anchor.top - height - 8
    const top = above >= VIEWPORT_MARGIN ? above : anchor.top + anchor.height + 8
    const left = Math.min(
  Math.max(VIEWPORT_MARGIN, anchor.left),
  Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
    )
    return h('div', {
  ref,
  // The closing class runs the exit animation; the parent keeps the card
  // mounted for CARD_EXIT_MS so it can finish.
  className: closing ? 'qc-card qc-card-out' : 'qc-card',
  style: {
    left: `${left}px`,
    top: `${top}px`,
    visibility: size.width === 0 ? 'hidden' : 'visible',
  },
    },
    annotation.comment === ''
  ? null
  : h('div', { className: 'qc-card-comment' }, annotation.comment),
    h('div', { className: 'qc-card-body' },
  annotation.kind === 'table'
    ? h('div', { dangerouslySetInnerHTML: { __html: tableHtml(annotation.text) } })
    : h('div', { dangerouslySetInnerHTML: { __html: annotation.previewHtml ?? '' } }),
    ),
    )
  }
  return { ChipCards: ChipCards, AnnotationCard: AnnotationCard }
}
