/**
 * The annotation dock: the strip above the composer, and the gestures that fill it.
 *
 * ## Why this is a dock and not a composer feature
 *
 * The composer is a Lexical editor whose node types are fixed when it is created. A plugin cannot
 * add a node type, so the cards cannot live inside it. They live in a slot above it instead, and
 * the only thing that reaches the draft is a reference chip — a token the Host already knows how
 * to render and serialize.
 *
 * ## What it owns
 *
 * Selection reading, the compose popover, the chip strip, the gutter layering, the table
 * affordance, and the jump. That is one workflow: select a passage, annotate it, see it in the
 * strip, click it to come back.
 *
 * ## Dependencies, all injected
 *
 * Every per-instance capability arrives in one deps object: the annotation store, the chip
 * registry and bridge, the highlighter, navigation, the quote handoff, and the component types.
 * Nothing here imports the entry, so the entry stays a wiring file and this stays testable.
 *
 * ## Lifetimes that must not change
 *
 * The effect closures below register cleanup for every listener, timer and frame they start,
 * and the chip-jump handler is cleared on unmount so a stale dock cannot answer a chip click.
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { elementOf, cssEscape } from '../dom.js'
import {
  rangeAt, captureAnchor, resolveAnchor, locateText, textOf,
  squishText, sameText, textOfWithin, FLOW_SELECTOR, BLOCK_SELECTOR, isInsideTranscript,
} from '../text-ranges.js'
import {
  serializeChipForModel, CHIP_SOURCE, CHIP_TRIGGER, CHIP_PLACEHOLDER,
} from '../chip-draft.js'
import { useDraft, useDraftOccurrences } from './draft-hooks.js'
import { FLASH_MS } from '../highlight.js'

/** createElement, bound once. */
const h = React.createElement



/** Surfaces a selection must never come from. */
const NON_ANSWER_SELECTOR = 'textarea, input, [contenteditable="true"], [data-slot="conversation.composer"]'

/** Elements a card must not replay. */
const UNSAFE_IN_CARD = 'script, style, iframe, object, embed, link, meta'
export function annotationDock(deps) {
  const {
    ctx,
    annotations,
    chips,
    highlights,
    navigation,
    quoteHandoff,
    surfaces,
    selection,
    limits,
    t: boundT,
  } = deps

  // Flattened back to the names the body reads. Keeping the original names means the component
  // body needed no edit at all, which is what makes this change verifiable by the suites alone.
  const {
    useAnnotations, store: annotationStore,
  } = annotations
  // The store's own methods, used directly: the entry's wrappers were identical pass-throughs.
  const { add: addAnnotation, remove: removeAnnotation, update: updateAnnotation } = annotationStore
  const { registry: chipRegistry, bridge: chipBridge, jumpHandler: chipJumpHandler } = chips
  // The highlighter's own methods; the entry's wrappers added a default that no call site used.
  const {
    flash: flashRange, clear: clearFlashRange, hold: holdRange,
  } = highlights
  const {
    ActionPopup, ComposerPopover, ChipCards, MarkerLayer, TableAddButton,
  } = surfaces
  const {
    readSelection, clearSelection, tableToMarkdown, tableAnchor, diagnoseMiss, findFlow,
  } = selection
  const { MAX_QUOTE_CHARS, MAX_ANNOTATIONS, TAB_KIND } = limits
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

    // Dismissal: a press inside the TRANSCRIPT closes the open surface; the surrounding chrome does not.
    //
    // The rule used to be "a press anywhere outside the open surface closes it", which threw away a draft comment for
    // the slightest reason — adjusting a side panel, glancing at the header, or reaching for the composer. The draft is
    // the user's work, so only moving on to another part of the transcript may discard it.
    //
    // The test lives in `isInsideTranscript` so this handler and the popover's own one cannot disagree. Before it was
    // shared, this handler closed the panel on every outside press, which made the popover's own rule unreachable.
    React.useEffect(() => {
      if (overlay === null) return undefined
      const onPointerDown = (event) => {
        const surface = document.querySelector('.qc-popup, .qc-compose')
        if (surface !== null && surface.contains(event.target)) return
        if (!isInsideTranscript(event.target)) return
        // Dismissing must go through cancelCompose, not setOverlay: the compose step paints the
        // passage, and only cancelCompose clears it. Calling setOverlay here unmounted the popover
        // before its own listener could run, so the highlight was left painted with nothing open.
        cancelCompose()
      }
      const onKeyDown = (event) => {
        if (event.key === 'Escape') cancelCompose()
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
      /**
       * Only the primary button ends a selection.
       *
       * A right-click on a selection is the reader asking to copy it, not asking to annotate. The
       * selection survives that click, so without this guard the popup opens underneath the
       * browser's own copy menu. Non-numeric `button` keeps the previous behaviour.
       *
       * @param event - the pointer or mouse event.
       * @returns whether this event belongs to a primary gesture.
       */
      const isPrimary = (event) => {
        const button = event?.button
        return typeof button !== 'number' || button === 0
      }
      const onDown = (event) => {
        if (!isPrimary(event)) return
        pointerDown = true
        // A new gesture: the previous release point must not leak into this one.
        releasePoint = null
      }
      const onUp = (event) => {
        // Cleared for EVERY button: this flag means "a gesture is in progress", and whatever ended
        // it ends it. Gating this line on the primary button left it stuck at true after a
        // right-click, which suppressed every later evaluation and made the toolbar never appear.
        pointerDown = false
        if (!isPrimary(event)) return
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
      navigation.reveal(flow, annotation).then((range) => {
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
