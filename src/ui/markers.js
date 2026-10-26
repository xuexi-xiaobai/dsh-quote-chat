/**
 * The gutter: numbered markers beside annotated passages, and the comment editor they open.
 *
 * ## How the marker is placed
 *
 * Horizontally by CSS, not by computation: the bubble is mounted INTO the row that holds the
 * passage, and a stylesheet rule pins it to that row's right edge. So there is no x coordinate
 * to recompute, and a pane drag cannot leave it straddling the wrong characters.
 *
 * Vertically it is `top: 0` of its containing block, which `rowOf` finds by walking up to the
 * nearest block-level element. That is the whole trick — because the containing block IS the
 * paragraph, there is no vertical offset to measure either, and nothing can wobble at fractional
 * pixel offsets while a drag is in progress.
 *
 * ## What this module needs from the instance
 *
 * `findFlow` and `columnElement` come from the instance's layout. Everything else — the ordinal
 * pairing, the position comparison, the block lookup — is local to this module, because these
 * are the only callers.
 *
 * ## Lifetimes worth not breaking
 *
 * The marker list is the one component that writes nothing into the page: it portals bubbles
 * into rows and a panel into the scroll container. Its observers, its pending frame and its
 * timers all live in one effect with a cleanup that disconnects every one of them.
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { CHIP_SOURCE } from '../chip-draft.js'
import { elementOf } from '../dom.js'
import { resolveAnchor, BLOCK_SELECTOR } from '../text-ranges.js'

/** createElement, bound once. */
const h = React.createElement

/** Never let a surface touch the viewport edge. */
const VIEWPORT_MARGIN = 8

/** Clearance kept between a gutter panel and the bubble it belongs to. */
const BUBBLE_CLEARANCE = 30

/** The comment panel's assumed width, used before it has measured itself. */
const BUBBLE_PANEL_WIDTH = 320

/** The comment panel's assumed height, used before it has measured itself. */
const BUBBLE_PANEL_HEIGHT = 200


/**
 * Create the gutter bound to one plugin instance.
 *
 * Call once during wiring: the returned component is a stable type, and minting it per render
 * would remount the marker layer — and with it every portal — on each keystroke.
 *
 * @param services - `{ findFlow, columnElement }` from the instance's layout.
 * @returns `{ MarkerLayer }`.
 */
export function createMarkerLayer({ findFlow, columnElement, anchorAboveBubble }) {
  /**
   * The ordinal each annotation currently shows on its composer chip.
   *
   * The chip number is the chip's position in the live draft, not a stored
   * field, so anything else that displays a number (the gutter bubble) has to
   * read the same source or the two disagree. Pairing is by reference id, the
   * same rule the hover cards use, because a chip the user deleted by hand
   * drops out of `occurrences` and a positional pairing would shift every
   * later number by one.
   * @param occurrences - the composer's live reference occurrences.
   * @returns a map of annotation id to the ordinal its chip displays.
   */
  function chipOrdinals(occurrences) {
    const ordinals = new Map()
    if (typeof document === 'undefined') return ordinals
    const refs = occurrences
      .filter((item) => item.source === CHIP_SOURCE)
      .map((item) => item.ref)
    const chips = [...document.querySelectorAll('[data-composer-chip="quote-chat"]')]
      .filter((element) => element.closest('[data-sidebar-right-tab]') === null)
    for (let index = 0; index < chips.length && index < refs.length; index += 1) {
      ordinals.set(refs[index], index + 1)
    }
    return ordinals
  }

  /**
   * A memoised `scrollContainerOf`.
   *
   * The walk calls `getComputedStyle` on every ancestor, which forces a style
   * recalc. That is fine once, ruinous at 60 Hz during a drag, so the answer is
   * cached against the flow element and re-validated cheaply (the container must
   * still contain the flow).
   * @param flow - the chat flow anchor.
   * @returns the scroll container, or null.
   */
  /**
   * The subtree that can contain annotation chips.
   *
   * Scoping the composer watcher to this instead of `document.body` is what keeps
   * a pane drag from waking it on every frame: the transcript re-renders
   * constantly during a drag, but the composer does not.
   * @returns the element to observe, or null when there is no composer yet.
   */
  function composerContainer() {
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
   * Cached text-column box per flow element.
   *
   * The column costs one rect read per mounted row, which is too much per frame
   * during a drag but cheap once. The ResizeObserver on the column clears the
   * entry when the column actually changes size, so a drag re-measures exactly
   * when it must and reuses the answer otherwise.
   */
  const columnCache = new WeakMap()

  const containerCache = new WeakMap()
  /**
   * The editor a gutter bubble opens.
   *
   * It edits the annotation's COMMENT only — the passage and the ordinal are
   * not text the user chose, they are what the annotation points at. Saving
   * rewrites the comment in place, so the chip, its id, and its position in the
   * draft all survive; deleting removes the annotation the same way the chip's ×
   * does.
   * @param props - the annotation, the anchor point, labels, and the handlers.
   */
  function BubblePanel(props) {
    const { annotation, anchor, labels, onSave, onDelete, onClose, inFlow = false, rel = null } = props
    const [text, setText] = React.useState(annotation.comment)
    const [flash, setFlash] = React.useState('')
    const ref = React.useRef(null)
    const areaRef = React.useRef(null)
    const [size, setSize] = React.useState({ width: 0, height: 0 })

    React.useLayoutEffect(() => {
      const element = ref.current
      if (element === null) return
      const box = element.getBoundingClientRect()
      setSize({ width: box.width, height: box.height })
      areaRef.current?.focus()
    }, [])

    // Clicking anywhere else closes it; the panel stops the event itself.
    React.useEffect(() => {
      const onDown = (event) => {
        if (ref.current !== null && event.target instanceof Node
          && ref.current.contains(event.target)) return
        onClose()
      }
      const onKey = (event) => {
        if (event.key === 'Escape') onClose()
      }
      document.addEventListener('mousedown', onDown, true)
      document.addEventListener('keydown', onKey, true)
      return () => {
        document.removeEventListener('mousedown', onDown, true)
        document.removeEventListener('keydown', onKey, true)
      }
    }, [onClose])

    const width = size.width || 320
    const height = size.height || 200
    // Two placement modes.
    //
    // inFlow: the panel is mounted INSIDE the annotated paragraph, so its offsets
    // are relative to that paragraph's own box. It therefore rides with the text -
    // scrolling, zooming and re-wrapping all keep it beside its passage - and needs
    // no scroll listener. It is pinned to the paragraph's top-right, which is the
    // spot beside the gutter bubble.
    //
    // Otherwise (no paragraph to attach to) it falls back to viewport coordinates,
    // clamped to stay on screen.
    // A `right` offset wins: it aligns to the bubble's right edge exactly, at any panel
    // width, without the anchor needing to know that width.
    const rightEdge = rel !== null && rel.right !== undefined ? rel.right : null
    const left = rel !== null
      ? rel.left
      : inFlow
      ? Math.max(0, anchor.width - width)
      : Math.min(
        Math.max(VIEWPORT_MARGIN, anchor.left),
        Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
      )
    // Opened ABOVE the passage, clear of both the gutter bubble and the text.
    //
    // The panel is a child of the paragraph, so a negative offset lifts it above the
    // paragraph's top edge - which is where the bubble also sits. Shifting up by the
    // bubble's own height plus a gap keeps the two from overlapping, and leaves the
    // annotated passage itself fully visible.
    // Bottom edge sits a fixed gap above the bubble, measured against the panel's OWN
    // height. Until it has measured, the anchor's assumption is used.
    const measured = height > 0 ? height : 0
    const top = rel !== null
      ? (rel.bubbleTop === undefined
        ? rel.top
        : Math.min(
          Math.max(rel.bandTop, rel.bubbleTop - rel.gap - (measured || rel.gap)),
          Math.max(rel.bandTop, rel.bandBottom - (measured || rel.gap)),
        ))
      : inFlow
      ? -(height + BUBBLE_CLEARANCE)
      : Math.min(
        Math.max(VIEWPORT_MARGIN, anchor.top),
        Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
      )
    /**
     * Save, with a visible acknowledgement.
     *
     * The panel closes on save, so without a brief confirmation the save is
     * indistinguishable from a dismissal. The toast outlives the panel because
     * it is its own element; `onSave` is deferred a frame so the toast paints
     * before the panel unmounts.
     */
    const commit = () => {
      setFlash(labels.saved)
      setTimeout(() => onSave(text), 160)
    }
    return h('div', {
      ref,
      // Plugin chrome: the passage highlight must never paint over the editor, and
      // text readers must skip it. Both are keyed off this attribute.
      'data-qc-ignore': '1',
      className: 'qc-bubble-panel',
      role: 'dialog',
      'aria-label': labels.edit,
      style: rightEdge !== null
        // Anchored by its RIGHT edge, so the panel lines up with the bubble exactly
        // whatever width the panel turns out to have.
        ? {
          right: `${rightEdge}px`,
          top: `${top}px`,
          visibility: size.width === 0 ? 'hidden' : 'visible',
        }
        : {
          left: `${left}px`,
          top: `${top}px`,
          visibility: size.width === 0 ? 'hidden' : 'visible',
        },
    },
    // No passage preview and no jump button: the passage is already lit in the
    // transcript behind this panel, which is a better answer than a truncated
    // copy of it, and jumping is folded into opening the panel.
    h('div', { className: 'qc-bp-label' }, labels.comment),
    h('textarea', {
      ref: areaRef,
      value: text,
      placeholder: labels.bubblePlaceholder,
      spellCheck: false,
      onChange: (event) => setText(event.target.value),
      onKeyDown: (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          commit()
        }
      },
    }),
    h('div', { className: 'qc-bp-actions' },
      h('button', {
        type: 'button',
        className: 'qc-bp-delete',
        onClick: () => {
          setFlash(labels.deleted)
          onDelete()
        },
      }, labels.delete),
      h('button', {
        type: 'button',
        className: 'qc-bp-save',
        onClick: commit,
      }, labels.save),
    ),
    flash === ''
      ? null
      : h('span', {
        className: 'qc-bp-done',
        style: { left: `${left}px`, top: `${top + height + 6}px` },
      }, flash),
    )
  }

  /**
   * Whether two bubble layouts are identical.
   *
   * Guards the state write: React re-renders on every `setPositions` call, so an
   * unchanged layout must not produce a new array. During a drag this is the
   * difference between ~60 renders a second and none.
   * @param left - the current layout.
   * @param right - the candidate layout.
   * @returns true when nothing visible changed.
   */
  function samePositions(left, right) {
    if (left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) {
      const a = left[index]
      const b = right[index]
      if (a.id !== b.id || a.row !== b.row || a.number !== b.number) return false
    }
    return true
  }

  /**
   * The row element that contains a resolved passage.
   *
   * The bubble is mounted INTO this element, which is what makes it track the
   * passage for free: any transform of the row - scroll, zoom, reflow, a pane
   * drag - carries the bubble with it because the bubble is part of the row's
   * box, not a coordinate someone recomputed.
   * @param range - the resolved passage range.
   * @param flow - the chat flow anchor, used when no row wrapper exists.
   * @returns the row element, or null.
   */
  /**
   * The block element that contains a resolved passage.
   *
   * The bubble is mounted INTO this element and positioned with top:0 and
   * right:4px, so layout puts it at the top-right of its own paragraph. That is
   * the whole trick: because the containing block IS the paragraph, there is no
   * vertical offset to compute and therefore nothing that can wobble while a pane
   * is dragged. Mounting to the surrounding chat ROW instead would force a
   * per-frame measurement of "how far into this row does the passage start", and
   * that measurement is what jittered at fractional pixel offsets.
   *
   * @param range - the resolved passage range.
   * @param flow - the chat flow anchor, used only to exclude the boxless wrapper.
   * @returns the containing block element, or null.
   */
  function rowOf(range, flow) {
    const element = elementOf(range.startContainer)
    if (element === null) return null
    // A block-level element is its own containing block: top:0 aligns exactly with
    // its first line, which is where the passage starts.
    const block = element.closest(BLOCK_SELECTOR)
    if (block !== null && block !== flow && flow.contains(block)) return block
    // Inline or unwrapped content: fall back to the chat row, which is still a real
    // box (unlike the flow anchor, which is display:contents and has no box).
    const row = element.closest('[data-chat-node-key]')
    if (row !== null) return row
    let ancestor = element
    while (ancestor !== null) {
      if (ancestor !== flow && ancestor.getClientRects().length > 0) return ancestor
      ancestor = ancestor.parentElement
    }
    return null
  }
  /**
   * The right-gutter bubbles that mark where each annotation came from.
   *
   * They are rendered INSIDE the transcript's scroll container, absolutely
   * positioned. That is what makes them behave: the container's overflow clips
   * them so they cannot paint over the tab strip or the composer, and they
   * scroll with the content instead of being re-measured on every frame.
   * @param props - the annotations, labels, and the handlers.
   */
  function MarkerLayer(props) {
    const { annotations, occurrences, labels, onJump, onHighlight, onUpdate, onRemove } = props
    const [positions, setPositions] = React.useState([])
    const [editing, setEditing] = React.useState(null)

    React.useEffect(() => {
      if (typeof document === 'undefined') return undefined
      let frame = 0
      let timer = 0
      /**
       * Reusable measurement state.
       *
       * A full pass is expensive: it walks ancestors with getComputedStyle,
       * reads a rect per row, and resolves every annotation's anchor (a DOM path
       * walk plus, on a miss, a TreeWalker over the whole transcript's text).
       * Dragging a pane edge fires the column ResizeObserver on every frame, so
       * running a full pass per frame is what made dragging stutter.
       *
       * A drag only changes the column's WIDTH. Vertical placement and anchor
       * resolution cannot change from it, so those are cached and only the
       * horizontal offset is recomputed while the drag is in flight. Once it
       * settles, one full pass runs to correct anything that moved.
       */
      /** The last fully measured bubbles, before the x offset is applied. */
      let measured = []
      const measure = () => {
        frame = 0
        const flow = findFlow()
        if (flow === null) {
          measured = []
          setPositions((current) => (current.length === 0 ? current : []))
          return
        }
        // The chip's ordinal is the authoritative number: it is the chip's
        // position in the current draft, so a bubble reading anything else would
        // disagree with the chip the user is looking at.
        const ordinals = chipOrdinals(occurrences)
        const next = []
        for (const annotation of annotations) {
          // A bubble marks an annotation that is still in the draft. Deleting a
          // chip with the keyboard removes the occurrence without calling back
          // into the plugin, so the store keeps an entry with no chip.
          const number = ordinals.get(annotation.id)
          if (number === undefined) continue
          const range = resolveAnchor(flow, annotation.anchor)
          if (range === null) continue
          // The bubble is mounted INTO this row, so the row is all the position
          // information needed: the browser keeps the bubble on it through
          // scrolling, zoom and reflow. No coordinates are computed here at all.
          const row = rowOf(range, flow)
          if (row === null) continue
          // No vertical offset is computed: the bubble mounts INSIDE its own
          // paragraph, so top:0 already sits on the passage's first line. Nothing
          // is measured per frame, so nothing can jitter while a pane is dragged.
          next.push({
            id: annotation.id,
            row,
            // The base class is already the blue bubble; only tables recolour.
            tone: annotation.kind === 'table' ? 'qc-marker-table' : '',
            number,
            title: labels.jump.replace('{n}', String(number)),
          })
        }
        measured = next
        publish(next)
      }
      /**
       * Push a measured set into state.
       *
       * Only the identity and the row matter now: layout owns the geometry.
       * @param next - the measured bubbles, each carrying its row element.
       */
       const publish = (next) => {
        setPositions((current) => (samePositions(current, next) ? current : next))
      }
      /**
       * Re-point the bubbles at their rows.
       *
       * There is nothing to position: a bubble lives inside its row, so the
       * browser keeps it on the passage through scrolling, zoom, wrapping and
       * pane drags. A resize therefore only has to ensure the set of bubbles is
       * current — it never has to move them.
       */
      const reflow = () => {
        frame = 0
        if (measured.length === 0) return
        publish(measured)
      }
      const schedule = () => {
        if (frame !== 0) return
        frame = requestAnimationFrame(measure)
      }
      /**
       * React to a column resize, choosing the cheap or the full pass.
       *
       * Two different changes can arrive here and they need different responses:
       *
       * - **Width only** (dragging a pane edge): vertical placement cannot move,
       *   so the cheap horizontal pass is correct.
       * - **Anything else**, in particular a change in the column's HEIGHT or a
       *   device-pixel-ratio change from Ctrl +/- zoom: line boxes reflow, so
       *   every bubble's vertical position moves. A width-only pass would keep
       *   the stale `top` values and the bubbles would visibly float. Those go
       *   through the full pass.
       */
      /**
       * A resize needs no geometry work any more: each bubble lives inside its
       * row, so layout keeps it on the passage through a pane drag, a zoom or a
       * reflow. The pass only refreshes which bubbles should exist.
       */
      const onColumnResize = () => { schedule() }
      schedule()
      /**
       * Coalesce transcript mutations.
       *
       * Rows mount and unmount as the virtualiser pages, which is the only event
       * that can change which annotations have a bubble mounted. Debouncing keeps
       * a burst of paging churn to one pass.
       */
      const debounced = () => {
        clearTimeout(timer)
        timer = setTimeout(schedule, 80)
      }
      const observer = new MutationObserver(debounced)
      const flow = findFlow()
      // `childList` only, and NOT `characterData`. The virtualiser mounting or
      // unmounting a row is the event that matters; a text edit inside a row does
      // not move a bubble, because bubble coordinates are container-absolute and
      // the browser reflows them. Watching characterData made every streamed token
      // — and every reflow during a pane drag — schedule a full anchor pass.
      if (flow !== null) observer.observe(flow, { childList: true, subtree: true })
      // Follow the text column's width. Resizing the transcript (dragging a
      // pane edge, toggling a side panel) does not fire `resize` on the window
      // and does not mutate the flow's children, so without this the bubble
      // would keep its old x while the prose moved underneath it.
      let columnObserver = null
      const watchColumn = () => {
        const flow2 = findFlow()
        const target = flow2 === null ? null : columnElement(flow2)
        if (target === null) return
        if (columnObserver !== null
          && columnObserver.__qcTarget === target) return
        if (columnObserver !== null) columnObserver.disconnect()
        if (typeof ResizeObserver !== 'function') return
        // `onColumnResize` decides between the cheap and the full pass: a width
        // change is cheap, a height change (reflow, zoom) is not.
        columnObserver = new ResizeObserver(onColumnResize)
        columnObserver.__qcTarget = target
        columnObserver.observe(target)
      }
      watchColumn()
      /**
       * Window resize and page zoom both invalidate vertical placement.
       *
       * Ctrl +/- changes the device pixel ratio without changing the column's
       * CSS width, so neither the ResizeObserver nor a width-only pass notices.
       * Listening for the ratio change is what catches zoom; the full pass is
       * required either way, because line boxes reflow.
       */
      let lastRatio = typeof window === 'undefined' ? 1 : (window.devicePixelRatio || 1)
      const onWindowResize = () => {
        const ratio = window.devicePixelRatio || 1
        const zoomed = ratio !== lastRatio
        lastRatio = ratio
        if (zoomed) {
        }
        schedule()
      }
      window.addEventListener('resize', onWindowResize)
      // `visualViewport` fires for zoom in browsers that do not change the ratio.
      if (window.visualViewport !== undefined && window.visualViewport !== null) {
        window.visualViewport.addEventListener('resize', onWindowResize)
      }
      return () => {
        if (frame !== 0) cancelAnimationFrame(frame)
        clearTimeout(timer)
        window.removeEventListener('resize', onWindowResize)
        if (window.visualViewport !== undefined && window.visualViewport !== null) {
          window.visualViewport.removeEventListener('resize', onWindowResize)
        }
        observer.disconnect()
        if (columnObserver !== null) columnObserver.disconnect()
      }
    }, [annotations, occurrences, labels])

    /**
     * Give every hosting row a positioned containing block.
     *
     * This runs in an effect rather than during render: writing to the DOM while
     * React renders is what invalidated the live selection (the browser drops a
     * selection whose nodes were mutated), which in turn closed the toolbar the
     * moment a bubble appeared.
     */
    React.useEffect(() => {
      if (typeof document === 'undefined') return
      for (const position of positions) {
        const row = position.row
        if (row === undefined || !row.isConnected) continue
        if (row.dataset.qcHost === '1') continue
        if (getComputedStyle(row).position === 'static') row.style.position = 'relative'
        // Reserve the bubble's gutter exactly once. The paragraph then lays out at
        // its final width before the bubble is drawn and keeps it forever after, so
        // the prose never re-wraps and the measured height never changes underneath
        // a later pass. That stability is what stopped the flicker.
        row.classList.add('qc-hosts-bubble')
        row.dataset.qcHost = '1'
      }
    }, [positions])


    if (typeof document === 'undefined') return null
    // Nothing to show: no annotations, nothing to edit. Returning null here keeps
    // this component out of the tree entirely, which is what it did before the
    // bubble was re-anchored into the rows.
    if (positions.length === 0 && editing === null) return null
    // Render each bubble INSIDE its paragraph, excluded from every text read.
    //
    // Mounting inside the paragraph is what makes it track the passage for free: it
    // shares the paragraph's box, so scrolling, zoom (Ctrl +/-), re-wrapping and pane
    // drags move it along with the text - no measurement, nothing to go stale.
    //
    // The catch is text contamination. The bubble's ordinal joins the paragraph's
    // textContent ("...对齐到1段落顶部"), so a recorded DOM path stops ending on the
    // quoted text: resolveAnchor then falls back to a full-text search, which can
    // land on a different occurrence. That is exactly what made the bubble jump
    // around AND stop responding to clicks. The bubble therefore carries
    // data-qc-ignore, and every text read in this file goes through textOf(), which
    // strips those nodes before matching.
    const nodes = []
    for (const position of positions) {
      const row = position.row
      if (row === undefined || !row.isConnected) continue
      nodes.push(createPortal(h('button', {
        key: position.id,
        type: 'button',
        'data-qc-ignore': '1',
        // The ordinal is drawn by CSS from this attribute rather than being a text
        // node. A real text node inside the paragraph joins its textContent AND gets
        // painted by CSS.highlights when the passage is lit - which is how the
        // fluorescent marker ended up covering the bubble's own number.
        'data-qc-number': String(position.number),
        // Stable handle for the annotation this bubble stands for. The editor is
        // positioned against this exact bubble.
        'data-qc-for': position.id,
        className: 'qc-marker ' + position.tone
          + (editing !== null && editing.id === position.id ? ' qc-marker-active' : ''),
        title: position.title,
        'aria-label': position.title,
        onClick: () => {
          const annotation = annotations.find((item) => item.id === position.id)
          if (annotation === undefined) return
          const already = editing !== null && editing.id === position.id
          setEditing(already ? null : { id: position.id, row })
          if (!already) onHighlight(annotation, true)
          else onHighlight(annotation, false)
        },
      }), row))
    }
    // The editor is a separate portal into document.body: it must not be
    // clipped by the transcript.
    const editor = editing === null ? null : (() => {
      const annotation = annotations.find((item) => item.id === editing.id)
      if (annotation === undefined) return null
      const row = editing.row
      // Mounted into the transcript container, so the container clips it (it can never
      // cover the composer) and it sits OUTSIDE the annotated paragraph - which is what
      // keeps the passage highlight from painting over the editor's own labels.
      // CSS.highlights covers every text node a range spans, and a range reaching the
      // paragraph's end covers anything mounted inside it.
      const flow = findFlow()
      // Anchor to the BUBBLE, not to the paragraph: the panel lines up with the marker
      // the user just clicked. Its right edge is flush with the bubble's right edge and
      // its bottom clears the bubble's top by a fixed gap. Both offsets derive from the
      // bubble's own box, so the panel travels with the marker as the transcript
      // scrolls - no scroll listener is involved.
      const bubble = (row !== undefined && row !== null && row.isConnected)
        ? row.querySelector('.qc-marker[data-qc-for="' + editing.id + '"]')
        : null
      const box = bubble === null || bubble === undefined
        ? (row !== undefined && row !== null && row.isConnected ? row.getBoundingClientRect() : null)
        : bubble.getBoundingClientRect()
      const anchored = flow === null || box === null
        ? null
        : anchorAboveBubble(flow, box, {
          width: BUBBLE_PANEL_WIDTH,
          // Assumed height for the first paint. The panel reports its real size after
          // mounting, and the bottom-edge offset uses that measurement from then on.
          height: BUBBLE_PANEL_HEIGHT,
        })
      return createPortal(h(BubblePanel, {
        annotation,
        rel: anchored === null ? null : anchored.position,
        // Fallback geometry for the case where there is no transcript to anchor to.
        anchor: {
          left: box === null ? 0 : Math.min(box.right, window.innerWidth - 40),
          top: box === null ? 0 : box.top,
          bottom: box === null ? 0 : box.bottom,
          width: box === null ? 0 : box.width,
        },
        labels,
        onJump: () => {
          setEditing(null)
          onHighlight(annotation, false)
          onJump(annotation)
        },
        onSave: (comment) => {
          setEditing(null)
          onHighlight(annotation, false)
          onUpdate(annotation, comment)
        },
        onDelete: () => {
          setEditing(null)
          onHighlight(annotation, false)
          onRemove(annotation)
        },
        onClose: () => {
          setEditing(null)
          onHighlight(annotation, false)
        },
      }), anchored === null ? document.body : anchored.scroller)
    })()
    return h(React.Fragment, null, ...nodes, editor)
  }

  return { MarkerLayer: MarkerLayer }
}
