/**
 * Demonstrate the two faults the user reported, and that they are fixed.
 *
 * 1. Scrolling while the panel is open: the panel must move with the block, keeping its gap.
 * 2. The same selection made forwards and backwards: the panel must land in the same place, above the text,
 *    whichever way the drag was made.
 *
 * Recorded so the behaviour can be watched, with the measurements printed alongside so the picture and the
 * claim can be checked against each other. The scroll steps are deliberately large and slow enough to be
 * visible at the recording's frame rate.
 *
 * Usage: node tools/demo-follow.mjs <url>
 */
import { mkdirSync } from 'node:fs'
import { openBrowser } from './harness.mjs'
import { findUsableConversation } from './find-usable-conversation.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/demo-follow.mjs <url>')
  process.exit(2)
}

const OUT = 'D:/Win自带分类文件夹/桌面/各种乱七八糟的项目/deepseekharness插件/dsh-quote-chat/recordings'
mkdirSync(OUT, { recursive: true })

const browser = await openBrowser({ video: true })
const { read, dragSelect, press, collapseRightSidebar, page, waitFor, click } = browser

/** Panel, block, and the gap between them. */
const geometry = () => read(() => {
  const panel = document.querySelector('.qc-compose')
  const block = document.querySelector('[data-qc-probe="1"]')
  if (panel === null || block === null) return null
  const box = panel.getBoundingClientRect()
  const blockBox = block.getBoundingClientRect()
  return {
    panelTop: Math.round(box.top),
    panelBottom: Math.round(box.bottom),
    blockTop: Math.round(blockBox.top),
    gap: Math.round(blockBox.top - box.bottom),
    coversBlock: box.top < blockBox.bottom && box.bottom > blockBox.top,
  }
})

/** Scroll by a delta, instantly, and let the re-render happen. */
const scrollBy = async (delta, settleMs = 300) => {
  const applied = await read((amount) => {
    const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
    for (const element of document.querySelectorAll('*')) {
      if (element.scrollHeight <= element.clientHeight + 4) continue
      if (!element.contains(flow)) continue
      if (element === document.body || element === document.documentElement) continue
      const previous = element.style.scrollBehavior
      element.style.scrollBehavior = 'auto'
      const before = element.scrollTop
      element.scrollTop = Math.max(0, before + amount)
      void element.offsetHeight
      element.style.scrollBehavior = previous
      return { before: Math.round(before), after: Math.round(element.scrollTop) }
    }
    return null
  }, delta)
  await page.waitForTimeout(settleMs)
  return applied
}

try {
  await browser.goto(url)
  await waitFor('document.querySelectorAll(\'[role="treeitem"]\').length > 0', { timeoutMs: 20000 })
  await collapseRightSidebar()
  await page.waitForTimeout(400)

  const found = await findUsableConversation(browser)
  if (found.failure === true) {
    console.log('  no usable conversation')
    process.exitCode = 1
  } else {
    console.log(`\n  conversation: "${found.title}"`)
    const block = await read(() => {
      const element = document.querySelector('[data-qc-probe="1"]')
      if (element === null) return null
      const box = element.getBoundingClientRect()
      const lineHeight = Math.round(parseFloat(getComputedStyle(element).lineHeight) || 25)
      return {
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        left: Math.round(box.left),
        right: Math.round(box.right),
        lineHeight,
        lines: Math.max(1, Math.round(box.height / lineHeight)),
      }
    })
    console.log(`  block ${block.top}..${block.bottom}, ${block.lines} line(s)`)

    // ── Part 1: dragging forwards and backwards ──
    console.log('\n  ── drag direction ──')
    const placed = {}
    for (const direction of ['forwards', 'backwards']) {
      await press('Escape')
      await page.waitForTimeout(500)
      const y = block.top + 14
      const from = direction === 'forwards'
        ? { x: block.left + 20, y }
        : { x: block.left + 170, y }
      const to = direction === 'forwards'
        ? { x: block.left + 170, y }
        : { x: block.left + 20, y }

      await dragSelect(from, to)
      const popupUp = await waitFor('document.querySelectorAll(\'.qc-popup button\').length === 2',
        { timeoutMs: 5000 })
      if (popupUp === null) {
        console.log(`  ${direction}: no toolbar`)
        continue
      }
      await page.waitForTimeout(700)
      await click('.qc-popup button:first-child')
      const opened = await waitFor('document.querySelector(\'.qc-compose\') !== null', { timeoutMs: 5000 })
      if (opened === null) {
        console.log(`  ${direction}: no panel`)
        continue
      }
      await page.waitForTimeout(900)

      const state = await geometry()
      placed[direction] = state
      console.log(`  ${direction.padEnd(10)} panel ${state.panelTop}..${state.panelBottom}`
        + `   block top ${state.blockTop}   gap ${state.gap}px   covers=${state.coversBlock}`)
      await page.waitForTimeout(700)
    }
    const samePlace = placed.forwards !== undefined && placed.backwards !== undefined
      && placed.forwards.panelTop === placed.backwards.panelTop
    console.log(`  ${samePlace ? 'OK' : 'WRONG'}: both directions put the panel at the same place`)

    // ── Part 2: scrolling while the panel is open ──
    console.log('\n  ── following the block while scrolling ──')
    await press('Escape')
    await page.waitForTimeout(360)
    await dragSelect({ x: block.left + 20, y: block.top + 14 },
      { x: block.left + 170, y: block.top + 14 })
    await waitFor('document.querySelectorAll(\'.qc-popup button\').length === 2', { timeoutMs: 5000 })
    await click('.qc-popup button:first-child')
    await waitFor('document.querySelector(\'.qc-compose\') !== null', { timeoutMs: 5000 })
    await page.waitForTimeout(700)

    const start = await geometry()
    console.log(`  before      panel ${start.panelTop}..${start.panelBottom}`
      + `   block top ${start.blockTop}   gap ${start.gap}px`)

    // Move in visible steps, pausing so the recording shows the panel travelling with the text.
    for (const delta of [-50, -50, 40]) {
      const applied = await scrollBy(delta, 800)
      if (applied === null || applied.after === applied.before) continue
      const now = await geometry()
      if (now === null) continue
      const deltaBlock = now.blockTop - start.blockTop
      const deltaPanel = now.panelTop - start.panelTop
      const followed = Math.abs(deltaPanel - deltaBlock) <= 2
      console.log(`  after ${String(delta).padStart(4)}px  panel moved ${String(deltaPanel).padStart(4)}px,`
        + ` block moved ${String(deltaBlock).padStart(4)}px   ${followed ? 'FOLLOWED' : 'LEFT BEHIND'}`
        + `   gap ${now.gap}px   covers=${now.coversBlock}`)
    }

    await press('Escape')
    await page.waitForTimeout(600)
  }
} finally {
  const recording = await browser.close()
  if (recording.video !== null && recording.video !== undefined) {
    console.log(`\n  recording: ${recording.video}`)
    console.log(`  ${recording.frames} frames over ${recording.seconds}s`
      + ` (captured ${recording.capturedFps}fps), muxed at ${recording.fps}fps`)
  } else {
    console.log(`\n  no recording produced (${JSON.stringify(recording)})`)
  }
}
