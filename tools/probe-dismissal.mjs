/**
 * Dismissal rule: only a press inside the transcript cancels the compose panel.
 *
 * The rule as the user stated it: clicking the left rail, the right sidebar, the header or the composer must leave the
 * panel — and the draft — intact; only a click in the transcript's own area cancels.
 *
 * ## Why this dispatches events instead of clicking coordinates
 *
 * Clicking real coordinates made the result depend on what happened to be under the cursor: one "left rail" point
 * landed on a conversation row and switched conversations, which unmounted the panel for an unrelated reason and was
 * reported as a failure of the dismissal rule. A pixel grid is also fragile as the app's layout changes.
 *
 * The rule itself is defined on the event TARGET, so dispatching a `mousedown` whose target is the region element
 * exercises exactly the code under test, with no coordinate, focus or hit-testing side effects. Each region is
 * therefore tested from a fresh panel, in isolation.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-dismissal.mjs <url>
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/probe-dismissal.mjs <url>')
  process.exit(2)
}

const DRAFT = '草稿不能丢'

const browser = await openBrowser()
const { read, dragSelect, press, page, waitFor, collapseRightSidebar, click, reload } = browser

/** Open a compose panel on a seated passage, with a draft typed. Returns false when it could not. */
const openPanel = async () => {
  await press('Escape')
  await page.waitForTimeout(120)
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
  if (points === null) return false

  await dragSelect(points.from, points.to)
  const popupUp = await waitFor('document.querySelectorAll(\'.qc-popup button\').length === 2',
    { timeoutMs: 4000 })
  if (popupUp === null) return false
  await click('.qc-popup button:first-child')
  const opened = await waitFor('document.querySelector(\'.qc-compose\') !== null', { timeoutMs: 4000 })
  if (opened === null) return false
  await page.waitForTimeout(250)
  await page.keyboard.type(DRAFT, { delay: 15 })
  await page.waitForTimeout(200)
  return true
}

/** Dispatch a mousedown whose target is the region element. Returns the target's identity, or null. */
const pressRegion = async (descriptor) => {
  const identity = await read((find) => {
    const resolve = () => {
      if (find.kind === 'header') return document.querySelector('.wSkVaW_header')
      if (find.kind === 'composer') {
        return [...document.querySelectorAll('[contenteditable="true"]')]
          .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
      }
      if (find.kind === 'leftRail') {
        const tree = document.querySelector('[role="treeitem"]')
        return tree === null ? null : tree.closest('aside, nav, [class*="rail"], [class*="sidebar"]')
          ?? tree.parentElement?.parentElement ?? null
      }
      if (find.kind === 'transcript') {
        const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
        return flow === null ? null : flow.querySelector('p, li')
      }
      if (find.kind === 'panel') return document.querySelector('.qc-compose')
      return null
    }
    const target = resolve()
    if (target === null) return null
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    return typeof target.className === 'string' && target.className !== ''
      ? target.className.slice(0, 34) : target.tagName
  }, descriptor)
  if (identity === null) return null
  // React applies the state update asynchronously, so the DOM must be given a frame before it is read. Reading
  // immediately reported "still open" even when the handler had cancelled.
  await page.waitForTimeout(220)
  const state = await read(() => {
    const panel = document.querySelector('.qc-compose')
    return {
      stillOpen: panel !== null,
      draft: panel === null ? null : (panel.querySelector('textarea')?.value ?? ''),
    }
  })
  return { identity, ...state }
}

try {
  await browser.goto(url)
  // Pick up the bundle that was just built; without this the page runs the code it loaded earlier.
  await reload()
  await waitFor('document.querySelectorAll(\'[role="treeitem"]\').length > 0', { timeoutMs: 20000 })
  await collapseRightSidebar()
  await page.waitForTimeout(300)

  const flowOpen = await read(() =>
    document.querySelector('[data-slot="conversation.chat.flow"]') !== null)
  if (flowOpen === false) {
    await read(() => [...document.querySelectorAll('[role="treeitem"]')][0]?.click())
    await page.waitForTimeout(1800)
  }

  const results = []
  /** Chrome must NOT dismiss. */
  for (const region of [
    { kind: 'panel', label: 'the panel itself' },
    { kind: 'header', label: 'the header' },
    { kind: 'leftRail', label: 'the left rail' },
    { kind: 'composer', label: 'the composer' },
  ]) {
    // Retry opening: the first attempt often runs while the conversation is still settling after the reload.
    let opened = false
    for (let attempt = 0; attempt < 3 && opened === false; attempt += 1) {
      opened = await openPanel()
      if (opened === false) await page.waitForTimeout(500)
    }
    if (opened === false) {
      console.log(`  ${region.label.padEnd(16)} SKIPPED (could not open a panel)`)
      continue
    }
    const outcome = await pressRegion({ kind: region.kind })
    if (outcome === null) {
      console.log(`  ${region.label.padEnd(16)} SKIPPED (region not found)`)
      continue
    }
    const ok = outcome.stillOpen === true && outcome.draft === DRAFT
    results.push(ok)
    console.log(`  ${region.label.padEnd(16)} target=${outcome.identity.padEnd(30)}`
      + `  open=${String(outcome.stillOpen).padEnd(5)}`
      + ` draft=${outcome.draft === DRAFT ? 'kept' : String(outcome.draft)}`
      + `  ${ok ? 'OK' : 'WRONG'}`)
  }

  // The transcript MUST dismiss.
  if (await openPanel()) {
    const outcome = await pressRegion({ kind: 'transcript' })
    const ok = outcome !== null && outcome.stillOpen === false
    results.push(ok)
    console.log(`  ${'the transcript'.padEnd(16)} target=${String(outcome?.identity).padEnd(30)}`
      + `  open=${String(outcome?.stillOpen).padEnd(5)}                        ${ok ? 'OK' : 'WRONG'}`)
  } else {
    console.log('  the transcript     SKIPPED (could not open a panel)')
  }

  const failed = results.filter((entry) => entry === false)
  console.log('\n  ══ verdict ══')
  console.log(`     regions exercised: ${results.length}   failed: ${failed.length}`)
  if (results.length < 5) {
    console.log('     NOT SET UP: not every region could be exercised')
    process.exitCode = 2
  } else if (failed.length === 0) {
    console.log('     OK: chrome keeps the panel, the transcript dismisses it')
    process.exitCode = 0
  } else {
    console.log('     NOT OK: the dismissal rule is not behaving as specified')
    process.exitCode = 1
  }

  await press('Escape')
} finally {
  await browser.close()
}
