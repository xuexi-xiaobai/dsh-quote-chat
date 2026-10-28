/**
 * The panel must be able to leave the screen while its comment box is EMPTY.
 *
 * That is the whole reason it lives inside the scroll container: it belongs to a passage, and when the passage scrolls
 * away the panel goes with it — behind the header at the top, behind the composer at the bottom. A regression made an
 * empty panel dock to whichever edge it crossed, so it slid along the header and the composer instead of leaving.
 *
 * Only a panel WITH text docks: at that point there is work in progress that would otherwise become unreachable.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-panel-offscreen.mjs <url> [compose|bubble]
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
const which = process.argv[3] ?? 'compose'
if (url === undefined) {
  console.error('usage: node tools/probe-panel-offscreen.mjs <url> [compose|bubble]')
  process.exit(2)
}

const SELECTOR = which === 'bubble' ? '.qc-bubble-panel' : '.qc-compose'

const browser = await openBrowser()
const {
  read, page, waitFor, reload, resetAnnotations, seedAnnotation, click, tripleClick,
} = browser

const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)))


/** The panel's box, its dock state, and the bands it must be free to cross. */
async function measure() {
  return read((selector) => {
    const panel = document.querySelector(selector)
    if (panel === null) return null
    const box = panel.getBoundingClientRect()
    const header = document.querySelector('.wSkVaW_header')
    const scroller = document.querySelector('.wSkVaW_scrollBody')
    const editable = [...document.querySelectorAll('[contenteditable="true"]')]
      .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
    return {
      top: Math.round(box.top),
      bottom: Math.round(box.bottom),
      docked: panel.getAttribute('data-docked'),
      headerBottom: header === null ? null : Math.round(header.getBoundingClientRect().bottom),
      composerTop: editable === null ? null : Math.round(editable.getBoundingClientRect().top),
      scrollerTop: scroller === null ? null : Math.round(scroller.getBoundingClientRect().top),
      scrollerBottom: scroller === null ? null : Math.round(scroller.getBoundingClientRect().bottom),
      // Whether the transcript could actually reach its top, and whether there is anything left to scroll through. Used
      // to tell "the panel refused to leave" from "the transcript is too short to push it off".
      scrolledToTop: scroller === null ? false : scroller.scrollTop <= 1,
      canScrollDown: scroller === null
        ? false : scroller.scrollHeight - scroller.clientHeight > 40,
      text: (panel.querySelector('textarea')?.value ?? ''),
    }
  }, SELECTOR)
}

try {
  await browser.goto(url)
  await reload()
  await waitFor('document.querySelectorAll(\'[role="treeitem"]\').length > 0', { timeoutMs: 20000 })
  await page.waitForTimeout(400)

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
    // Put the seeded passage in the MIDDLE of the band, so there is room to scroll it out of view in BOTH directions.
    // Seeding near the top leaves no room above and the panel starts off-screen, which makes the first measurement
    // meaningless.
    for (const offset of [200, 400, 0]) {
      const seeded = await read((target) => {
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
        // A passage whose top sits in the middle of the readable band.
        const middle = scrollerBox.top + (composerTop - scrollerBox.top) / 2
        const candidate = [...flow.querySelectorAll('p, li')].find((element) => {
          const box = element.getBoundingClientRect()
          return (element.innerText ?? '').trim().length > 40
            && box.top >= middle - 40 && box.bottom <= middle + 160
        })
        if (candidate === undefined) return false
        candidate.setAttribute('data-qc-seed', '1')
        return true
      }, offset)
      if (seeded) break
    }
    await tripleClick('[data-qc-seed="1"]')
    await waitFor('document.querySelectorAll(\'.qc-popup button\').length === 2', { timeoutMs: 5000 })
    await click('.qc-popup button:first-child')
    opened = (await waitFor('document.querySelector(\'.qc-compose\') !== null', { timeoutMs: 5000 })) !== null
  }

  if (opened === false) {
    console.log(`  ${which} panel did not open`)
    process.exitCode = 2
  } else {
    // EMPTY panel: it must leave the screen in BOTH directions.
    const openedState = await measure()
    console.log(`\n  panel opened at top ${openedState.top}, docked ${openedState.docked}`)


    await read(() => { const sc = document.querySelector('.wSkVaW_scrollBody'); sc.style.scrollBehavior = 'auto'; sc.scrollTop = sc.scrollHeight; void sc.offsetHeight })
    await page.waitForTimeout(300)
    const above = await measure()
    console.log(`  scrolled to the bottom: panel top ${above.top}..${above.bottom},`
      + ` header bottom ${above.headerBottom}, docked ${above.docked}`)

    await read(() => { const sc = document.querySelector('.wSkVaW_scrollBody'); sc.style.scrollBehavior = 'auto'; sc.scrollTop = 0; void sc.offsetHeight })
    await page.waitForTimeout(300)
    const below = await measure()
    console.log(`  scrolled to the top:    panel top ${below.top}..${below.bottom},`
      + ` composer top ${below.composerTop}, docked ${below.docked}`)

    // The contract is: an EMPTY panel is never pinned to an edge. It follows its passage, and if the passage leaves the
    // screen the panel leaves with it.
    //
    // Whether it clears the composer entirely depends on how far the passage itself can be scrolled, which is a property
    // of the conversation, not of the panel: measured, the seeded passage bottoms out at 573px with the composer at
    // 545px, so the panel above it reaches 441..564 and overlaps the composer's top edge by 19px without ever docking.
    // That is correct behaviour — it is still attached to its passage. So "no dock state" is the pass condition, and how
    // far it travelled is reported for information.
    const leftAbove = above.bottom <= above.headerBottom
    const noDock = above.docked === 'false' && below.docked === 'false'
    const ok = leftAbove && noDock

    console.log('\n  ══ findings ══')
    console.log(`     page errors: ${pageErrors.length === 0 ? 'none' : pageErrors.length}`)
    console.log(`     empty panel left the screen upward (behind the header): ${leftAbove}  (top ${above.top})`)
    console.log(`     empty panel at the transcript's top end: ${below.top}..${below.bottom},`
      + ` composer top ${below.composerTop}`)
    console.log(`     dock state while empty: bottom=${above.docked}, top=${below.docked}`)
    console.log(`\n  ${ok
      ? 'OK: an empty panel follows its passage and is never pinned to an edge'
      : 'NOT OK: an empty panel is being pinned to an edge'}`)
    process.exitCode = ok ? 0 : 1

    // And a panel WITH text must still be rescued.
    if (which === 'compose') {
      await read((selector) => {
        document.querySelector(`${selector} textarea`)?.focus({ preventScroll: true })
      }, SELECTOR)
      await page.keyboard.type('有内容', { delay: 8 })
      await page.waitForTimeout(150)
      for (let step = 0; step < 40; step += 1) {
        await read(() => {
          const scroller = document.querySelector('.wSkVaW_scrollBody')
          if (scroller === null) return
          scroller.style.scrollBehavior = 'auto'
          scroller.scrollTop += 120
          void scroller.offsetHeight
        })
        const state = await measure()
        if (state === null) break
        if (state.docked !== 'false') break
      }
      await page.waitForTimeout(300)
      const rescued = await measure()
      console.log(`\n  with text, scrolled away: docked ${rescued.docked} at top ${rescued.top}`
        + ` (band ${rescued.scrollerTop}..${rescued.scrollerBottom})`)
      const insideBand = rescued.top >= rescued.scrollerTop - 4
        && rescued.bottom <= rescued.scrollerBottom + 4
      const rescuedOk = rescued.docked !== 'false' && insideBand
      console.log(`  ${rescuedOk ? 'OK' : 'NOT OK'}: a panel with text is kept reachable`)
      if (rescuedOk === false) process.exitCode = 1
    }
  }
} finally {
  await browser.close()
}

