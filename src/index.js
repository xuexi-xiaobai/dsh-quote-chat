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
import { annotationDock } from './ui/dock.js'
import { TableAddButton, diagnoseMiss, tableAnchor } from './ui/table.js'
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

/** The chat flow anchor. */
const findFlow = () => layout.findFlow()

/** Place a surface against a selection, inside the readable band. */
const anchorInTranscript = (flow, box, size, prefer) => layout.anchorInTranscript(flow, box, size, prefer)

/** Place the comment panel above a bubble, right edges flush. */
const anchorAboveBubble = (flow, bubble, size) => layout.anchorAboveBubble(flow, bubble, size)

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

// #endregion

// #region icons

// #endregion

// #region side-chat transport

// The side-chat transport (URL, request, SSE parsing) lives in
// side-chat-transport.js; this module is imported above.

// #region floating surfaces

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
    }, annotationDock({
        ctx, navigation, chipRegistry, chipBridge, chipJumpHandler,
        addAnnotation, removeAnnotation, updateAnnotation, useAnnotations,
        flashRange, clearFlashRange, holdRange, quoteHandoff,
        ActionPopup, ComposerPopover, ChipCards, MarkerLayer, TableAddButton,
        diagnoseMiss, tableAnchor, readSelection, clearSelection, tableToMarkdown,
        findFlow,
        MAX_QUOTE_CHARS,
        MAX_ANNOTATIONS,
        TAB_KIND,
        t,
      })))
    return () => { if (typeof release === 'function') release() }
  }, 'quote-chat: annotation dock')
}

// #endregion

// ── export surface ────────────────────────────────────────────────────────────

export const inject = ['slots', 'locale']

export function apply(ctx) {
  applyImpl(ctx)
}
