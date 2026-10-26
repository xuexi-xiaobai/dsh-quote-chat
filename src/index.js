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
import { tableHtml, escapeHtml } from './html.js'
import { createPopovers } from './ui/popovers.js'
import { createCards } from './ui/cards.js'
import { createMarkerLayer } from './ui/markers.js'
import { createSideChat } from './ui/side-chat.js'
import { useDraft, useDraftOccurrences } from './ui/draft-hooks.js'
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

/**
 * The floating surfaces over a selection.
 *
 * Created ONCE here, not inside a render: a factory call per render would mint new component
 * types and React would unmount and remount them, losing the editor's focus and measured size.
 */
const { composerContainer } = layout

const { ChipCards, AnnotationCard } = createCards({ composerContainer: layout.composerContainer })

/**
 * The gutter: numbered markers and the comment editor.
 *
 * Created once, like the other component groups; the marker layer owns portals into transcript
 * rows, so a per-render factory would remount them all.
 */
const { MarkerLayer } = createMarkerLayer({
  findFlow: layout.findFlow,
  columnElement: (flow) => layout.columnElement(flow),
  anchorAboveBubble: (flow, box, size) => layout.anchorAboveBubble(flow, box, size),
})

/**
 * The side chat.
 *
 * Created once during wiring. The tab body keeps its own message list and abort controller; the
 * only thing it borrows from the instance is the quote handoff.
 */
/**
 * The passage a freshly opened side chat should show.
 *
 * One handoff per plugin instance: navigation params win, and a pending quote is a 15-second
 * fallback for a Host that opens the tab without carrying them. The rules live in
 * quote-handoff.js.
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

const { SideChat, SideChatTab } = createSideChat({ quoteForTab })

const { ActionPopup, ComposerPopover } = createPopovers({
  findFlow: layout.findFlow,
  anchorInTranscript: (flow, box, size, prefer) => layout.anchorInTranscript(flow, box, size, prefer),
})

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
