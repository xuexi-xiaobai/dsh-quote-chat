/**
 * Establish the basics, by measurement: how does the width divider actually behave?
 *
 * Three claims were made earlier and none of them was verified properly:
 *
 *   1. "the pane width has only two settings (824 and 640)";
 *   2. "only the bar on the right of the prose column works";
 *   3. "the scroll position changes by itself between selecting text and opening the panel".
 *
 * All three came from experiments that dragged every time toward the SAME side. If the column was already at its
 * limit, nothing moved — and "nothing moved" was then read as "this handle does not work" or "there are only two
 * settings". That is a measurement error, not a property of the app.
 *
 * So this probe does the groundwork instead:
 *
 *   - drags in SMALL steps with the button held, sampling the width at every step, so the real range and its
 *     granularity are visible;
 *   - does it for BOTH bars, in BOTH directions, always starting from a position away from the limit;
 *   - records `scrollTop` at every step, so the claim about scrolling is either confirmed or dropped.
 *
 * Nothing here tests the panel. It only maps the mechanism the panel has to follow.
 *
 * Usage: node tools/explore-drag.mjs <url>
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/explore-drag.mjs <url>')
  process.exit(2)
}

const browser = await openBrowser()
const { read, page, waitFor, collapseRightSidebar } = browser

/** Every resize handle, with its position and the prose geometry. */
const survey = () => read(() => {
  const prose = document.querySelector('[data-slot="conversation.chat.flow"] p')
  const scroller = document.querySelector('.wSkVaW_scrollBody')
  if (prose === null || scroller === null) return null
  const proseBox = prose.getBoundingClientRect()
  const handles = []
  for (const element of document.querySelectorAll('*')) {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    if (style.cursor !== 'col-resize' && style.cursor !== 'ew-resize') continue
    if (rect.width > 24 || rect.height < 40) continue
    handles.push({
      className: typeof element.className === 'string' ? element.className.slice(0, 24) : '',
      left: Math.round(rect.left),
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    })
  }
  handles.sort((a, b) => a.left - b.left)
  return {
    proseWidth: Math.round(proseBox.width),
    proseLeft: Math.round(proseBox.left),
    proseRight: Math.round(proseBox.right),
    scrollTop: Math.round(scroller.scrollTop),
    handles,
  }
})

/**
 * Drag one handle horizontally in small steps, sampling after each step.
 *
 * The button is held for the whole sweep, and the pointer moves a few pixels at a time — which is what a real drag does.
 * Each sample records the width and the scroll offset, so both the range and any scroll side effect are visible.
 */
const sweep = async (handle, deltaX, label) => {
  const before = await survey()
  if (before === null) return null
  await page.mouse.move(handle.x, handle.y)
  await page.mouse.down()
  const samples = []
  const steps = 24
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(handle.x + Math.round((deltaX * step) / steps), handle.y)
    await page.waitForTimeout(35)
    const state = await survey()
    if (state === null) continue
    samples.push({ step, width: state.proseWidth, scrollTop: state.scrollTop })
  }
  await page.mouse.up()
  await page.waitForTimeout(400)
  const after = await survey()

  const widths = samples.map((sample) => sample.width)
  const distinct = [...new Set(widths)].sort((a, b) => a - b)
  const scrolls = [...new Set(samples.map((sample) => sample.scrollTop))]
  console.log(`\n  ── ${label} ──`)
  console.log(`    start ${before.proseWidth}  end ${after === null ? '?' : after.proseWidth}`)
  console.log(`    widths seen while dragging: ${widths.join(', ')}`)
  console.log(`    distinct widths: ${distinct.length}  ${distinct.length > 2 ? '<- CONTINUOUS' : '<- only these'}`)
  console.log(`    scrollTop during the drag: ${scrolls.join(', ')}`
    + `  ${scrolls.length === 1 ? '(never changed)' : '<- CHANGED'}`)
  return { before, after, samples, distinct }
}

try {
  await browser.goto(url)
  await waitFor('document.querySelectorAll(\'[role="treeitem"]\').length > 0', { timeoutMs: 20000 })
  await collapseRightSidebar()
  await page.waitForTimeout(400)
  await read(() => [...document.querySelectorAll('[role="treeitem"]')][0]?.click())
  await page.waitForTimeout(2200)

  const initial = await survey()
  console.log(`\n  prose ${initial.proseWidth}px  at ${initial.proseLeft}..${initial.proseRight}`
    + `   scrollTop ${initial.scrollTop}`)
  console.log(`  handles found: ${initial.handles.length}`)
  for (const handle of initial.handles) {
    const side = Math.abs(handle.left - initial.proseRight) < Math.abs(handle.left - initial.proseLeft)
      ? 'RIGHT side of the prose' : 'LEFT side of the prose'
    console.log(`    ${handle.className}  at x=${handle.left}  -> ${side}`)
  }

  // Sweep the RIGHT handle both ways, starting from wherever the column is.
  const first = await survey()
  const rightHandle = first.handles.reduce((best, handle) =>
    Math.abs(handle.left - first.proseRight) < Math.abs(best.left - first.proseRight) ? handle : best)
  await sweep(rightHandle, -240, 'RIGHT handle, dragged 240px LEFT')

  const afterLeft = await survey()
  if (afterLeft !== null) {
    const handle = afterLeft.handles.reduce((best, item) =>
      Math.abs(item.left - afterLeft.proseRight) < Math.abs(best.left - afterLeft.proseRight) ? item : best)
    await sweep(handle, +240, 'RIGHT handle, dragged 240px RIGHT (back)')
  }

  // Sweep the LEFT handle both ways, so "it does nothing" is tested away from a limit too.
  const beforeLeftSweep = await survey()
  if (beforeLeftSweep !== null) {
    const leftHandle = beforeLeftSweep.handles.reduce((best, handle) =>
      Math.abs(handle.left - beforeLeftSweep.proseLeft) < Math.abs(best.left - beforeLeftSweep.proseLeft)
        ? handle : best)
    await sweep(leftHandle, +200, 'LEFT handle, dragged 200px RIGHT')
    const mid = await survey()
    if (mid !== null) {
      const handle = mid.handles.reduce((best, item) =>
        Math.abs(item.left - mid.proseLeft) < Math.abs(best.left - mid.proseLeft) ? item : best)
      await sweep(handle, -200, 'LEFT handle, dragged 200px LEFT (back)')
    }
  }

  const final = await survey()
  console.log(`\n  final prose width ${final.proseWidth}, scrollTop ${final.scrollTop}`)
} finally {
  await browser.close()
}
