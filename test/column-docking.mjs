/**
 * Guard where the bubble is docked, and the feedback loop that made it twitch.
 *
 * Two failures this protects against, both from measuring the wrong box:
 *
 *  1. Docking to the SCROLLER's width. The scroller spans the entire conversation
 *     pane; the prose is a narrower, centred column inside it. Using the pane put
 *     the bubble at the pane's right edge — visually against the navigation rail —
 *     and, because the pane does not follow a prose-column resize, the bubble
 *     stopped tracking a pane drag.
 *
 *  2. A measurement feedback loop. Measuring the column reads a rect per row, which
 *     can nudge layout and re-fire the ResizeObserver, which measures again. With
 *     the sidebar open that showed up as the layout twitching repeatedly.
 *
 * Run: node test/column-docking.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'client.js'), 'utf8')

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

function functionBody(name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) return ''
  let depth = 0
  let opened = false
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') {
      depth += 1
      opened = true
    } else if (char === '}') {
      depth -= 1
      if (opened && depth === 0) return source.slice(start, index + 1)
    }
  }
  return ''
}

const columnBody = functionBody('flowColumnBox')
const shiftBody = /const shift = \(\) => \{([\s\S]*?)\n        \}/.exec(source)?.[1] ?? ''

// ── 1. The column is the prose, not the pane ──────────────────────────────
check('the column is not the scroller width',
  !/scroller\.clientWidth/.test(columnBody),
  'the bubble is docked to the conversation pane, not the text column')
check('the column comes from the widest row',
  /data-chat-node-key/.test(columnBody) && /box\.right > best\.box\.right/.test(columnBody),
  'the column is not derived from the text rows')
check('the column keeps a fallback for an empty transcript',
  /ancestor = flow\.parentElement/.test(columnBody),
  'no fallback when no rows are mounted')
check('the bubble hugs the column edge',
  /column\.right \+ 4/.test(source), 'the offset is not tight to the column')

// ── 2. The column box is cached, and invalidated for the right reasons ────
check('the column box is cached per flow',
  /const columnCache = new WeakMap\(\)/.test(source)
    && /columnCache\.set\(flow, /.test(source),
  'the column is re-measured from scratch on every pass')
check('a resize drops the cache',
  shiftBody !== '' && /columnCache\.delete\(flow\)/.test(shiftBody),
  'the resize path reuses a stale column box')
check('a detached host clears the cache',
  /cachedHost !== null && !cachedHost\.isConnected/.test(source),
  'closing the sidebar leaves a dead host and a dead column box')

// ── 3. No feedback loop ──────────────────────────────────────────────────
check('a cheap pass bails when the edge did not move',
  /if \(edge === lastColumnRight\) return/.test(shiftBody),
  'every observer callback writes state, which can re-trigger layout')
check('a full pass records the edge it used',
  /lastColumnRight = Math\.round\(column\.right\)/.test(source),
  'the cheap pass cannot tell a real resize from a spurious callback')
check('the edge guard is reset with the host',
  /lastColumnRight = -1/.test(source),
  'a stale edge survives a remount')

// ── 4. The sidebar must not be mistaken for the transcript ────────────────
const findFlowBody = functionBody('findFlow')
check('findFlow skips the right-sidebar tab',
  /data-sidebar-right-tab/.test(findFlowBody),
  'a side-chat tab would be measured as the transcript')
check('the column lookup skips the right-sidebar tab',
  /closest\('\[data-sidebar-right-tab\]'\) !== null\) continue/.test(columnBody),
  'a side-chat row could become the measured column')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
