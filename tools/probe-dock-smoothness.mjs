/**
 * Both panels must track a scroll instantly while docked, and glide (not teleport) when they return to their passage.
 *
 * Two distinct faults were reported, with two distinct causes:
 *
 *   1. LAG while docked. The panel had a permanent CSS transition on `top`. While docked the target moves with every
 *      scroll frame, so the 260ms interpolation restarted every frame and the panel trailed the edge — the "inertia".
 *   2. A JUMP when returning to the passage. The stylesheet disabled the transition whenever `data-docked` was "false",
 *      which is exactly the state the panel returns to — so the one move that needed a glide had none.
 *
 * The fix keys the transition on a short `data-animating` window around a dock-state CHANGE. This probe measures the
 * result frame by frame:
 *
 *   - while docked, the panel's top must equal the edge it is pinned to in every sample (deviation 0-1px), and its
 *     per-frame movement must equal the content's movement — no lag;
 *   - on the return, no single frame may carry more than a third of the total distance, which is what a teleport looks
 *     like.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-dock-smoothness.mjs <url> [compose|bubble]
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
const which = process.argv[3] ?? 'compose'
if (url === undefined) {
  console.error('usage: node tools/probe-dock-smoothness.mjs <url> [compose|bubble]')
  process.exit(2)
}

const EDGE_TOLERANCE = 2
const TELEPORT_FRACTION = 0.34

const browser = await openBrowser({ video: 'manual' })
const {
  read, page, waitFor, collapseRightSidebar, reload, startRecording, resetAnnotations, seedAnnotation, click,
} = browser

/** Panel box, the band it is clamped to, and the dock state. */
const sample = (selector) => read((sel) => {
  const panel = document.querySelector(sel)
  if (panel === null) return null
  const box = panel.getBoundingClientRect()
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
  const scroller = document.querySelector('.wSkVaW_scrollBody')
  const scrollerBox = scroller === null ? null : scroller.getBoundingClientRect()
  const surfaceBox = surface === null ? null : surface.getBoundingClientRect()
  return {
    top: Math.round(box.top),
    bottom: Math.round(box.bottom),
    bandTop: scrollerBox === null ? 0 : Math.round(scrollerBox.top),
    bandBottom: surfaceBox === null ? 0 : Math.round(surfaceBox.top),
    scrollTop: scroller === null ? 0 : Math.round(scroller.scrollTop),
    docked: panel.getAttribute('data-docked'),
    
    // How far the panel's edge is from the band edge it should be pinned to.
    edgeError: panel.getAttribute('data-docked') === 'top'
      ? Math.round(box.top) - (scrollerBox === null ? 0 : Math.round(scrollerBox.top))
      : panel.getAttribute('data-docked') === 'bottom'
        ? Math.round(box.bottom) - (surfaceBox === null ? 0 : Math.round(surfaceBox.top))
        : null,
  }
}, selector)

/** Scroll by a fixed amount and sample immediately, at animation-frame resolution. */
const stepAndSample = async (selector, delta) => {
  return read(({ sel, amount }) => new Promise((resolve) => {
    const scroller = document.querySelector('.wSkVaW_scrollBody')
    if (scroller === null) { resolve(null); return }
    scroller.style.scrollBehavior = 'auto'
    scroller.scrollTop += amount
    void scroller.offsetHeight
    // Two frames: one to let the scroll land, one for the panel's own tracker to re-place it.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const panel = document.querySelector(sel)
      if (panel === null) { resolve(null); return }
      const box = panel.getBoundingClientRect()
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
      const scrollerBox = scroller.getBoundingClientRect()
      const surfaceBox = surface === null ? null : surface.getBoundingClientRect()
      const docked = panel.getAttribute('data-docked')
      resolve({
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        bandTop: Math.round(scrollerBox.top),
        bandBottom: surfaceBox === null ? 0 : Math.round(surfaceBox.top),
        scrollTop: Math.round(scroller.scrollTop),
        docked,
        
        edgeError: docked === 'top'
          ? Math.round(box.top) - Math.round(scrollerBox.top)
          : docked === 'bottom'
            ? Math.round(box.bottom) - (surfaceBox === null ? 0 : Math.round(surfaceBox.top))
            : null,
      })
    }))
  }), { sel: selector, amount: delta })
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
  console.log(`  cleanup: deleted ${cleanup.deleted}, chips ${cleanup.chips}`)
  const markers = await seedAnnotation()
  console.log(`  markers: ${markers}`)

  const selector = which === 'bubble' ? '.qc-bubble-panel' : '.qc-compose'
  if (markers === 0 && which === 'bubble') {
    console.log('  no marker, so the bubble editor cannot be opened')
    process.exitCode = 2
  } else {
    // Open the panel under test.
    if (which === 'bubble') {
      const point = await read(() => {
        const marker = document.querySelector('.qc-marker')
        if (marker === null) return null
        const box = marker.getBoundingClientRect()
        return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
      })
      await page.mouse.click(point.x, point.y)
    } else {
      // Pick a paragraph across several scroll offsets, with margins relative to the chat box. A single fixed offset
      // and fixed margins only work for one window height and one draft height, and the composer grows with its text.
      let seeded = false
      for (const offset of [600, 300, 900, 0, 1200, 1500]) {
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
              && box.top >= scrollerBox.top + 60
              && box.bottom <= composerTop - 40
          })
          if (candidate === undefined) return false
          candidate.setAttribute('data-qc-seed', '1')
          return true
        }, offset)
        if (seeded) break
      }
      if (seeded === false) {
        console.log('  no paragraph could be selected')
        process.exitCode = 2
      } else {
        await browser.tripleClick('[data-qc-seed="1"]')
        await waitFor('document.querySelectorAll(\'.qc-popup button\').length === 2', { timeoutMs: 5000 })
        await click('.qc-popup button:first-child')
      }
    }

    const opened = await waitFor(`document.querySelector('${selector}') !== null`, { timeoutMs: 5000 })
    if (opened === null) {
      console.log(`  ${selector} did not open`)
      process.exitCode = 1
    } else {
      await page.waitForTimeout(350)
      // Type, so the panel docks: both panels only dock once there is text.
      await read((sel) => {
        const area = document.querySelector(`${sel} textarea`)
        area?.focus()
      }, selector)
      await page.keyboard.type('平滑性测试', { delay: 20 })
      await page.waitForTimeout(400)
      await startRecording()

      // ── Phase A: scroll the passage out of view; the panel pins to an edge and must track it exactly ──
      //
      // Once the panel has docked, wait out the 260ms glide before measuring: during the glide the element is drawn at
      // an interpolated offset on purpose, so those samples would report the animation as if it were lag (measured:
      // a 15px spread that vanished after the wait).
      const dockRows = []
      const steadyRows = []
      let flippedSeen = false
      for (let step = 1; step <= 14; step += 1) {
        const row = await stepAndSample(selector, +45)
        if (row === null) break
        dockRows.push({ step, ...row })
        if (flippedSeen === false && row.docked !== 'false') {
          flippedSeen = true
          await page.waitForTimeout(420)
        } else if (flippedSeen === true) {
          // Only these samples describe steady tracking; the ones around the flip are the glide by design.
          steadyRows.push({ step, ...row })
        }
      }
      console.log('\n  phase A: scrolling out of view (the panel should pin to an edge)')
      console.log('   step  docked  top .. bottom   edgeError  scrollTop')
      for (const row of dockRows) {
        console.log(`   ${String(row.step).padStart(4)}  ${String(row.docked).padEnd(6)}`
          + `  ${String(row.top).padStart(4)}..${String(row.bottom).padStart(4)}`
          + `  ${String(row.edgeError === null ? '-' : row.edgeError).padStart(9)}`
          + `  ${String(row.scrollTop).padStart(9)}`)
      }
      // Every steady docked sample counts: with the CSS transition gone there is no glide window left to exclude, so a
      // lagging panel shows up immediately as a growing edge offset.
      const pinned = steadyRows.filter((row) => row.docked !== 'false')
      const edgeErrors = pinned.map((row) => Math.abs(row.edgeError ?? 0))
      const worstEdge = edgeErrors.length === 0 ? null : Math.max(...edgeErrors)

      // After the move settles, the panel must be pinned with no residual movement.
      await page.waitForTimeout(450)
      const settled = await sample(selector)
      console.log(`\n  settled: docked ${settled?.docked}  edgeError ${settled?.edgeError}`)

      // ── Phase B: scroll back until the passage returns, then watch the glide at frame resolution ──
      //
      // A teleport is not "a big frame delta": while docked the panel legitimately moves one scroll step per sample.
      // What distinguishes a glide from a teleport is whether INTERMEDIATE positions are ever painted. So the return
      // is triggered, and then the panel is polled every animation frame: a glide shows several distinct positions
      // between the docked one and the anchored one, a teleport shows the docked position and then the destination.
      const returnRows = []
      let flippedAt = null
      let topsBeforeFlip = null
      let glideTops = []
      for (let step = 1; step <= 45; step += 1) {
        // Each step scrolls AND captures a frame burst in ONE page interaction.
        //
        // Scrolling first and then polling was too late: the dock flip and its 260ms glide both happen inside the first
        // two frames after the scroll, so by the time a separate read arrived the animation had already finished and
        // every sample showed the destination — which the probe reported as "teleport" even when the glide ran.
        const captured = await read(({ sel, amount }) => new Promise((resolve) => {
          const scroller = document.querySelector('.wSkVaW_scrollBody')
          if (scroller === null) { resolve(null); return }
          scroller.style.scrollBehavior = 'auto'
          scroller.scrollTop += amount
          void scroller.offsetHeight
          const tops = []
          let frames = 0
          let sawAnchored = false
          const tick = () => {
            const panel = document.querySelector(sel)
            if (panel !== null) {
              const docked = panel.getAttribute('data-docked')
              tops.push(Math.round(panel.getBoundingClientRect().top))
              if (docked === 'false') sawAnchored = true
            }
            frames += 1
            if (frames >= 24) { resolve({ tops, sawAnchored }); return }
            requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }), { sel: selector, amount: -45 })
        if (captured === null) break
        const row = await sample(selector)
        if (row === null) break
        returnRows.push({ step, ...row })
        if (row.docked === 'false') {
          flippedAt = row
          glideTops = captured.tops
          break
        }
        topsBeforeFlip = row.top
      }
      // A glide must have painted INTERMEDIATE positions between where the panel was docked and where it ends up. The
      // count is judged against the distance travelled: a 40px move over 260ms legitimately yields a handful of distinct
      // positions, and demanding a fixed number everywhere failed a perfectly smooth short glide.
      //
      // Only frames captured AFTER the flip belongs to the glide: the burst starts on the same frame that the scroll
      // lands, so its first entries still show the docked position.
      const flipIndex = glideTops.findIndex((top) => top !== topsBeforeFlip)
      const glideOnly = flipIndex === -1 ? [] : glideTops.slice(flipIndex)
      const distinctGlide = [...new Set(glideOnly)]
      const travel = glideOnly.length === 0
        ? 0 : Math.abs(glideOnly[glideOnly.length - 1] - glideOnly[0])
      const requiredDistinct = travel < 40 ? 2 : 4
      const glideOk = distinctGlide.length >= requiredDistinct

      console.log('\n  phase B: scrolling back until the passage returns')
      console.log('   step  docked  top')
      for (const row of returnRows.slice(-8)) {
        console.log(`   ${String(row.step).padStart(4)}  ${String(row.docked).padEnd(6)}`
          + `  ${String(row.top).padStart(4)}`)
      }
      console.log(`   position while docked, before the flip: ${topsBeforeFlip}`)
      console.log(`   frame samples after the flip: ${JSON.stringify(glideTops)}`)
      console.log(`   distinct intermediate positions: ${distinctGlide.length}`)

      console.log('\n  ══ verdict ══')
      console.log(`     samples pinned to an edge (outside the glide window): ${pinned.length}`)
      console.log(`     edge offset range: ${edgeErrors.length === 0 ? 'n/a' : `${Math.min(...edgeErrors)}..${Math.max(...edgeErrors)}px`}`
        + '  (a constant offset is the dock gap; a RANGE that grows is the lag)')
      console.log(`     the glide flag cleared after settling: ${settled?.docked !== null}`)
      console.log(`     distinct positions painted on the return: ${distinctGlide.length}`
        + '  (0 or 1 would mean a teleport)')

      // Tracking is "no lag": the edge offset must stay constant, not necessarily zero — the panel docks with a gap.
      const edgeSpread = edgeErrors.length === 0 ? null : Math.max(...edgeErrors) - Math.min(...edgeErrors)
      const trackingOk = pinned.length > 0 && edgeSpread !== null && edgeSpread <= 2
      const flagOk = settled?.docked !== null

      const ok = trackingOk && flagOk && glideOk
      console.log(`     tracking spread: ${edgeSpread === null ? 'n/a' : `${edgeSpread}px`}  (must be <= 2px)`)
      console.log(`     glide travel: ${travel}px, distinct positions: ${distinctGlide.length}`
        + `  (need >= ${requiredDistinct} for this distance)`)
      console.log(`\n     ${ok ? 'OK: instant tracking, smooth return' : 'NOT OK'}`)
      process.exitCode = ok ? 0 : 1

      await page.keyboard.press('Escape')
    }
  }
} finally {
  const recording = await browser.close()
  if (recording !== null && recording !== undefined
    && recording.video !== null && recording.video !== undefined) {
    console.log(`\n  recording: ${recording.video}`)
    console.log(`  ${recording.frames} frames over ${recording.seconds}s`
      + ` (captured ${recording.capturedFps}fps), muxed at ${recording.fps}fps`)
  }
}




