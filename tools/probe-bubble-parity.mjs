/**
 * The bubble editor must behave like the compose panel in two specific ways.
 *
 * The user reported both as inconsistencies:
 *
 *   1. DOCKING. Typing snapped the editor to a screen edge even when the bubble and the editor were both comfortably
 *      visible. The compose panel only docks when it would otherwise be out of view, so the editor must do the same.
 *   2. DISMISSAL. The editor closed on any outside press, discarding the edit when the user reached for a side panel or
 *      the composer. The compose panel only closes on a press inside the transcript.
 *
 * The probe therefore checks, in one run:
 *
 *   - with the editor fully visible, typing does not move it;
 *   - a press on the header, the composer or the left rail leaves it open;
 *   - a press inside the transcript closes it.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-bubble-parity.mjs <url>
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/probe-bubble-parity.mjs <url>')
  process.exit(2)
}

const browser = await openBrowser({ video: 'manual' })
const {
  read, page, waitFor, collapseRightSidebar, reload, startRecording, resetAnnotations, seedAnnotation,
} = browser

/** Editor geometry and whether it is open. */
const state = () => read(() => {
  const panel = document.querySelector('.qc-bubble-panel')
  const marker = document.querySelector('.qc-marker')
  if (panel === null) return { open: false }
  const panelBox = panel.getBoundingClientRect()
  const markerBox = marker === null ? null : marker.getBoundingClientRect()
  const scroller = document.querySelector('.wSkVaW_scrollBody')
  const scrollerBox = scroller === null ? null : scroller.getBoundingClientRect()
  return {
    open: true,
    top: Math.round(panelBox.top),
    bottom: Math.round(panelBox.bottom),
    gap: markerBox === null ? null : Math.round(markerBox.top - panelBox.bottom),
    docked: panel.getAttribute('data-docked'),
    fullyVisible: scrollerBox === null
      ? null
      : panelBox.top >= scrollerBox.top - 1 && panelBox.bottom <= scrollerBox.bottom + 1,
  }
})

/** Dispatch a mousedown at a region, then report whether the editor survived. */
const pressRegion = async (kind) => {
  const identity = await read((which) => {
    const resolve = () => {
      if (which === 'header') return document.querySelector('.wSkVaW_header')
      if (which === 'leftRail') {
        const tree = document.querySelector('[role="treeitem"]')
        return tree === null ? null : tree.closest('aside, nav, [class*="rail"], [class*="sidebar"]')
          ?? tree.parentElement?.parentElement ?? null
      }
      if (which === 'composer') {
        const editable = [...document.querySelectorAll('[contenteditable="true"]')]
          .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
        if (editable === null) return null
        const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
        let surface = editable
        for (let node = editable.parentElement; node !== null; node = node.parentElement) {
          if (node === document.body) break
          if (flow !== null && node.contains(flow)) break
          surface = node
        }
        return surface
      }
      if (which === 'transcript') {
        const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
        return flow === null ? null : flow.querySelector('p, li')
      }
      return null
    }
    const target = resolve()
    if (target === null) return null
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    return typeof target.className === 'string' && target.className !== ''
      ? target.className.slice(0, 30) : target.tagName
  }, kind)
  if (identity === null) return null
  await page.waitForTimeout(220)
  const after = await state()
  return { identity, open: after.open }
}

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

  const cleanup = await resetAnnotations()
  console.log(`  cleanup: deleted ${cleanup.deleted}, chips ${cleanup.chips}, draft ${cleanup.draft}`)

  const markers = await seedAnnotation()
  console.log(`  markers after seeding: ${markers}`)

  if (markers === 0) {
    console.log('  could not create an annotation, so nothing was measured')
    process.exitCode = 2
  } else {
    // Open the editor on a bubble that sits comfortably inside the band.
    const point = await read(() => {
      const scroller = document.querySelector('.wSkVaW_scrollBody')
      const editable = [...document.querySelectorAll('[contenteditable="true"]')]
        .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
      const composerTop = editable === null
        ? window.innerHeight : editable.getBoundingClientRect().top
      const scrollerBox = scroller.getBoundingClientRect()
      const marker = document.querySelector('.qc-marker')
      if (marker === null) return null
      const wanted = Math.max(scrollerBox.top + 200, composerTop - 210)
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const box = marker.getBoundingClientRect()
        const delta = box.top - wanted
        if (Math.abs(delta) <= 6) break
        scroller.style.scrollBehavior = 'auto'
        scroller.scrollTop += delta
        void scroller.offsetHeight
      }
      const box = marker.getBoundingClientRect()
      return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
    })

    if (point === null) {
      console.log('  no marker to click')
      process.exitCode = 1
    } else {
      await page.mouse.click(point.x, point.y)
      const opened = await waitFor('document.querySelector(\'.qc-bubble-panel\') !== null',
        { timeoutMs: 4000 })
      if (opened === null) {
        console.log('  the editor did not open')
        process.exitCode = 1
      } else {
        await page.waitForTimeout(350)
        await startRecording()

        // ── 1. Typing must not move a fully visible editor ──
        const before = await state()
        console.log(`\n  before typing: top ${before.top}  gap ${before.gap}`
          + `  docked ${before.docked}  fullyVisible ${before.fullyVisible}`)
        await read(() => {
          const area = document.querySelector('.qc-bubble-panel textarea')
          area?.focus()
        })
        await page.keyboard.type('补充内容', { delay: 25 })
        await page.waitForTimeout(500)
        const afterType = await state()
        const moved = afterType.top - before.top
        console.log(`  after typing:  top ${afterType.top}  gap ${afterType.gap}`
          + `  docked ${afterType.docked}  moved ${moved}px`)
        const stayedPut = before.fullyVisible === true && moved === 0 && afterType.docked === 'false'

        // ── 2. Chrome must not dismiss ──
        const chromeResults = []
        for (const kind of ['header', 'composer', 'leftRail']) {
          const outcome = await pressRegion(kind)
          if (outcome === null) {
            console.log(`  ${kind.padEnd(10)} SKIPPED (region not found)`)
            continue
          }
          console.log(`  ${kind.padEnd(10)} target=${String(outcome.identity).padEnd(26)}`
            + `  open=${outcome.open}`)
          chromeResults.push(outcome.open === true)
        }

        // ── 3. The transcript must dismiss ──
        const transcript = await pressRegion('transcript')
        const closed = transcript !== null && transcript.open === false
        console.log(`  ${'transcript'.padEnd(10)} target=${String(transcript?.identity).padEnd(26)}`
          + `  open=${transcript?.open}`)

        const chromeOk = chromeResults.length === 3 && chromeResults.every((entry) => entry === true)

        console.log('\n  ══ verdict ══')
        console.log(`     typing left a fully visible editor in place: ${stayedPut}`
          + `  (moved ${moved}px, docked ${afterType.docked})`)
        console.log(`     chrome kept it open: ${chromeOk}  ${JSON.stringify(chromeResults)}`)
        console.log(`     the transcript closed it: ${closed}`)

        const ok = stayedPut && chromeOk && closed
        console.log(`\n     ${ok ? 'OK: the editor behaves like the compose panel' : 'NOT OK'}`)
        process.exitCode = ok ? 0 : 1
      }
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
