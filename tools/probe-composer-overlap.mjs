/**
 * The compose panel must never extend into the composer.
 *
 * Reported: "the annotation panel overlaps the chat box". The panel's bottom edge tracks the block's top edge, so
 * scrolling the block down until it sits behind the composer drags the panel in after it — and the composer is sticky
 * and painted above the panel, so it covers the panel's own buttons.
 *
 * The probe opens a panel, then scrolls in small steps and records, at every step, how far the panel's bottom edge
 * reaches past the composer's top edge. Scrolling is what produces the state, so it has to be sampled DURING the
 * scroll rather than compared before and after.
 *
 * Two numbers are asserted:
 *   - the panel must not extend below the composer's top edge;
 *   - the panel must still clear the block it annotates, so the clamp cannot be "fixed" by parking the panel over the
 *     text.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-composer-overlap.mjs <url>
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/probe-composer-overlap.mjs <url>')
  process.exit(2)
}

const browser = await openBrowser()
const { read, dragSelect, press, page, waitFor, collapseRightSidebar, click, reload } = browser

/** Panel, block and composer geometry. */
const sample = () => read(() => {
  const panel = document.querySelector('.qc-compose')
  const block = document.querySelector('[data-qc-probe="1"]')
  if (panel === null || block === null) return null
  const panelBox = panel.getBoundingClientRect()
  const blockBox = block.getBoundingClientRect()
  const editors = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter((element) => element.getBoundingClientRect().height > 0)
  const composerTop = editors.length === 0
    ? null : Math.round(editors[editors.length - 1].getBoundingClientRect().top)
  return {
    panelTop: Math.round(panelBox.top),
    panelBottom: Math.round(panelBox.bottom),
    blockTop: Math.round(blockBox.top),
    composerTop,
    // Positive means the panel reaches BELOW the composer's top edge.
    intoComposer: composerTop === null ? null : Math.round(panelBox.bottom) - composerTop,
    // Positive means the panel's bottom is below the block's top: it covers the text it annotates.
    overBlock: Math.round(panelBox.bottom) - Math.round(blockBox.top),
  }
})

try {
  await browser.goto(url)
  await reload()
  await waitFor('document.querySelectorAll(\'[role="treeitem"]\').length > 0', { timeoutMs: 20000 })
  await collapseRightSidebar()
  await page.waitForTimeout(300)

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
  await page.waitForTimeout(300)

  // Seat a passage near the TOP of the band, so there is room to scroll it down behind the composer.
  let points = null
  for (const offset of [600, 900, 300, 1200, 0]) {
    points = await read((target) => {
      const scroller = document.querySelector('.wSkVaW_scrollBody')
      const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
      if (scroller === null || flow === null) return null
      scroller.style.scrollBehavior = 'auto'
      scroller.scrollTop = target
      void scroller.offsetHeight
      const scrollerBox = scroller.getBoundingClientRect()
      const candidates = [...flow.querySelectorAll('p, li')].filter((element) => {
        const box = element.getBoundingClientRect()
        return (element.innerText ?? '').trim().length > 40
          && box.top >= scrollerBox.top + 180
          && box.top <= scrollerBox.top + 300
          && box.bottom <= scrollerBox.bottom - 60
      })
      const element = candidates[0]
      if (element === undefined) return null
      const box = element.getBoundingClientRect()
      for (const old of document.querySelectorAll('[data-qc-probe="1"]')) old.removeAttribute('data-qc-probe')
      element.setAttribute('data-qc-probe', '1')
      return {
        from: { x: Math.round(box.left + 20), y: Math.round(box.top + 12) },
        to: { x: Math.round(box.left + Math.min(150, box.width - 20)), y: Math.round(box.top + 12) },
      }
    }, offset)
    if (points !== null) break
  }

  if (points === null) {
    console.log('  no passage could be seated near the top of the band')
    process.exitCode = 1
  } else {
    await dragSelect(points.from, points.to)
    const popupUp = await waitFor('document.querySelectorAll(\'.qc-popup button\').length === 2',
      { timeoutMs: 5000 })
    if (popupUp === null) {
      console.log('  no toolbar appeared')
      process.exitCode = 1
    } else {
      await click('.qc-popup button:first-child')
      await waitFor('document.querySelector(\'.qc-compose\') !== null', { timeoutMs: 5000 })
      await page.waitForTimeout(300)

      const start = await sample()
      console.log(`\n  start: panel ${start.panelTop}..${start.panelBottom}`
        + `  block ${start.blockTop}  composer top ${start.composerTop}`)
      console.log(`         into composer ${start.intoComposer}px   over block ${start.overBlock}px`)

      // Scroll the passage down toward (and behind) the composer, sampling as it goes. Enough steps to carry the
      // block's top edge PAST the composer: 10 steps of 45px only reached top 502 against a composer at 545, so the
      // state under test was never produced and the probe reported a pass it had not earned.
      const rows = []
      for (let step = 1; step <= 20; step += 1) {
        await read(() => {
          const scroller = document.querySelector('.wSkVaW_scrollBody')
          if (scroller === null) return
          scroller.style.scrollBehavior = 'auto'
          scroller.scrollTop -= 45
          void scroller.offsetHeight
        })
        await page.waitForTimeout(90)
        const state = await sample()
        if (state !== null) rows.push({ step, ...state })
      }

      console.log('\n   step  blockTop  panelTop..Bottom  composerTop  intoComposer  overBlock')
      for (const row of rows) {
        console.log(`   ${String(row.step).padStart(4)}  ${String(row.blockTop).padStart(8)}`
          + `  ${String(row.panelTop).padStart(6)}..${String(row.panelBottom).padEnd(6)}`
          + `  ${String(row.composerTop).padStart(11)}`
          + `  ${String(row.intoComposer).padStart(12)}`
          + `  ${String(row.overBlock).padStart(9)}`)
      }

      const into = rows.filter((row) => row.intoComposer > 0)
      const covering = rows.filter((row) => row.overBlock > 0)
      const worstInto = rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.intoComposer))
      const worstOver = rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.overBlock))

      console.log('\n  ══ verdict ══')
      console.log(`     samples: ${rows.length}`)
      console.log(`     samples where the panel reached into the composer: ${into.length}`
        + `  (worst ${worstInto}px)`)
      console.log(`     samples where the panel covered its own block: ${covering.length}`
        + `  (worst ${worstOver}px)`)

      if (rows.length < 3) {
        console.log('\n     NOT SET UP: too few samples, nothing was proven')
        process.exitCode = 2
      } else if (into.length > 0) {
        console.log('\n     NOT OK: the panel still overlaps the chat box')
        process.exitCode = 1
      } else if (covering.length > 0) {
        console.log('\n     NOT OK: the clamp parked the panel over the text it annotates')
        process.exitCode = 1
      } else {
        console.log('\n     OK: the panel stays above the chat box and clear of its block')
        process.exitCode = 0
      }

      await press('Escape')
    }
  }
} finally {
  await browser.close()
}
