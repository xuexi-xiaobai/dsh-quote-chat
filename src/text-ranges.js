/**
 * Locating a passage in the transcript, and getting back to it.
 *
 * This is the module that answers "where is this quote, and is it still there?" — the question
 * every other feature depends on. It contains three layers:
 *
 * 1. **Paths** — `nodePath`/`nodeAtPath` address a node by child indices from a host element,
 *    which survives re-rendering as long as the structure does.
 * 2. **Anchors** — `captureAnchor` records a passage as (row key, block path, offsets); the
 *    transcript is virtualized, so a stored DOM node or Range would go stale the moment the
 *    row scrolled out. `resolveAnchor` rebuilds a live Range from that record.
 * 3. **Text search** — when structure has changed but the text has not,
 *    `locateText` finds the quote again by content, with whitespace normalised so a
 *    different NBSP or a re-wrapped line does not defeat the match.
 *
 * What this module does NOT do: paint, scroll, or decide policy. It never touches
 * `CSS.highlights`, never moves the viewport, and never decides whether a stale anchor should
 * be retried — it only reports that resolution failed, so the caller chooses.
 *
 * It is free of React on purpose: everything here is testable against a DOM alone, which is
 * why the anchor round-trip is covered without rendering the app.
 */
import { elementOf, cssEscape } from './dom.js'

/** The chat flow container: a selection outside it is not an answer passage. */
export const FLOW_SELECTOR = '[data-slot="conversation.chat.flow"]'

/**
 * Selectors for the chat flow, most specific first.
 *
 * The web build marks the flow with `data-slot`. The desktop build does not necessarily carry that attribute — its
 * layout comes from a different set of plugins — so a missing data-slot must not disable the whole plugin. The
 * fallbacks are structural rather than generated class names: the flow is the scrollable element that holds the
 * message rows, and its rows are marked with `data-message-id` in both builds.
 *
 * Order matters: the most specific match wins, and the structural ones are only tried when nothing better is found.
 */
export const FLOW_SELECTORS = [
  '[data-slot="conversation.chat.flow"]',
  '[data-slot="conversation.chat"]',
  '[data-message-id]',
  '[data-chat-flow]',
]

/**
 * Find the chat flow element.
 *
 * Walks {@link FLOW_SELECTORS} in order and returns the first match that is not inside a sidebar tab and that either
 * renders a box or contains rows that do. When the last selector matches a message ROW rather than the container, the
 * row's nearest scrollable ancestor is used instead, because the flow is the scroller.
 *
 * @returns the flow element, or null when no chat is mounted.
 */
export function findFlowElement() {
  if (typeof document === 'undefined') return null
  for (const selector of FLOW_SELECTORS) {
    const matches = [...document.querySelectorAll(selector)]
      .filter((element) => element.closest('[data-sidebar-right-tab]') === null)
    if (matches.length === 0) continue
    // A row match (data-message-id) is not the flow: climb to the element that scrolls it.
    const first = matches[0]
    if (selector === '[data-message-id]') {
      for (let node = first.parentElement; node !== null; node = node.parentElement) {
        if (node.scrollHeight > node.clientHeight + 8) return node
      }
    }
    return first
  }
  return null
}

/**
 * Block-level elements a bubble can use as its containing block.
 *
 * Each is its own box with a well-defined top edge, so the bubble can sit at top:0 without
 * any measured offset.
 */
    export const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, table, figure'

    /**
     * Build a DOM range from a character offset inside one element.
     * @param root - the containing element.
     * @param offset - start offset in `root.textContent`.
     * @param length - number of characters to cover.
     * @returns the range, or null when the offsets fall outside the element.
     */
    export function rangeAt(root, offset, length) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let consumed = 0
      let startNode = null
      let startOffset = 0
      let endNode = null
      let endOffset = 0
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        // Skip plugin chrome. The comment panel and the gutter bubble live inside the
        // paragraph, so their labels are text nodes too. Counting them shifts every
        // offset, and the range then lands past the passage - which is how the
        // fluorescent highlight ended up painting over the editor's own buttons.
        if (node.parentElement?.closest('[data-qc-ignore]') != null) continue
        const next = consumed + node.data.length
        if (startNode === null && offset < next) {
          startNode = node
          startOffset = offset - consumed
        }
        if (startNode !== null && offset + length <= next) {
          endNode = node
          endOffset = offset + length - consumed
          break
        }
        consumed = next
      }
      if (startNode === null || endNode === null) return null
      const range = document.createRange()
      range.setStart(startNode, Math.max(0, Math.min(startOffset, startNode.data.length)))
      range.setEnd(endNode, Math.max(0, Math.min(endOffset, endNode.data.length)))
      return range
    }

    /**
     * The child-index path from an ancestor down to a node.
     * @param host - the ancestor element.
     * @param node - the descendant to locate.
     * @returns the index list, or null when `node` is not inside `host`.
     */
    export function nodePath(host, node) {
      const path = []
      let current = node
      while (current !== null && current !== host) {
        const parent = current.parentNode
        if (parent === null) return null
        path.unshift([...parent.childNodes].indexOf(current))
        current = parent
      }
      return current === host ? path : null
    }

    /**
     * Walk a child-index path back to a node.
     * @param host - the ancestor element.
     * @param path - the index list.
     * @returns the node, or null when the tree no longer matches.
     */
    export function nodeAtPath(host, path) {
      let current = host
      for (const index of path) {
        const next = current?.childNodes?.[index]
        if (next === undefined) return null
        current = next
      }
      return current ?? null
    }

    /**
     * Describe where a selection starts, in a form that survives a re-render.
     *
     * The anchor is a pair of DOM points (child-index path plus offset), not a
     * character count: `Range.toString()` inserts newlines across block
     * boundaries while `textContent` does not, so any offset measured one way and
     * replayed the other silently misses on a multi-paragraph selection.
     *
     * Paths are taken **relative to the flow**, not to the row: a selection that
     * starts in one paragraph and ends in the next produced an `endPath` that was
     * not a descendant of the start row, so it came back `null` and the whole
     * path branch was skipped — which is why a single-paragraph jump worked while
     * a longer one reported "no longer in this conversation". `nodeKey` still
     * rides along to scroll the right row into view and to prefer a row-local
     * match first.
     * @param range - the live selection range.
     * @param flow - the chat flow container.
     * @returns the anchor record.
     */
    export function captureAnchor(range, flow) {
      const row = elementOf(range.startContainer)?.closest('[data-chat-node-key]') ?? null
      return {
        nodeKey: row?.getAttribute('data-chat-node-key') ?? '',
        startPath: nodePath(flow, range.startContainer),
        startOffset: range.startOffset,
        endPath: nodePath(flow, range.endContainer),
        endOffset: range.endOffset,
        quote: range.toString(),
      }
    }

    /**
     * Rebuild the range one anchor describes.
     *
     * Four things can go wrong between capture and click, and each used to fail
     * silently:
     *
     * - the row is not in the DOM at all (the flow virtualizes long
     *   conversations), handled by resolving against the flow instead;
     * - the subtree was rebuilt (a settled stream, a rendered formula, a
     *   collapsed tool row), so the recorded path now points at different text —
     *   handled by validating the rebuilt range against the quote instead of
     *   trusting it because it is non-empty;
     * - the two ends live in different rows, which a row-scoped path could not
     *   express;
     * - the passage moved, handled by the text fallback.
     * @param flow - the chat flow container.
     * @param anchor - the stored anchor.
     * @returns the range, or null when the passage is gone.
     */
    export function resolveAnchor(flow, anchor) {
      if (flow === null || anchor.quote === '') return null

      // Preferred path: the exact DOM points recorded at capture time — but only
      // if they still resolve to the quoted text. A rebuilt subtree can leave the
      // path structurally valid and semantically wrong, and returning that would
      // scroll to an unrelated sentence.
      if (Array.isArray(anchor.startPath) && Array.isArray(anchor.endPath)) {
        const startNode = nodeAtPath(flow, anchor.startPath)
        const endNode = nodeAtPath(flow, anchor.endPath)
        if (startNode !== null && endNode !== null) {
          try {
            const range = document.createRange()
            range.setStart(startNode, Math.min(anchor.startOffset, (startNode.textContent ?? '').length))
            range.setEnd(endNode, Math.min(anchor.endOffset, (endNode.textContent ?? '').length))
            // Compare against the filtered text: the bubble lives inside this
            // subtree, so a raw range.toString() would include its ordinal and the
            // passage would never match - which silently pushed every anchor onto the
            // slow full-text path.
            if (sameText(textOfWithin(range, anchor.quote), anchor.quote)) return range
          } catch {
            // The tree moved under us; fall through to the text search.
          }
        }
      }

      // The owning row first: it is the tightest match and keeps a phrase that
      // appears several times in the answer on the row it came from.
      const row = anchor.nodeKey === ''
        ? null
        : flow.querySelector(`[data-chat-node-key="${cssEscape(anchor.nodeKey)}"]`)
      if (row !== null) {
        const local = locateText(row, anchor.quote)
        if (local !== null) {
          const range = rangeAt(row, local.offset, local.length)
          if (range !== null) return range
        }
      }

      // Last resort: the whole flow. This is what makes a row that unmounted
      // (virtualization), a passage that re-rendered elsewhere, or a selection
      // spanning two rows still reachable.
      const anywhere = locateText(flow, anchor.quote)
      return anywhere === null ? null : rangeAt(flow, anywhere.offset, anywhere.length)
    }

    /**
     * Whitespace characters beyond `\s` that rich-text markup can contain.
     *
     * Kept as one definition shared by `sameText` and `locateText`. When the two
     * had their own idea of whitespace they disagreed about whether a stored
     * anchor matched the live text, and both the path check and the text search
     * would reject the same passage — which read as "the annotation is gone".
     */
    export const EXTRA_SPACE = '\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000'

    /** Zero-width characters that are invisible and must not affect matching. */
    export const ZERO_WIDTH = '\u200b-\u200d\ufeff'

    /**
     * Collapse a passage to a canonical form for comparison.
     *
     * Drops zero-width characters and folds every space-like character (including
     * NBSP and the ideographic space) to a single ASCII space.
     * @param value - the text to normalise.
     * @returns the canonical form.
     */
    export function squishText(value) {
      return value
        .replace(new RegExp(`[${ZERO_WIDTH}]`, 'g'), '')
        .replace(new RegExp(`[\\s${EXTRA_SPACE}]+`, 'g'), ' ')
        .trim()
    }

    /**
     * Whether two passages say the same thing, ignoring whitespace differences.
     * @param left - the first passage.
     * @param right - the second passage.
     * @returns true when they match after normalising whitespace.
     */
    export function sameText(left, right) {
      return squishText(left) === squishText(right)
    }

    /**
     * Find a quoted passage inside one element's text.
     *
     * Both sides are whitespace-collapsed before comparing, so a brief that spans
     * a paragraph break still matches the row's flat text.
     * @param host - the element to search.
     * @param quote - the captured text.
     * @returns the offset and length in `host`'s raw text, or null.
     */
    /**
     * The text a range covers, with plugin-owned nodes removed.
     *
     * A Range that spans a paragraph includes the bubble mounted inside it, so its
     * toString() carries the bubble's ordinal. That digit makes the recorded quote
     * unmatchable, and every anchor silently degrades to a text search.
     * @param range - the candidate range.
     * @param quote - the text being matched, used to bound the work.
     * @returns the range's text without plugin nodes.
     */
    export function textOfWithin(range, quote) {
      const raw = range.toString()
      if (raw === '' || raw.length < quote.length) return raw
      // Fast path: if no plugin node sits inside the range, the raw text is correct.
      const start = elementOf(range.startContainer)
      const box = start?.closest(BLOCK_SELECTOR) ?? start
      if (box === null || box === undefined) return raw
      if (box.querySelector('[data-qc-ignore]') === null) return raw
      return textOf(box)
    }

    /**
     * The text of a subtree, ignoring nodes this plugin owns.
     *
     * A bubble is mounted INSIDE the paragraph it marks, so its ordinal joins the
     * paragraph's textContent - "需要留意的取舍气泡现在对齐到1段落顶部". That single
     * stray digit broke anchoring in two ways at once: the recorded path no longer
     * ended on the quoted text (so the bubble fell back to a text search, which could
     * land elsewhere and made it jump), and the passage it resolved to was wrong (so
     * clicking the bubble edited nothing).
     *
     * @param host - the element to read.
     * @returns its text with plugin-owned nodes removed.
     */
    export function textOf(host) {
      if (host === null || host === undefined) return ''
      const ignored = host.querySelectorAll('[data-qc-ignore]')
      if (ignored.length === 0) return host.textContent ?? ''
      const copy = host.cloneNode(true)
      for (const node of copy.querySelectorAll('[data-qc-ignore]')) node.remove()
      return copy.textContent ?? ''
    }

    export function locateText(host, quote) {
      const raw = textOf(host)
      const exact = raw.indexOf(quote)
      if (exact >= 0) return { offset: exact, length: quote.length }
      // Whitespace-insensitive retry: collapse the needle and the haystack in
      // lockstep, remembering where each collapsed character came from.
      //
      // The character classes come from the same definitions `sameText` uses, or
      // the two disagree about what counts as whitespace: an NBSP would survive
      // the collapse here while `sameText` treats it as a space, so the path check
      // and the text search would each reject the other's answer.
      const spaceRe = new RegExp(`[\\s${EXTRA_SPACE}]`)
      const zeroRe = new RegExp(`[${ZERO_WIDTH}]`)
      const needle = squishText(quote)
      if (needle === '') return null
      const starts = []
      let flat = ''
      let pendingSpace = false
      for (let index = 0; index < raw.length; index += 1) {
        const char = raw[index]
        if (zeroRe.test(char)) continue
        if (spaceRe.test(char)) {
          pendingSpace = flat !== ''
          continue
        }
        if (pendingSpace) {
          starts.push(index - 1)
          flat += ' '
          pendingSpace = false
        }
        starts.push(index)
        flat += char
      }
      const at = flat.indexOf(needle)
      if (at < 0) return null
      const from = starts[at]
      const to = starts[at + needle.length - 1]
      return { offset: from, length: (to - from) + 1 }
    }
