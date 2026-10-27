/**
 * Demonstrate the panel scrolling under the header and the composer, like text does.
 *
 * The user's requirement, in their words: the panel should be covered by the header and the composer as it scrolls,
 * naturally, the way text is — not clipped by a special effect.
 *
 * The panel now lives inside the transcript's scroll container, so:
 *
 *   - as it rises, the container's top edge cuts it off, exactly as it cuts off text;
 *   - at the bottom, the composer (sticky, above it) covers it;
 *   - it moves with the content, so it needs no scroll listener for the resting position.
 *
 * This records that sequence at a legible pace and prints, for each step, who is painted on top where the panel
 * overlaps the chrome.
 *
 * Usage: node tools/demo-covering.mjs <url>
 */
import { mkdirSync } from 'node:fs'
import { openBrowser } from './harness.mjs'
import { findUsableConversation } from './find-usable-conversation.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/demo-covering.mjs <url>')
  process.exit(2)
}

const OUT = 'D:/Win自带分类文件夹/桌面/各种乱七八糟的项目/deepseekharness插件/dsh-quote-chat/recordings'
mkdirSync(OUT, { recursive: true })

const browser = await openBrowser({ video: true })
const { read, dragSelect, press, collapseRightSidebar, page, waitFor, click } = browser

/** Who is painted where the panel meets the chrome. */
const probe = () => read(() => {
  const panel = document.querySelector('.qc-compose')
  if (panel === null) return null
  const box = panel.getBoundingClientRect()
  const header = document.querySelector('.wSkVaW_header')
  const headerBox = header === null ? null : header.getBoundingClientRect()
  const headerBottom = headerBox === null ? 0 : Math.round(headerBox.bottom)
  const scroller = document.querySelector('.wSkVaW_scrollBody')
  const scrollerBox = scroller === null ? null : scroller.getBoundingClientRect()
  const centreX = Math.round(box.left + box.width / 2)

  const at = (y) => {
    if (y === null) return null
    const hit = document.elementFromPoint(centreX, Math.round(y))
    return hit === null ? 'nothing'
      : hit.closest('.qc-compose') !== null ? 'PANEL'
        : hit.closest('.wSkVaW_header') !== null ? 'header'
          : hit.closest('[contenteditable="true"]') !== null ? 'composer'
            : 'other'
  }

  // Sample inside the part of the panel that is still within the container's visible box.
  const visibleTop = Math.max(box.top, scrollerBox?.top ?? 0)
  const visibleBottom = Math.min(box.bottom, scrollerBox?.bottom ?? window.innerHeight)
  const mid = visibleTop < visibleBottom ? (visibleTop + visibleBottom) / 2 : null

  return {
    panelTop: Math.round(box.top),
    panelBottom: Math.round(box.bottom),
    headerBottom,
    scrollerTop: scrollerBox === null ? null : Math.round(scrollerBox.top),
    overlapHeader: Math.max(0, headerBottom - Math.round(box.top)),
    hiddenAbove: Math.max(0, Math.round((scrollerBox?.top ?? 0) - box.top)),
    topmostInVisible: at(mid),
    topmostAtHeaderOverlap: headerBottom - box.top > 3
      ? at(Math.max(scrollerBox?.top ?? 0, box.top) + 3)
      : null,
  }
})

/** Scroll instantly by a delta. */
const scrollBy = (delta) => read((amount) => {
  const scroller = document.querySelector('.wSkVaW_scrollBody')
  if (scroller === null) return null
  const before = Math.round(scroller.scrollTop)
  scroller.style.scrollBehavior = 'auto'
  scroller.scrollTop = before + amount
  void scroller.offsetHeight
  return { before, after: Math.round(scroller.scrollTop) }
}, delta)

try {
  await browser.goto(url)
  await waitFor('document.querySelectorAll(\'[role="treeitem"]\').length > 0', { timeoutMs: 20000 })
  await collapseRightSidebar()
  await page.waitForTimeout(500)

  const found = await findUsableConversation(browser)
  if (found.failure === true) {
    console.log('  no usable conversation')
    process.exitCode = 1
  } else {
    // Start at the top so the passage can climb into the header.
    await read(() => {
      const scroller = document.querySelector('.wSkVaW_scrollBody')
      if (scroller === null) return
      scroller.style.scrollBehavior = 'auto'
      scroller.scrollTop = 0
      void scroller.offsetHeight
    })
    await page.waitForTimeout(500)

    const block = await read(() => {
      const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
      const header = document.querySelector('.wSkVaW_header')
      const bandTop = header === null ? 0 : Math.round(header.getBoundingClientRect().bottom)
      const editors = [...document.querySelectorAll('[contenteditable="true"]')]
        .filter((element) => element.getBoundingClientRect().height > 0)
      const bandBottom = editors.length === 0
        ? window.innerHeight : Math.round(editors[editors.length - 1].getBoundingClientRect().top)
      const candidates = [...flow.querySelectorAll('p, li')].filter((element) => {
        const box = element.getBoundingClientRect()
        return (element.innerText ?? '').trim().length > 40
          && box.height > 30
          && box.top >= bandTop + 170
          && box.bottom <= bandBottom - 4
      })
      const element = candidates[0]
      if (element === undefined) return null
      for (const old of document.querySelectorAll('[data-qc-probe="1"]')) old.removeAttribute('data-qc-probe')
      element.setAttribute('data-qc-probe', '1')
      const box = element.getBoundingClientRect()
      return { top: Math.round(box.top), left: Math.round(box.left) }
    })

    if (block === null) {
      console.log('  no block with room above it')
      process.exitCode = 1
    } else {
      await page.waitForTimeout(800)
      await dragSelect({ x: block.left + 20, y: block.top + 14 },
        { x: block.left + 160, y: block.top + 14 })
      const popupUp = await waitFor('document.querySelectorAll(\'.qc-popup button\').length === 2',
        { timeoutMs: 5000 })
      console.log(`\n  toolbar: ${popupUp !== null}`)
      if (popupUp !== null) {
        await page.waitForTimeout(600)
        await click('.qc-popup button:first-child')
        await waitFor('document.querySelector(\'.qc-compose\') !== null', { timeoutMs: 5000 })
        await page.waitForTimeout(900)

        const start = await probe()
        console.log(`\n  resting: panel ${start.panelTop}..${start.panelBottom}`
          + `  header bottom ${start.headerBottom}`)
        console.log(`  who is painted in the visible part: ${start.topmostInVisible}`)

        console.log('\n   step  panelTop  hiddenAbove  paintedInVisible  paintedAtHeaderEdge')
        const rows = [start]
        // Pause at each step so the recording shows the panel sliding under the header.
        for (let step = 0; step < 9; step += 1) {
          const applied = await scrollBy(38)
          if (applied === null || applied.after === applied.before) break
          await page.waitForTimeout(750)
          const state = await probe()
          if (state === null) break
          rows.push(state)
          console.log(`   ${String(step + 1).padStart(4)}  ${String(state.panelTop).padStart(8)}`
            + `  ${String(state.hiddenAbove).padStart(11)}`
            + `  ${String(state.topmostInVisible).padEnd(16)}`
            + `  ${state.topmostAtHeaderOverlap ?? '-'}`)
        }

        await press('Escape')
        await page.waitForTimeout(400)

        const overlapping = rows.filter((row) => row.topmostAtHeaderOverlap !== null)
        const headerWins = overlapping.filter((row) => row.topmostAtHeaderOverlap === 'header')
        console.log('\n  ══ summary ══')
        console.log(`  steps: ${rows.length}`)
        console.log(`  steps where the panel reached the header: ${overlapping.length}`)
        console.log(`  of those, the header was painted on top: ${headerWins.length}`)
        console.log(`  steps where the panel was still painted in the visible part:`
          + ` ${rows.filter((row) => row.topmostInVisible === 'PANEL').length}`)
      }
    }
  }
} finally {
  const recording = await browser.close()
  if (recording.video !== null && recording.video !== undefined) {
    console.log(`\n  recording: ${recording.video}`)
    console.log(`  ${recording.frames} frames over ${recording.seconds}s`
      + ` (captured ${recording.capturedFps}fps), muxed at ${recording.fps}fps`)
  } else {
    console.log('  no recording produced')
  }
}
