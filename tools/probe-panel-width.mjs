/**
 * The comment panel must shrink with the text column, and must re-place itself when the column reflows.
 *
 * Two faults, one theme — the panel was sized and placed against things that do not change when a sidebar moves:
 *
 *   1. WIDTH. The stylesheet sized both panels against the VIEWPORT (`min(420px, 92vw)`, `min(320px, 80vw)`). A sidebar
 *      widening the column's neighbours narrows the column, and the panel then overhangs it — the sidebar paints over
 *      the panel's buttons.
 *   2. FOLLOWING. The per-frame watcher compared the anchor block's top/left/height but NOT its width. A reflow
 *      re-wraps the paragraph and moves the panel's correct position while the top stays put, so nothing fired and the
 *      panel kept stale coordinates until an unrelated scroll forced a pass.
 *
 * The probe drives the real UI: it finds the widest and narrowest column it can reach, and at each state records the
 * column, the panel, and whether the panel fits inside the column.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-panel-width.mjs <url> [compose|bubble]
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
const which = process.argv[3] ?? 'bubble'
if (url === undefined) {
  console.error('usage: node tools/probe-panel-width.mjs <url> [compose|bubble]')
  process.exit(2)
}

const SELECTOR = which === 'bubble' ? '.qc-bubble-panel' : '.qc-compose'

const browser = await openBrowser({ video: 'manual' })
const {
  read, page, waitFor, reload, resetAnnotations, seedAnnotation, click, tripleClick,
} = browser

const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)))

/** Column, right bar and panel boxes, all in viewport coordinates. */
const geometry = () => read((selector) => {
  const box = (element) => {
    if (element === null || element === undefined) return null
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return null
    return {
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
    }
  }
  const panel = document.querySelector(selector)
  const panelBox = panel === null ? null : panel.getBoundingClientRect()
  const center = document.querySelector('.pI_x6G_centerCol')
  const rightBar = document.querySelector('.pI_x6G_rightbarCol')
  const centerBox = center === null ? null : center.getBoundingClientRect()
  const rightBox = rightBar === null ? null : rightBar.getBoundingClientRect()
  // The text itself, which is what a person sees as the column: the widest mounted row.
  const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
  let text = null
  if (flow !== null) {
    let widest = null
    for (const row of flow.querySelectorAll('p, li, pre')) {
      const rect = row.getBoundingClientRect()
      if (rect.width === 0) continue
      if (widest === null || rect.width > widest.width) widest = rect
    }
    text = widest === null ? null : {
      left: Math.round(widest.left), right: Math.round(widest.right), width: Math.round(widest.width),
    }
  }
  return {
    panel: panelBox === null ? null : {
      left: Math.round(panelBox.left),
      right: Math.round(panelBox.right),
      width: Math.round(panelBox.width),
      top: Math.round(panelBox.top),
    },
    center: box(center),
    rightBar: box(rightBar),
    text,
    // Positive means the panel's right edge is past the column's right edge: it overhangs into the sidebar.
    overhang: panelBox === null || centerBox === null
      ? null : Math.round(panelBox.right) - Math.round(centerBox.right),
    // Positive means the *panel* covers the right bar's area.
    intoRightBar: panelBox === null || rightBox === null || rightBox.width === 0
      ? 0 : Math.max(0, Math.round(panelBox.right) - Math.round(rightBox.left)),
  }
}, SELECTOR)

/** Press whichever right-sidebar control is currently visible. */
const toggleRightBar = async () => {
  const label = await read(() => {
    for (const element of document.querySelectorAll('[aria-label], [title]')) {
      const text = (element.getAttribute('aria-label') ?? element.getAttribute('title') ?? '').trim()
      if (text !== '打开右侧边栏' && text !== '收起右侧边栏') continue
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      element.click()
      return text
    }
    return null
  })
  await page.waitForTimeout(650)
  return label
}

/** Drive the right sidebar until the text column is as wide as it gets. */
const widenColumn = async () => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await geometry()
    if (current.center === null) return null
    if (current.center.width >= 900) return current
    const used = await toggleRightBar()
    if (used === null) return null
  }
  return geometry()
}

try {
  await browser.goto(url)
  await reload()
  await waitFor('document.querySelectorAll(\'[role="treeitem"]\').length > 0', { timeoutMs: 20000 })
  await page.waitForTimeout(400)

  const flowOpen = await read(() =>
    document.querySelector('[data-slot="conversation.chat.flow"]') !== null)
  if (flowOpen === false) {
    await read(() => [...document.querySelectorAll('[role="treeitem"]')][0]?.click())
  }

  // Pick a conversation that actually HAS prose.
  //
  // The first entries in the list are often empty conversations, and a probe that opens one finds zero paragraphs, so
  // seeding fails and every measurement reports nothing — which reads exactly like a product bug. Walk the list until a
  // conversation with rows is open.
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
      await page.waitForTimeout(1500)
      const rows = await read(() =>
        document.querySelector('[data-slot="conversation.chat.flow"]')?.querySelectorAll('p, li').length ?? 0)
      if (rows > 3) break
    }
    console.log('  opened a conversation with prose')
  }

  await waitFor(
    '(() => { const f = document.querySelector(\'[data-slot="conversation.chat.flow"]\');'
      + ' return f !== null && [...f.querySelectorAll("p, li")].some((e) => (e.innerText ?? "").trim().length > 40) })()',
    { timeoutMs: 20000 },
  )
  await page.waitForTimeout(400)

  // Widen FIRST, then create the annotation: an annotation needs room to seed, and a squeezed column has none.
  const wide = await widenColumn()
  console.log(`  column widened to ${wide?.center?.width}px (text ${wide?.text?.width}px)`)
  const cleanup = await resetAnnotations()
  console.log(`  cleanup: deleted ${cleanup.deleted}, chips ${cleanup.chips}`)

  const markers = await seedAnnotation()
  console.log(`  markers: ${markers}`)
  if (markers === 0) {
    console.log('  could not create an annotation, so nothing was measured')
    process.exitCode = 2
  } else {
    if (which === 'bubble') {
      // Scroll the marker into the band first, then read its box and press exactly that point.
      //
      // Reading the coordinates and clicking later is unreliable here: `seedAnnotation` leaves the transcript at
      // whatever offset the seeding gesture needed, so the marker can sit behind the composer or off the top, and a click
      // computed from a stale position lands on the transcript — which is the panel's dismissal gesture, so the panel
      // never appeared and the run looked like a product failure.
      const point = await read(() => {
        const scroller = document.querySelector('.wSkVaW_scrollBody')
        const marker = document.querySelector('.qc-marker')
        if (scroller === null || marker === null) return null
        scroller.style.scrollBehavior = 'auto'
        const scrollerBox = scroller.getBoundingClientRect()
        const editable = [...document.querySelectorAll('[contenteditable="true"]')]
          .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
        const composerTop = editable === null ? scrollerBox.bottom : editable.getBoundingClientRect().top
        const wanted = Math.max(scrollerBox.top + 160, composerTop - 200)
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const box = marker.getBoundingClientRect()
          const delta = box.top - wanted
          if (Math.abs(delta) <= 6) break
          scroller.scrollTop += delta
          void scroller.offsetHeight
        }
        const box = marker.getBoundingClientRect()
        return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
      })
      if (point !== null) {
        const hitsMarker = await read((point2) => {
          const hit = document.elementFromPoint(point2.x, point2.y)
          return hit !== null && hit.closest('.qc-marker') !== null
        }, point)
        console.log(`  marker at ${point.x},${point.y} (hit is marker: ${hitsMarker})`)
        await page.mouse.click(point.x, point.y)
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
    }

    const opened = await waitFor(`document.querySelector('${SELECTOR}') !== null`, { timeoutMs: 5000 })
    if (opened === null) {
      console.log(`  ${SELECTOR} did not open`)
      process.exitCode = 2
    } else {
      await read((selector) => {
        const area = document.querySelector(`${selector} textarea`)
        area?.focus({ preventScroll: true })
      }, SELECTOR)
      await page.keyboard.type('宽度跟随测试', { delay: 15 })
      await page.waitForTimeout(450)

      const wideState = await geometry()
      console.log(`\n  wide:   column ${wideState.center?.width}px  panel ${wideState.panel?.width}px`
        + `  overhang ${wideState.overhang}px`)

      // Squeeze the column HARDER than the panel's default width, otherwise nothing is proven: with a 320px panel and a
      // 424px column the panel still fits and no sizing rule is exercised. Drag the right bar's divider left in jumps
      // until the column is narrower than the panel.
      const used = await toggleRightBar()
      await page.waitForTimeout(400)
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const current = await geometry()
        if (current.center !== null && current.panel !== null
          && current.center.width <= current.panel.width + 20) break
        const divider = await read(() => {
          const handles = [...document.querySelectorAll('[class*="widthHandle"]')]
            .map((node) => node.getBoundingClientRect())
            .filter((rect) => rect.width > 0 && rect.height > 0)
            .sort((a, b) => a.left - b.left)
          const last = handles[handles.length - 1]
          if (last === undefined) return null
          return { x: Math.round(last.left + last.width / 2), y: Math.round(last.top + last.height / 2) }
        })
        if (divider === null) break
        await page.mouse.move(divider.x, divider.y)
        await page.mouse.down()
        await page.mouse.move(divider.x - 40, divider.y, { steps: 1 })
        await page.mouse.up()
        await page.waitForTimeout(260)
      }
      const narrowed = await geometry()
      console.log(`  (${used}, squeezed)`)
      console.log(`  narrow: column ${narrowed.center?.width}px  panel ${narrowed.panel?.width}px`
        + `  overhang ${narrowed.overhang}px  intoRightBar ${narrowed.intoRightBar}px`)

      // If the panel still fits comfortably, the run has not exercised the cap at all: squeezing a 320px panel inside a
      // 424px column proves nothing. Narrow the scroller further by widening the LEFT sidebar, which is the other half of
      // the squeeze the user described ("both sidebars pressing in").
      let narrowState = narrowed
      if (narrowed.center !== null && narrowed.panel !== null
        && narrowed.center.width > narrowed.panel.width + 8) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const before = await geometry()
          if (before.center === null || before.panel === null) break
          if (before.center.width <= before.panel.width + 8) break
          const divider = await read(() => {
            const handles = [...document.querySelectorAll('[class*="widthHandle"]')]
              .map((node) => node.getBoundingClientRect())
              .filter((rect) => rect.width > 0 && rect.height > 0)
              .sort((a, b) => a.left - b.left)
            const first = handles[0]
            if (first === undefined) return null
            return { x: Math.round(first.left + first.width / 2), y: Math.round(first.top + first.height / 2) }
          })
          if (divider === null) break
          await page.mouse.move(divider.x, divider.y)
          await page.mouse.down()
          await page.mouse.move(divider.x + 40, divider.y, { steps: 1 })
          await page.mouse.up()
          await page.waitForTimeout(260)
        }
        narrowState = await geometry()
        console.log('  (left sidebar widened)')
        console.log(`  tighter: column ${narrowState.center?.width}px  panel ${narrowState.panel?.width}px`
          + `  overhang ${narrowState.overhang}px  intoRightBar ${narrowState.intoRightBar}px`)
      }

      // A pure reflow must be followed with NO scrolling: sample again after a moment, then once more after a scroll,
      // and require that the pre-scroll and post-scroll geometry agree.
      await page.waitForTimeout(400)
      const settled = await geometry()
      await read(() => {
        const scroller = document.querySelector('.wSkVaW_scrollBody')
        if (scroller === null) return
        scroller.style.scrollBehavior = 'auto'
        scroller.scrollTop += 30
        void scroller.offsetHeight
      })
      await page.waitForTimeout(350)
      const afterScroll = await geometry()

      const followedWithoutScroll = settled.panel !== null && afterScroll.panel !== null
        && Math.abs(settled.panel.width - afterScroll.panel.width) <= 1
        && Math.abs(settled.panel.left - afterScroll.panel.left) <= 2

      console.log('\n  ══ findings ══')
      console.log(`     page errors: ${pageErrors.length === 0 ? 'none' : pageErrors.length}`)
      for (const message of pageErrors.slice(0, 3)) console.log(`       ${message}`)
      const shrunk = wideState.panel !== null && narrowState.panel !== null
        && narrowState.panel.width < wideState.panel.width - 4
      // The rule is "the panel never exceeds the column", not "the panel always gets narrower". Shrinking is only
      // required once the column is narrower than the panel's own preferred width; a 314px panel inside a 424px column
      // is correct as it is, and demanding a change there was a wrong assertion in an earlier version of this probe.
      const columnIsNarrower = narrowState.center !== null && narrowState.panel !== null
        && narrowState.center.width < narrowState.panel.width + 16
      const sizingOk = columnIsNarrower ? shrunk : true
      console.log(`     the column narrowed: ${wideState.center?.width} -> ${narrowState.center?.width}`)
      console.log(`     the column is now narrower than the panel: ${columnIsNarrower}`
        + `  (if true the panel MUST have shrunk)`)
      console.log(`     the panel narrowed with it: ${wideState.panel?.width} -> ${narrowState.panel?.width}`
        + `  ${sizingOk ? 'OK' : 'DID NOT FOLLOW'}`)
      console.log(`     the panel stays inside the column: overhang ${narrowState.overhang}px`
        + `  ${narrowState.overhang !== null && narrowState.overhang <= 0 ? 'OK' : 'OVERHANGS'}`)
      console.log(`     it covers no part of the right bar: ${narrowState.intoRightBar === 0 ? 'OK' : `${narrowState.intoRightBar}px OVER`}`)
      console.log(`     it settled without a scroll: ${followedWithoutScroll ? 'OK' : 'NEEDS A SCROLL'}`)

      const ok = sizingOk
        && narrowState.overhang !== null && narrowState.overhang <= 0
        && narrowState.intoRightBar === 0
        && followedWithoutScroll
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
  }
}

