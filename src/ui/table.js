/**
 * Tables as annotation targets.
 *
 * ## Why a table needs its own affordance
 *
 * A table cannot be annotated through a text selection the way prose can. Selecting cells gives a
 * fragmented range, and the plugin anchors a passage by a text quote so it can find it again after
 * the transcript rebuilds — which a table's cell layout does not survive. So a table is anchored as
 * ONE element: start and end paths are the same, the range covers the whole table, and the quote is
 * the table's text.
 *
 * That is also why the control is a button that follows the pointer rather than the selection
 * toolbar: the user hovers a table, not selects it.
 *
 * ## Position around the pointer
 *
 * The button is placed at the table's top-right corner, offset inward so it sits over the header
 * rather than outside the table. `mousedown` is prevented so pressing it does not clear the hover
 * state before the click lands.
 *
 * ## The listeners
 *
 * Mousemove is the only way to know the pointer entered a table that is created later, so it is
 * observed on the document in capture phase and coalesced into one animation frame — a table under
 * a moving pointer would otherwise cause a `setState` per event.
 */
import React from 'react'
import { createPortal } from 'react-dom'
import { elementOf, cssEscape } from '../dom.js'
import { nodePath, FLOW_SELECTOR } from '../text-ranges.js'
import { IconAnnotate } from '../icons.js'

/** createElement, bound once. */
const h = React.createElement

/** Never let a surface touch the viewport edge. */
const VIEWPORT_MARGIN = 8

/** How far in from the table's right edge the button sits. */
const TABLE_BUTTON_INSET = 116

/** How far below the table's top edge the button sits. */
const TABLE_BUTTON_OFFSET = 4

/**
 * The "add this table" button that follows the pointer across answer tables.
 *
 * A table cannot share an annotation with the prose around it, so it gets its own control instead
 * of relying on a text selection.
 *
 * @param props - `{ label, onAdd }`.
 * @returns the button, or null when the pointer is not over a table.
 */
export function TableAddButton(props) {
  const { label, onAdd } = props
  const [target, setTarget] = React.useState(null)

  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined
    let frame = 0
    let pending = null
    // One state update per animation frame: a mousemove over a table would otherwise set state on
    // every event.
    const apply = () => {
      frame = 0
      if (pending === null) {
        setTarget((current) => (current === null ? current : null))
        return
      }
      const rect = pending.getBoundingClientRect()
      setTarget((current) => {
        // Same element at the same position: keep the previous object so React does not re-render.
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
    left: Math.max(VIEWPORT_MARGIN, target.rect.right - TABLE_BUTTON_INSET),
    top: Math.max(VIEWPORT_MARGIN, target.rect.top + TABLE_BUTTON_OFFSET),
  }
  return createPortal(
    h('button', {
      type: 'button',
      className: 'qc-table-add',
      style: { left: `${position.left}px`, top: `${position.top}px` },
      // Keep the pointer where it is: focusing the button would fire a mousemove elsewhere and
      // clear the target before the click.
      onMouseDown: (event) => event.preventDefault(),
      onClick: () => onAdd(target.element),
    }, h(IconAnnotate, null), label),
    document.body,
  )
}

/**
 * Explain why a jump missed, in terms of the state that actually failed.
 *
 * "Not found" is useless when debugging, because the failures are different: no flow at all, the
 * row unmounted (the transcript pages distant rows out of the DOM), or the row present but the
 * passage gone from it. Reporting the mounted-row count and the stored quote length turns the next
 * report into a diagnosis instead of another guess.
 *
 * @param flow - the chat flow, or null.
 * @param annotation - the annotation that failed to resolve.
 * @returns the notice text.
 */
export function diagnoseMiss(flow, annotation) {
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

/**
 * Anchor one table inside the flow, addressed by its own DOM path so the gutter marker lands on the
 * table rather than on the paragraph before it.
 *
 * The path is relative to the flow, matching `captureAnchor`, so a table survives the row around it
 * being rebuilt.
 *
 * @param flow - the chat flow container.
 * @param table - the table element.
 * @returns the anchor record.
 */
export function tableAnchor(flow, table) {
  const row = table.closest('[data-chat-node-key]') ?? null
  const path = nodePath(flow, table)
  return {
    nodeKey: row?.getAttribute('data-chat-node-key') ?? '',
    // A table anchors as a single element: start and end are the same node, so the range covers
    // the whole table rather than a character run.
    startPath: path,
    startOffset: 0,
    endPath: path,
    endOffset: table.childNodes.length,
    quote: table.innerText.trim(),
  }
}
