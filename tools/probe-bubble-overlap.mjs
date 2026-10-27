/**
 * Does the gutter bubble's comment panel overlap the chat box?
 *
 * This is a DIFFERENT panel from the compose panel: `.qc-bubble-panel` is the one that opens when a gutter bubble (a
 * marker beside an annotated paragraph) is clicked. Its placement comes from `anchorAboveBubble`, which clamps against
 * `visibleChatArea()` — and that function takes the composer's boundary from `findComposerDock()`.
 *
 * The probe first makes sure an annotation exists (creating one through the normal flow if needed), then clicks a
 * marker and measures the panel against the chat box. Two boundaries are reported, because they differ by the box's
 * padding and only one of them is what a person sees:
 *
 *   - the composer's OUTER box (what the chat box looks like);
 *   - the composer's editable (what `findComposerDock()` returns today).
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-bubble-overlap.mjs <url>
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/probe-bubble-overlap.mjs <url>')
  process.exit(2)
}

const browser = await openBrowser({ video: 'manual' })
const { read, dragSelect, press, page, waitFor, collapseRightSidebar, click, reload, startRecording } = browser

/** Panel and chat-box geometry. */
const sample = () => read(() => {
  const panel = document.querySelector('.qc-bubble-panel')
  if (panel === null) return null
  const panelBox = panel.getBoundingClientRect()
  const editable = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter((element) => element.getBoundingClientRect().height > 0)
    .pop() ?? null
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
  const editableBox = editable === null ? null : editable.getBoundingClientRect()
  return {
    panel: {
      top: Math.round(panelBox.top), bottom: Math.round(panelBox.bottom),
      left: Math.round(panelBox.left), right: Math.round(panelBox.right),
    },
    composerBoxTop: surfaceBox === null ? null : Math.round(surfaceBox.top),
    composerEditableTop: editableBox === null ? null : Math.round(editableBox.top),
    intoBox: surfaceBox === null ? null : Math.round(panelBox.bottom) - Math.round(surfaceBox.top),
    intoEditable: editableBox === null ? null : Math.round(panelBox.bottom) - Math.round(editableBox.top),
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

  // Make sure at least one annotation exists, so a bubble exists to click.
  let markers = await read(() => document.querySelectorAll('.qc-marker').length)
  console.log(`\n  existing markers: ${markers}`)
  if (markers === 0) {
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
      }, offset)
      if (points !== null) break
    }
    if (points === null) {
      console.log('  could not seat a passage to annotate')
      process.exitCode = 1
    } else {
      // Select with click + Shift-click. A plain drag depends on the page having focus and on the pointer events landing
      // in the right order; after a reload it intermittently produced an empty selection, so the toolbar never appeared
      // and the probe aborted before measuring anything. Shift-click always yields a range, and the selection text is
      // checked before going on.
      await page.mouse.click(points.from.x, points.from.y)
      await page.waitForTimeout(120)
      await page.keyboard.down('Shift')
      await page.mouse.click(points.to.x, points.to.y)
      await page.keyboard.up('Shift')
      await page.waitForTimeout(150)
      const selected = await read(() => (window.getSelection() ?? '').toString().trim().length)
      console.log(`  selected ${selected} characters`)
      await waitFor('document.querySelectorAll(\'.qc-popup button\').length === 2', { timeoutMs: 5000 })
      await click('.qc-popup button:first-child')
      await waitFor('document.querySelector(\'.qc-compose\') !== null', { timeoutMs: 5000 })
      await page.waitForTimeout(250)
      await page.keyboard.type('气泡重叠测试', { delay: 20 })
      await page.waitForTimeout(200)
      await click('.qc-compose-confirm')
      await page.waitForTimeout(700)
      markers = await read(() => document.querySelectorAll('.qc-marker').length)
      console.log(`  markers after creating one: ${markers}`)
    }
  }

  if (markers === 0) {
    console.log('  no marker to click; nothing to measure')
    process.exitCode = 1
  } else {
    // Scroll so the marker sits low in the band: the panel then has room above it, AND there is room to scroll it
    // upward afterwards. Placing it at the very top instead pinned the panel against the band's bottom clamp from the
    // first frame, so every sample was identical and the run demonstrated nothing.
    const placed = await read(() => {
      const scroller = document.querySelector('.wSkVaW_scrollBody')
      const marker = document.querySelector('.qc-marker')
      if (scroller === null || marker === null) return null
      scroller.style.scrollBehavior = 'auto'
      const scrollerBox = scroller.getBoundingClientRect()
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const box = marker.getBoundingClientRect()
        const delta = box.top - (scrollerBox.top + 430)
        if (Math.abs(delta) <= 6) break
        scroller.scrollTop += delta
        void scroller.offsetHeight
      }
      const after = marker.getBoundingClientRect()
      return { markerTop: Math.round(after.top), band: [Math.round(scrollerBox.top), Math.round(scrollerBox.bottom)] }
    })
    await page.waitForTimeout(400)
    console.log(`  marker placed at ${placed?.markerTop}  band ${placed?.band?.join('..')}`)

    await read(() => document.querySelector('.qc-marker')?.click())
    const opened = await waitFor('document.querySelector(\'.qc-bubble-panel\') !== null',
      { timeoutMs: 5000 })
    if (opened === null) {
      console.log('  the bubble panel did not open')
      process.exitCode = 1
    } else {
      await page.waitForTimeout(350)
      // Start recording only now: the verification is what matters, and recording during setup disturbed the
      // selection that creates the annotation.
      await startRecording()
      const state = await sample()
      console.log(`\n  bubble panel ${state.panel.top}..${state.panel.bottom}`)
      console.log(`  chat box top ${state.composerBoxTop}   (input top ${state.composerEditableTop})`)
      console.log(`  into the chat box's OUTER edge: ${state.intoBox}px`)
      console.log(`  into the chat box's editable:   ${state.intoEditable}px`)

      // The panel's position is a container coordinate, so it travels with the content when the transcript scrolls.
      // Opening it once and measuring once therefore says nothing about the state after a scroll — and scroll is
      // exactly how it ended up over the chat box. Sample on the way.
      // Two phases, because they exercise different failures:
      //
      //   A. scroll UP   — the panel must travel with its bubble (and clamp at the band's top edge);
      //   B. scroll DOWN — the panel must NOT travel into the chat box. This is the reported defect: the panel's
      //                    position is a container coordinate, so scrolling carries it down over the composer, which is
      //                    sticky and painted above it.
      //
      // The first version only scrolled up, which can never produce the overlap, and reported a pass that meant
      // nothing.
      const rows = []
      for (const phase of [{ name: 'up', delta: +55, steps: 5 }, { name: 'down', delta: -55, steps: 14 }]) {
        for (let step = 1; step <= phase.steps; step += 1) {
          await read((amount) => {
            const scroller = document.querySelector('.wSkVaW_scrollBody')
            if (scroller === null) return
            scroller.style.scrollBehavior = 'auto'
            scroller.scrollTop += amount
            void scroller.offsetHeight
          }, phase.delta)
          await page.waitForTimeout(220)
          const next = await sample()
          if (next !== null) rows.push({ phase: phase.name, step, ...next })
        }
      }

      console.log('\n  phase  step  panelTop..Bottom  boxTop  intoBox')
      for (const row of rows) {
        console.log(`   ${row.phase.padEnd(5)}  ${String(row.step).padStart(4)}`
          + `  ${String(row.panel.top).padStart(6)}..${String(row.panel.bottom).padEnd(6)}`
          + `  ${String(row.composerBoxTop).padStart(6)}`
          + `  ${String(row.intoBox).padStart(7)}`)
      }

      const into = rows.filter((row) => row.intoBox !== null && row.intoBox > 0)
      const worst = rows.length === 0 ? null : Math.max(...rows.map((row) => row.intoBox ?? -9999))

      console.log('\n  ══ verdict ══')
      console.log(`     samples: ${rows.length}`)
      console.log(`     samples overlapping the drawn chat box: ${into.length}`
        + `  (worst ${worst === null ? 'n/a' : `${worst}px`})`)
      if (rows.length < 5) {
        console.log('\n     NOT SET UP: too few samples')
        process.exitCode = 2
      } else if (into.length > 0) {
        console.log('\n     NOT OK: the bubble panel overlaps the chat box')
        process.exitCode = 1
      } else {
        console.log('\n     OK: the bubble panel stays above the drawn chat box')
        process.exitCode = 0
      }

      await press('Escape')
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

