/**
 * Dump the real chip's DOM shape, so the design fixture can replicate it exactly.
 *
 * The fixture is a static replica; if the host's decorator structure changes, the replica silently stops
 * representing the product. This prints the ancestor chain, the attributes, and the computed geometry that the
 * fixture has to reproduce.
 *
 * Usage: node tools/design-dump-chip.mjs "<url>"
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/design-dump-chip.mjs <url>')
  process.exit(2)
}

const browser = await openBrowser()
const { read, page, waitFor, reload, resetAnnotations, seedAnnotation, collapseRightSidebar } = browser

try {
  await browser.goto(url)
  await reload()
  await waitFor(`document.querySelectorAll('[role="treeitem"]').length > 0`, { timeoutMs: 20000 })
  await collapseRightSidebar().catch(() => {})
  await page.waitForTimeout(500)

  const usable = await read(() =>
    (document.querySelector('[data-slot="conversation.chat.flow"]')?.querySelectorAll('p, li').length ?? 0) > 3)
  if (usable === false) {
    const entries = await read(() => [...document.querySelectorAll('[role="treeitem"]')]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
      }).slice(0, 8))
    for (const entry of entries) {
      await page.mouse.click(entry.x, entry.y)
      await page.waitForTimeout(1200)
      const rows = await read(() =>
        document.querySelector('[data-slot="conversation.chat.flow"]')?.querySelectorAll('p, li').length ?? 0)
      if (rows > 3) break
    }
  }
  await page.waitForTimeout(300)

  await resetAnnotations()
  await read(() => {
    const editable = [...document.querySelectorAll('[contenteditable="true"]')]
      .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
    editable?.focus?.({ preventScroll: true })
  })
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(300)

  const before = await read(() => document.querySelectorAll('.qc-marker').length)
  await seedAnnotation({ comment: '形状检查' })
  const after = await read(() => document.querySelectorAll('.qc-marker').length)
  if (after <= before) {
    console.log('  NOT SET UP: could not seed an annotation')
    process.exitCode = 2
  } else {
    await page.waitForTimeout(600)
    const shape = await read(() => {
      const chip = document.querySelector('[data-composer-chip="quote-chat"]')
      if (chip === null) return null
      const describe = (element, depth = 0) => {
        const box = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return {
          depth,
          tag: element.tagName.toLowerCase(),
          className: element.className === '' ? null : String(element.className),
          attributes: [...element.attributes].map((attribute) => `${attribute.name}="${attribute.value}"`),
          text: (element.textContent ?? '').trim().slice(0, 30),
          box: {
            width: Math.round(box.width * 100) / 100,
            height: Math.round(box.height * 100) / 100,
          },
          style: {
            display: style.display,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            padding: style.padding,
            margin: style.margin,
            borderRadius: style.borderRadius,
            background: style.backgroundColor,
            color: style.color,
            border: style.border,
            verticalAlign: style.verticalAlign,
            transform: style.transform,
          },
        }
      }
      const chain = []
      let node = chip
      for (let depth = 0; depth < 6 && node !== null; depth += 1) {
        chain.push(describe(node, depth))
        node = node.parentElement
      }
      // The chip's own subtree, three levels deep, with every attribute.
      const subtree = []
      const walk = (element, depth) => {
        subtree.push(describe(element, depth))
        for (const child of element.children) walk(child, depth + 1)
      }
      walk(chip, 0)
      return {
        chain,
        subtree,
        outerHtml: chip.outerHTML.slice(0, 1200),
        composerHtml: (chip.closest('[contenteditable="true"]')?.outerHTML ?? '').slice(0, 1500),
        pseudo: {
          before: {
            content: getComputedStyle(chip, '::before').content,
            width: getComputedStyle(chip, '::before').width,
            height: getComputedStyle(chip, '::before').height,
            marginRight: getComputedStyle(chip, '::before').marginRight,
            backgroundColor: getComputedStyle(chip, '::before').backgroundColor,
          },
          after: {
            content: getComputedStyle(chip, '::after').content,
            fontSize: getComputedStyle(chip, '::after').fontSize,
          },
        },
      }
    })
    console.log(JSON.stringify(shape, null, 2))
  }
} finally {
  await browser.close()
}
