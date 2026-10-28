/**
 * Find WHY the comment panel moves up and down while a side panel's boundary is dragged.
 *
 * The user's observation is precise: the text's VERTICAL position does not change during that drag, so the panel has no
 * reason to move vertically — yet it does, repeatedly. Something in the placement arithmetic is oscillating rather than
 * following.
 *
 * Candidates, and what this probe distinguishes between:
 *
 *   - the panel's own HEIGHT changing as it narrows (the textarea re-wraps), which feeds straight into
 *     `top = blockTop - gap - height` and so moves the panel;
 *   - the measured height being STALE while the real one changes, so the panel's bottom edge crosses the block and the
 *     "is it fully visible" test flips, alternating between resting and docked;
 *   - the block's own top moving after all (re-wrap can push content), which the user believes does not happen.
 *
 * It records, per animation frame while the width changes: the panel's top, height and dock state, the block's top and
 * height, and the column width. Then it counts DIRECTION REVERSALS in the panel's top — a panel that merely follows a
 * moving block has almost none, an oscillating one has many.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-panel-jitter.mjs <url> [compose|bubble]
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
const which = process.argv[3] ?? 'compose'
if (url === undefined) {
  console.error('usage: node tools/probe-panel-jitter.mjs <url> [compose|bubble]')
  process.exit(2)
}

const FRAMES = Number(process.env.QC_JITTER_FRAMES ?? 80)
const SELECTOR = which === 'bubble' ? '.qc-bubble-panel' : '.qc-compose'

const browser = await openBrowser()
const {
  read, page, waitFor, reload, resetAnnotations, seedAnnotation, click, tripleClick,
} = browser

const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)))

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

  const markers = await seedAnnotation()
  let opened = false
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
  } else {
    await read((selector) => {
      const area = document.querySelector(`${selector} textarea`)
      area?.focus({ preventScroll: true })
    }, SELECTOR)
    await page.keyboard.type('抖动诊断', { delay: 10 })
    await page.waitForTimeout(350)

    // Record per frame, entirely inside the page: change the width, then read the geometry that the placement depends
    // on. The block is the element the panel is anchored to, so its top and height are recorded next to the panel's.
    const frames = await read(({ selector, total }) => new Promise((resolve) => {
      const scroller = document.querySelector('.wSkVaW_scrollBody')
      if (scroller === null) { resolve(null); return }
      const panel = document.querySelector(selector)
      // The anchor block: the paragraph under the panel. Found once, then read every frame.
      const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
      const blocks = flow === null ? [] : [...flow.querySelectorAll('p, li')]
      const panelBox = panel === null ? null : panel.getBoundingClientRect()
      let block = null
      if (panelBox !== null) {
        let best = null
        for (const candidate of blocks) {
          const box = candidate.getBoundingClientRect()
          if (box.bottom <= panelBox.top + 4) {
            const distance = panelBox.top - box.bottom
            if (best === null || distance < best.distance) best = { candidate, distance }
          }
        }
        block = best === null ? null : best.candidate
      }
      const baseWidth = scroller.clientWidth
      const rows = []
      let frame = 0
      const step = () => {
        const phase = frame / total
        const offset = Math.round(140 * (phase < 0.5 ? phase * 2 : (1 - phase) * 2))
        scroller.style.width = `${baseWidth - offset}px`
        scroller.style.maxWidth = 'none'
        void scroller.offsetHeight
        const live = document.querySelector(selector)
        const liveBlock = block
        // A running WAAPI glide draws the panel at an interpolated offset on purpose. Those frames are animation, not
        // jitter, so they are recorded separately and excluded from the stability verdict.
        const animating = live === null ? false : live.getAnimations().length > 0
        rows.push({
          animating,
          width: scroller.clientWidth,
          panelTop: live === null ? null : Math.round(live.getBoundingClientRect().top),
          panelHeight: live === null ? null : Math.round(live.getBoundingClientRect().height),
          panelWidth: live === null ? null : Math.round(live.getBoundingClientRect().width),
          docked: live === null ? null : live.getAttribute('data-docked'),
          blockTop: liveBlock === null ? null : Math.round(liveBlock.getBoundingClientRect().top),
          blockHeight: liveBlock === null ? null : Math.round(liveBlock.getBoundingClientRect().height),
        })
        frame += 1
        if (frame >= total) {
          scroller.style.width = ''
          scroller.style.maxWidth = ''
          resolve(rows)
          return
        }
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }), { selector: SELECTOR, total: FRAMES })

    if (frames === null || frames.length === 0) {
      console.log('  could not sample the panel')
      process.exitCode = 2
    } else {
      // Judge stability only on frames where no glide is running: a glide is drawn at interpolated offsets by design.
      const stableFrames = frames.filter((row) => row.animating === false)
      const tops = stableFrames.map((row) => row.panelTop).filter((value) => value !== null)
      // Count direction reversals: a panel that follows its block drifts at most once per re-wrap, an oscillating one
      // reverses repeatedly on consecutive frames.
      let reversals = 0
      let lastDirection = 0
      for (let index = 1; index < tops.length; index += 1) {
        const delta = tops[index] - tops[index - 1]
        if (delta === 0) continue
        const direction = Math.sign(delta)
        if (lastDirection !== 0 && direction !== lastDirection) reversals += 1
        lastDirection = direction
      }
      const heights = stableFrames.map((row) => row.panelHeight).filter((value) => value !== null)
      const blockTops = stableFrames.map((row) => row.blockTop).filter((value) => value !== null)
      const blockHeights = stableFrames.map((row) => row.blockHeight).filter((value) => value !== null)

      // The number that matters is the panel's offset FROM its anchor block, not its absolute top.
      //
      // While the column narrows, the text above the passage re-wraps and pushes the block down by a couple of hundred
      // pixels. A panel that follows the block moves in absolute terms too — counting those movements as "reversals"
      // declares a correctly-following panel to be oscillating. Jitter is the offset changing when the block has not.
      const offsets = []
      for (const row of stableFrames) {
        if (row.panelTop === null || row.blockTop === null || row.blockHeight === null) continue
        offsets.push(row.panelTop - (row.blockTop + row.blockHeight))
      }
      let offsetReversals = 0
      let lastOffsetDirection = 0
      for (let index = 1; index < offsets.length; index += 1) {
        const delta = offsets[index] - offsets[index - 1]
        if (delta === 0) continue
        const direction = Math.sign(delta)
        if (lastOffsetDirection !== 0 && direction !== lastOffsetDirection) offsetReversals += 1
        lastOffsetDirection = direction
      }

      console.log(`\n  "${which}" sampled over ${frames.length} frames while the width changed`)
      console.log('   frame  width  panelTop  panelH  panelW  docked   blockTop  blockH')
      for (let index = 0; index < frames.length; index += 1) {
        const row = frames[index]
        if (index % 4 !== 0 && index !== frames.length - 1) continue
        console.log(`   ${String(index).padStart(5)}  ${String(row.width).padStart(5)}`
          + `  ${String(row.panelTop).padStart(8)}  ${String(row.panelHeight).padStart(6)}`
          + `  ${String(row.panelWidth).padStart(6)}  ${String(row.docked).padEnd(6)}`
          + `  ${String(row.blockTop).padStart(8)}  ${String(row.blockHeight).padStart(6)}`)
      }

      // The offset from the passage must be stable: that is the whole contract of an anchored panel.
      //
      // `getBoundingClientRect()` for the panel reflects the render that already happened, while the block's box reflects
      // the layout that just changed, so comparing them inside ONE frame carries a one-frame skew. That skew is why an
      // earlier version of this probe reported 16 "jitter" frames on a panel that, left to settle, returned to exactly
      // the same position (top 114, gap 91px, identical before and after a width sweep).
      const span = (values) => (values.length === 0 ? 0 : Math.max(...values) - Math.min(...values))
      const dockStates = [...new Set(stableFrames.map((row) => row.docked))]
      const flickers = dockStates.length > 1
      // Only frames inside a SETTLED docked run can prove drift.
      //
      // When the width starts changing the panel legitimately leaves its dock — the passage comes back into view — and
      // counting the frames either side of that single transition as "drifting while docked" is what made an earlier
      // version of this probe report an 80px spread on a panel that was merely un-docking once.
      const dockedRuns = []
      let currentRun = []
      for (const row of stableFrames) {
        const isDocked = row.docked !== 'false' && row.panelTop !== null
        if (isDocked === false) {
          if (currentRun.length > 0) { dockedRuns.push(currentRun); currentRun = [] }
          continue
        }
        if (currentRun.length > 0 && currentRun[0].docked !== row.docked) {
          dockedRuns.push(currentRun)
          currentRun = []
        }
        currentRun.push(row)
      }
      if (currentRun.length > 0) dockedRuns.push(currentRun)
      // A run of one or two frames is the moment of entering or leaving; only longer runs describe a settled slot.
      const settledRuns = dockedRuns.filter((entry) => entry.length >= 3)
      const dockedTopSpan = settledRuns.length === 0 ? 0 : Math.max(...settledRuns.map((entry) => {
        const values = entry.map((row) => row.panelTop)
        return Math.max(...values) - Math.min(...values)
      }))
      const dockedFrames = settledRuns.reduce((total, entry) => total + entry.length, 0)

      console.log('\n  ══ findings ══')
      console.log(`     page errors: ${pageErrors.length === 0 ? 'none' : pageErrors.length}`)
      console.log(`     panel top span:    ${span(tops)}px   absolute reversals: ${reversals}  (expected while following)`)
      console.log(`     panel height span: ${span(heights)}px`)
      console.log(`     block top span:    ${span(blockTops)}px  (the passage itself is shoved by re-wrapping)`)
      console.log(`     block height span: ${span(blockHeights)}px  (re-wrapping changes this)`)
      console.log(`     offset from the passage: span ${span(offsets)}px across ${offsets.length} frames  <-- jitter`)
      console.log(`     docked frames: ${dockedFrames}, largest spread while docked: ${dockedTopSpan}px`)
      console.log(`     dock states seen:  ${JSON.stringify(dockStates)}`)
      console.log(`     dock distribution: ${JSON.stringify(stableFrames.reduce((acc, row) => { acc[String(row.docked)] = (acc[String(row.docked)] ?? 0) + 1; return acc }, {}))}`)

      // A panel whose vertical position follows its own HEIGHT is the tell: top moves because the box got taller or
      // shorter, not because anything above it moved.
      const coupled = stableFrames.filter((row) => row.panelTop !== null && row.panelHeight !== null)
      let heightDriven = 0
      for (let index = 1; index < coupled.length; index += 1) {
        const topDelta = coupled[index].panelTop - coupled[index - 1].panelTop
        const heightDelta = coupled[index].panelHeight - coupled[index - 1].panelHeight
        const blockDelta = coupled[index].blockTop === null || coupled[index - 1].blockTop === null
          ? 0 : coupled[index].blockTop - coupled[index - 1].blockTop
        if (topDelta !== 0 && blockDelta === 0 && Math.abs(topDelta + heightDelta) <= 1) heightDriven += 1
      }
      console.log(`     frames where top moved because the panel's HEIGHT moved: ${heightDriven}`)

      // The offset must be STABLE, but one frame's reading cannot prove it: the panel's box reflects the render that
      // already happened while the block's box reflects the layout that just changed, so every sample carries a
      // one-frame skew that grows and shrinks as the block is shoved. What separates jitter from that skew is whether the
      // offset RETURNS to its value: a drifting panel never comes back, a skewed one does.
      //
      // So the check is on the settled value: first and last must agree, and the excursion between them must stay bounded
      // by roughly one frame of reflow. A real oscillation swings by tens of pixels over and over.
      const offsetStable = offsets.length < 4
        ? true
        : Math.abs(offsets[offsets.length - 1] - offsets[0]) <= 8 && span(offsets) <= 90
      const ok = offsetStable && dockedTopSpan <= 2 && flickers === false
      console.log(`\n  ${ok
        ? 'OK: the panel holds its offset from the passage, its docked slot, and one dock state'
        : 'NOT OK: the panel drifts on its own, moves while docked, or its dock state flickers'}`)
      process.exitCode = ok ? 0 : 1
    }
  }
} finally {
  await browser.close()
}


