/**
 * dsh-quote-chat — browser half.
 *
 * Two gestures over a passage of an answer:
 *
 * 1. **Annotate** — select text (or point at a table) in a model answer, add an
 *    optional comment, and the passage becomes a numbered annotation. The
 *    annotation gets a small colored marker in the answer's right gutter and a
 *    card in the strip above the composer; its content is appended to the draft
 *    so the model receives it.
 * 2. **Ask in side chat** — a right-Sidebar tab with a self-contained
 *    conversation about the passage, answered by this package's Host half.
 *
 * Why the cards live above the composer rather than inside it: the composer is
 * a Lexical editor whose node types are fixed when it is created (reference
 * chip, command chip, text ref). A plugin can insert plain text
 * (`InputActions.insertText`) or replace the whole draft (`setDraft`), but it
 * cannot introduce an interactive card node mid-document.
 * `conversation.input.dock` — the full-width strip directly above the composer
 * card — is the surface that is actually open to plugins, so the cards are
 * there, and the draft carries numbered blocks the user can move, edit, or
 * surround with their own prose.
 *
 * The only Host markers read are the chat flow container
 * (`[data-slot="conversation.chat.flow"]`) and the per-row
 * `data-chat-node-key` attributes: together they answer "which pass of which
 * answer is this?", which is what a jump-back needs.
 */

/** Largest annotated passage accepted, in UTF-16 code units. */
const MAX_QUOTE_CHARS = 8000

/** Annotations kept per session. */
const MAX_ANNOTATIONS = 12

/** Distance kept between a floating surface and the viewport edge, in px. */
const VIEWPORT_MARGIN = 8

/** Gap between a floating surface and its anchor, in px. */
const ANCHOR_GAP = 8

/** Breathing room between the top bar and a jumped-to passage, in px. */
const ANCHOR_TOP_GAP = 28

/** Assumed comment-panel size, used until it reports its own. */
const BUBBLE_PANEL_WIDTH = 320
const BUBBLE_PANEL_HEIGHT = 200

/** Clearance so the comment panel never overlaps the gutter bubble, in px. */
const BUBBLE_CLEARANCE = 30


/**
 * Grace period before a hover card closes, in ms.
 *
 * Without it the card vanished the instant the pointer left the chip, so the gap
 * between chip and card was impossible to cross. Long enough to travel a few
 * pixels, short enough that the card does not linger over the composer.
 */
const HOVER_LINGER_MS = 260

/**
 * How long the hover card's exit animation runs, in ms.
 *
 * The card is kept mounted for this long after the pointer leaves so the fade-out
 * can finish. Unmounting immediately makes it disappear between frames, which
 * reads as a flicker rather than a dismissal.
 */
const CARD_EXIT_MS = 130


// ── implementation ────────────────────────────────────────────────────────────

import React from 'react'
import { createPortal } from 'react-dom'

/** Shorthand for React.createElement; the whole UI is written as plain calls. */
const h = React.createElement

import { zh, en } from './locales.js'
import { createAnnotationStore } from './annotation-store.js'
import {
  serializeChipForModel, CHIP_SOURCE, CHIP_TRIGGER, CHIP_PLACEHOLDER,
} from './chip-draft.js'
import { createChipRegistry } from './chip-registry.js'
import { createDraftBridge } from './chip-bridge.js'
import { createQuoteHandoff } from './quote-handoff.js'
import { askSideChat } from './side-chat-transport.js'
import { createLayout } from './layout.js'
import { createHighlighter, canPaintHighlight, FLASH_HIGHLIGHT, FLASH_MS } from './highlight.js'
import { createNavigation } from './navigation.js'
import { STYLESHEET } from './stylesheet.js'
import { IconAnnotate, IconSideChat, IconCheck } from './icons.js'
import { elementOf, cssEscape } from './dom.js'
import {
  rangeAt, captureAnchor, resolveAnchor, locateText, textOf, nodePath, nodeAtPath,
  squishText, sameText, textOfWithin, FLOW_SELECTOR, BLOCK_SELECTOR,
} from './text-ranges.js'



/** This package's locale namespace. */
const NS = 'quoteChat'

/** The tab type contributed to the right Sidebar. */
const TAB_ID = 'dsh-quote-chat:side'
const TAB_KIND = 'dsh-quote-chat'

/** Surfaces a selection must never come from. */
const NON_ANSWER_SELECTOR = 'textarea, input, [contenteditable="true"], [data-slot="conversation.composer"]'

/** Elements a card must not replay. */
const UNSAFE_IN_CARD = 'script, style, iframe, object, embed, link, meta'


// #region styles

/**
 * Package-owned stylesheet, removed with the plugin fiber.
 *
 * Deliberately NOT named `CSS`: that identifier shadows the browser's global
 * CSS object, which is the one that owns `escape` and `highlights`, for the
 * whole module scope. Called `CSS`, `CSS.highlights` read back `undefined`,
 * so `canPaintHighlight()` returned false and the jump highlight never
 * painted at all.
 */
/**
 * Install the stylesheet once per plugin activation.
 * @param ctx - Client context owning the effect.
 */
function installStyles(ctx) {
  ctx.effect(() => {
    if (typeof document === 'undefined') return undefined
    const tag = document.createElement('style')
    tag.dataset.quoteChat = ''
    tag.textContent = STYLESHEET
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'quote-chat: stylesheet')
}

// #endregion

// #region generic helpers

/**
 * Read the live composer draft through the standard `useInput` seat.
 * @param useInput - the slot's standard `useInput` prop, when present.
 * @param fallback - value reported when the seat is missing.
 * @returns the current draft text.
 */
function useDraft(useInput, fallback = '') {
  const inert = (selector) => selector({ draft: fallback })
  return (typeof useInput === 'function' ? useInput : inert)(
    (state) => state.draft,
    (left, right) => left === right,
  )
}

/**
 * Read the draft's reference occurrences (the inline chips) through the same
 * seat.
 *
 * `InputState.occurrences` is the editor's own projection of the chips in
 * the draft, in clipboard order. It is what lets a removal cut exactly the
 * right span instead of re-deriving one from text offsets the user may have
 * edited around.
 * @param useInput - the slot's standard `useInput` prop, when present.
 * @returns the occurrence list, empty when unavailable.
 */
function useDraftOccurrences(useInput) {
  const empty = React.useMemo(() => [], [])
  const inert = () => empty
  const picked = (typeof useInput === 'function' ? useInput : inert)(
    (state) => state.occurrences,
    (left, right) => left === right,
  )
  return Array.isArray(picked) ? picked : empty
}

/** Drop the visible selection so the toolbar does not immediately reopen. */
function clearSelection() {
  if (typeof window === 'undefined') return
  const selection = window.getSelection()
  if (selection !== null && selection.rangeCount > 0) selection.removeAllRanges()
}

// #endregion


// #region selection reading

/**
 * Read the current selection as a quotable answer passage.
 * @returns text, range, flow, anchor, kind, and preview, or null when the
 * selection is empty, outside the chat flow, or inside an input surface.
 */
/**
 * What the user has selected, if it is one annotatable passage.
 * @param pointer - where the pointer was released, in viewport coordinates. The
 *   popup opens there, because that is where the user's attention is at the end of
 *   the drag; the selection's bounding box is not usable for this, since it spans
 *   every line and its left edge is always the leftmost one.
 * @returns the source descriptor, or null.
 */
function readSelection(pointer) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  const selection = window.getSelection()
  if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return null
  const text = selection.toString()
  if (typeof text !== 'string' || text.trim() === '') return null
  const startElement = elementOf(selection.anchorNode)
  const endElement = elementOf(selection.focusNode)
  if (startElement === null || endElement === null) return null
  const flow = startElement.closest(FLOW_SELECTOR)
  // A selection leaving the flow (or spanning two flows) is not one passage.
  if (flow === null || !flow.contains(endElement)) return null
  // The user's own message is already theirs; tool cards are not prose.
  if (startElement.closest('[data-chat-flow-kind="user"]') !== null) return null
  // A right-Sidebar tab owns its own composer.
  if (startElement.closest('[data-sidebar-right-tab]') !== null) return null
  if (startElement.closest(NON_ANSWER_SELECTOR) !== null) return null
  const range = selection.getRangeAt(0)
  let box
  try {
    box = range.getBoundingClientRect()
  } catch {
    return null
  }
  if (box === undefined || (box.width === 0 && box.height === 0)) return null
  // Where the popup should open: the release point when we have one, otherwise the
  // selection's right edge (a keyboard selection has no pointer).
  const rect = pointer === null || pointer === undefined
    ? { left: box.right, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height }
    : {
      left: pointer.x,
      top: pointer.y,
      right: pointer.x,
      bottom: pointer.y,
      width: box.width,
      height: box.height,
      // The passage box, kept so the action popup can sit relative to the text too.
      passage: box,
    }
  if (rect === undefined || (rect.width === 0 && rect.height === 0)) return null
  // A table is its own card, never merged with prose: the requirement is
  // explicit that a table gets a separate annotation. If the selection simply
  // touches a table — starting inside it and running out into the paragraph,
  // or the reverse — narrow the annotation to the table instead of quietly
  // swallowing it into a text card.
  const table = startElement.closest('table') ?? endElement.closest('table')
  if (table !== null && flow.contains(table)) {
    return {
      kind: 'table',
      text: tableToMarkdown(table),
      previewHtml: '',
      previewText: table.innerText.trim(),
      rect: table.getBoundingClientRect(),
      anchor: tableAnchor(flow, table),
    }
  }
  return {
    kind: 'text',
    text: text.trim(),
    previewHtml: fragmentHtml(range.cloneContents()),
    previewText: text.trim(),
    rect,
    // The block that holds the selection. The popover mounts beside it (not against
    // the viewport), so it stays pinned to the passage while the page scrolls.
    block: startElement.closest(BLOCK_SELECTOR) ?? flow,
    anchor: captureAnchor(range, flow),
  }
}

/**
 * Serialize a DOM fragment to HTML a card can replay.
 * @param fragment - the cloned selection contents.
 * @returns sanitized markup.
 */
function fragmentHtml(fragment) {
  const host = document.createElement('div')
  host.appendChild(fragment)
  for (const node of host.querySelectorAll(UNSAFE_IN_CARD)) node.remove()
  for (const node of host.querySelectorAll('*')) {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on')) node.removeAttribute(attribute.name)
    }
  }
  return host.innerHTML
}

/**
 * Convert one table into a compact Markdown table.
 * @param table - the source table element.
 * @returns Markdown rows, one line each.
 */
function tableToMarkdown(table) {
  const rows = [...table.rows].map((row) => [...row.cells].map((cell) => cell.innerText.replace(/\s+/g, ' ').trim()))
  const usable = rows.filter((row) => row.length > 0)
  if (usable.length === 0) return ''
  const width = Math.max(...usable.map((row) => row.length))
  const pad = (row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')]
  const line = (row) => `| ${pad(row).map((cell) => cell.replace(/\|/g, '\\|')).join(' | ')} |`
  const head = usable[0]
  return [line(head), `| ${pad(head).map(() => '---').join(' | ')} |`, ...usable.slice(1).map(line)].join('\n')
}

// #endregion

/**
 * Layout: the transcript anchor, the readable band, the text column, surface placement.
 *
 * One instance per Host factory call: the lookups carry caches, and a shared cache would
 * outlive the instance that filled it. The rules live in layout.js.
 */
const layout = createLayout()

/**
 * Navigation: restoring a stored passage into view.
 *
 * It uses the layout instance above rather than creating its own, so there is still exactly
 * one set of layout caches. It returns a Range; painting is the caller's decision.
 */
const navigation = createNavigation({ layout })

/** Resolve a passage into view through the virtualized transcript. */
const revealWithSearch = (flow, annotation) => navigation.reveal(flow, annotation)

/** Bring one resolved range into view and hand it back. */
const scrollToRange = (range, flow) => navigation.scrollToRange(range, flow)

/** The chat flow anchor. */
const findFlow = () => layout.findFlow()

/** The flow's scroll container, cached while it still contains the flow. */
const containerFor = (flow) => layout.containerFor(flow)

/** The nearest scrollable ancestor. */
const scrollContainerOf = (flow) => layout.scrollContainerOf(flow)

/** The composer's dock, which bounds the transcript from below. */
const findComposerDock = () => layout.findComposerDock()

/** The part of the transcript the user can read. */
const visibleChatArea = (scroller) => layout.visibleChatArea(scroller)

/** Place a surface against a selection, inside the readable band. */
const anchorInTranscript = (flow, box, size, prefer) => layout.anchorInTranscript(flow, box, size, prefer)

/** Place the comment panel above a bubble, right edges flush. */
const anchorAboveBubble = (flow, bubble, size) => layout.anchorAboveBubble(flow, bubble, size)

/** The text column's box and the element it came from. */
const flowColumnBox = (flow) => layout.flowColumnBox(flow)

/** Just the column rectangle. */
const flowColumn = (flow) => layout.flowColumn(flow)

/** The element whose width defines the text column. */
const columnElement = (flow) => layout.columnElement(flow)

/**
 * Range highlights: the transient jump glow and the held editor glow.
 *
 * One highlighter per Host factory call, so two instances never clear each other's paint.
 * The registry name, the timings and the identity guards live in highlight.js.
 */
const highlighter = createHighlighter()

/** Paint the transient glow on a range, then clear it. */
const flashRange = (range, ms = FLASH_MS, resolve = null) => highlighter.flash(range, ms, resolve)

/** Clear any highlight currently painted. */
const clearFlashRange = () => highlighter.clear()

/** Paint a highlight that stays until cleared. */
const holdRange = (range, resolve = null) => highlighter.hold(range, resolve)

// #region annotation store

/**
 * This plugin instance's annotations.
 *
 * One store per Host factory call, so two plugin instances never share annotations while
 * a single instance fans them out across sessions by `sessionId`. The store itself lives
 * in `annotation-store.js`; what remains here is the React adapter.
 */
const annotationStore = createAnnotationStore({ maxAnnotations: MAX_ANNOTATIONS })

/**
 * Add one annotation to a session.
 * @param sessionId - the session key.
 * @param draft - the annotation draft (without id or number).
 * @returns the stored annotation, or null when the list is full.
 */
const addAnnotation = (sessionId, draft) => annotationStore.add(sessionId, draft)

/**
 * Remove one annotation.
 * @param sessionId - the session key.
 * @param id - the annotation id.
 */
const removeAnnotation = (sessionId, id) => annotationStore.remove(sessionId, id)

/**
 * Change one annotation's comment.
 * @param sessionId - the session key.
 * @param id - the annotation id.
 * @param comment - the new comment text (may be empty).
 * @returns the updated annotation, or null when it is gone.
 */
const updateAnnotation = (sessionId, id, comment) => annotationStore.update(sessionId, id, comment)

/**
 * Look up one annotation.
 * @param sessionId - the session key.
 * @param id - the annotation id.
 * @returns the annotation, or null.
 */
const findAnnotation = (sessionId, id) => annotationStore.find(sessionId, id)

/**
 * Remove every annotation of a session.
 * @param sessionId - the session key.
 */
const clearAnnotations = (sessionId) => annotationStore.clear(sessionId)

/**
 * Subscribe to one session's annotations.
 *
 * Kept here rather than in the store because it is a React binding: the store exposes a
 * plain subscribe/snapshot pair, and this adapts them to `useSyncExternalStore`.
 *
 * @param sessionId - the session key (may be undefined).
 * @returns the current list.
 */
function useAnnotations(sessionId) {
  const subscribe = React.useCallback(
    (listener) => annotationStore.subscribe(sessionId, listener),
    [sessionId],
  )
  const snapshot = React.useCallback(
    () => annotationStore.snapshot(sessionId),
    [sessionId],
  )
  return React.useSyncExternalStore(subscribe, snapshot, snapshot)
}

// #endregion

// #region inline chips

/**
 * The chips this instance has minted, keyed by id.
 *
 * One registry per Host factory call, so two plugin instances never resolve each other's
 * chips. Within an instance it is shared across sessions, because chip ids are annotation
 * ids and those are unique per instance. Entries are never removed — see chip-registry.js.
 */
const chipRegistry = createChipRegistry()

/** The chip/draft seam for this instance: ordering and failure live in the bridge. */
const chipBridge = createDraftBridge({ registry: chipRegistry, source: CHIP_SOURCE })

/**
 * The dock's jump function, published for the reference source.
 *
 * The source is registered at `apply` time (one per plugin, not per session),
 * while jumping needs the mounted dock's own handler — so the dock installs
 * itself here on mount and the source calls through it.
 */
const chipJumpHandler = { current: null }

/**
 * A short plain-text preview of the passage, used for card headers and the
 * jump hint.
 * @param annotation - the annotation.
 * @returns the flattened passage, single-spaced.
 */
function previewOf(annotation) {
  const flat = (annotation.previewText || annotation.text || '').replace(/\s+/g, ' ').trim()
  if (flat !== '') return flat
  return annotation.kind === 'table' ? '表格' : '引文'
}

// #endregion

// #region icons


// #endregion

// #region side-chat transport

// The side-chat transport (URL, request, SSE parsing) lives in
// side-chat-transport.js; this module is imported above.

// #region floating surfaces

/**
 * Place a floating surface near an anchor, inside the viewport.
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

  // Inside the transcript (so the container clips it against the chat chrome) and
  // clamped to the visible band (so it is never cut off at an edge).
  const flow = findFlow()
  const measured = { width: size.width || 210, height: size.height || 34 }
  const anchored = flow === null ? null : anchorInTranscript(flow, anchor, measured, 'below')
  const position = anchored === null
    ? placeNear(anchor, measured)
    : anchored.position
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
 * The annotation editor: a preview of what will be attached, an optional
 * comment, and the confirm pair.
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
  // Clicking elsewhere in the transcript, or on the composer, used to leave the box
  // open with the passage still lit, which read as "my comment is being kept". An
  // outside click is a dismissal like any other, so it cancels - and cancelling
  // clears the highlight.
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
  // The popover used to be position:fixed at a viewport coordinate, so scrolling the
  // page left it hovering over unrelated text. It now mounts as a SIBLING of the
  // annotated block and is positioned from that block's own offset, so it travels
  // with the passage. Being a sibling also keeps it outside the paragraph, and
  // therefore outside any passage highlight.
  const width = size.width || 420
  const height = size.height || 170
  // Same placement rule as the action toolbar: inside the transcript so the container
  // clips it against the chat chrome, clamped to the visible band so it is never cut
  // off at an edge.
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
      // The model's own markup, replayed: the preview shows the passage the
      // way the answer showed it, emphasis and math included.
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

// #endregion

// #region annotation strip

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
  const { annotations, occurrences, labels, onJump, onRemove } = props
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
/** Pending close, so leaving the chip can be undone by coming back. */
let closeTimer = 0
const marked = new Set()

/** Drop our attributes from one chip. */
const unmark = (chip) => {
  delete chip.dataset.qcNum
  delete chip.dataset.qcKind
  delete chip.dataset.qcLabel
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
const onClick = (event) => {
  const chip = chipOf(event)
  if (chip === null) return
  const annotation = pairs().find((pair) => pair.chip === chip)?.annotation
  if (annotation === undefined) return
  event.preventDefault()
  event.stopPropagation()
  actionsRef.current.onJump(annotation)
}
document.addEventListener('click', onClick, true)

return () => {
  if (frame !== 0) cancelAnimationFrame(frame)
  clearTimeout(timer)
  if (closeTimer !== 0) clearTimeout(closeTimer)
  observer.disconnect()
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

/**
 * Render a Markdown table as an HTML table for the preview.
 *
 * The preview shows the passage as the reader saw it, so a table has to be a real
 * table — pipes and header rules would not read as the same thing.
 * @param markdown - the captured Markdown table.
 * @returns HTML for the table, or a plain-text fallback.
 */
function tableHtml(markdown) {
  const rows = markdown
.split('\n')
.map((line) => line.trim())
.filter((line) => line.startsWith('|'))
.map((line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()))
// Drop the `|---|---|` separator row.
.filter((cells) => cells.length > 0 && !cells.every((cell) => /^:?-{2,}:?$/.test(cell)))
  if (rows.length === 0) return `<pre class="qc-card-md">${escapeHtml(markdown)}</pre>`
  const head = rows[0]
  const body = rows.slice(1)
  const cell = (tag, text) => `<${tag}>${escapeHtml(text)}</${tag}>`
  return `<table><thead><tr>${head.map((text) => cell('th', text)).join('')}</tr></thead>`
+ `<tbody>${body.map((cells) => `<tr>${cells.map((text) => cell('td', text)).join('')}</tr>`).join('')}</tbody></table>`
}

/**
 * Escape text for safe insertion into HTML.
 * @param text - the raw text.
 * @returns the escaped text.
 */
function escapeHtml(text) {
  return String(text)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
}

// #endregion

// #region gutter markers

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

// #endregion

// #region table affordance

/**
 * The "add this table" button that follows the pointer across answer tables.
 *
 * A table cannot share an annotation with the prose around it, so it gets
 * its own control instead of relying on a text selection.
 * @param props - the label and the handler.
 */
function TableAddButton(props) {
  const { label, onAdd } = props
  const [target, setTarget] = React.useState(null)

  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined
    let frame = 0
    let pending = null
    const apply = () => {
      frame = 0
      if (pending === null) {
        setTarget((current) => (current === null ? current : null))
        return
      }
      const rect = pending.getBoundingClientRect()
      setTarget((current) => {
        if (current !== null && current.element === pending
          && current.rect.top === rect.top && current.rect.right === rect.right) return current
        return { element: pending, rect }
      })
    }
    const schedule = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(apply)
    }
    const onMove = (event) => {
      const element = elementOf(event.target)
      const flow = element?.closest(FLOW_SELECTOR) ?? null
      const table = flow === null || element === null ? null : element.closest('table')
      pending = table !== null && flow !== null && flow.contains(table) ? table : null
      schedule()
    }
    const onLeave = () => {
      pending = null
      schedule()
    }
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseleave', onLeave, true)
    document.addEventListener('scroll', onLeave, true)
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      document.removeEventListener('mousemove', onMove, true)
      document.removeEventListener('mouseleave', onLeave, true)
      document.removeEventListener('scroll', onLeave, true)
    }
  }, [])

  if (target === null || typeof document === 'undefined') return null
  const position = {
    left: Math.max(VIEWPORT_MARGIN, target.rect.right - 116),
    top: Math.max(VIEWPORT_MARGIN, target.rect.top + 4),
  }
  return createPortal(
    h('button', {
      type: 'button',
      className: 'qc-table-add',
      style: { left: `${position.left}px`, top: `${position.top}px` },
      onMouseDown: (event) => event.preventDefault(),
      onClick: () => onAdd(target.element),
    }, h(IconAnnotate, null), label),
    document.body,
  )
}

/**
 * Explain why a jump missed, in terms of the state that actually failed.
 *
 * "Not found" is useless when debugging, because the failures are different:
 * no flow at all, the row unmounted (the transcript pages distant rows out
 * of the DOM), or the row present but the passage gone from it. Reporting the
 * mounted-row count and the stored quote length turns the next report into a
 * diagnosis instead of another guess.
 * @param flow - the chat flow, or null.
 * @param annotation - the annotation that failed to resolve.
 * @returns the notice text.
 */
function diagnoseMiss(flow, annotation) {
  const anchor = annotation.anchor ?? {}
  const quote = typeof anchor.quote === 'string' ? anchor.quote : ''
  const head = quote.length > 18 ? `${quote.slice(0, 18)}…` : quote
  if (flow === null) return `找不到对话区域 / no chat flow (quote ${quote.length} chars: ${head})`
  const rows = flow.querySelectorAll('[data-chat-node-key]')
  const row = anchor.nodeKey === ''
    ? null
    : flow.querySelector(`[data-chat-node-key="${cssEscape(anchor.nodeKey)}"]`)
  if (row === null) {
    return `翻遍对话仍未加载到原文所在消息 / row never loaded (${rows.length} rows mounted, quote ${quote.length} chars: ${head})`
  }
  return `消息还在，但其中找不到这段引文 / row present, quote missing (${quote.length} chars: ${head})`
}

// #endregion


// #endregion

// #region side chat panel

/**
 * One side-chat thread: the quoted passage, the exchange so far, and the
 * composer. All state is local to this tab.
 * @param props - the quote, a translate function, and the composer actions.
 */
function SideChat(props) {
  const { quote, t, locale, inputActions, useInput } = props
  const draft = useDraft(useInput)
  const [messages, setMessages] = React.useState([])
  const [question, setQuestion] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [expanded, setExpanded] = React.useState(false)
  const [added, setAdded] = React.useState(false)
  const abortRef = React.useRef(null)
  const threadRef = React.useRef(null)

  // A new passage is a new thread: the previous exchange was about a
  // different quote, and mixing the two would make answers unattributable.
  React.useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setQuestion('')
    setError('')
    setBusy(false)
    setAdded(false)
  }, [quote])

  React.useEffect(() => () => { abortRef.current?.abort() }, [])

  const scrollToEnd = React.useCallback(() => {
    const element = threadRef.current
    if (element !== null) element.scrollTop = element.scrollHeight
  }, [])

  React.useEffect(scrollToEnd, [messages, scrollToEnd])

  const submit = React.useCallback(async () => {
    const text = question.trim()
    if (text === '' || busy) return
    const history = messages
      .filter((message) => message.text.trim() !== '')
      .map((message) => ({ role: message.role, text: message.text }))
    // The Host wants completed Q/A pairs, so fold the finished exchange and
    // send the new question separately.
    const replayed = []
    for (let index = 0; index < history.length; index += 1) {
      const current = history[index]
      const next = history[index + 1]
      if (current.role === 'user' && next !== undefined && next.role === 'assistant') {
        replayed.push({ question: current.text, answer: next.text })
        index += 1
      }
    }
    setMessages((current) => [...current, { role: 'user', text }, { role: 'assistant', text: '' }])
    setQuestion('')
    setError('')
    setBusy(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await askSideChat({ quote, question: text, history: replayed, locale }, controller.signal, (delta) => {
        setMessages((current) => {
          const copy = current.slice()
          const last = copy.length - 1
          if (last < 0) return current
          copy[last] = { role: 'assistant', text: copy[last].text + delta }
          return copy
        })
      })
    } catch (failure) {
      if (controller.signal.aborted) {
        setMessages((current) => {
          const copy = current.slice()
          const last = copy.length - 1
          if (last >= 0 && copy[last].role === 'assistant' && copy[last].text === '') copy.pop()
          return copy
        })
      } else {
        setError(failure instanceof Error ? failure.message : String(failure))
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusy(false)
    }
  }, [question, busy, messages, quote, locale])

  const stop = React.useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
  }, [])

  /** Append one passage to the current session's composer draft. */
  const addToChat = React.useCallback((text) => {
    const payload = text
      .split(/\r?\n/)
      .map((line) => (line === '' ? '>' : `> ${line}`))
      .join('\n')
    const current = typeof draft === 'string' ? draft : ''
    if (typeof inputActions?.captureInsertion === 'function'
      && typeof inputActions?.insertText === 'function') {
      const span = inputActions.captureInsertion()
      if (inputActions.insertText(`${payload}\n\n`, span) === true) {
        setAdded(true)
        return
      }
    }
    if (typeof inputActions?.setDraft === 'function') {
      inputActions.setDraft(current.trim() === '' ? payload : `${current}\n\n${payload}`)
      setAdded(true)
    }
  }, [draft, inputActions])

  React.useEffect(() => {
    if (!added) return undefined
    const timer = setTimeout(() => setAdded(false), 2200)
    return () => clearTimeout(timer)
  }, [added])

  const lastAssistant = [...messages].reverse()
    .find((message) => message.role === 'assistant' && message.text !== '')
  const lastQuestion = [...messages].reverse().find((message) => message.role === 'user')

  return h('div', { className: 'qc-side' },
    h('div', { className: 'qc-side-head' },
      h('span', { className: 'qc-side-head-title' }, t('side.title')),
      messages.length > 0
        ? h('button', {
          type: 'button',
          onClick: () => { setMessages([]); setError(''); setAdded(false) },
        }, t('side.clear'))
        : null,
    ),
    h('div', { className: 'qc-quote' },
      h('div', { className: 'qc-quote-label' },
        h('span', null, t('side.quote')),
        quote.length > 260
          ? h('button', {
            type: 'button',
            onClick: () => setExpanded((value) => !value),
          }, expanded ? t('side.collapseQuote') : t('side.expandQuote'))
          : null,
      ),
      h('div', { className: `qc-quote-body${expanded ? '' : ' qc-clamped'}` }, quote),
    ),
    h('div', { ref: threadRef, className: 'qc-thread' },
      messages.length === 0
        ? h('div', { className: 'qc-empty' }, t('side.empty'))
        : messages.map((message, index) => h('div', {
          key: `${index}-${message.role}`,
          className: `qc-msg qc-msg-${message.role}`,
        },
        h('div', { className: 'qc-msg-role' },
          message.role === 'user' ? t('side.you') : t('side.assistant')),
        h('div', { className: 'qc-msg-body' },
          message.text === '' && busy && index === messages.length - 1
            ? h('span', { className: 'qc-dots' })
            : message.text),
        message.role === 'assistant' && message.text !== ''
          ? h('div', { className: 'qc-msg-actions' },
            h('button', {
              type: 'button',
              onClick: () => addToChat(message.text),
            }, t('side.addToChat')))
          : null,
        )),
      error === ''
        ? null
        : h('div', { className: 'qc-msg-error' }, `${t('side.errorPrefix')}${error}`),
    ),
    h('div', { className: 'qc-side-compose' },
      h('textarea', {
        value: question,
        placeholder: t('side.placeholder'),
        rows: 2,
        onChange: (event) => setQuestion(event.target.value),
        onKeyDown: (event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
            event.preventDefault()
            submit()
          }
        },
      }),
      h('div', { className: 'qc-side-compose-row' },
        h('span', { className: 'qc-side-compose-hint' }, added ? t('side.added') : ''),
        lastAssistant !== undefined
          ? h('button', {
            type: 'button',
            className: 'qc-btn qc-btn-ghost',
            onClick: () => addToChat(
              `> ${lastQuestion === undefined ? '' : lastQuestion.text}\n\n${lastAssistant.text}`,
            ),
          }, t('side.addToChat'))
          : null,
        busy
          ? h('button', { type: 'button', className: 'qc-btn qc-btn-ghost', onClick: stop }, t('side.stop'))
          : h('button', {
            type: 'button',
            className: 'qc-btn',
            disabled: question.trim() === '',
            onClick: submit,
          }, t('side.send')),
      ),
    ),
  )
}

/**
 * The passage a freshly opened side chat should show.
 *
 * One handoff per plugin instance: navigation params win, and a pending quote is a
 * 15-second fallback for a Host that opens the tab without carrying them. The rules and
 * the window live in quote-handoff.js.
 */
const quoteHandoff = createQuoteHandoff()

/**
 * The quote a freshly opened side chat should show.
 * @param carried - the quote the tab's own navigation params carried.
 * @returns the carried quote, a fresh pending one, or an empty string.
 */
function quoteForTab(carried) {
  return quoteHandoff.forTab(carried)
}

/**
 * The tab body: read the quote the tab was opened with, then hand it to the
 * panel.
 *
 * `t` arrives from the framework (a registration with `locale` gets the
 * bound translate seat), `pluginCtx` from this registration's `inject`, and
 * `inputActions`/`useInput` are standard session props.
 * @param props - standard session props, the tab hook context, and the
 * injected seats.
 */
function SideChatTab(props) {
  const { useTabInfo, inputActions, useInput, t, pluginCtx } = props
  const info = typeof useTabInfo === 'function' ? useTabInfo() : undefined
  const quote = quoteForTab(info?.tab?.navigation?.params?.quote)
  // A locale switch must reach the Host prompt language, so subscribe to the
  // locale snapshot rather than reading it once.
  const localeService = pluginCtx?.locale
  const locale = React.useSyncExternalStore(
    React.useCallback(
      (listener) => (typeof localeService?.subscribe === 'function' ? localeService.subscribe(listener) : () => {}),
      [localeService],
    ),
    React.useCallback(
      () => (typeof localeService?.getLocale === 'function' ? localeService.getLocale().active : 'zh'),
      [localeService],
    ),
    React.useCallback(() => 'zh', []),
  )

  if (quote === '') {
    return h('div', { className: 'qc-side' },
      h('div', { className: 'qc-quote' },
        h('div', { className: 'qc-quote-body' }, t('side.noQuote')),
      ),
    )
  }
  return h(SideChat, { quote, t, locale: locale === 'en' ? 'en' : 'zh', inputActions, useInput })
}

// #endregion

// #region table anchor

/**
 * Anchor one table inside the flow, addressed by its own DOM path so the
 * gutter marker lands on the table rather than on the paragraph before it.
 *
 * The path is relative to the flow, matching `captureAnchor`, so a table
 * survives the row around it being rebuilt.
 * @param flow - the chat flow container.
 * @param table - the table element.
 * @returns the anchor record.
 */
function tableAnchor(flow, table) {
  const row = table.closest('[data-chat-node-key]') ?? null
  const path = nodePath(flow, table)
  return {
    nodeKey: row?.getAttribute('data-chat-node-key') ?? '',
    // A table anchors as a single element: start and end are the same node,
    // so the range covers the whole table rather than a character run.
    startPath: path,
    startOffset: 0,
    endPath: path,
    endOffset: table.childNodes.length,
    quote: table.innerText.trim(),
  }
}

// #endregion

// #region annotation dock

/**
 * Build the composer-dock controller: it watches the selection and the
 * pointer over answer tables, runs the annotation workflow, and renders the
 * strip, the gutter markers, and the jump highlight.
 * @param deps - the plugin's Client context and bound translate function.
 * @returns the React component registered into `conversation.input.dock`.
 */
function annotationDock(deps) {
  const { ctx, t: boundT } = deps
  return function AnnotationDock(props) {
    const { inputActions, useInput, sessionId } = props
    const t = typeof props.t === 'function' ? props.t : boundT
    const draft = useDraft(useInput)
    // The chip list is the authority on which annotations are still in the
    // draft; the annotation store alone cannot tell an edited-away chip.
    const occurrences = useDraftOccurrences(useInput)
    const inputStateRef = React.useRef(null)
    inputStateRef.current = { draft, occurrences }
    const annotations = useAnnotations(sessionId)
    /** `{ kind: 'actions' | 'compose', source }` — one floating surface at a time. */
    const [overlay, setOverlay] = React.useState(null)
    const [notice, setNotice] = React.useState('')
    const overlayRef = React.useRef(null)
    overlayRef.current = overlay

    const labels = React.useMemo(() => ({
      annotate: t('popup.annotate'),
      askInSide: t('popup.askInSide'),
      tooLong: t('popup.tooLong'),
      unavailable: t('popup.unavailable'),
      title: t('compose.title'),
      placeholder: t('compose.placeholder'),
      selected: t('compose.selected'),
      table: t('compose.table'),
      confirm: t('compose.confirm'),
      cancel: t('compose.cancel'),
      hint: t('compose.hint'),
      content: t('card.content'),
      remove: t('card.remove'),
      count: t('card.count'),
      clear: t('card.clear'),
      missing: t('card.missing'),
      limit: t('card.limit'),
      jump: t('marker.jump'),
      tableAdd: t('table.add'),
      edit: t('bubble.edit'),
      comment: t('bubble.comment'),
      saved: t('bubble.saved'),
      deleted: t('bubble.deleted'),
      /** Bubble-editor placeholder. The compose box keeps `placeholder`;
       * a duplicate key here silently overrode it, so the compose box was showing
       * the bubble's hint. */
      bubblePlaceholder: t('bubble.placeholder'),
      save: t('bubble.save'),
      delete: t('bubble.delete'),
    }), [t])

    // Dismissal: a press anywhere outside the open surface closes it.
    React.useEffect(() => {
      if (overlay === null) return undefined
      const onPointerDown = (event) => {
        const surface = document.querySelector('.qc-popup, .qc-compose')
        if (surface !== null && surface.contains(event.target)) return
        setOverlay(null)
      }
      const onKeyDown = (event) => {
        if (event.key === 'Escape') setOverlay(null)
      }
      document.addEventListener('mousedown', onPointerDown, true)
      document.addEventListener('keydown', onKeyDown, true)
      return () => {
        document.removeEventListener('mousedown', onPointerDown, true)
        document.removeEventListener('keydown', onKeyDown, true)
      }
    }, [overlay === null])

    // Selection tracking.
    //
    // The popup may only appear once the point has been released: `selectstart`
    // and `selectionchange` both fire while the pointer is still down, and a
    // `position: fixed` toolbar rendered mid-drag swallows the rest of the
    // gesture, freezing the selection at the first few characters. So the
    // pointer state gates every evaluation, and the keyboard path (which has
    // no pointer) opens on `keyup` only.
    React.useEffect(() => {
      if (typeof document === 'undefined') return undefined
      let frame = 0
      let pointerDown = false
      // Where the drag ended. The popup opens here: it is the point the user was
      // looking at when they finished selecting, so it reads as "next to my mouse"
      // rather than "at the start of the passage".
      let releasePoint = null
      const evaluate = () => {
        frame = 0
        if (overlayRef.current !== null) return
        if (pointerDown) return
        const next = readSelection(releasePoint)
        if (next === null) {
          setOverlay((current) => (current === null || current.kind === 'actions' ? null : current))
          return
        }
        if (next.text.length > MAX_QUOTE_CHARS) {
          setNotice(labels.tooLong.replace('{max}', String(MAX_QUOTE_CHARS)))
          setOverlay(null)
          return
        }
        setOverlay({ kind: 'actions', source: next })
      }
      const schedule = () => {
        if (frame !== 0) return
        frame = requestAnimationFrame(evaluate)
      }
      const onDown = () => {
        pointerDown = true
        // A new gesture: the previous release point must not leak into this one.
        releasePoint = null
      }
      const onUp = (event) => {
        pointerDown = false
        if (typeof event?.clientX === 'number' && typeof event?.clientY === 'number') {
          releasePoint = { x: event.clientX, y: event.clientY }
        } else {
          // A keyboard-driven selection has no pointer: fall back to the passage box.
          releasePoint = null
        }
        // Let the browser finish committing the selection before reading it.
        schedule()
      }
      document.addEventListener('pointerdown', onDown, true)
      document.addEventListener('mousedown', onDown, true)
      document.addEventListener('pointerup', onUp, true)
      document.addEventListener('mouseup', onUp, true)
      document.addEventListener('keyup', schedule, true)
      document.addEventListener('selectionchange', schedule)
      return () => {
        if (frame !== 0) cancelAnimationFrame(frame)
        document.removeEventListener('pointerdown', onDown, true)
        document.removeEventListener('mousedown', onDown, true)
        document.removeEventListener('pointerup', onUp, true)
        document.removeEventListener('mouseup', onUp, true)
        document.removeEventListener('keyup', schedule, true)
        document.removeEventListener('selectionchange', schedule)
      }
    }, [labels])

    React.useEffect(() => {
      if (notice === '') return undefined
      const timer = setTimeout(() => setNotice(''), 3200)
      return () => clearTimeout(timer)
    }, [notice])

    // The flash is painted by the browser's highlight registry, which clears
    // itself; there is no React state to expire here any more.
    React.useEffect(() => () => clearFlashRange(), [])

    /**
     * Put one annotation into the draft as an inline chip.
     *
     * `setDraft({ text, references })` is the only channel that reaches the
     * editor's `restoreDraft`, which mints a real inline `ReferenceChipNode`
     * — an atomic, non-editable decorator sitting in the text flow. The chip
     * therefore behaves like the `@file` chips: arrows step across it,
     * Backspace removes it whole, and the user can type prose before and
     * after it in the same paragraph.
     *
     * Only the placeholder goes into the text. The passage and comment stay
     * in the payload registry and are expanded by `codec.serialize` on
     * submit, so the card is one clean token rather than a token followed by
     * loose prose.
     * @param annotation - the annotation to place.
     * @returns whether the draft accepted the chip.
     */
    const writeChip = React.useCallback((annotation) => chipBridge.place(
      inputActions,
      () => ({ draft, occurrences: inputStateRef.current?.occurrences }),
      annotation,
      labels,
    ), [draft, inputActions, labels])

    /**
     * Dismiss the comment box without saving.
     *
     * Enter and the confirm button are the only ways to commit; every other
     * dismissal - Escape, the cancel button, or a click anywhere outside the box -
     * lands here. The passage highlight is cleared because an abandoned comment must
     * not leave the text looking annotated.
     *
     * A stable identity matters: this is passed into the popover's outside-click
     * effect, and a fresh function each render would rebind the listener constantly.
     */
    const cancelCompose = React.useCallback(() => {
      clearFlashRange()
      setOverlay(null)
    }, [])

    /** Store one annotation and mirror it into the draft as an inline chip. */
    const commit = React.useCallback((source, comment) => {
      if (sessionId === undefined) return
      const text = typeof comment === 'string' ? comment.trim() : ''
      const stored = addAnnotation(sessionId, {
        kind: source.kind,
        text: source.text,
        previewText: source.previewText,
        // The captured markup is what the card replays. It used to be stored
        // under `html` while the card read `previewHtml`, so every card body
        // came out blank — the "content is not rendered" symptom.
        previewHtml: source.kind === 'table' ? '' : source.previewHtml,
        // A table is annotatable too: the requirement asks for a comment box
        // on tables, so its comment is kept like any other.
        comment: text,
        anchor: source.anchor,
      })
      if (stored === null) {
        setNotice(labels.limit.replace('{max}', String(MAX_ANNOTATIONS)))
        return
      }
      if (!writeChip(stored)) setNotice(labels.unavailable)
      setOverlay(null)
      clearSelection()
      // Confirm the passage was captured by flashing it. It is already in
      // view (it was just selected), so no scroll is needed.
      const flow = findFlow()
      const range = flow === null ? null : resolveAnchor(flow, stored.anchor)
      if (range !== null) flashRange(range)
    }, [sessionId, labels, writeChip])

    /** Open the annotation editor for one table. */
    const annotateTable = React.useCallback((table) => {
      const markdown = tableToMarkdown(table)
      if (markdown === '') return
      const flow = findFlow()
      setOverlay({
        kind: 'compose',
        source: {
          kind: 'table',
          text: markdown,
          previewHtml: '',
          previewText: markdown,
          rect: table.getBoundingClientRect(),
          rows: table.rows.length,
          anchor: flow === null
            ? { nodeKey: '', offset: 0, quote: '' }
            : tableAnchor(flow, table),
        },
      })
      clearSelection()
    }, [])

    /**
     * Light a passage while its editor is open, and clear it after.
     *
     * This is the same paint the jump uses, but without an expiry: the point is
     * to show WHICH passage is being commented on for as long as the editor is
     * open. It also scrolls the passage into view first, so opening the editor
     * on a bubble whose row has drifted off-screen still shows what is being
     * edited — which is the jump, folded into the same gesture.
     * @param annotation - the annotation being edited.
     * @param on - whether to light it or clear it.
     */
    const onHighlight = React.useCallback((annotation, on) => {
      const flow = findFlow()
      if (flow === null) return
      if (!on) {
        clearFlashRange()
        return
      }
      // Light the passage WITHOUT moving the view.
      //
      // Opening the bubble's editor used to scroll the transcript, which yanked the
      // page away from wherever the user was reading. Only the composer chip is
      // allowed to jump; clicking the bubble is a request to edit a comment, not to
      // relocate. So this resolves the passage in place and paints it, and leaves
      // scrollTop alone.
      const range = resolveAnchor(flow, annotation.anchor)
      if (range === null) return
      holdRange(range, () => {
        const live = findFlow()
        return live === null ? null : resolveAnchor(live, annotation.anchor)
      })
    }, [])

    const onJump = React.useCallback((annotation) => {
      const flow = findFlow()
      if (flow === null) {
        setNotice(diagnoseMiss(null, annotation))
        return
      }
      setNotice('')
      // Async because the transcript unmounts distant rows: a passage from an
      // older answer has no DOM until it is paged back in, so a miss means
      // "scroll and look again", not "gone".
      revealWithSearch(flow, annotation).then((range) => {
        if (range === null) {
          setNotice(diagnoseMiss(findFlow(), annotation))
          return
        }
        // The registry keeps the glow on the text from here on, so scrolling
        // or a later reflow cannot leave it stranded. It is re-resolved once
        // after the scroll settles, because the virtualiser rebuilds the rows
        // the returned range points at and a highlight over removed nodes
        // paints nothing.
        flashRange(range, FLASH_MS, () => {
          const live = findFlow()
          return live === null ? null : resolveAnchor(live, annotation.anchor)
        })
      }, (failure) => {
        console.error('[dsh-quote-chat] jump failed:', failure)
        setNotice(diagnoseMiss(findFlow(), annotation))
      })
    }, [])

    /**
     * Jump by chip id, the form the reference source receives.
     *
     * The source is registered once per plugin while annotations are
     * per-session, so it cannot hold a closure over this session's list; it
     * calls through this published handler instead.
     * @param ref - the chip's annotation id.
     * @returns whether an annotation with that id was found.
     */
    React.useEffect(() => {
      chipJumpHandler.current = (ref) => {
        const match = annotations.find((item) => item.id === ref)
        if (match === undefined) return false
        onJump(match)
        return true
      }
      return () => {
        if (chipJumpHandler.current !== null) chipJumpHandler.current = null
      }
    }, [annotations, onJump])

    const onRemove = React.useCallback((annotation) => {
      if (sessionId === undefined) return
      // Removing the annotation removes its chip, and any prose the user
      // typed after that chip stays: only the chip and its comment line go.
      chipBridge.release(
        inputActions,
        () => ({ draft, occurrences: inputStateRef.current?.occurrences }),
        annotation.id,
      )
      removeAnnotation(sessionId, annotation.id)
    }, [draft, inputActions, sessionId])

    /**
     * Rewrite one annotation's comment from the bubble editor.
     *
     * The draft is untouched: the chip already stands for this annotation, and
     * the comment reaches the model through the codec at submit time. Only the
     * stored comment changes, so the chip keeps its place and its number.
     */
    const onUpdate = React.useCallback((annotation, comment) => {
      if (sessionId === undefined) return
      // Keep the codec's payload in step with the store, or the model would
      // receive the previous comment while the chip shows the new one.
      chipRegistry.updateComment(annotation.id, comment)
      updateAnnotation(sessionId, annotation.id, comment)
    }, [sessionId])

    const onAsk = React.useCallback((source) => {
      const opener = ctx.get('sidebarRight')
      if (typeof opener?.openTab !== 'function') return
      quoteHandoff.remember(source.text)
      try {
        opener.openTab(TAB_KIND, {
          params: { quote: source.text, title: t('side.title') },
          revealIfOpened: true,
        })
      } catch (failure) {
        console.error('[dsh-quote-chat] side-chat open failed:', failure)
        setNotice(labels.unavailable)
        return
      }
      setOverlay(null)
      clearSelection()
    }, [ctx, labels, t])

    const canAnnotate = typeof inputActions?.setDraft === 'function'
      || (typeof inputActions?.captureInsertion === 'function'
        && typeof inputActions?.insertText === 'function')
    const canAsk = typeof ctx.get('sidebarRight')?.openTab === 'function'

    return h(React.Fragment, null,
      overlay === null ? null : overlay.kind === 'actions'
        ? h(ActionPopup, {
          anchor: overlay.source.rect,
          canAnnotate,
          canAsk,
          labels,
          onAnnotate: () => {
            // Light the selection immediately: the popover is about to cover part
            // of the transcript, so the highlight is what tells the user which
            // passage the comment belongs to. It stays lit for as long as the
            // popover is open.
            const source = overlay.source
            const flow = findFlow()
            if (flow !== null && source.anchor !== undefined) {
              const range = resolveAnchor(flow, source.anchor)
              if (range !== null) {
                holdRange(range, () => {
                  const live = findFlow()
                  return live === null ? null : resolveAnchor(live, source.anchor)
                })
              }
            }
            setOverlay({ kind: 'compose', source })
          },
          onAsk: () => onAsk(overlay.source),
        })
        : h(ComposerPopover, {
          source: overlay.source,
          labels,
          onConfirm: (comment) => commit(overlay.source, comment),
          onCancel: cancelCompose,
        }),
      h(ChipCards, { annotations, occurrences, labels, onJump, onRemove }),
      h(MarkerLayer, { annotations, occurrences, labels, onJump, onHighlight, onUpdate, onRemove }),
      h(TableAddButton, { label: labels.tableAdd, onAdd: annotateTable }),
      typeof notice === 'string' && notice !== ''
        ? h('div', { className: 'qc-notice' }, notice)
        : null,
    )
  }
}

// #endregion

// #region apply

/**
 * Browser plugin body.
 * @param ctx - Client context.
 */
function applyImpl(ctx) {
  installStyles(ctx)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'quote-chat: dictionaries')
  const t = ctx.locale.bind(NS)

  // The side-chat tab type. Optional: a host without the right Sidebar keeps
  // the annotation workflow and disables the other action.
  ctx.effect(() => {
    const handle = ctx.inject(['sidebarRightTabs'], (scope) => {
      const tabs = scope.sidebarRightTabs
      if (tabs === undefined || typeof tabs.register !== 'function') return
      const disposers = []
      try {
        disposers.push(tabs.register({
          id: TAB_ID,
          kind: TAB_KIND,
          title: () => t('side.title'),
          guide: [{
            id: 'quote-chat',
            order: 55,
            title: () => t('side.title'),
            description: () => t('side.guide'),
          }],
        }))
        disposers.push(scope.slots.inject('sidebar.right.pane.tab', () => scope.slots.register({
          name: 'sidebar.right.pane.tab',
          key: TAB_ID,
          locale: NS,
          inject: () => ({ pluginCtx: ctx }),
        }, SideChatTab)))
      } catch (error) {
        for (const dispose of disposers.splice(0)) dispose()
        console.error('[dsh-quote-chat] right-sidebar registration failed:', error)
        return undefined
      }
      return () => { for (const dispose of disposers.splice(0)) dispose() }
    })
    const release = typeof handle === 'function' ? handle : handle?.dispose?.bind(handle)
    return () => { if (typeof release === 'function') release() }
  }, 'quote-chat: side-chat tab type')

  // The reference source. This is what makes an annotation a chip rather
  // than stray text: the framework calls `codec.serialize` on submit to turn
  // the chip into the model's copy of the passage, and `openReference` when
  // the chip is clicked. Both bug reports — "clicking does nothing" and "the
  // content sits outside the card" — came from this registration not
  // existing: without it a chip is an inert token with no owner.
  ctx.effect(() => {
    const handle = ctx.inject(['inputTriggers'], (scope) => {
      const registry = scope.inputTriggers
      if (registry === undefined || typeof registry.registerSource !== 'function') return undefined
      return registry.registerSource({
        trigger: CHIP_TRIGGER,
        name: CHIP_SOURCE,
        openReference(_session, reference) {
          const jump = chipJumpHandler.current
          if (typeof jump !== 'function') return false
          // The chip knows which annotation it is; the dock knows where that
          // annotation's passage sits in the flow.
          return jump(reference?.ref) === true
        },
        codec: {
          clipboardText: () => CHIP_PLACEHOLDER,
          serialize(ref) {
            const payload = chipRegistry.get(ref)
            if (payload === undefined) {
              return Promise.reject(new Error(`quote-chat: unknown chip "${ref}"`))
            }
            return Promise.resolve(serializeChipForModel(payload))
          },
        },
      })
    })
    const release = typeof handle === 'function' ? handle : handle?.dispose?.bind(handle)
    return () => { if (typeof release === 'function') release() }
  }, 'quote-chat: reference source')

  // The annotation strip and its floating surfaces.
  ctx.effect(() => {
    const release = ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
      name: 'conversation.input.dock',
      id: 'quote-chat-annotations',
      order: 15,
      locale: NS,
    }, annotationDock({ ctx, t })))
    return () => { if (typeof release === 'function') release() }
  }, 'quote-chat: annotation dock')
}

// #endregion

// ── export surface ────────────────────────────────────────────────────────────

export const inject = ['slots', 'locale']

export function apply(ctx) {
  applyImpl(ctx)
}
