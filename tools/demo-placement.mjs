/**
 * A recorded demonstration of the two things the user asked to see.
 *
 * A full acceptance run is 25 seconds of assertions firing with little on screen but clicks — the wrong
 * material for judging placement. This shows the specific behaviour, slowly:
 *
 *   1. where the panel rests — bottom edge just above the BLOCK's top edge, never over the text;
 *   2. how it moves once the user types — the glide to the NEARER edge of the chat area;
 *   3. that clearing the text puts it back above the block;
 *   4. the animation in slow motion, because a 300ms transition at this machine's 25fps capture ceiling
 *      would otherwise be only 7 or 8 frames.
 *
 * Each step pauses long enough to be visible, and the measured numbers are printed beside what the
 * recording shows, so the picture and the claim can be checked against each other.
 *
 * Usage: node tools/demo-placement.mjs <url>
 */
import { mkdirSync } from 'node:fs'
import { openBrowser } from './harness.mjs'
import { findUsableConversation } from './find-usable-conversation.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/demo-placement.mjs <url>')
  process.exit(2)
}

const OUT = 'D:/Win自带分类文件夹/桌面/各种乱七八糟的项目/deepseekharness插件/dsh-quote-chat/recordings'
mkdirSync(OUT, { recursive: true })

const browser = await openBrowser({ video: true })
const {
  goto, waitFor, read, click, dragSelect, press, collapseRightSidebar, page, setAnimationRate,
} = browser

/** Panel, block, and chat-area geometry. */
const geometry = () => read(() => {
  const panel = document.querySelector('.qc-compose')
  if (panel === null) return null
  const box = panel.getBoundingClientRect()
  const block = document.querySelector('[data-qc-probe="1"]')
  const blockBox = block === null ? null : block.getBoundingClientRect()
  const editors = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter((element) => element.getBoundingClientRect().height > 0)
  const composerTop = editors.length === 0
    ? null : Math.round(editors[editors.length - 1].getBoundingClientRect().top)
  const header = document.querySelector('header')
  const headerBottom = header === null ? 0 : Math.round(header.getBoundingClientRect().bottom)
  return {
    panelTop: Math.round(box.top),
    panelBottom: Math.round(box.bottom),
    blockTop: blockBox === null ? null : Math.round(blockBox.top),
    gapToBlock: blockBox === null ? null : Math.round(blockBox.top - box.bottom),
    gapToHeader: Math.round(box.top - headerBottom),
    gapToComposer: composerTop === null ? null : Math.round(composerTop - box.bottom),
    docked: panel.getAttribute('data-docked'),
  }
})

/** Print one state, labelled. */
const report = (label, state) => {
  console.log(`\n  ${label}`)
  console.log(`    panel      ${state.panelTop}..${state.panelBottom}   docked=${state.docked}`)
  console.log(`    block top  ${state.blockTop}   gap to the block ${state.gapToBlock}px`)
  console.log(`    to header  ${state.gapToHeader}px   to composer ${state.gapToComposer}px`)
}

try {
  await goto(url)
  await waitFor('document.querySelectorAll(\'[role="treeitem"]\').length > 0', { timeoutMs: 20000 })
  await collapseRightSidebar()
  await page.waitForTimeout(400)

  // Let the shared finder pick a conversation and a block: it knows to scroll long transcripts to their
  // end, where the newest prose is, and it verifies the offset has settled before measuring.
  const found = await findUsableConversation(browser)
  if (found.failure === true) {
    console.log('  no conversation with a usable block; tried:')
    for (const title of found.tried) console.log(`    ${title}`)
    process.exitCode = 1
    throw new Error('no usable conversation')
  }

  const chosen = await read(() => {
    const block = document.querySelector('[data-qc-probe="1"]')
    if (block === null) return null
    const box = block.getBoundingClientRect()
    return {
      blockTop: Math.round(box.top),
      blockBottom: Math.round(box.bottom),
      text: (block.innerText ?? '').trim().slice(0, 26),
      lastLine: Math.round(box.bottom - 12),
      left: Math.round(box.left + 14),
      right: Math.round(box.left + 130),
    }
  })
  console.log(`\n  conversation: "${found.title}"`)

  if (chosen === null || chosen.failure === true) {
    console.log('  no suitable paragraph; nothing to demonstrate')
    if (chosen !== null && chosen.failure === true) {
      console.log(`  band ${chosen.bandTop}..${chosen.bandBottom}`)
      for (const block of chosen.blocks) {
        console.log(`    ${String(block.top).padStart(4)}..${String(block.bottom).padStart(4)}`
          + ` h=${block.h} c=${block.c}`)
      }
    }
    process.exitCode = 1
  } else {
    // Wait until the transcript's offset stops changing, so every later coordinate describes the same
    // page state. Measuring mid-scroll is what produced impossible numbers in earlier probes.
    let stable = false
    let lastTop = null
    for (let attempt = 0; attempt < 20 && !stable; attempt += 1) {
      const reading = await read(() => {
        const block = document.querySelector('[data-qc-probe="1"]')
        return block === null ? null : Math.round(block.getBoundingClientRect().top)
      })
      stable = reading !== null && reading === lastTop
      lastTop = reading
      if (!stable) await page.waitForTimeout(50)
    }
    if (!stable) {
      console.log('  the transcript never stopped scrolling; aborting rather than measuring it')
      process.exitCode = 1
      throw new Error('scroll did not settle')
    }

    console.log(`\n  paragraph: "${chosen.text}"  ${chosen.blockTop}..${chosen.blockBottom}`)

    // ── 1. Select the LAST line: the case that used to cover the text. ──
    await page.waitForTimeout(700)
    await dragSelect({ x: chosen.left, y: chosen.lastLine }, { x: chosen.right, y: chosen.lastLine })
    await waitFor('document.querySelectorAll(\'.qc-popup button\').length === 2', { timeoutMs: 5000 })
    await page.waitForTimeout(800)

    await click('.qc-popup button:first-child')
    await waitFor('document.querySelector(\'.qc-compose\') !== null', { timeoutMs: 5000 })
    await page.waitForTimeout(1100)

    const resting = await geometry()
    report('RESTING — above the block, nothing typed', resting)
    const restingOk = resting.gapToBlock >= 4 && resting.gapToBlock <= 24
    console.log(`    ${restingOk ? 'OK' : 'WRONG'}: expected the bottom edge 4..24px above the block top`)

    // ── 2. The glide, at quarter speed so the easing is visible. ──
    console.log('\n  slowing the page to 1/4 speed to show the glide')
    await setAnimationRate(0.25)
    await page.waitForTimeout(400)

    await page.keyboard.type('这里需要补充说明', { delay: 30 })
    // Long enough for the slowed transition plus the typing.
    await page.waitForTimeout(2600)

    const docked = await geometry()
    report('DOCKED — after typing, at the nearer edge', docked)
    const closerToHeader = docked.gapToHeader <= docked.gapToComposer
    const expected = closerToHeader ? 'header' : 'composer'
    const atExpected = expected === 'header'
      ? docked.gapToHeader <= 24
      : docked.gapToComposer <= 24
    console.log(`    nearer edge is the ${expected}; panel is at the`
      + ` ${docked.gapToHeader <= 24 ? 'header' : docked.gapToComposer <= 24 ? 'composer' : 'wrong place'}`
      + `  ${atExpected ? 'OK' : 'WRONG'}`)

    // ── 3. Restore real time, clear the text, and watch it go back. ──
    await setAnimationRate(1)
    await page.waitForTimeout(500)
    console.log('\n  restoring real time; clearing the text')
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    await page.waitForTimeout(1400)

    const restored = await geometry()
    report('CLEARED — back above the block', restored)
    const backOk = Math.abs((restored.gapToBlock ?? 0) - (resting.gapToBlock ?? 0)) <= 2
    console.log(`    ${backOk ? 'OK' : 'WRONG'}: should return to the same gap as before typing`)

    // ── 4. Confirm, and show the annotation in place. ──
    await page.waitForTimeout(400)
    await page.keyboard.type('录屏演示：确认添加', { delay: 40 })
    await page.waitForTimeout(1200)
    await press('Enter')
    await page.waitForTimeout(1600)

    const final = await read(() => ({
      panels: document.querySelectorAll('.qc-compose').length,
      chips: document.querySelectorAll('.qc-chip').length,
      markers: document.querySelectorAll('.qc-gutter-marker').length,
    }))
    console.log(`\n  after confirming: panels=${final.panels} chips=${final.chips}`
      + ` markers=${final.markers}`)
    await page.waitForTimeout(900)
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
