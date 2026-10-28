/**
 * The chip's place in the composer's text.
 *
 * Three properties, all reported together because they were all broken at once and each was invisible while another was
 * failing:
 *
 *   1. No stray characters. Adding chips must not inject spaces or line breaks into the draft — whatever the model
 *      receives is the draft, so an editor-only artefact becomes part of the message.
 *   2. Chips share a line. Two chips added in a row land side by side, not on separate paragraphs.
 *   3. A chip can be dropped INSIDE prose, not only between other chips. 【chip】text → text【chip】text.
 *
 * Plus the fixed-size token itself: every chip has the same width, and there is real space between it and the words.
 *
 * Usage: QC_CDP=http://127.0.0.1:9222 node tools/probe-chip-layout.mjs <url>
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/probe-chip-layout.mjs <url>')
  process.exit(2)
}

/** The minimum space between a chip and the words beside it, in CSS pixels. */
const MIN_GAP = 4

const browser = await openBrowser()
const {
  read, page, waitFor, reload, resetAnnotations, seedAnnotation,
} = browser

const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 240)))

const state = () => read(() => {
  const editable = [...document.querySelectorAll('[contenteditable="true"]')]
    .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
  if (editable === null) return null
  const chips = [...editable.querySelectorAll('[data-composer-chip="quote-chat"]')]
  // The nearest text on either side of the first chip, to measure the breathing room the stylesheet promises.
  const first = chips[0] ?? null
  let gapBefore = null
  let gapAfter = null
  if (first !== null) {
    const box = first.getBoundingClientRect()
    const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    let bestLeft = -Infinity
    let bestRight = Infinity
    while (node !== null) {
      const text = node.data ?? ''
      if (text.trim() !== '' && !first.contains(node)) {
        const range = document.createRange()
        range.selectNodeContents(node)
        const rect = range.getBoundingClientRect()
        if (rect.width > 0) {
          if (rect.right <= box.left + 1 && rect.right > bestLeft) bestLeft = rect.right
          if (rect.left >= box.right - 1 && rect.left < bestRight) bestRight = rect.left
        }
      }
      node = walker.nextNode()
    }
    gapBefore = bestLeft === -Infinity ? null : Math.round(box.left - bestLeft)
    gapAfter = bestRight === Infinity ? null : Math.round(bestRight - box.right)
  }
  return {
    text: editable.textContent ?? '',
    paragraphs: editable.querySelectorAll('p').length,
    // The composer's own line height, so a chip can be checked against it rather than against a guess.
    lineHeight: (() => {
      const paragraph = editable.querySelector('p')
      const raw = paragraph === null ? getComputedStyle(editable).lineHeight : getComputedStyle(paragraph).lineHeight
      const parsed = Number.parseFloat(raw)
      return Number.isFinite(parsed) ? parsed : 0
    })(),
    chipBackground: first === null ? null : getComputedStyle(first).backgroundColor,
    chipFontSize: first === null ? null : getComputedStyle(first).fontSize,
    textFontSize: getComputedStyle(editable).fontSize,
    surfaceBackground: (() => {
      let node = editable
      while (node !== null && node !== document.body) {
        const colour = getComputedStyle(node).backgroundColor
        if (colour !== 'rgba(0, 0, 0, 0)' && colour !== 'transparent') return colour
        node = node.parentElement
      }
      return null
    })(),
    chips: chips.map((chip) => {
      const box = chip.getBoundingClientRect()
      return {
        left: Math.round(box.left),
        right: Math.round(box.right),
        top: Math.round(box.top),
        width: Math.round(box.width),
        height: Math.round(box.height * 10) / 10,
      }
    }),
    gapBefore,
    gapAfter,
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

  // Clear the composer explicitly.
  //
  // `resetAnnotations` removes the annotations, but the draft is the Host's state and can keep a chip whose payload is
  // gone — a stale chip makes every later measurement meaningless (measured: the previous run's chip survived and the
  // draft read "@注释 1@注释 1@注释 2", with the drop landing somewhere else entirely).
  await read(() => {
    const editable = [...document.querySelectorAll('[contenteditable="true"]')]
      .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
    editable?.focus?.({ preventScroll: true })
  })
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(300)
  const emptied = await state()
  if (emptied !== null && (emptied.chips.length > 0 || emptied.text.trim() !== '')) {
    console.log(`  composer did not clear: ${JSON.stringify(emptied.text)}`)
    process.exitCode = 2
  }

  // Two chips added back to back: the pair is what exposes the added line break and the stray space.
  for (let round = 0; round < 2; round += 1) {
    const before = await read(() => document.querySelectorAll('.qc-marker').length)
    await seedAnnotation({ comment: `布局${round + 1}` })
    const after = await read(() => document.querySelectorAll('.qc-marker').length)
    if (after <= before) break
  }

  const placed = await state()
  if (placed === null || placed.chips.length < 2) {
    console.log('  need two chips in the composer')
    process.exitCode = 2
  } else {
    const noStraySpace = placed.text.includes('  ') === false
      && placed.text.startsWith(' ') === false
      && /\s\uFFFC/.test(placed.text) === false
    const sameLine = placed.paragraphs === 1
      && placed.chips.every((chip) => chip.top === placed.chips[0].top)
    // Width is em-based now, so it is compared against the FIRST chip rather than a pixel constant: the point of the
    // check is that every chip is the same size, not that the size happens to be a particular number.
    const uniformWidth = placed.chips.every((chip) => Math.abs(chip.width - placed.chips[0].width) <= 1)
    // A chip must not make its line taller than a line of plain text.
    const chipHeight = placed.chips[0].height
    const lineHeight = placed.lineHeight
    const fitsTheLine = chipHeight <= lineHeight + 1
    const separated = (placed.gapBefore === null || placed.gapBefore >= MIN_GAP)
      && (placed.gapAfter === null || placed.gapAfter >= MIN_GAP)
    const noOverlap = placed.chips.every((chip, index) => index === 0
      || chip.left >= placed.chips[index - 1].right)
    // The chip must not share the composer's exact background, or it has no body of its own.
    const distinctBackground = placed.chipBackground !== placed.surfaceBackground

    // ── a chip dropped inside prose ────────────────────────────────────────
    await read(() => {
      const editable = [...document.querySelectorAll('[contenteditable="true"]')]
        .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
      editable?.focus?.({ preventScroll: true })
    })
    await page.keyboard.press('Control+End')
    await page.keyboard.type('abcdefghij', { delay: 15 })
    await page.waitForTimeout(300)

    const prosePoint = await read(() => {
      const editable = [...document.querySelectorAll('[contenteditable="true"]')]
        .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
      const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node !== null) {
        if ((node.data ?? '').includes('abcdefghij')) {
          const range = document.createRange()
          range.setStart(node, 5)
          range.setEnd(node, 6)
          const rect = range.getBoundingClientRect()
          return { x: Math.round(rect.left), y: Math.round(rect.top + rect.height / 2) }
        }
        node = walker.nextNode()
      }
      return null
    })
    const chipPoint = await read(() => {
      const chip = document.querySelector('[data-composer-chip="quote-chat"]')
      const box = chip.getBoundingClientRect()
      return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) }
    })

    let insideProse = false
    let order = ''
    if (prosePoint !== null) {
      await page.mouse.move(chipPoint.x, chipPoint.y)
      await page.mouse.down()
      await page.waitForTimeout(80)
      for (let step = 1; step <= 10; step += 1) {
        await page.mouse.move(
          chipPoint.x + ((prosePoint.x - chipPoint.x) * step) / 10,
          chipPoint.y + ((prosePoint.y - chipPoint.y) * step) / 10,
        )
        await page.waitForTimeout(22)
      }
      await page.waitForTimeout(150)
      await page.mouse.up()
      await page.waitForTimeout(600)
      const dropped = await state()
      // "Inside" is judged on the text ACTUALLY between the two halves of the prose.
      //
      // Two earlier attempts at this were wrong for the same reason: they searched `textContent` for the U+FFFC
      // placeholder, but the editor renders a chip as the visible label, so that character never appears there. What the
      // reader sees is "@注释 1" sitting between "abcde" and "fghij", and that is exactly what this checks.
      const firstHalf = dropped.text.indexOf('abcde')
      const secondHalf = dropped.text.indexOf('fghij')
      const between = firstHalf >= 0 && secondHalf > firstHalf
        ? dropped.text.slice(firstHalf + 'abcde'.length, secondHalf)
        : ''
      insideProse = /@\s*注释/.test(between)
      order = JSON.stringify(dropped.text)
    }

    console.log('\n  ══ findings ══')
    console.log(`     page errors: ${pageErrors.length === 0 ? 'none' : pageErrors.length}`)
    console.log(`     draft text: ${JSON.stringify(placed.text)}`)
    console.log(`     no stray space or break added:  ${noStraySpace}`)
    console.log(`     chips share one line:           ${sameLine}  (${placed.paragraphs} paragraph(s),`
      + ` tops ${placed.chips.map((chip) => chip.top).join('/')})`)
    console.log(`     every chip is the same width:   ${uniformWidth}`
      + `  (${placed.chips.map((chip) => chip.width).join('/')}px)`)
    console.log(`     the chip fits its line:         ${fitsTheLine}`
      + `  (chip ${chipHeight}px, line ${lineHeight}px)`)
    console.log(`     font size matches the prose:    ${placed.chipFontSize === placed.textFontSize}`
      + `  (chip ${placed.chipFontSize}, text ${placed.textFontSize})`)
    console.log(`     it has a body of its own:       ${distinctBackground}`
      + `  (chip ${placed.chipBackground}, surface ${placed.surfaceBackground})`)
    console.log(`     gaps to the words around it:    ${separated}`
      + `  (before ${placed.gapBefore}px, after ${placed.gapAfter}px, need >= ${MIN_GAP})`)
    console.log(`     chips never overlap:            ${noOverlap}`)
    console.log(`     a chip drops INSIDE prose:      ${insideProse}  ${order}`)

    const ok = pageErrors.length === 0 && noStraySpace && sameLine && uniformWidth && fitsTheLine
      && placed.chipFontSize === placed.textFontSize && distinctBackground
      && separated && noOverlap && insideProse
    console.log(`\n  ${ok
      ? 'OK: the chip is a fixed-size token that matches the prose, stands off the surface, and can be dropped inside a sentence'
      : 'NOT OK: see the failing line above'}`)
    process.exitCode = ok ? 0 : 1
  }
} finally {
  await browser.close()
}

