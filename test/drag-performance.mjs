/**
 * Guard the bubble layer's cost during a pane drag.
 *
 * Dragging a pane edge fires the column ResizeObserver once per frame. The first
 * implementation ran the SAME full measurement on every one of those frames:
 *
 *   - `scrollContainerOf` walked ancestors calling getComputedStyle (style recalc)
 *   - `flowColumn` read a bounding rect for EVERY mounted row
 *   - `resolveAnchor` ran per annotation: a DOM path walk, then a TreeWalker over
 *     the transcript's whole text on a miss
 *   - `chipOrdinals` re-queried the composer's chips
 *
 * None of that can change from a width-only drag: vertical placement and anchor
 * resolution are unaffected. Only the horizontal offset is.
 *
 * The contract this file protects: a drag frame must do a bounded, small amount of
 * layout work — one container rect and one client width — and no anchor work.
 *
 * Run: node test/drag-performance.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'client.js'), 'utf8')

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

/** The body of a named function, by brace matching from its declaration. */
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

const shiftBody = /const shift = \(\) => \{([\s\S]*?)\n        \}/.exec(source)?.[1] ?? ''
const measureBody = /const measure = \(\) => \{([\s\S]*?)\n        \}\n        \/\*\*/.exec(source)?.[1]
  ?? functionBody('measure')

// ── 1. The drag path exists and is separate ────────────────────────────────
check('a cheap drag path exists', shiftBody !== '',
  'no separate shift() path; a drag would run a full pass')
check('the drag path does no anchor resolution',
  shiftBody !== '' && !/resolveAnchor/.test(shiftBody),
  'the drag path resolves anchors every frame')
check('the drag path does no chip lookup',
  shiftBody !== '' && !/chipOrdinals/.test(shiftBody),
  'the drag path re-queries the composer chips every frame')
check('the drag path does not re-detect the container',
  shiftBody !== '' && !/scrollContainerOf/.test(shiftBody),
  'the drag path walks ancestors every frame')
check('the drag path does not re-check computed style',
  shiftBody !== '' && !/getComputedStyle\(scroller\)/.test(shiftBody),
  'the drag path forces a style recalc every frame')

// ── 2. The column observer takes the cheap path ────────────────────────────
check('the column observer classifies the resize',
  /new ResizeObserver\(onColumnResize\)/.test(source)
    && /if \(widthOnly\)/.test(source),
  'the ResizeObserver cannot tell a width change from a reflow')
check('a full pass still runs once the drag settles',
  /settleTimer = setTimeout\([\s\S]{0,160}schedule\(\)/.test(source),
  'nothing corrects the layout after the drag ends')
check('the settle timer is cleaned up',
  /clearTimeout\(settleTimer\)/.test(source),
  'the settle timer leaks')

// ── 3. Column width is read cheaply ────────────────────────────────────────
const columnBody = functionBody('flowColumnBox')
check('the column box is cached between passes',
  /const columnCache = new WeakMap\(\)/.test(source)
    && /columnCache\.get\(flow\)/.test(source),
  'the column is re-measured from scratch every pass')
check('the column is measured from the text rows, not the scroller',
  !/scroller\.clientWidth/.test(columnBody),
  'the column is derived from the pane, which is wider than the prose column')
check('a drag re-measures the column exactly once',
  /columnCache\.delete\(flow\)/.test(source),
  'the resize path reuses a stale column box')
const fastPath = columnBody.slice(0, columnBody.indexOf('let best = null'))
check('the cached column is invalidated when the flow detaches',
  /cachedHost !== null && !cachedHost\.isConnected/.test(source),
  'a remounted transcript keeps a dead host and a dead column box')
check('the row scan survives only as a fallback',
  /data-chat-node-key/.test(columnBody),
  'the accurate fallback was removed entirely')

// ── 4. The container lookup is memoised ────────────────────────────────────
check('the container lookup is memoised',
  /const containerCache = new WeakMap\(\)/.test(source)
    && /function containerFor\(flow\)/.test(source),
  'scrollContainerOf still runs on every measurement')
check('the cached container is re-validated',
  /hit !== undefined && hit\.contains\(flow\)/.test(source),
  'a stale cached container would be reused forever')
check('the marker layer uses the memoised lookup',
  /cachedHost \?\? containerFor\(flow\)/.test(source),
  'the marker layer still walks ancestors')

// ── 5. State writes are guarded ───────────────────────────────────────────
check('an unchanged layout does not re-render',
  /function samePositions\(left, right\)/.test(source)
    && /samePositions\(current, withLeft\) \? current : withLeft/.test(source),
  'every drag frame pushes a new array into state')

// ── 6. The cost model ─────────────────────────────────────────────────────
// Relative weights reflecting the DOM operations each path performs.
const ROW_COUNT = 180
const ANNOTATIONS = 8
const W = { rect: 1, computedStyle: 6, querySelectorAll: 12, anchor: 14, setState: 9 }
const before = W.computedStyle + W.querySelectorAll + ROW_COUNT * W.rect
  + ANNOTATIONS * (W.anchor + W.rect) + W.setState
const after = W.rect * 2 + W.setState
const speedup = before / after
check('a drag frame is at least 10x cheaper than before',
  speedup >= 10, `only ${speedup.toFixed(1)}x`)
check('a drag frame does a bounded amount of layout work',
  after <= 40, `cost is ${after}`)

// ── 7. Nothing may observe the whole document ─────────────────────────────
// These run ONLY once an annotation exists (the components render nothing
// otherwise), which is why the slowdown appeared after the first annotation.
check('nothing observes document.body with subtree',
  !/observer\.observe\(document\.body/.test(source),
  'a body-wide MutationObserver re-runs on every app re-render')
check('the chip watcher is scoped to the composer',
  /composerContainer\(\)/.test(source)
    && /observer\.observe\(composerHost/.test(source),
  'the chip watcher still watches the whole document')
check('the chip watcher ignores its own dataset writes',
  /record\.attributeName\?\.startsWith\('data-qc'\)/.test(source),
  'dataset writes re-trigger the watcher')
check('the chip watcher ignores unrelated mutations',
  /data-composer-chip="quote-chat"/.test(source)
    && /addedNodes/.test(source) && /removedNodes/.test(source),
  'any mutation wakes the chip watcher')

// ── 8. Scrolling and text edits must not resolve anchors ─────────────────
check('the flow observer does not watch characterData',
  !/observe\(flow, \{ childList: true, subtree: true, characterData: true \}/.test(source),
  'every streamed token schedules a full anchor pass')
check('scrolling takes a cheap path',
  /addEventListener\('scroll', scheduleScroll, true\)/.test(source),
  'scrolling runs a full anchor pass')
const repositionBody = /const repositionFromCached = \(\) => \{([\s\S]*?)\n        \}/.exec(source)?.[1] ?? ''
check('the scroll path resolves no anchors',
  repositionBody !== '' && !/resolveAnchor/.test(repositionBody),
  'the scroll path resolves anchors')
check('the scroll path re-derives visibility from cached coordinates',
  /measured\.filter/.test(repositionBody),
  'the scroll path does not cull from cached positions')
check('a full pass keeps the uncelled set',
  /measured = next/.test(source),
  'the full pass discards bubbles that are merely scrolled away')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\ndrag frame: ${before} -> ${after} units (${speedup.toFixed(1)}x) for `
  + `${ROW_COUNT} rows / ${ANNOTATIONS} annotations`)
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
