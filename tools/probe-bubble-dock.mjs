/**
 * The gutter bubble's comment editor must behave like the compose panel.
 *
 * The rule, as the user stated it: at rest the editor stays anchored to the object it belongs to (the gutter bubble),
 * and it only snaps to the top or bottom edge of the reading area once there is text in it.
 *
 * That is exactly how the compose panel behaves, so the two editors feel the same. It also fixes the reported overlap:
 * a box that only docks when the user is typing can still be dragged over the chat box while scrolling, but the moment
 * there is text it moves somewhere usable.
 *
 * The probe checks all three parts, in order, and records the whole run:
 *
 *   1. at rest, the editor's bottom edge tracks the bubble (the gap between them stays constant while scrolling);
 *   2. after typing, the editor sits against the band's nearer edge and clear of the chat box;
 *   3. clearing the text returns it to the bubble.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-bubble-dock.mjs <url>
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/probe-bubble-dock.mjs <url>')
  process.exit(2)
}

const browser = await openBrowser({ video: 'manual' })
const { read, page, waitFor, collapseRightSidebar, click, reload, startRecording, resetAnnotations } = browser

/** Editor, bubble and chat-box geometry. */
const sample = () => read(() => {
  const panel = document.querySelector('.qc-bubble-panel')
  const bubble = document.querySelector('.qc-marker')
  if (panel === null) return null
  const panelBox = panel.getBoundingClientRect()
  const bubbleBox = bubble === null ? null : bubble.getBoundingClientRect()
  const editable = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
  let surface = editable
  if (editable !== null) {
    const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
    for (let node = editable.parentElement; node !== null; node = node.parentElement) {
      if (node === document.body) break
      if (flow !== null && node.contains(flow)) break
      surface = node
    }
  }
  const surfaceBox = surface === null ? null : surface.getBoundingClientRect()
  return {
    panelTop: Math.round(panelBox.top),
    panelBottom: Math.round(panelBox.bottom),
    bubbleTop: bubbleBox === null ? null : Math.round(bubbleBox.top),
    bubbleBottom: bubbleBox === null ? null : Math.round(bubbleBox.bottom),
    // The anchored relationship, measured BOTH ways.
    //
    // At rest the editor hangs above its bubble, and moves BELOW when there is no room above — otherwise it would be
    // clamped onto the band's top edge and cover the very bubble it belongs to. A metric that only knows "above"
    // reports the below case as a large negative gap and looks like drift, when the editor is in fact glued to the
    // bubble.
    attachGap: bubbleBox === null
      ? null
      : Math.round(panelBox.top) >= Math.round(bubbleBox.bottom)
        ? Math.round(panelBox.top) - Math.round(bubbleBox.bottom)
        : Math.round(bubbleBox.top) - Math.round(panelBox.bottom),
    side: bubbleBox === null
      ? null
      : Math.round(panelBox.top) >= Math.round(bubbleBox.bottom) ? 'below' : 'above',
    composerBoxTop: surfaceBox === null ? null : Math.round(surfaceBox.top),
    intoComposer: surfaceBox === null ? null : Math.round(panelBox.bottom) - Math.round(surfaceBox.top),
    docked: panel.getAttribute('data-docked'),
    geom: panel.getAttribute('data-qc-geom'),
    text: panel.querySelector('textarea, [contenteditable="true"]')?.textContent ?? null,
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

  // Start from a clean conversation: chips from previous runs pile up in the composer and change what the probes
  // measure, so they are removed through the plugin's own controls before anything is measured.
  const cleanup = await resetAnnotations()
  console.log(`  cleanup: deleted ${cleanup.deleted}, chips now ${cleanup.chips}, draft ${cleanup.draft}`)

  // An annotation must exist for a bubble to click.
  let markers = await read(() => document.querySelectorAll('.qc-marker').length)
  if (markers === 0) {
    const points = await read(() => {
      const scroller = document.querySelector('.wSkVaW_scrollBody')
      const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
      if (scroller === null || flow === null) return null
      scroller.style.scrollBehavior = 'auto'
      scroller.scrollTop = 600
      void scroller.offsetHeight
      const scrollerBox = scroller.getBoundingClientRect()
      const candidates = [...flow.querySelectorAll('p, li')].filter((element) => {
        const box = element.getBoundingClientRect()
        return (element.innerText ?? '').trim().length > 40
          && box.top >= scrollerBox.top + 190
          && box.bottom <= scrollerBox.bottom - 60
      })
      const element = candidates[0]
      if (element === undefined) return null
      const box = element.getBoundingClientRect()
      return {
        from: { x: Math.round(box.left + 20), y: Math.round(box.top + 12) },
        to: { x: Math.round(box.left + Math.min(150, box.width - 20)), y: Math.round(box.top + 12) },
      }
    })
    if (points === null) {
      console.log('  no passage to annotate')
      process.exitCode = 1
    } else {
      // Triple-click the paragraph. Coordinate selection was unreliable here: the cleanup pass focuses the composer, and
      // a click-plus-Shift-click on the transcript sometimes left an empty selection, so the toolbar never appeared and
      // the probe aborted before measuring anything. A triple click selects the paragraph in one gesture.
      await read(() => {
        const scroller = document.querySelector('.wSkVaW_scrollBody')
        const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
        if (scroller === null || flow === null) return
        scroller.style.scrollBehavior = 'auto'
        scroller.scrollTop = 600
        void scroller.offsetHeight
        for (const old of document.querySelectorAll('[data-qc-seed]')) old.removeAttribute('data-qc-seed')
        const scrollerBox = scroller.getBoundingClientRect()
        const candidate = [...flow.querySelectorAll('p, li')].find((element) => {
          const box = element.getBoundingClientRect()
          return (element.innerText ?? '').trim().length > 40
            && box.top >= scrollerBox.top + 190
            && box.bottom <= scrollerBox.bottom - 60
        })
        candidate?.setAttribute('data-qc-seed', '1')
      })
      await browser.tripleClick('[data-qc-seed="1"]')
      await page.waitForTimeout(300)
      const selected = await read(() => (window.getSelection() ?? '').toString().trim().length)
      console.log(`  selected ${selected} characters by triple click`)
      await waitFor('document.querySelectorAll(\'.qc-popup button\').length === 2', { timeoutMs: 5000 })
      await click('.qc-popup button:first-child')
      await waitFor('document.querySelector(\'.qc-compose\') !== null', { timeoutMs: 5000 })
      await page.waitForTimeout(250)
      await page.keyboard.type('气泡吸附测试', { delay: 15 })
      await click('.qc-compose-confirm')
      await page.waitForTimeout(700)
      markers = await read(() => document.querySelectorAll('.qc-marker').length)
    }
  }

  if (markers === 0) {
    console.log('  no marker available')
    process.exitCode = 1
  } else {
    // Seat the bubble in the middle of the usable area, measured against the CHAT BOX rather than a fixed offset.
    //
    // A fixed `scrollerTop + 430` put the bubble at 506 while the composer's top edge was at 469 — i.e. behind the chat
    // box, so clicking it hit the composer instead and the editor never opened. The composer's position depends on the
    // window and on how many lines the draft has, so the only safe anchor is the composer itself.
    await read(() => {
      const scroller = document.querySelector('.wSkVaW_scrollBody')
      const marker = document.querySelector('.qc-marker')
      if (scroller === null || marker === null) return
      scroller.style.scrollBehavior = 'auto'
      const scrollerBox = scroller.getBoundingClientRect()
      const editable = [...document.querySelectorAll('[contenteditable="true"]')]
        .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
      const composerTop = editable === null ? scrollerBox.bottom : editable.getBoundingClientRect().top
      // 190px above the chat box: comfortably inside the band, and low enough that the editor has room above it.
      const wanted = Math.max(scrollerBox.top + 140, composerTop - 190)
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const box = marker.getBoundingClientRect()
        const delta = box.top - wanted
        if (Math.abs(delta) <= 6) break
        scroller.scrollTop += delta
        void scroller.offsetHeight
      }
    })
    await page.waitForTimeout(300)
    // Click the marker with a REAL pointer press. A synthetic `.click()` only dispatches `click`, and the editor is
    // opened from a pointer handler, so the panel never appeared — which read as "the editor did not open" while the
    // marker was perfectly clickable by hand.
    const markerPoint = await read(() => {
      const marker = document.querySelector('.qc-marker')
      if (marker === null) return null
      const box = marker.getBoundingClientRect()
      return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
    })
    if (markerPoint === null) {
      console.log('  the marker disappeared before it could be clicked')
      process.exitCode = 1
    } else {
      await page.mouse.click(markerPoint.x, markerPoint.y)
    }
    const opened = await waitFor('document.querySelector(\'.qc-bubble-panel\') !== null', { timeoutMs: 4000 })
    if (opened === null) {
      console.log('  the editor did not open')
      process.exitCode = 1
    } else {
      await page.waitForTimeout(350)
      await startRecording()

      // ── Phase 1: at rest, the editor must track the bubble ──
      const restRows = []
      for (let step = 1; step <= 6; step += 1) {
        await read(() => {
          const scroller = document.querySelector('.wSkVaW_scrollBody')
          if (scroller === null) return
          scroller.style.scrollBehavior = 'auto'
          scroller.scrollTop += 55
          void scroller.offsetHeight
        })
        await page.waitForTimeout(260)
        const next = await sample()
        if (next !== null) restRows.push({ step, ...next })
      }
      console.log('\n  phase 1: at rest, following the bubble')
      console.log('   step  bubbleTop  panelTop..Bottom  attachGap side docked')
      const first = await sample()
      if (first !== null) {
        console.log(`   ${'0'.padStart(4)}  ${String(first.bubbleTop).padStart(9)}`
          + `  ${String(first.panelTop).padStart(6)}..${String(first.panelBottom).padEnd(6)}`
          + `  ${String(first.attachGap).padStart(9)}  ${first.docked}`)
      }
      for (const row of restRows) {
        console.log(`   ${String(row.step).padStart(4)}  ${String(row.bubbleTop).padStart(9)}`
          + `  ${String(row.panelTop).padStart(6)}..${String(row.panelBottom).padEnd(6)}`
          + `  ${String(row.attachGap).padStart(9)}  ${row.docked}`)
      }
      const gaps = [first, ...restRows].filter((row) => row !== null).map((row) => row.attachGap)
      const gapSpread = gaps.length === 0 ? 0 : Math.max(...gaps) - Math.min(...gaps)

      // Phase 1b: with no text the editor must be ordinary content, free to leave the screen.
      //
      // The reported defect was the chat box "pushing" it: the editor held its ground while the bubble scrolled away. So
      // the observable proof is a sample where the editor's bottom edge goes PAST the chat box's top edge — allowed,
      // because the chat box simply covers it, exactly as it covers the transcript text. If every sample stays clear of
      // the chat box, the editor is being clamped into the band again.
      const pushedRows = []
      for (let step = 1; step <= 10; step += 1) {
        await read(() => {
          const scroller = document.querySelector('.wSkVaW_scrollBody')
          if (scroller === null) return
          scroller.style.scrollBehavior = 'auto'
          scroller.scrollTop -= 55
          void scroller.offsetHeight
        })
        await page.waitForTimeout(180)
        const next = await sample()
        if (next !== null) pushedRows.push({ step, ...next })
      }
      const enteredComposer = pushedRows.filter((row) => row.intoComposer !== null && row.intoComposer > 0)
      const attachSpreads = pushedRows.map((row) => row.attachGap)
      const attachOk = attachSpreads.length > 0
        && Math.max(...attachSpreads) - Math.min(...attachSpreads) <= 12

      console.log('\n  phase 1b: scrolled down, no text — the editor must be free to leave the screen')
      console.log('   step  panelTop..Bottom  bubbleTop  attachGap  intoComposer')
      for (const row of pushedRows) {
        console.log(`   ${String(row.step).padStart(4)}`
          + `  ${String(row.panelTop).padStart(6)}..${String(row.panelBottom).padEnd(6)}`
          + `  ${String(row.bubbleTop).padStart(9)}`
          + `  ${String(row.attachGap).padStart(9)}`
          + `  ${String(row.intoComposer).padStart(12)}`)
      }
      console.log(`\n  samples reaching past the chat box's top: ${enteredComposer.length}`
        + `  (this is ALLOWED when there is no text)`)
      console.log(`  the bubble gap stayed constant across the scroll: ${attachOk}`)

      await read(() => {
        const area = document.querySelector('.qc-bubble-panel textarea, .qc-bubble-panel [contenteditable="true"]')
        area?.focus()
      })
      await page.keyboard.type('补充说明', { delay: 30 })
      await page.waitForTimeout(500)
      const docked = await sample()
      console.log('\n  phase 2: after typing')
      console.log(`   panel ${docked.panelTop}..${docked.panelBottom}`
        + `   docked=${docked.docked}   intoComposer=${docked.intoComposer}`)

      // ── Phase 3: clearing the text must return it to the bubble ──
      // Select-all then delete: the box was pre-filled with the existing comment, so a fixed number of backspaces
      // would have left characters behind and the flag would never clear.
      await page.keyboard.press('Control+A')
      await page.keyboard.press('Delete')
      await page.waitForTimeout(500)
      const restored = await sample()
      console.log('\n  phase 3: after clearing the text')
      console.log(`   panel ${restored.panelTop}..${restored.panelBottom}`
        + `   docked=${restored.docked}   attachGap=${restored.attachGap}`)

      const follows = gapSpread <= 12
      const dockedOk = docked.docked !== 'false' && docked.intoComposer !== null && docked.intoComposer <= 0
      const restoredOk = restored.docked === 'false'
        && restored.attachGap !== null && Math.abs(restored.attachGap) <= 12
      // The decisive check for the reported defect: with no text the editor must be able to scroll behind the chat box.
      const freeToLeave = enteredComposer.length > 0 && attachOk

      console.log('\n  ══ verdict ══')
      console.log(`     at rest, it follows its bubble: gap varied ${gapSpread}px  ${follows ? 'OK' : 'DRIFTED'}`)
      console.log(`     at rest, it can scroll behind the chat box: ${enteredComposer.length} samples did`
        + `  ${freeToLeave ? 'OK' : 'STILL PUSHED'}`)
      console.log(`     typing docked it to an edge: ${docked.docked}, clear of the chat box by`
        + ` ${docked.intoComposer === null ? 'n/a' : -docked.intoComposer}px  ${dockedOk ? 'OK' : 'WRONG'}`)
      console.log(`     clearing the text restored the anchor  ${restoredOk ? 'OK' : 'WRONG'}`)

      const ok = follows && freeToLeave && dockedOk && restoredOk
      console.log(`\n     ${ok ? 'OK' : 'NOT OK'}`)
      process.exitCode = ok ? 0 : 1
    }
  }
} finally {
  const recording = await browser.close()
  if (recording !== null && recording !== undefined
    && recording.video !== null && recording.video !== undefined) {
    console.log(`\n  recording: ${recording.video}`)
    console.log(`  ${recording.frames} frames over ${recording.seconds}s`
      + ` (captured ${recording.capturedFps}fps), muxed at ${recording.fps}fps`)
  } else {
    console.log('\n  no recording produced')
  }
}



