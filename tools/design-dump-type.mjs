/**
 * Read the host's composer typography and surface, so the design fixture can pin the same values.
 *
 * Usage: node tools/design-dump-type.mjs "<url>"
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/design-dump-type.mjs <url>')
  process.exit(2)
}

const browser = await openBrowser()
const { read, page, waitFor, reload, collapseRightSidebar } = browser

try {
  await browser.goto(url)
  await reload()
  await waitFor(`document.querySelectorAll('[role="treeitem"]').length > 0`, { timeoutMs: 20000 })
  await collapseRightSidebar().catch(() => {})
  await page.waitForTimeout(600)

  for (const scheme of ['light', 'dark']) {
    const values = await read((mode) => {
      const editable = [...document.querySelectorAll('[contenteditable="true"]')]
        .filter((element) => element.getBoundingClientRect().height > 0).pop() ?? null
      if (editable === null) return null
      const style = getComputedStyle(editable)
      const paragraph = editable.querySelector('p')
      const paragraphStyle = paragraph === null ? null : getComputedStyle(paragraph)
      // Walk up for the first painted surface, which is what the chip's color-mix resolves against.
      let surface = null
      let node = editable
      while (node !== null && node !== document.body) {
        const colour = getComputedStyle(node).backgroundColor
        if (colour !== 'rgba(0, 0, 0, 0)' && colour !== 'transparent') { surface = colour; break }
        node = node.parentElement
      }
      return {
        mode,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        paragraphLineHeight: paragraphStyle?.lineHeight ?? null,
        padding: style.padding,
        color: style.color,
        surface,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
      }
    }, scheme)
    console.log(JSON.stringify(values))
    // Flip the OS-level preference the app reads, then let it repaint.
    await page.emulateMedia({ colorScheme: scheme === 'dark' ? 'dark' : 'light' })
    await page.waitForTimeout(500)
  }
  await page.emulateMedia({ colorScheme: 'light' })
} finally {
  await browser.close()
}
