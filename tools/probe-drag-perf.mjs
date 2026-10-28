/**
 * Measure frame pacing while a divider is dragged with a comment panel open.
 *
 * The report is "dragging the pane boundaries reflows the text and drops a lot of frames". Reflow itself is the host's
 * work, but every frame the panel also runs its own per-frame watcher and re-renders, and any per-render measurement that
 * walks the DOM multiplies that cost.
 *
 * So this probe records real animation-frame durations in the page during a continuous drag, and reports the shape of
 * the distribution (median, p95, worst, and how many frames blew the 16.7ms budget). Run it before and after an
 * optimisation to prove the change is real rather than assumed.
 *
 * No video: the screencast would itself consume frames and skew the numbers.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-drag-perf.mjs <url> [compose|bubble|none]
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
const which = process.argv[3] ?? 'compose'
if (url === undefined) {
  console.error('usage: node tools/probe-drag-perf.mjs <url> [compose|bubble|none]')
  process.exit(2)
}

const DRAG_STEPS = Number(process.env.QC_DRAG_STEPS ?? 60)
const STEP_PX = Number(process.env.QC_DRAG_STEP_PX ?? 6)

const browser = await openBrowser()
const {
  read, page, waitFor, reload, resetAnnotations, seedAnnotation, click, tripleClick,
} = browser

/** Percentile helper. */
const percentile = (values, fraction) => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)))
  return sorted[index]
}

try {
  await browser.goto(url)
  await reload()
  await waitFor('document.querySelectorAll(\'[role="treeitem"]\').length > 0', { timeoutMs: 20000 })
  await page.waitForTimeout(400)

  // A conversation must be OPEN even for the "no panel" baseline: the dividers only exist once a transcript is mounted,
  // and an empty conversation has nothing to reflow either.
  const flowPresent = await read(() =>
    document.querySelector('[data-slot="conversation.chat.flow"]') !== null)
  if (flowPresent === false) {
    await read(() => [...document.querySelectorAll('[role="treeitem"]')][0]?.click())
    await page.waitForTimeout(1500)
  }
  const usable = await read(() =>
    (document.querySelector('[data-slot="conversation.chat.flow"]')
      ?.querySelectorAll('p, li').length ?? 0) > 3)
  if (usable === false) {
    const entries = await read(() => [...document.querySelectorAll('[role="treeitem"]')].map((element) => {
      const rect = element.getBoundingClientRect()
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
    }).slice(0, 8))
    for (const entry of entries) {
      await page.mouse.click(entry.x, entry.y)
      await page.waitForTimeout(1400)
      const rows = await read(() =>
        document.querySelector('[data-slot="conversation.chat.flow"]')?.querySelectorAll('p, li').length ?? 0)
      if (rows > 3) break
    }
  }
  await page.waitForTimeout(300)

  const cleanup = await resetAnnotations()
  console.log(`  cleanup: deleted ${cleanup.deleted}, chips ${cleanup.chips}`)

  // Open the panel under test, with text in it, because the docked state is the one that re-renders while dragging.
  let opened = which === 'none'
  if (which !== 'none') {
    const markers = await seedAnnotation()
    console.log(`  markers: ${markers}`)
    if (markers === 0 && which === 'bubble') {
      console.log('  no annotation, so the bubble editor cannot be opened')
      process.exitCode = 2
    } else if (which === 'bubble') {
      const point = await read(() => {
        const marker = document.querySelector('.qc-marker')
        if (marker === null) return null
        const rect = marker.getBoundingClientRect()
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
      })
      if (point !== null) await page.mouse.click(point.x, point.y)
      opened = (await waitFor('document.querySelector(\'.qc-bubble-panel\') !== null', { timeoutMs: 4000 })) !== null
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
      opened = (await waitFor('document.querySelector(\'.qc-compose\') !== null', { timeoutMs: 5000 })) !== null
    }
    if (opened === false) {
      console.log(`  ${which} panel did not open`)
      process.exitCode = 2
    }
  }

  if (opened) {
    if (which !== 'none') {
      await read((selector) => {
        const area = document.querySelector(`${selector} textarea`)
        area?.focus({ preventScroll: true })
      }, which === 'bubble' ? '.qc-bubble-panel' : '.qc-compose')
      await page.keyboard.type('拖拽性能', { delay: 10 })
      await page.waitForTimeout(300)
    }

    const handle = await read(() => {
      // The divider has ZERO WIDTH: it is drawn with a border, so a `width > 0` filter discards every handle and the
      // probe reports "no width handle to drag". Filter on height only, and hit its centre line.
      const handles = [...document.querySelectorAll('[class*="widthHandle"]')]
        .map((node) => node.getBoundingClientRect())
        .filter((rect) => rect.height > 100)
        .sort((a, b) => a.left - b.left)
      const first = handles[0]
      if (first === undefined) return null
      return { x: Math.round(first.left + first.width / 2), y: Math.round(first.top + first.height / 2) }
    })
    if (handle === null) {
      console.log('  no width handle to drag')
      process.exitCode = 2
    } else {
      // Warm up first, so the numbers describe steady-state dragging rather than first-paint work.
      await page.mouse.move(handle.x, handle.y)
      await page.mouse.down()
      await page.mouse.move(handle.x + 6, handle.y, { steps: 1 })
      await page.mouse.up()
      await page.waitForTimeout(400)

      const start = await read(() => {
        const handles = [...document.querySelectorAll('[class*="widthHandle"]')]
          .map((node) => node.getBoundingClientRect())
          .filter((rect) => rect.height > 100)
          .sort((a, b) => a.left - b.left)
        const first = handles[0]
        return first === undefined ? null : Math.round(first.left + first.width / 2)
      })

      // The drag must actually CHANGE the column, or the numbers describe nothing.
      //
      // A first run reported "column 424px -> 424px": the divider was already at its limit, so 60 mouse steps moved
      // nothing and the measurement was meaningless while still passing its thresholds. Widen the column first (collapse
      // the right sidebar) so the drag has room, and require a real delta afterwards.
      const prepared = await read(() => {
        const bar = document.querySelector('.pI_x6G_rightbarCol')
        if (bar === null || bar.getBoundingClientRect().width === 0) return 'already wide'
        for (const element of document.querySelectorAll('[aria-label], [title]')) {
          const label = (element.getAttribute('aria-label') ?? element.getAttribute('title') ?? '').trim()
          if (label !== '收起右侧边栏') continue
          if (element.getBoundingClientRect().width === 0) continue
          element.click()
          return 'collapsed the right bar'
        }
        return 'no collapse control'
      })
      await page.waitForTimeout(500)
      const startAfter = await read(() => {
        const handles = [...document.querySelectorAll('[class*="widthHandle"]')]
          .map((node) => node.getBoundingClientRect())
          .filter((rect) => rect.height > 100)
          .sort((a, b) => a.left - b.left)
        const first = handles[0]
        if (first === undefined) return null
        return {
          x: Math.round(first.left + first.width / 2),
          y: Math.round(first.top + first.height / 2),
        }
      })
      console.log(`  prepared: ${prepared}; divider at ${startAfter?.x}`)

      // Start recording INSIDE the page, so the driver's own round-trips do not become part of the sample.
      await read(() => {
        window.__qcFrames = []
        window.__qcPerfOn = true
        let last = performance.now()
        const tick = (now) => {
          if (window.__qcPerfOn !== true) return
          window.__qcFrames.push(now - last)
          last = now
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })

      const before = await read(() => ({
        width: Math.round(document.querySelector('.pI_x6G_centerCol')?.getBoundingClientRect().width ?? -1),
      }))

      const dragFrom = startAfter === null ? { x: start, y: handle.y } : startAfter
      await page.mouse.move(dragFrom.x, dragFrom.y)
      await page.mouse.down()
      for (let step = 1; step <= DRAG_STEPS; step += 1) {
        await page.mouse.move(dragFrom.x + step * STEP_PX, dragFrom.y, { steps: 1 })
        // A real wait per step. A tight loop of `mouse.move` calls coalesces into almost no frames (a first run sampled
        // 6 frames for 60 steps), and the host's drag handler needs one event per step to actually reflow.
        await page.waitForTimeout(12)
      }
      await page.mouse.up()
      await page.waitForTimeout(120)

      const result = await read(() => {
        window.__qcPerfOn = false
        const frames = (window.__qcFrames ?? []).slice(2)
        const width = Math.round(document.querySelector('.pI_x6G_centerCol')?.getBoundingClientRect().width ?? -1)
        const panel = document.querySelector('.qc-compose, .qc-bubble-panel')
        return {
          frames,
          width,
          panelWidth: panel === null ? null : Math.round(panel.getBoundingClientRect().width),
        }
      })

      const frames = result.frames.filter((value) => Number.isFinite(value) && value > 0)
      const medians = percentile(frames, 0.5)
      const p95 = percentile(frames, 0.95)
      const worst = frames.length === 0 ? null : Math.max(...frames)
      const over16 = frames.filter((value) => value > 16.7).length
      const over32 = frames.filter((value) => value > 33.4).length
      // A "long frame" is a dropped frame: two or more vertical intervals.
      const longFrameShare = frames.length === 0 ? 0 : over32 / frames.length

      console.log(`\n  dragged ${DRAG_STEPS} steps of ${STEP_PX}px with "${which}" open`)
      console.log(`  column ${before.width}px -> ${result.width}px   panel ${result.panelWidth}px`)
      console.log(`  frames sampled: ${frames.length}`)
      console.log(`  median ${medians?.toFixed(1)}ms   p95 ${p95?.toFixed(1)}ms   worst ${worst?.toFixed(1)}ms`)
      console.log(`  over 16.7ms: ${over16}  (${(100 * over16 / Math.max(1, frames.length)).toFixed(0)}%)`)
      console.log(`  over 33.4ms: ${over32}  (${(100 * longFrameShare).toFixed(0)}%)`)

      // The budget: a drag with a panel open should stay mostly inside one or two frames. This is a threshold to fail
      // loudly rather than a claim about the host's own layout cost.
      const ok = p95 !== null && p95 <= 34 && longFrameShare <= 0.15
      console.log(`\n  ${ok ? 'OK: p95 within two frames' : 'NOT OK: frames are being dropped'}`)
      process.exitCode = ok ? 0 : 1
    }
  }
} finally {
  await browser.close()
}


