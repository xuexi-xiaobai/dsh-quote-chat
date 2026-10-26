/**
 * Reading what the user has selected.
 *
 * ## The one rule this module exists to enforce
 *
 * A selection becomes an annotation only if it is one passage inside one answer. Everything here is
 * an early return that tests that condition, and the order of the tests is the order in which the
 * failures actually occur:
 *
 *   - empty or collapsed, so nothing to quote;
 *   - outside the chat flow, or spanning two flows, so not one passage;
 *   - inside the user's own message, which is already theirs;
 *   - inside a right-Sidebar tab, which owns its own composer;
 *   - inside an input surface, which is not prose.
 *
 * Returning null at each step is what keeps a stray drag from producing a chip.
 *
 * ## Why the pointer coordinate, not the selection box
 *
 * The popup opens where the pointer was released, because that is where the user's attention is at
 * the end of a drag. The selection's bounding box cannot serve: it spans every line, and its left
 * edge is always the leftmost one on the widest line.
 *
 * A keyboard selection has no pointer, so the box's right edge is used instead.
 *
 * ## Tables are their own kind
 *
 * A table is never merged with prose. If a selection merely touches one — starting inside it and
 * running out into the paragraph, or the reverse — the annotation narrows to the table rather than
 * quietly swallowing it into a text card. `tableToMarkdown` is how it becomes quotable text, and
 * `tableAnchor` is how it is found again.
 */
import { elementOf } from './dom.js'
import { captureAnchor, BLOCK_SELECTOR, FLOW_SELECTOR } from './text-ranges.js'
import { tableAnchor } from './ui/table.js'

/** Surfaces a selection must never come from. */
const NON_ANSWER_SELECTOR = 'textarea, input, [contenteditable="true"], [data-slot="conversation.composer"]'

/** Elements a card must not replay. */
const UNSAFE_IN_CARD = 'script, style, iframe, object, embed, link, meta'

/** Drop the visible selection so the toolbar does not immediately reopen. */
export function clearSelection() {
  if (typeof window === 'undefined') return
  const selection = window.getSelection()
  if (selection !== null && selection.rangeCount > 0) selection.removeAllRanges()
}

/**
 * Serialize a DOM fragment to HTML a card can replay.
 *
 * Scripts and event-handler attributes are stripped: the card renders this, and a copied passage
 * must not be able to run anything.
 *
 * @param fragment - the cloned selection contents.
 * @returns sanitized markup.
 */
export function fragmentHtml(fragment) {
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
export function tableToMarkdown(table) {
  const rows = [...table.rows].map((row) => [...row.cells].map((cell) => cell.innerText.replace(/\s+/g, ' ').trim()))
  const usable = rows.filter((row) => row.length > 0)
  if (usable.length === 0) return ''
  const width = Math.max(...usable.map((row) => row.length))
  const pad = (row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')]
  const line = (row) => `| ${pad(row).map((cell) => cell.replace(/\|/g, '\\|')).join(' | ')} |`
  const head = usable[0]
  return [line(head), `| ${pad(head).map(() => '---').join(' | ')} |`, ...usable.slice(1).map(line)].join('\n')
}

/**
 * Read the current selection as a quotable answer passage.
 *
 * @param pointer - where the pointer was released, in viewport coordinates; null for a keyboard
 *   selection.
 * @returns the source descriptor, or null when the selection is not one annotatable passage.
 */
export function readSelection(pointer) {
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
  // Where the popup should open: the release point when we have one, otherwise the selection's
  // right edge (a keyboard selection has no pointer).
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
  const table = startElement.closest('table') ?? endElement.closest('table')
  if (table !== null && flow.contains(table)) {
    const tableBox = table.getBoundingClientRect()
    return {
      kind: 'table',
      text: tableToMarkdown(table),
      previewHtml: '',
      previewText: table.innerText.trim(),
      rect: tableBox,
      block: table,
      blockRect: tableBox,
      anchor: tableAnchor(flow, table),
    }
  }
  const block = startElement.closest(BLOCK_SELECTOR) ?? flow
  return {
    kind: 'text',
    text: text.trim(),
    previewHtml: fragmentHtml(range.cloneContents()),
    previewText: text.trim(),
    rect,
    // The block that holds the selection, kept both as an element and as a snapshot of its box at
    // this moment. Placement must use the snapshot: a live `getBoundingClientRect()` at render time
    // reports wherever the block has moved to since, which put the panel 182–207px off in scenarios
    // where the transcript scrolled in between.
    block,
    blockRect: block.getBoundingClientRect(),
    anchor: captureAnchor(range, flow),
  }
}
