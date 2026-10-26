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
import { makeUseAnnotations } from './annotation-hooks.js'
import {
  serializeChipForModel, CHIP_SOURCE, CHIP_TRIGGER, CHIP_PLACEHOLDER
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
import {
  registerSideChatTab, registerReferenceSource, registerAnnotationDock,
} from './registrations.js'
import { TableAddButton, diagnoseMiss, tableAnchor } from './ui/table.js'
import { clearSelection, readSelection, tableToMarkdown } from './selection.js'
import {
  rangeAt, resolveAnchor, locateText, textOf, nodeAtPath,
  squishText, sameText, textOfWithin, FLOW_SELECTOR,
} from './text-ranges.js'

/** This package's locale namespace. */
const NS = 'quoteChat'

/** The tab type contributed to the right Sidebar. */
const TAB_ID = 'dsh-quote-chat:side'
const TAB_KIND = 'dsh-quote-chat'



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
  anchorAboveBubble: (flow, box, size) => layout.anchorAboveBubble(flow, box, size)
})

/**
 * The passage a freshly opened side chat should show.
 *
 * One handoff per plugin instance: navigation params win, and a pending quote is a 15-second
 * fallback for a Host that opens the tab without carrying them. The rules live in
 * quote-handoff.js.
 */
const quoteHandoff = createQuoteHandoff()

/**
 * The side chat. It borrows only the handoff, and binds `forTab` itself: the wrapper that used to
 * sit here existed solely to rename the method.
 */
const { SideChat, SideChatTab } = createSideChat({
  quoteForTab: (carried) => quoteHandoff.forTab(carried),
})

const { ActionPopup, ComposerPopover } = createPopovers({
  findFlow: layout.findFlow,
  anchorInTranscript: (flow, box, size, prefer) => layout.anchorInTranscript(flow, box, size, prefer),
  // Viewport-space placement for the compose panel: above the selection, then docked once it has text.
  anchorAboveSelection: layout.anchorAboveSelection,
  snapPosition: layout.snapPosition,
})

/**
 * Range highlights: the transient jump glow and the held editor glow.
 *
 * One highlighter per Host factory call, so two instances never clear each other's paint.
 * The registry name, the timings and the identity guards live in highlight.js.
 */
const highlighter = createHighlighter()


// #region annotation store

/**
 * This plugin instance's annotations.
 *
 * One store per Host factory call, so two plugin instances never share annotations while a single
 * instance fans them out across sessions by `sessionId`. The store itself lives in
 * `annotation-store.js`; its `add` / `remove` / `update` / `snapshot` / `subscribe` are used
 * directly rather than wrapped, because the wrappers were identical in name, arity and order.
 */
const annotationStore = createAnnotationStore({ maxAnnotations: MAX_ANNOTATIONS })

/**
 * The React binding over that store.
 *
 * Built once here so the hook keeps a stable identity, and kept out of the store so the store stays
 * renderer-free. See annotation-hooks.js for why the two callbacks must be memoised.
 */
const useAnnotations = makeUseAnnotations(annotationStore)

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

// #region apply

/**
 * Browser plugin body: wiring, not behaviour.
 *
 * What this plugin is made of, in the order it is assembled. Each registration owns one host
 * concern and lives in registrations.js; the components and stores above are created once here so
 * two plugin instances never share state.
 *
 * @param ctx - Client context.
 */
function applyImpl(ctx) {
  installStyles(ctx)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'quote-chat: dictionaries')
  const t = ctx.locale.bind(NS)

  registerSideChatTab({ ctx, t, TAB_ID, TAB_KIND, NS, SideChatTab })

  registerReferenceSource({
    ctx,
    registry: chipRegistry,
    jumpHandler: chipJumpHandler,
    CHIP_TRIGGER,
    CHIP_SOURCE,
    CHIP_PLACEHOLDER,
    serializeChipForModel,
  })

  registerAnnotationDock({
    ctx,
    NS,
    buildDock: () => annotationDock({
        ctx,
        // The annotation lifecycle: one store, plus the React binding over it.
        annotations: { store: annotationStore, useAnnotations },
        // Chip identity and the draft seam.
        chips: { registry: chipRegistry, bridge: chipBridge, jumpHandler: chipJumpHandler },
        // Painting: the transient glow and the held editor highlight.
        highlights: highlighter,
        // Restoring a stored passage into view.
        navigation,
        // The passage a freshly opened side chat should show.
        quoteHandoff,
        // Component types, created once at wiring.
        surfaces: { ActionPopup, ComposerPopover, ChipCards, MarkerLayer, TableAddButton },
        // Reading what the user selected, and explaining a jump that missed.
        selection: {
          readSelection, clearSelection, tableToMarkdown, tableAnchor, diagnoseMiss,
          findFlow: layout.findFlow,
        },
        // Declared limits and protocol ids.
        limits: { MAX_QUOTE_CHARS, MAX_ANNOTATIONS, TAB_KIND },
        t,
    }),
  })
}

// ── export surface ────────────────────────────────────────────────────────────

export const inject = ['slots', 'locale']

export function apply(ctx) {
  applyImpl(ctx)
}
