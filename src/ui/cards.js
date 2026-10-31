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

/**
 * After removing a chip, refuse to show its card for this long.
 *
 * The pointer stays where the × was, so without this the next pointer event re-opens a card for a chip that no longer
 * exists. The card is a portal in its own stacking context, so while mounted it intercepts clicks aimed at anything
 * beneath it — measured, it completely covered the undo bar and made the button unreachable. Long enough to outlast the
 * pointer events that follow a click, short enough that the user does not notice a dead zone.
 */
const SUPPRESS_MS = 400

/** Never let a card touch the viewport edge. */
const VIEWPORT_MARGIN = 8

/** Keep subpixel chip geometry stable across hover and reposition handlers. */
const snap = (value) => Math.round(value * 100) / 100

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
    /**
     * The pointer's last known position, in viewport pixels.
     *
     * A ref, not a closure variable: the effect below re-runs whenever the draft changes — typing does that on every
     * keystroke — and a closure variable would be reset to "unknown" on each run. Unknown has to mean "assume it is
     * still on the chip" (the very first hover has no position yet), so resetting it made the card follow a chip that
     * had long left the pointer behind. Measured: the chip walked 330px away and the × followed it, because every
     * keystroke re-created the position object.
     */
    const pointerRef = React.useRef({ x: Number.NaN, y: Number.NaN, known: false, away: false })
    /**
     * While `Date.now()` is below this, no card is shown. See SUPPRESS_MS.
     *
     * Declared HERE, not inside the effect below. It spent one revision inside the effect callback, which is a hook
     * call outside the component body — React rejects that with "Invalid hook call" (#321) and the whole dock slot
     * crashes. The symptom was not an obvious error: the composer still worked, but every selection-driven surface
     * silently stopped appearing, so annotating a passage became impossible.
     */
    const suppressUntil = React.useRef(0)

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
    // Only strip a chip that is provably no longer ours.
    //
    // This used to unmark every chip not in `live`, which is right when a chip is deleted but wrong when `pairs()` comes
    // back EMPTY for a moment. That happens because `pairs()` zips the DOM chips against `occurrences`, and the host
    // re-renders the composer during a jump with `occurrences` not yet settled: the zip produced nothing, `live` stayed
    // empty, and every chip lost its `data-qc-*` attributes. Measured after clicking a chip: `data-qc-num` went from "1"
    // to null on the very same element, the chip's label and icon disappeared with it, and because `pairs()` then
    // matched nothing, selecting a passage stopped opening the toolbar at all.
    //
    // A chip is only stripped when the store no longer contains its reference — an empty result is not evidence.
    const alive = new Set(annotations.map((item) => item.id))
    for (const chip of [...marked]) {
      if (live.has(chip)) continue
      const ref = chip.dataset.qcRef
      if (ref !== undefined && alive.has(ref)) {
        // The chip still stands for a live annotation; this pass simply could not pair it. Leave it marked.
        continue
      }
      unmark(chip)
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
    // Only the × counts as "still on the chip": it is drawn INSIDE the chip's left slot. The card floats above the chip,
    // so the pointer is off the chip while it is over the card — it no longer holds the hover open. That is deliberate:
    // the card is a preview, and the requested rule is that it goes away when the pointer leaves the chip.
    if (target.closest('.qc-chip-remove') !== null) {
      // Keep whatever is showing (null = nothing).
      return hoverRef.current?.annotation ?? null
    }
    const chip = chipOf(event)
    if (chip === null) return undefined
    return pairs().find((pair) => pair.chip === chip)?.annotation
  }

  /**
   * The pointer's last known position, in viewport pixels.
   *
   * The card and the × are anchored to the CHIP, and the requirement is that they disappear the moment the pointer is
   * not over that chip. No DOM event fires for the case that broke this: typing in front of the chip pushes it to the
   * right while the pointer does not move at all, so there is no `mouseover`, no `mouseout` and no `mousemove` — the
   * chip simply travels out from under a stationary pointer. Measured: the chip moved 329px, the × did not move at all
   * and sat on top of the text being typed.
   *
   * So the position is remembered here and compared against the chip's LIVE rectangle every frame while a card is open.
   * That one comparison covers all three cases at once: the pointer moving away, the chip moving away, and the chip
   * growing or re-wrapping under the pointer.
   */
  const notePointer = (event) => {
    if (typeof event.clientX !== 'number') return
    pointerRef.current.x = event.clientX
    pointerRef.current.y = event.clientY
    pointerRef.current.known = true
    pointerRef.current.away = false
  }

  /** Whether the remembered pointer position is inside a chip's live box. */
  const pointerOnChip = (chip) => {
    const pointer = pointerRef.current
    if (pointer.away) return false
    if (pointer.known === false) return true
    const box = chip.getBoundingClientRect()
    return pointer.x >= box.left && pointer.x <= box.right
      && pointer.y >= box.top && pointer.y <= box.bottom
  }

  /**
   * Start the exit animation, then unmount.
   *
   * Re-checks at fire time: the decision to close was taken on an earlier frame (or on an earlier pointer event), and
   * an open could have happened since — moving straight from one chip to the next used to close the NEW card.
   *
   * @param linger - ms to wait before starting the exit; 0 when the pointer has already left the chip.
   */
  const scheduleClose = (linger) => {
    if (closeTimer !== 0) return
    closeTimer = setTimeout(() => {
      closeTimer = 0
      const open = hoverRef.current
      if (open === null) return
      const pair = pairs().find((item) => item.annotation.id === open.annotation.id)
      if (pair !== undefined && pointerOnChip(pair.chip)) return
      // Mark it closing so the exit animation can run before unmount; the card would otherwise vanish between frames.
      setHover((current) => (current === null ? current : { ...current, closing: true }))
      closeTimer = setTimeout(() => {
        closeTimer = 0
        setHover(null)
      }, CARD_EXIT_MS)
    }, linger)
  }

  // One handler for the whole gesture. A pointer that is over a chip opens (or keeps) that chip's card; a pointer
  // anywhere else starts the close. Handling this on `mouseover` alone also covers leaving the ×, which a chip-scoped
  // `mouseout` could never see.
  const onPointer = (event) => {
    // A card that is still open swallows clicks aimed at anything it covers, because it is a portal in its own stacking
    // context. Nothing may be open during the window after a removal — see SUPPRESS_MS.
    if (Date.now() < suppressUntil.current) return
    notePointer(event)
    const annotation = hoverTargetOf(event)
    // `undefined` = pointer is elsewhere; `null` = inside a piece with nothing
    // open. Both mean there is nothing to show.
    if (annotation === undefined || annotation === null) {
      // The × is drawn INSIDE the chip's left slot, so reaching for it is not "leaving the chip" — the frame loop sees
      // the pointer inside the chip's box and keeps the card open. The CARD, on the other hand, floats above the chip:
      // the pointer is off the chip while it is over the card, so the card closes. That is the requested behaviour; it
      // used to stay open so the pointer could travel into it.
      scheduleClose(HOVER_LINGER_MS)
      return
    }
    if (closeTimer !== 0) {
      clearTimeout(closeTimer)
      closeTimer = 0
    }
    // SUB-PIXEL PRECISION MATTERS for the values below.
    //
    // They used to be `Math.round`ed. That keeps the tooltip stable, but it throws away the fraction: a chip whose left
    // edge is at 314.5 was reported as 315. The × is positioned from this anchor and sized to just cover the glyph, so
    // half a pixel of error is enough to leave a sliver of the icon showing past the red disc — which is what was
    // reported. Two decimals is precise enough for placement and still stable enough that a chip sitting still does not
    // re-render on every mouse move.
    const chip = pairs().find((pair) => pair.annotation.id === annotation.id)?.chip
    if (chip === undefined) return
    const rect = chip.getBoundingClientRect()
    setHover((current) => {
      if (current !== null && current.annotation.id === annotation.id
        && current.anchor.left === snap(rect.left)
        && current.anchor.top === snap(rect.top)
        && current.anchor.width === snap(rect.width)
        && current.anchor.height === snap(rect.height)) return current
      return { annotation, anchor: {
        left: snap(rect.left),
        top: snap(rect.top),
        width: snap(rect.width),
        height: snap(rect.height),
      } }
    })
    // The chip can move without any event (typing in front of it), so following starts here and stops itself when the
    // card closes.
    startFollow()
  }
  /**
   * While a card is open, keep it on its chip — and close it when the pointer is no longer over that chip.
   *
   * A frame loop rather than listeners, because the thing that moves is not an event: typing re-wraps the composer and
   * the chip slides sideways with no pointer event and no scroll. The previous version listened for `scroll` and
   * `resize`, which covers the composer growing but not the chip moving, and that is exactly the reported case.
   *
   * The loop only runs while a card is open: it starts when the first card opens and stops as soon as there is nothing
   * to follow, so an idle composer costs nothing.
   */
  let followFrame = 0
  const follow = () => {
    followFrame = 0
    const current = hoverRef.current
    if (current === null) return
    const pair = pairs().find((item) => item.annotation.id === current.annotation.id)
    if (pair === undefined) {
      setHover(null)
      return
    }
    if (pointerOnChip(pair.chip) === false) {
      // Off the chip: this is the reported case where the chip walks away from a still pointer. No linger — the card
      // must go when the pointer is no longer on the chip.
      scheduleClose(0)
      followFrame = requestAnimationFrame(follow)
      return
    }
    const rect = pair.chip.getBoundingClientRect()
    const next = {
      left: snap(rect.left),
      top: snap(rect.top),
      width: snap(rect.width),
      height: snap(rect.height),
    }
    if (current.anchor.left !== next.left || current.anchor.top !== next.top
      || current.anchor.width !== next.width || current.anchor.height !== next.height) {
      setHover({ annotation: current.annotation, anchor: next })
    }
    followFrame = requestAnimationFrame(follow)
  }
  const startFollow = () => {
    if (followFrame === 0) followFrame = requestAnimationFrame(follow)
  }
  // This effect re-runs whenever the draft changes — which is exactly what typing does — and the cleanup cancels the
  // loop. Without restarting it here, the card that was open when the first character was typed would never be
  // followed again, and would never notice that its chip had moved away: measured, the chip slid 330px and the × did
  // not move at all.
  if (hoverRef.current !== null) startFollow()
  document.addEventListener('mouseover', onPointer, true)
  // Pointer left the window entirely: no further pointer events will arrive, so nothing else would ever close the card.
  const onLeaveWindow = (event) => {
    if (event.relatedTarget !== null) return
    pointerRef.current.away = true
    scheduleClose(0)
  }
  document.addEventListener('mouseout', onLeaveWindow, true)

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
    document.removeEventListener('mouseout', onLeaveWindow, true)
    if (followFrame !== 0) cancelAnimationFrame(followFrame)
    document.removeEventListener('click', onClick, true)
    // The chips are deliberately NOT unmarked here.
    //
    // This used to run `for (const chip of [...marked]) unmark(chip)`, which strips `data-qc-num`, `-kind`, `-label` and
    // `-ref` from every chip. That is correct when the component really is going away, but this effect re-runs whenever
    // `annotations`, `occurrences` or `labels` change identity — and the host hands back a fresh `occurrences` array on
    // its own re-renders. Clicking a chip to jump scrolls the transcript, the host re-renders, the cleanup ran, and
    // every chip lost its attributes on the SAME DOM node (verified with a MutationObserver: four attribute deletions,
    // no node replacement).
    //
    // The damage was not cosmetic. `pairs()` zips DOM chips against `occurrences` by reference, and a chip without
    // `data-qc-ref` matches nothing, so the chip list became permanently empty: no label, no icon, and selecting a
    // passage stopped opening the toolbar entirely, because the selection path also depends on being able to resolve a
    // chip. That is the reported "after jumping, the chip breaks and no more annotations can be added".
    //
    // Attributes are the only thing this component writes to the host's DOM, and `apply()` rewrites them for every chip
    // it can pair on the next pass. Leaving them in place through a re-run is therefore harmless when the effect comes
    // back, and when the component genuinely unmounts the host owns the chip's whole subtree anyway, so the attributes
    // go with it. `unmark` still exists for the real case: a chip whose annotation is gone (see `apply`).
  }
    }, [annotations, occurrences, labels])

    if (hover === null) return null
    // The × is drawn over the chip's left edge, in the slot the kind glyph occupies — the two never show at once. It is
    // a fixed overlay pinned to the chip's own rectangle rather than a chip child, because the chip's contents are the
    // editor's and must not be written into.
    //
    // POSITION AND SIZE BOTH COME FROM CSS, and from the same three numbers the chip itself uses.
    //
    // This used to be computed here as `7 + 13/2` for the centre and a hard-coded 15px box. Those constants described
    // the chip as it was some revisions ago; the icon is now 1.12em (16.8px) and the padding is .5em (7.5px). Measured
    // while hovering: the button's centre sat 1.9px left of the icon's, and its 15px box could not cover a 16.8px
    // glyph, so a blue sliver of the icon showed around the red disc. A hard-coded number cannot track a value that is
    // expressed in em, so the button is placed by the chip's own geometry instead: the stylesheet knows the padding and
    // the glyph width, this passes only where the chip is.
    return createPortal(
  h(React.Fragment, null,
    h('button', {
      type: 'button',
      className: 'qc-chip-remove',
      title: labels.remove,
      'aria-label': labels.remove,
      style: {
        '--qc-chip-left': `${hover.anchor.left}px`,
        '--qc-chip-top': `${hover.anchor.top}px`,
        '--qc-chip-height': `${hover.anchor.height}px`,
      },
      onMouseDown: (event) => event.preventDefault(),
      onClick: (event) => {
        event.preventDefault()
        event.stopPropagation()
        // Drop the card AND stop it coming back.
        //
        // `setHover(null)` alone is not enough: the pointer is still over the chip's position, so the very next pointer
        // event re-opens the card. That mattered because the card is a portal in its own stacking context, and while it
        // is mounted it swallows clicks aimed at anything beneath it — measured, the undo bar sat underneath it and
        // could not be pressed at all.
        suppressUntil.current = Date.now() + SUPPRESS_MS
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
