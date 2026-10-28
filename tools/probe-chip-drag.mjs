/**
 * Dragging an annotation chip inside the composer.
 *
 * The gesture is drawn by an overlay and expressed as a DRAFT rewrite, so the things worth checking are:
 *
 *   - a press alone does not start a drag (a click must still jump to the passage);
 *   - moving past the threshold draws the grab bar and the ghost, and neither takes pointer events;
 *   - the grab bar sits at a real seam, i.e. on a chip's edge;
 *   - releasing rewrites the draft with the chips reordered, and the text around them intact;
 *   - Escape abandons the drag and leaves the draft untouched.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-chip-drag.mjs <url>
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/probe-chip-drag.mjs <url>')
  process.exit(2)
}

const browser = await openBrowser()
const {
  read, page, waitFor, reload, resetAnnotations, seedAnnotation,
} = browser

const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)))

/** The chips in the composer, in draft order, with their boxes and the draft text. */
const chips = () => read(() => {
  const editable = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
  if (editable === null) return null
  return {
    list: [...editable.querySelectorAll('[data-composer-chip="quote-chat"]')].map((chip) => {
      const box = chip.getBoundingClientRect()
      return {
        ref: chip.getAttribute('data-qc-ref'),
        label: chip.getAttribute('data-qc-label'),
        left: Math.round(box.left), right: Math.round(box.right),
        y: Math.round(box.top + box.height / 2),
      }
    }),
    text: editable.textContent ?? '',
  }
})

const overlay = () => read(() => {
  const grab = document.querySelector('.qc-chip-drag-grab')
  const ghost = document.querySelector('.qc-chip-drag-ghost')
  const style = (element) => (element === null ? null : getComputedStyle(element))
  return {
    grab: grab === null ? null : {
      left: Math.round(grab.getBoundingClientRect().left),
      height: Math.round(grab.getBoundingClientRect().height),
      pointerEvents: style(grab).pointerEvents,
    },
    ghost: ghost === null ? null : {
      left: Math.round(ghost.getBoundingClientRect().left),
      text: (ghost.textContent ?? '').trim(),
      pointerEvents: style(ghost).pointerEvents,
    },
  }
})

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

  // Two annotations, so there is something to reorder. The composer accumulates a chip per annotation.
  for (let round = 0; round < 2; round += 1) {
    const before = await read(() => document.querySelectorAll('.qc-marker').length)
    await seedAnnotation({ comment: `拖动${round + 1}` })
    const after = await read(() => document.querySelectorAll('.qc-marker').length)
    if (after <= before) break
  }

  const start = await chips()
  console.log(`\n  chips before: ${start.list.map((chip) => chip.label).join(', ')}`)
  if (start.list.length < 2) {
    console.log('  need at least two chips in the composer to test reordering')
    process.exitCode = 2
  } else {
    const [first, second] = start.list
    const textBefore = start.text

    // Settle the composer before synthesising a gesture.
    //
    // The chips are re-rendered by the editor moments after a draft write, and a pointerdown that arrives during that
    // re-render is delivered to the node being replaced — the drag then never starts, which is what made this probe
    // report a missing overlay while the exact same gesture worked from a quiet composer.
    await read(() => {
      const editable = [...document.querySelectorAll('[contenteditable="true"]')]
        .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
      editable?.focus?.({ preventScroll: true })
    })
    await page.waitForTimeout(500)

    // ── a real drag draws the overlay ──────────────────────────────────────
    //
    // The steps are deliberately coarse and slow. A finer sweep (12 steps of 12ms) never started the drag: the pointer
    // crossed the threshold and left the chip's box between two synthesised events, and the editor's own hit-testing
    // consumed the intermediate move. Eight steps with a frame between them is the shape a real hand produces.
    //
    // The path follows the DESTINATION chip's row, not a fixed y. Two chips in a draft are often on separate lines
    // (measured: y 543 and y 568), and dragging horizontally along the first row never brings the pointer over the
    // second — `dropIndexAt` then correctly returns a slot next to where it started, and the draft legitimately does not
    // change. That was read as "reordering is broken" when the gesture was simply aimed at empty space.
    await read(() => {
      const editable = [...document.querySelectorAll('[contenteditable="true"]')]
        .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
      editable?.focus?.({ preventScroll: true })
    })
    await page.waitForTimeout(500)

    const fromX = first.left + 10
    const fromY = first.y
    const toX = second.right + 20
    const toY = second.y
    await page.mouse.move(fromX, fromY)
    await page.mouse.down()
    await page.waitForTimeout(80)
    const steps = 8
    for (let step = 1; step <= steps; step += 1) {
      await page.mouse.move(
        fromX + ((toX - fromX) * step) / steps,
        fromY + ((toY - fromY) * step) / steps,
      )
      await page.waitForTimeout(25)
    }
    await page.waitForTimeout(150)
    const during = await overlay()
    const draws = during.grab !== null && during.ghost !== null
    const transparent = during.grab?.pointerEvents === 'none' && during.ghost?.pointerEvents === 'none'
    // The bar must sit on a seam: within a couple of pixels of some chip's edge.
    const onSeam = during.grab === null ? false : start.list.some((chip) =>
      Math.abs(during.grab.left - chip.left) <= 3 || Math.abs(during.grab.left - chip.right) <= 3)
    const ghostFollows = during.ghost === null ? false : during.ghost.left > first.left + 40

    await page.mouse.up()
    await page.waitForTimeout(400)
    const afterDrop = await chips()
    // Judged on REFS, not labels.
    //
    // The label is the chip's ordinal — "注释 1" is whichever chip is first — so it is renumbered after every move and a
    // label comparison can never show a reorder. The ref is the annotation's stable id, so the sequence of refs is what
    // actually moved.
    const beforeRefs = start.list.map((chip) => chip.ref).join(',')
    const afterRefs = afterDrop.list.map((chip) => chip.ref).join(',')
    const reordered = afterDrop.list.length === start.list.length && afterRefs !== beforeRefs
    const overlayGone = (await overlay()).grab === null && (await overlay()).ghost === null
    // The prose must survive a move; only the chips' order may change.
    //
    // Compared as a multiset of non-placeholder characters rather than as a string: reordering chips moves the line
    // breaks that separate them, so the exact text legitimately differs even when nothing was lost.
    const proseOf = (value) => [...value.replace(/\uFFFC/g, '')].filter((char) => char.trim() !== '').sort().join('')
    const textIntact = proseOf(afterDrop.text) === proseOf(textBefore)

    // ── Escape abandons a drag ─────────────────────────────────────────────
    const now = await chips()
    const dragMe = now.list[0]
    const settle = now.text
    let escaped = false
    if (dragMe !== undefined) {
      await page.mouse.move(dragMe.left + 8, dragMe.y)
      await page.mouse.down()
      for (let step = 1; step <= 6; step += 1) {
        await page.mouse.move(dragMe.left + 8 + step * 12, dragMe.y)
        await page.waitForTimeout(12)
      }
      await page.keyboard.press('Escape')
      await page.waitForTimeout(150)
      const afterEscape = await overlay()
      escaped = afterEscape.grab === null && afterEscape.ghost === null
      await page.mouse.up()
      await page.waitForTimeout(250)
    }
    const afterEscapeText = (await chips()).text
    const textUnchanged = afterEscapeText === settle

    // ── a press alone must not start a drag ────────────────────────────────
    //
    // Checked LAST deliberately. A press-release on a chip makes the editor treat it as an activation, and doing that
    // before the real drag left the composer in a state where the following drag never started — the probe reported the
    // overlay as missing while the same gesture worked from a fresh state.
    const pressChip = (await chips()).list[0]
    let clickOnly = false
    if (pressChip !== undefined) {
      await page.mouse.move(pressChip.left + 10, pressChip.y)
      await page.mouse.down()
      await page.mouse.move(pressChip.left + 11, pressChip.y)
      await page.waitForTimeout(80)
      const justPressed = await overlay()
      clickOnly = justPressed.grab === null && justPressed.ghost === null
      await page.mouse.up()
      await page.waitForTimeout(150)
    }

    console.log('\n  ══ findings ══')
    console.log(`     page errors: ${pageErrors.length === 0 ? 'none' : pageErrors.length}`)
    console.log(`     a press alone starts no drag:        ${clickOnly}`)
    console.log(`     a move past the threshold draws it:  ${draws}`)
    console.log(`     the overlay never takes the pointer: ${transparent}`)
    console.log(`     the grab bar sits on a chip seam:    ${onSeam}  (bar ${during.grab?.left})`)
    console.log(`     the ghost follows the cursor:        ${ghostFollows}  (ghost ${during.ghost?.left})`)
    console.log(`     releasing reorders the draft:        ${reordered}`
      + `  (${start.list.map((chip) => chip.label).join(',')}`
      + ` -> ${afterDrop.list.map((chip) => chip.label).join(',')})`)
    console.log(`     the rest of the text survives:       ${textIntact}`)
    console.log(`     the overlay is torn down:            ${overlayGone}`)
    console.log(`     Escape abandons the drag:            ${escaped}, draft unchanged ${textUnchanged}`)

    const ok = pageErrors.length === 0 && clickOnly && draws && transparent && onSeam
      && ghostFollows && reordered && textIntact && overlayGone && escaped && textUnchanged
    console.log(`\n  ${ok ? 'OK: chips drag, reorder, and cancel cleanly' : 'NOT OK: see the failing line above'}`)
    process.exitCode = ok ? 0 : 1
  }
} finally {
  await browser.close()
}
