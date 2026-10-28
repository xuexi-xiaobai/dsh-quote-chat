/**
 * Frame pacing while the transcript's width changes with a comment panel open.
 *
 * The reported symptom is severe dropped frames while dragging a pane boundary, with a panel open. Synthetic mouse events
 * do NOT drive the host's divider (measured: 60 steps of `mouse.move` left the column at exactly 1000px), so a probe that
 * "drags" it measures an idle window and proves nothing.
 *
 * Instead this changes the column's width directly, frame by frame, which is the same reflow the host performs during a
 * drag — the text re-wraps, the rows change height, the panel must re-place itself. That exercises the panel's per-frame
 * cost honestly, without depending on event plumbing that the automation cannot reach.
 *
 * Run it before and after an optimisation to compare p95 and the share of dropped frames.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-reflow-perf.mjs <url> [compose|bubble|none]
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
const which = process.argv[3] ?? 'compose'
if (url === undefined) {
  console.error('usage: node tools/probe-reflow-perf.mjs <url> [compose|bubble|none]')
  process.exit(2)
}

const FRAMES = Number(process.env.QC_REFLOW_FRAMES ?? 90)

const browser = await openBrowser()
const {
  read, page, waitFor, reload, resetAnnotations, seedAnnotation, click, tripleClick,
} = browser

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

  let opened = which === 'none'
  if (which !== 'none') {
    const markers = await seedAnnotation()
    if (which === 'bubble') {
      if (markers === 0) {
        console.log('  no annotation, so the bubble editor cannot be opened')
        process.exitCode = 2
      } else {
        const point = await read(() => {
          const marker = document.querySelector('.qc-marker')
          if (marker === null) return null
          const rect = marker.getBoundingClientRect()
          return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
        })
        if (point !== null) await page.mouse.click(point.x, point.y)
        opened = (await waitFor('document.querySelector(\'.qc-bubble-panel\') !== null', { timeoutMs: 4000 })) !== null
      }
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
      await page.keyboard.type('重排性能', { delay: 10 })
      await page.waitForTimeout(300)
    }

    // Everything measured happens inside ONE page interaction: the width is changed per animation frame and the frame
    // durations are recorded beside it, so the driver's round-trips never appear in the numbers.
    const result = await read(({ total }) => new Promise((resolve) => {
      const scroller = document.querySelector('.wSkVaW_scrollBody')
      const center = document.querySelector('.pI_x6G_centerCol')
      if (scroller === null) { resolve(null); return }
      const baseLeft = Math.round(scroller.getBoundingClientRect().left)
      const baseWidth = scroller.clientWidth
      const durations = []
      const widths = []
      let frame = 0
      let last = performance.now()

      const step = () => {
        const now = performance.now()
        if (frame > 2) durations.push(now - last)
        last = now
        // Move the edge by 8px per frame, reversing direction in the second half, so the reflow keeps changing.
        const phase = frame / total
        const offset = Math.round(140 * (phase < 0.5 ? phase * 2 : (1 - phase) * 2))
        scroller.style.width = `${baseWidth - offset}px`
        scroller.style.maxWidth = 'none'
        // Force the layout to be recomputed before the next frame, which is what makes this an honest reflow cost.
        void scroller.offsetHeight
        widths.push(scroller.clientWidth)
        frame += 1
        if (frame >= total) {
          scroller.style.width = ''
          scroller.style.maxWidth = ''
          resolve({ durations, widths: [...new Set(widths)].length, baseLeft })
          return
        }
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }), { total: FRAMES })

    if (result === null) {
      console.log('  no scroller to resize')
      process.exitCode = 2
    } else {
      const frames = result.durations.filter((value) => Number.isFinite(value) && value > 0)
      const median = percentile(frames, 0.5)
      const p95 = percentile(frames, 0.95)
      const worst = frames.length === 0 ? null : Math.max(...frames)
      const over16 = frames.filter((value) => value > 16.7).length
      const over32 = frames.filter((value) => value > 33.4).length
      const longShare = frames.length === 0 ? 0 : over32 / frames.length

      console.log(`\n  reflowed ${FRAMES} frames with "${which}" open (${result.widths} distinct widths)`)
      console.log(`  frames sampled: ${frames.length}`)
      console.log(`  median ${median?.toFixed(1)}ms   p95 ${p95?.toFixed(1)}ms   worst ${worst?.toFixed(1)}ms`)
      console.log(`  over 16.7ms: ${over16}  (${(100 * over16 / Math.max(1, frames.length)).toFixed(1)}%)`)
      console.log(`  over 33.4ms: ${over32}  (${(100 * longShare).toFixed(1)}%)`)

      const ok = p95 !== null && p95 <= 34 && longShare <= 0.15
      console.log(`\n  ${ok ? 'OK: p95 within two frames' : 'NOT OK: frames are being dropped'}`)
      process.exitCode = ok ? 0 : 1
    }
  }
} finally {
  await browser.close()
}
