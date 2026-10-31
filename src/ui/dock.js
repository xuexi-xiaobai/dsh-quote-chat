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
  serializeChipForModel, CHIP_SOURCE, CHIP_TRIGGER, CHIP_PLACEHOLDER, chipRemovalSite, chipOrdinal, orphanedIds,
  staleChipRefs, withoutChip, chipLabel,
} from '../chip-draft.js'
import { useDraft, useDraftOccurrences } from './draft-hooks.js'
import { FLASH_MS } from '../highlight.js'

/** createElement, bound once. */
const h = React.createElement



/** Surfaces a selection must never come from. */
const NON_ANSWER_SELECTOR = 'textarea, input, [contenteditable="true"], [data-slot="conversation.composer"]'

/** Elements a card must not replay. */
const UNSAFE_IN_CARD = 'script, style, iframe, object, embed, link, meta'

/**
 * How long the undo offer stands after a removal.
 *
 * Module scope, not the component body: it is used as an effect dependency and as the deadline for the countdown, and a
 * value re-created on every render would restart the interval continuously and the bar would never close.
 */
const UNDO_MS = 5000
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
    useAnnotations, store: annotationStore, persistence: annotationPersistence,
  } = annotations
  // The store's own methods, used directly: the entry's wrappers were identical pass-throughs.
  const { add: addAnnotation, remove: removeAnnotation, update: updateAnnotation } = annotationStore
  const {
    registry: chipRegistry, bridge: chipBridge, jumpHandler: chipJumpHandler, labelHandler: chipLabelHandler,
  } = chips
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
    /**
     * The one removed annotation that can still be restored, or null.
     *
     * ONE entry, not a stack: the bar offers a single "撤销", so keeping several would mean a button that restores
     * something other than what its label says. A second removal replaces the offer.
     */
    const undoRef = React.useRef(null)
    /** Mirrors `undoRef.current !== null` so the bar can render without reading a ref during render. */
    const [undoPending, setUndoPending] = React.useState(false)
    /** Counts down the seconds left in the undo window; 0 hides the bar. */
    const [undoLeft, setUndoLeft] = React.useState(0)
    /**
     * Bumped by every removal so the countdown effect restarts even when `undoPending` stays true.
     *
     * Without it, removing a second chip while the bar is still showing left the new offer running against the first
     * removal's deadline: the effect's dependency did not change, so it never re-ran.
     */
    const [undoToken, setUndoToken] = React.useState(0)
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
      stale: t('card.stale'),
      removed: t('card.removed'),
      undo: t('card.undo'),
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

    /**
     * Bring back the annotations stored by the previous page load, and give their chips a payload again.
     *
     * The Host restores the draft, chips included, but the plugin's annotations and chip payloads were memory-only:
     * every restored chip therefore had no owner, and the Host refuses a send containing one. Restoring the
     * annotations is what closes that loop — `chipRegistry.register` derives a payload from an annotation, so
     * re-registering here rebuilds exactly what the codec needs, with nothing else stored.
     *
     * Runs once per session, before the first paint that could serialize anything. `restoredRef` guards against a
     * second run re-registering payloads over live ones, which would resurrect a comment the user has since edited.
     */
    const restoredRef = React.useRef(null)
    React.useEffect(() => {
      if (sessionId === undefined) return
      if (restoredRef.current === sessionId) return
      // Marked BEFORE the read, so the save effect below never runs for a session whose stored list has not been
      // looked at yet — an early save would overwrite what this effect is about to load with an empty list.
      restoredRef.current = sessionId
      if (typeof annotationPersistence?.load !== 'function') return
      // Only when this page has nothing for the session: the store is the live truth, and a re-mount mid-session must
      // not overwrite edits with whatever happened to be on disk.
      if (annotationStore.snapshot(sessionId).length > 0) return
      const stored = annotationPersistence.load(sessionId)
      if (stored.length === 0) return
      annotationStore.restore(sessionId, stored)
      // The chips are already in the draft — the Host restored them — but they have no payload on this page load, so
      // the codec cannot resolve them. Registering rebuilds exactly that, derived from the annotation.
      for (const annotation of stored) {
        chipRegistry.register(annotation, chipLabel(annotation, labels))
      }
    }, [annotationPersistence, annotationStore, chipRegistry, labels, sessionId])

    /**
     * Save the session's annotations whenever they change.
     *
     * Written through the same list the UI reads, so what comes back is what was on screen. Nothing else is stored:
     * the chip payloads are derived from these entries on the next load, so a second copy could only disagree.
     */
    React.useEffect(() => {
      if (sessionId === undefined) return
      if (typeof annotationPersistence?.save !== 'function') return
      // Effects run in declaration order, so the restore above has already run for this session — but only once it
      // has is this list the authoritative one. Before that it is the empty state that precedes a restore.
      if (restoredRef.current !== sessionId) return
      annotationPersistence.save(sessionId, annotations)
    }, [annotations, annotationPersistence, sessionId])

    /**
     * Take out of the draft the chips this page load has no payload for.
     *
     * The Host persists the draft; the payload registry does not — it is built when the plugin loads. After a reload
     * the chip is still drawn, because the Host restores its own label, but `registry.get(ref)` answers nothing and the
     * codec rejects. The Host treats an unresolvable reference as a hard error: it refuses the whole send and puts the
     * draft back, so the user is stuck with a chip that looks fine and a send button that does nothing but show an
     * internal id.
     *
     * The chip cannot be repaired — the passage went with the page — so the only thing to do is remove it. That is not
     * data loss, there is nothing left to lose; the notice is what keeps it from being silent.
     */
    React.useEffect(() => {
      if (sessionId === undefined) return
      const stale = staleChipRefs(occurrences, (ref) => chipRegistry.has(ref), CHIP_SOURCE)
      if (stale.length === 0) return
      if (typeof inputActions?.setDraft !== 'function') return
      // One snapshot, not one `release` per chip: `release` reads the live draft on every call, so a second call would
      // still see the first chip's placeholder and cut at the wrong offsets.
      let snapshot = { text: draft, references: occurrences }
      let removed = 0
      for (const ref of stale) {
        const next = withoutChip(snapshot.text, snapshot.references, CHIP_SOURCE, ref)
        if (next === null) continue
        snapshot = next
        removed += 1
      }
      if (removed === 0) return
      inputActions.setDraft(snapshot)
      setNotice(labels.stale.replace('{n}', String(removed)))
    }, [chipRegistry, draft, inputActions, labels, occurrences, sessionId])

    /**
     * Drop the annotations whose chip is no longer in the draft.
     *
     * An annotation is meant to live as long as its chip, but two paths remove the chip without telling the plugin:
     * the Host clears the draft after a send, and Backspace deletes a chip directly. What is left is invisible — no
     * chip, so no marker bubble and no hover card, and therefore nothing on screen to delete it from — while still
     * occupying a slot in the limit. A session that had sent a dozen annotations could not add another, and the notice
     * only restated the limit.
     *
     * Called only when the limit is about to block. The store is bounded by the limit either way, so pruning on every
     * commit would churn it for nothing.
     *
     * @returns how many entries were dropped, for logging and for the suites.
     */
    const pruneOrphans = React.useCallback(() => {
      if (sessionId === undefined) return 0
      const dead = orphanedIds(annotations, occurrences, CHIP_SOURCE)
      for (const id of dead) removeAnnotation(sessionId, id)
      return dead.length
    }, [annotations, occurrences, removeAnnotation, sessionId])

    /** Store one annotation and mirror it into the draft as an inline chip. */
    const commit = React.useCallback((source, comment) => {
      if (sessionId === undefined) return
      // The limit counts annotations the user can still SEE. Entries left behind by a sent draft or a Backspaced chip
      // must not be what blocks the next one.
      if (annotations.length >= MAX_ANNOTATIONS) pruneOrphans()
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
    }, [annotations, sessionId, labels, pruneOrphans, writeChip])

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

    /**
     * Name a chip by its position in the draft, for the reference source.
     *
     * The number a chip shows is a POSITION — the third chip is "注释 3" no matter when it was created — but the copy
     * stored with its payload is frozen at registration. Deleting a chip in the middle shifts every chip after it, so
     * the frozen number stops matching what the user sees: the model read "注释 3" for a chip displayed as "注释 2",
     * and two chips could carry the same number.
     *
     * Same shape as the jump above, for the same reason: the source is registered once per plugin while the draft is
     * per-session, so it asks through this published handler instead of holding a closure over this session's list.
     */
    React.useEffect(() => {
      chipLabelHandler.current = (ref) => {
        const ordinal = chipOrdinal(occurrences, CHIP_SOURCE, ref)
        return ordinal === null ? null : labels.content.replace('{n}', String(ordinal))
      }
      return () => {
        if (chipLabelHandler.current !== null) chipLabelHandler.current = null
      }
    }, [occurrences, labels])

    /**
     * The draft as it is at this instant.
     *
     * Never a captured value. Every callback below that touches the draft runs after the user may have typed, and
     * `setDraft` replaces the composer wholesale, so a stale read destroys text instead of merely missing an update.
     */
    const readLiveDraft = React.useCallback(() => {
      const state = inputStateRef.current
      return {
        draft: typeof state?.draft === 'string' ? state.draft : '',
        occurrences: Array.isArray(state?.occurrences) ? state.occurrences : [],
      }
    }, [])

    /**
     * Remove an annotation's chip, keeping the annotation for a few seconds so the removal can be undone.
     *
     * THE DRAFT IS ALWAYS READ THROUGH `inputStateRef`, NEVER FROM THIS CALLBACK'S CLOSURE.
     *
     * `chipBridge.place` / `release` rebuild the whole draft from the string they are handed, so a stale string does not
     * merely fail to update — it REPLACES the composer. That is what made an earlier undo wipe whatever the user had
     * typed: `writeChip` was created during an earlier render and closed over that render's `draft`, so the restore
     * wrote a draft that still contained the old chip and none of the prose typed since. Everything that touches the
     * draft here reads `inputStateRef.current`, which is refreshed on every render.
     *
     * The window is 5 seconds and it is a real deadline, not a cosmetic one: after it the annotation is genuinely
     * dropped, so the bar never offers something it can no longer do.
     */
    const onRemove = React.useCallback((annotation) => {
      if (sessionId === undefined) return
      // One read for both the cut and the record of it. Reading twice would let the two disagree, and the record has
      // to describe the draft the cut was actually made in.
      const live = readLiveDraft()
      // Where the chip is about to come out of, and the break the cut will take with it. Measured BEFORE the rewrite
      // because the offset stops existing the moment the chip is gone — which is exactly why undo used to append.
      const site = chipRemovalSite(live.draft, live.occurrences, CHIP_SOURCE, annotation.id)
      // Removing the annotation removes its chip; prose typed after that chip stays.
      chipBridge.release(inputActions, () => live, annotation.id)
      removeAnnotation(sessionId, annotation.id)
      // One entry, replaced by each removal. The live record carries the passage, the comment and the anchor, plus the
      // place the chip came out of so the undo can put it back there instead of at the end.
      undoRef.current = { annotation, site }
      setUndoPending(true)
      setUndoLeft(Math.ceil(UNDO_MS / 1000))
      // Restart the countdown for EVERY removal, including one that lands while the bar is already showing.
      //
      // `undoPending` cannot express that: it goes true -> true on a second removal, and a dependency that does not
      // change does not re-run the effect, so the new entry inherited the FIRST removal's deadline and could expire in
      // under five seconds. A counter always changes, so the effect always restarts with a fresh deadline.
      setUndoToken((value) => value + 1)
    }, [inputActions, readLiveDraft, sessionId])

    /**
     * Count the undo window down and close it.
     *
     * Driven by an interval rather than a chain of timeouts so the number on the bar and the closing moment come from
     * the SAME clock — a timeout chain would drift from the label after a slow frame.
     */
    React.useEffect(() => {
      if (!undoPending) return undefined
      const deadline = Date.now() + UNDO_MS
      const tick = () => {
        const remaining = deadline - Date.now()
        if (remaining <= 0) {
          undoRef.current = null
          setUndoPending(false)
          setUndoLeft(0)
          return
        }
        setUndoLeft(Math.ceil(remaining / 1000))
      }
      setUndoLeft(Math.ceil(UNDO_MS / 1000))
      const timer = setInterval(tick, 250)
      return () => clearInterval(timer)
    }, [undoPending, undoToken])

    /** Put the most recently removed annotation back, chip and all — in the place it came out of. */
    const onUndoRemove = React.useCallback(() => {
      if (sessionId === undefined) return
      const entry = undoRef.current
      undoRef.current = null
      setUndoPending(false)
      setUndoLeft(0)
      if (entry === null) return
      const { annotation, site } = entry
      // Same guard as `commit`: a restore must not be blocked by entries the user cannot see, let alone delete.
      if (annotations.length >= MAX_ANNOTATIONS) pruneOrphans()
      const restored = addAnnotation(sessionId, {
        kind: annotation.kind,
        text: annotation.text,
        previewText: annotation.previewText,
        previewHtml: annotation.previewHtml,
        comment: annotation.comment,
        anchor: annotation.anchor,
      })
      if (restored === null) {
        setNotice(labels.limit.replace('{max}', String(MAX_ANNOTATIONS)))
        return
      }
      // Read the CURRENT draft: the user may have typed since the removal. `site` is where the chip came out, measured
      // in the draft as it stood right after the cut; if the user typed before that point the index is stale, and
      // `withChipAt` clamps it rather than writing an offset the composer cannot resolve. A null site means the chip
      // was already gone when the annotation was removed, so there is no place to restore to and the chip is appended.
      if (!chipBridge.placeAt(inputActions, readLiveDraft, restored, labels, site)) {
        setNotice(labels.unavailable)
      }
    }, [annotations, inputActions, labels, pruneOrphans, readLiveDraft, sessionId])

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

    /**
     * Keep `--qc-composer-offset` on the document equal to the composer's distance from the bottom of the viewport.
     *
     * The undo bar is `position: fixed`, so it cannot inherit the composer's position the way a sibling would. Measuring
     * is the only way for it to sit just above the composer at any window size and with any amount of text in the box.
     * Written once per change rather than per animation frame: the composer's top only moves when the draft grows or the
     * window resizes, and both of those fire an observer.
     */
    React.useEffect(() => {
      if (typeof document === 'undefined') return undefined
      const sync = () => {
        // Resolved per call, not captured: the host can re-create the composer without this component re-rendering.
        const editor = [...document.querySelectorAll('[contenteditable="true"]')]
          .filter((element) => element.closest('[data-sidebar-right-tab]') === null)
          .find((element) => element.getBoundingClientRect().height > 0)
        const box = editor?.getBoundingClientRect?.()
        if (box === undefined || box === null || box.height === 0) return
        const offset = Math.max(0, Math.round(window.innerHeight - box.top + 8))
        document.documentElement.style.setProperty('--qc-composer-offset', `${offset}px`)
      }
      sync()
      const timer = setInterval(sync, 500)
      window.addEventListener('resize', sync)
      return () => {
        clearInterval(timer)
        window.removeEventListener('resize', sync)
        document.documentElement.style.removeProperty('--qc-composer-offset')
      }
    }, [])

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
      h(ChipCards, {
        annotations, occurrences, labels, onJump, onRemove, setDraft: inputActions?.setDraft, draft,
      }),
      h(MarkerLayer, { annotations, occurrences, labels, onJump, onHighlight, onUpdate, onRemove }),
      h(TableAddButton, { label: labels.tableAdd, onAdd: annotateTable }),
      // The whole bar is the control.
      //
      // It used to be a container whose only live region was a small button inside it, and pressing the middle of the
      // bar did nothing — reported as "the undo button is hard to hit". A single button makes every pixel work, and the
      // label reads as the action it performs rather than as a caption.
      undoPending
        ? h('button', {
          type: 'button',
          className: 'qc-undo',
          onClick: onUndoRemove,
          title: labels.undo,
        },
        h('span', { className: 'qc-undo-text' }, labels.removed),
        h('span', { className: 'qc-undo-action', 'aria-hidden': 'true' }, labels.undo),
        // A thin bar that drains over the life of the window, so the deadline is visible rather than surprising.
        h('span', {
          className: 'qc-undo-meter',
          'aria-hidden': 'true',
          style: { '--qc-undo-left': String(undoLeft) },
        }))
        : null,
      typeof notice === 'string' && notice !== ''
        ? h('div', { className: 'qc-notice' }, notice)
        : null,
    )
  }
}
