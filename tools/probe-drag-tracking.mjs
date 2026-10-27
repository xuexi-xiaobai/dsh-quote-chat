/**
 * Verify that the compose panel tracks its passage while the text column is being resized.
 *
 * ## What this does differently from every earlier attempt
 *
 * A 12-second exploration (`tools/explore-drag.mjs`) established the mechanism first, and three earlier conclusions
 * were wrong because they came from "drag to the limit, compare the two endpoints":
 *
 *   - the width is CONTINUOUS (~20px per step), not two settings;
 *   - BOTH divider bars work; the earlier "only the right one" was an artefact of dragging at a limit;
 *   - dragging CHANGES `scrollTop` (measured 1476 -> 1526), because the reflow changes content height.
 *
 * So this samples on EVERY step of a continuous drag instead of comparing before/after. The gap between the panel's
 * bottom edge and the passage's top edge is the assertion, because it is independent of how far the content moved.
 *
 * ## What it asserts
 *
 * For every sample where the passage is inside the visible band:
 *
 *   - the panel's bottom edge stays ~10px above the passage's top edge;
 *   - the panel's top edge equals the passage's top edge minus the panel height minus 10.
 *
 * A run that never moved the passage, or never changed the width, reports NOT SET UP rather than passing.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-drag-tracking.mjs <url>
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/probe-drag-tracking.mjs <url>')
  process.exit(2)
}

/** How far to drag, in pixels, and in how many samples. */
const TRAVEL = 240
const STEPS = 20

const browser = await openBrowser()
const { read, dragSelect, press, page, waitFor, collapseRightSidebar, click } = browser

try {
  await browser.goto(url)
  await waitFor('document.querySelectorAll(\'[role="treeitem"]\').length > 0', { timeoutMs: 20000 })
  await collapseRightSidebar()
  await page.waitForTimeout(300)

  // Make sure a conversation is open. In CDP mode the previous probe may already have left one open, and re-clicking
  // would throw away its scroll position for no reason.
  const flowOpen = await read(() =>
    document.querySelector('[data-slot="conversation.chat.flow"]') !== null)
  if (flowOpen === false) {
    await read(() => [...document.querySelectorAll('[role="treeitem"]')][0]?.click())
    await page.waitForTimeout(1800)
  }

  /** Put a usable passage in view: inside the band, with room above it for the panel. */
  const seatPassage = async () => {
    for (const offset of [600, 900, 300, 1200, 1500, 0]) {
      const found = await read((target) => {
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
            && box.height > 20
            && box.top >= scrollerBox.top + 190
            && box.bottom <= scrollerBox.bottom - 60
        })
        const element = candidates[0]
        if (element === undefined) return null
        const box = element.getBoundingClientRect()
        return {
          top: Math.round(box.top),
          chars: (element.innerText ?? '').trim().length,
          from: { x: Math.round(box.left + 20), y: Math.round(box.top + 12) },
          to: { x: Math.round(box.left + Math.min(150, box.width - 20)), y: Math.round(box.top + 12) },
        }
      }, offset)
      if (found !== null) return found
    }
    return null
  }

  const passage = await seatPassage()
  if (passage === null) {
    console.log('  no passage could be seated inside the band')
    process.exitCode = 1
  } else {
    console.log(`\n  passage at top ${passage.top}, ${passage.chars} chars`)
    await dragSelect(passage.from, passage.to)
    const popupUp = await waitFor('document.querySelectorAll(\'.qc-popup button\').length === 2',
      { timeoutMs: 5000 })
    if (popupUp === null) {
      console.log('  no toolbar appeared; the selection did not register')
      process.exitCode = 1
    } else {
      await click('.qc-popup button:first-child')
      await waitFor('document.querySelector(\'.qc-compose\') !== null', { timeoutMs: 5000 })
      await page.waitForTimeout(300)

      /** Everything one sample needs. */
      const sample = () => read(() => {
        const panel = document.querySelector('.qc-compose')
        const block = document.querySelector('[data-qc-probe="1"]')
        const prose = document.querySelector('[data-slot="conversation.chat.flow"] p')
        const scroller = document.querySelector('.wSkVaW_scrollBody')
        if (panel === null || block === null) return null
        const panelBox = panel.getBoundingClientRect()
        const blockBox = block.getBoundingClientRect()
        const scrollerBox = scroller.getBoundingClientRect()
        return {
          width: prose === null ? null : Math.round(prose.getBoundingClientRect().width),
          scrollTop: Math.round(scroller.scrollTop),
          blockTop: Math.round(blockBox.top),
          blockHeight: Math.round(blockBox.height),
          panelTop: Math.round(panelBox.top),
          panelBottom: Math.round(panelBox.bottom),
          panelHeight: Math.round(panelBox.height),
          gap: Math.round(blockBox.top - panelBox.bottom),
          // Only meaningful while the passage is inside the band.
          inBand: blockBox.top >= scrollerBox.top - 2 && blockBox.bottom <= scrollerBox.bottom + 2,
          band: { top: Math.round(scrollerBox.top), bottom: Math.round(scrollerBox.bottom) },
        }
      })

      // Mark the passage so `sample()` can find it.
      await read((wanted) => {
        const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
        const scroller = document.querySelector('.wSkVaW_scrollBody')
        const scrollerBox = scroller.getBoundingClientRect()
        const candidates = [...flow.querySelectorAll('p, li')].filter((element) => {
          const box = element.getBoundingClientRect()
          return (element.innerText ?? '').trim().length > 40
            && box.top >= scrollerBox.top + 190
            && box.bottom <= scrollerBox.bottom - 60
        })
        const element = candidates[0]
        if (element === undefined) return
        for (const old of document.querySelectorAll('[data-qc-probe="1"]')) old.removeAttribute('data-qc-probe')
        element.setAttribute('data-qc-probe', '1')
      })

      // The divider beside the prose column's right edge.
      const grip = await read(() => {
        const prose = document.querySelector('[data-slot="conversation.chat.flow"] p')
        if (prose === null) return null
        const proseRight = prose.getBoundingClientRect().right
        let best = null
        for (const element of document.querySelectorAll('*')) {
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          if (rect.width === 0 || rect.height === 0) continue
          if (style.cursor !== 'col-resize' && style.cursor !== 'ew-resize') continue
          if (rect.width > 24 || rect.height < 40) continue
          const distance = Math.abs(rect.left - proseRight)
          if (best === null || distance < best.distance) {
            best = { distance, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
          }
        }
        return best === null ? null : { x: best.x, y: best.y }
      })

      if (grip === null) {
        console.log('  no divider found')
        process.exitCode = 1
      } else {
        const before = await sample()
        // Drag toward the WIDE end if the column is currently narrow, so there is always room to travel.
        const direction = before.width < 740 ? +1 : -1
        console.log(`\n  column ${before.width}px, dragging ${direction > 0 ? 'right' : 'left'}`
          + ` by ${TRAVEL}px in ${STEPS} steps`)
        console.log(`  before: block ${before.blockTop}  panel ${before.panelTop}..${before.panelBottom}`
          + `  gap ${before.gap}  scrollTop ${before.scrollTop}`)

        const samples = []
        await page.mouse.move(grip.x, grip.y)
        await page.mouse.down()
        for (let step = 1; step <= STEPS; step += 1) {
          await page.mouse.move(grip.x + Math.round((direction * TRAVEL * step) / STEPS), grip.y)
          await page.waitForTimeout(45)
          const state = await sample()
          if (state !== null) samples.push({ step, ...state })
        }
        await page.mouse.up()
        await page.waitForTimeout(350)
        const afterUp = await sample()

        console.log('\n   step  width  blockTop  panelTop  panelBot  gap  scrollTop  inBand')
        for (const entry of samples) {
          console.log(`   ${String(entry.step).padStart(4)}`
            + `  ${String(entry.width).padStart(5)}`
            + `  ${String(entry.blockTop).padStart(8)}`
            + `  ${String(entry.panelTop).padStart(8)}`
            + `  ${String(entry.panelBottom).padStart(8)}`
            + `  ${String(entry.gap).padStart(4)}`
            + `  ${String(entry.scrollTop).padStart(9)}`
            + `  ${entry.inBand ? 'yes' : 'NO'}`)
        }
        console.log(`\n  after releasing: block ${afterUp.blockTop}  panel ${afterUp.panelTop}`
          + `..${afterUp.panelBottom}  gap ${afterUp.gap}`)

        const widths = [...new Set(samples.map((entry) => entry.width))]
        const blockTops = [...new Set(samples.map((entry) => entry.blockTop))]
        const panelTops = [...new Set(samples.map((entry) => entry.panelTop))]
        const judged = samples.filter((entry) => entry.inBand === true)
        const gaps = judged.map((entry) => entry.gap)
        const worstGap = gaps.length === 0 ? null : Math.max(...gaps.map((gap) => Math.abs(gap - 10)))
        const offBy = judged.filter((entry) => Math.abs(entry.gap - 10) > 8)

        console.log('\n  ══ verdict ══')
        console.log(`     samples: ${samples.length}`)
        console.log(`     distinct widths seen: ${widths.length}  (${widths.slice(0, 6).join(', ')}${widths.length > 6 ? ', …' : ''})`)
        console.log(`     distinct passage tops seen: ${blockTops.length}`)
        console.log(`     distinct panel tops seen:   ${panelTops.length}`)
        console.log(`     samples judged (passage inside the band): ${judged.length}`)
        console.log(`     worst deviation from the 10px gap: ${worstGap === null ? 'n/a' : `${worstGap}px`}`)
        console.log(`     samples off the passage: ${offBy.length}`)
        if (offBy.length > 0) {
          for (const entry of offBy.slice(0, 8)) {
            console.log(`       step ${entry.step}: gap ${entry.gap}px`
              + `  block ${entry.blockTop}  panel ${entry.panelTop}..${entry.panelBottom}`)
          }
        }

        const moved = blockTops.length > 1
        const widened = widths.length > 1
        if (widened === false || moved === false || judged.length < 3) {
          console.log('\n     NOT SET UP: the drag did not move the passage inside the band, so nothing was proven')
          process.exitCode = 2
        } else if (offBy.length === 0) {
          console.log('\n     OK: the panel tracked the passage through every sample of the drag')
          process.exitCode = 0
        } else {
          console.log('\n     NOT OK: the panel did not track the passage (the reported defect)')
          process.exitCode = 1
        }

        await press('Escape')
      }
    }
  }
} finally {
  await browser.close()
}
