/**
 * Reproduce: a sidebar narrowing the text column covers the comment panel, and the reflow makes the panel thrash.
 *
 * The panel's box is fixed — the compose panel is `width:min(420px,92vw)` and the bubble editor `min(320px,80vw)`,
 * both measured against the VIEWPORT — while the transcript column narrows when a sidebar expands or the width divider
 * is dragged. Nothing in either panel reacts, so the column's chrome lands on top of the panel.
 *
 * The second symptom needs its own cause: the panel only re-places itself when the BUBBLE moves or when the content
 * scrolls. A pure REFLOW (the column narrowing, text re-wrapping) moves the block without scrolling, so a panel
 * anchored to that block keeps its old offsets until something else forces a pass — which is exactly the reported
 * "keeps thrashing, and only scrolling fixes it".
 *
 * This probe measures both:
 *
 *   - the panel's box versus the column's box, before and after expanding/collapsing the left sidebar;
 *   - whether the panel's offsets track the block across a pure reflow, with NO scrolling in between.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-panel-reflow.mjs <url> [compose|bubble]
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
const which = process.argv[3] ?? 'compose'
if (url === undefined) {
  console.error('usage: node tools/probe-panel-reflow.mjs <url> [compose|bubble]')
  process.exit(2)
}

const browser = await openBrowser({ video: 'manual' })
const {
  read, page, waitFor, reload, resetAnnotations, seedAnnotation, click, tripleClick,
} = browser

const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)))

const SELECTOR = which === 'bubble' ? '.qc-bubble-panel' : '.qc-compose'

/** Panel, text column, sidebar boundary, and the anchor block's box. */
const geometry = () => read((selector) => {
  const panel = document.querySelector(selector)
  const panelBox = panel === null ? null : panel.getBoundingClientRect()
  const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
  let columnLeft = null
  let columnRight = null
  if (flow !== null) {
    let widest = null
    for (const row of flow.querySelectorAll('p, li, pre, h1, h2, h3')) {
      const box = row.getBoundingClientRect()
      if (box.width === 0) continue
      if (widest === null || box.width > widest.width) widest = box
    }
    if (widest !== null) {
      columnLeft = Math.round(widest.left)
      columnRight = Math.round(widest.right)
    }
  }
  // The rail's right edge is the divider's left edge: walking up from a tree item overshoots to a full-window
  // container and reported the rail as 1280px wide, which made every sample look overlapped.
  const dividers = [...document.querySelectorAll('[class*="widthHandle"]')]
    .map((node) => node.getBoundingClientRect())
    .filter((box) => box.width > 0 && box.height > 0)
    .sort((a, b) => a.left - b.left)
  const railRight = dividers.length === 0 ? null : Math.round(dividers[0].left)
  // The annotated block, found from the marker when the bubble panel is under test.
  const marker = document.querySelector('.qc-marker')
  const markerBox = marker === null ? null : marker.getBoundingClientRect()
  return {
    panel: panelBox === null ? null : {
      left: Math.round(panelBox.left),
      right: Math.round(panelBox.right),
      top: Math.round(panelBox.top),
      bottom: Math.round(panelBox.bottom),
      width: Math.round(panelBox.width),
    },
    columnLeft,
    columnRight,
    columnWidth: columnLeft === null || columnRight === null ? null : columnRight - columnLeft,
    railRight,
    markerTop: markerBox === null ? null : Math.round(markerBox.top),
    markerLeft: markerBox === null ? null : Math.round(markerBox.left),
    // Panel right edge versus the area the column actually occupies.
    pastColumnRight: panelBox === null || columnRight === null
      ? null : Math.round(panelBox.right) - columnRight,
    // How far the rail overlaps the panel horizontally.
    railOverlap: panelBox === null || railRight === null
      ? null : Math.max(0, Math.round(railRight) - Math.round(panelBox.left)),
  }
}, SELECTOR)

/** Press the left sidebar's collapse button, identified by its accessible label. */
const toggleLeftSidebar = async () => {
  const found = await read(() => {
    const button = [...document.querySelectorAll('button,[role="button"]')]
      .find((element) => {
        const label = (element.getAttribute('aria-label') ?? '').trim()
        return label === '收起侧边栏' || label === '展开侧边栏'
      })
    if (button === undefined) return null
    const box = button.getBoundingClientRect()
    return {
      label: (button.getAttribute('aria-label') ?? '').trim(),
      x: Math.round(box.left + box.width / 2),
      y: Math.round(box.top + box.height / 2),
    }
  })
  if (found === null) return null
  await page.mouse.click(found.x, found.y)
  await page.waitForTimeout(420)
  return found.label
}

try {
  await browser.goto(url)
  await reload()
  await waitFor('document.querySelectorAll(\'[role="treeitem"]\').length > 0', { timeoutMs: 20000 })
  await page.waitForTimeout(400)

  const flowOpen = await read(() =>
    document.querySelector('[data-slot="conversation.chat.flow"]') !== null)
  if (flowOpen === false) {
    await read(() => [...document.querySelectorAll('[role="treeitem"]')][0]?.click())
  }
  await waitFor(
    '(() => { const f = document.querySelector(\'[data-slot="conversation.chat.flow"]\');'
      + ' return f !== null && [...f.querySelectorAll("p, li")].some((e) => (e.innerText ?? "").trim().length > 40) })()',
    { timeoutMs: 20000 },
  )
  await page.waitForTimeout(400)

  const cleanup = await resetAnnotations()
  console.log(`  cleanup: deleted ${cleanup.deleted}, chips ${cleanup.chips}`)
  const markers = await seedAnnotation()
  console.log(`  markers: ${markers}`)

  if (which === 'bubble') {
    const point = await read(() => {
      const marker = document.querySelector('.qc-marker')
      if (marker === null) return null
      const box = marker.getBoundingClientRect()
      return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
    })
    if (point !== null) await page.mouse.click(point.x, point.y)
  } else {
    let seeded = false
    for (const offset of [600, 300, 900, 0, 1200]) {
      seeded = await read((target) => {
        const scroller = document.querySelector('.wSkVaW_scrollBody')
        const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
        if (scroller === null || flow === null) return false
        scroller.style.scrollBehavior = 'auto'
        scroller.scrollTop = target
        void scroller.offsetHeight
        for (const old of document.querySelectorAll('[data-qc-seed]')) old.removeAttribute('data-qc-seed')
        const scrollerBox = scroller.getBoundingClientRect()
        const editable = [...document.querySelectorAll('[contenteditable="true"]')]
          .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
        const composerTop = editable === null
          ? scrollerBox.bottom : editable.getBoundingClientRect().top
        const candidate = [...flow.querySelectorAll('p, li')].find((element) => {
          const box = element.getBoundingClientRect()
          return (element.innerText ?? '').trim().length > 40
            && box.top >= scrollerBox.top + 60 && box.bottom <= composerTop - 40
        })
        if (candidate === undefined) return false
        candidate.setAttribute('data-qc-seed', '1')
        return true
      }, offset)
      if (seeded) break
    }
    if (seeded) {
      await tripleClick('[data-qc-seed="1"]')
      await waitFor('document.querySelectorAll(\'.qc-popup button\').length === 2', { timeoutMs: 5000 })
      await click('.qc-popup button:first-child')
    }
  }

  const opened = await waitFor(`document.querySelector('${SELECTOR}') !== null`, { timeoutMs: 5000 })
  if (opened === null) {
    console.log(`  ${SELECTOR} did not open`)
    process.exitCode = 2
  } else {
    await read((selector) => {
      const area = document.querySelector(`${selector} textarea`)
      area?.focus()
    }, SELECTOR)
    await page.keyboard.type('重排测试', { delay: 15 })
    await page.waitForTimeout(400)

    console.log('\n  phase   panel left..right (w)   column left..right (w)   railRight  pastColumnRight  railOverlap')
    const rows = []
    const report = async (label) => {
      const geo = await geometry()
      if (geo === null || geo.panel === null) {
        console.log(`  ${label.padEnd(7)} (panel gone)`)
        return null
      }
      console.log(`  ${label.padEnd(7)} ${String(geo.panel.left).padStart(4)}..${String(geo.panel.right).padStart(4)}`
        + ` (${String(geo.panel.width).padStart(3)})`
        + `   ${String(geo.columnLeft).padStart(4)}..${String(geo.columnRight).padStart(4)}`
        + ` (${String(geo.columnWidth).padStart(3)})`
        + `   ${String(geo.railRight).padStart(8)}`
        + `  ${String(geo.pastColumnRight).padStart(15)}`
        + `  ${String(geo.railOverlap).padStart(11)}`)
      rows.push({ label, ...geo })
      return geo
    }

    const base = await report('base')

    // Collapse the sidebar: this WIDENS the column and re-wraps the text without any scrolling.
    const collapsed = await toggleLeftSidebar()
    console.log(`  toggled: ${collapsed}`)
    await page.waitForTimeout(300)
    const afterCollapse = await report('collapsed')

    // Expand it again, which narrows the column back and is where the overlap appears.
    const expanded = await toggleLeftSidebar()
    console.log(`  toggled: ${expanded}`)
    await page.waitForTimeout(300)
    const afterExpand = await report('expanded')

    // A pure reflow with NO scrolling: the panel must already be in its new place. If it only lands correctly after a
    // scroll, that is the reported "must scroll before it settles".
    const movedByReflow = base !== null && afterCollapse !== null
      && base.columnWidth !== null && afterCollapse.columnWidth !== null
      && Math.abs(afterCollapse.columnWidth - base.columnWidth) > 20

    console.log('\n  ══ findings ══')
    console.log(`     page errors: ${pageErrors.length === 0 ? 'none' : pageErrors.length}`)
    for (const message of pageErrors.slice(0, 3)) console.log(`       ${message}`)
    console.log(`     the column width changed by a sidebar toggle: ${movedByReflow}`)
    console.log(`     panel width across the three states: `
      + rows.filter((row) => row.panel !== null).map((row) => row.panel.width).join(' -> '))
    console.log(`     panel left edge across the states: `
      + rows.filter((row) => row.panel !== null).map((row) => row.panel.left).join(' -> '))
    console.log(`     panel right edge past the column's right edge: `
      + rows.filter((row) => row.pastColumnRight !== null).map((row) => row.pastColumnRight).join(' -> '))
    console.log(`     rail overlapping the panel: `
      + rows.filter((row) => row.railOverlap !== null).map((row) => row.railOverlap).join(' -> '))

    const staticWidth = new Set(rows.filter((row) => row.panel !== null).map((row) => row.panel.width)).size === 1
    const staticLeft = new Set(rows.filter((row) => row.panel !== null).map((row) => row.panel.left)).size === 1
    if (movedByReflow && staticWidth && staticLeft) {
      console.log('\n     REPRODUCED: the panel keeps its box while the column moves under it')
    }
    process.exitCode = movedByReflow && staticWidth ? 1 : 0
  }
} finally {
  const recording = await browser.close()
  if (recording !== null && recording !== undefined
    && recording.video !== null && recording.video !== undefined) {
    console.log(`\n  recording: ${recording.video}`)
    console.log(`  ${recording.frames} frames over ${recording.seconds}s`
      + ` (captured ${recording.capturedFps}fps), muxed at ${recording.fps}fps`)
  }
}
