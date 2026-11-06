/**
 * Parity: does the design fixture still describe the real chip?
 *
 * The workbench renders a static replica of the host's decorator. That is what makes the captures deterministic, and
 * it is also the replica's one failure mode: if the host changes its decorator, the fixture keeps passing while
 * reviewing a chip that no longer exists.
 *
 * This compares the two STRUCTURALLY - tag chain, attribute names, subtree shape - and deliberately ignores class
 * names, because the host's classes are CSS-module hashes that change with its build and the stylesheet selects
 * structurally on purpose.
 *
 * Usage: node tools/design-parity.mjs "<url>"
 */
import { chromium } from 'playwright'
import { STYLESHEET } from '../src/stylesheet.js'
import { page as fixturePage, chip as fixtureChip } from '../design/fixture.mjs'
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/design-parity.mjs <url>')
  process.exit(2)
}

/**
 * The structural fingerprint of one chip.
 *
 * Two kinds of attribute are excluded on purpose:
 *
 *   - `data-qc-*` are THIS PLUGIN's own attributes. They vary by state (`data-qc-hover` is only present while the
 *     pointer is on the chip, `data-qc-num`/`-label`/`-ref` vary by annotation), so comparing them would report a
 *     mismatch on almost every run. What the fixture must replicate is the HOST's structure, not our own bookkeeping.
 *   - Attribute VALUES are excluded for the same reason.
 *
 * Class names are excluded too: the host's are CSS-module hashes, and the stylesheet selects structurally.
 */
const FINGERPRINT = () => {
  const chip = document.querySelector('[data-composer-chip="quote-chat"]')
  if (chip === null) return null
  const hostAttributes = (element) => [...element.attributes]
    .map((attribute) => attribute.name)
    .filter((name) => !name.startsWith('data-qc-'))
    .sort()
  const describe = (element, depth) => ({
    depth,
    tag: element.tagName.toLowerCase(),
    attributes: hostAttributes(element),
    pluginAttributes: [...element.attributes]
      .map((attribute) => attribute.name)
      .filter((name) => name.startsWith('data-qc-'))
      .sort(),
  })
  const subtree = []
  const walk = (element, depth) => {
    subtree.push(describe(element, depth))
    for (const child of element.children) walk(child, depth + 1)
  }
  walk(chip, 0)
  const composer = chip.closest('[contenteditable="true"]')
  return {
    subtree,
    composer: composer === null ? null : {
      tag: composer.tagName.toLowerCase(),
      attributes: hostAttributes(composer),
    },
  }
}

/** Render the fixture in a throwaway page and fingerprint it. */
const fixtureFingerprint = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 900, height: 220 }, deviceScaleFactor: 1 })
  try {
    await page.setContent(fixturePage(`<p dir="auto">${fixtureChip({ num: 1 })}</p>`), { waitUntil: 'load' })
    await page.addStyleTag({ content: STYLESHEET })
    return await page.evaluate(FINGERPRINT)
  } finally {
    await page.close()
  }
}

const browser = await chromium.launch()
const fixture = await fixtureFingerprint(browser)
await browser.close()

const app = await openBrowser()
const { read, page, waitFor, reload, resetAnnotations, seedAnnotation, collapseRightSidebar } = app
let product = null
try {
  await app.goto(url)
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
  if (after > before) {
    await page.waitForTimeout(600)
    product = await read(FINGERPRINT)
  }
} finally {
  await app.close()
}

if (product === null) {
  console.log('  NOT SET UP: could not obtain a real chip')
  process.exitCode = 2
} else {
  const problems = []
  const label = (node) => `${'  '.repeat(node.depth)}<${node.tag}> [${node.attributes.join(', ')}]`
    + (node.pluginAttributes.length === 0 ? '' : `  + plugin [${node.pluginAttributes.join(', ')}]`)

  const fixtureNodes = fixture?.subtree ?? []
  const productNodes = product.subtree
  if (fixtureNodes.length !== productNodes.length) {
    problems.push(`subtree size: fixture ${fixtureNodes.length}, product ${productNodes.length}`)
  }
  for (let index = 0; index < Math.max(fixtureNodes.length, productNodes.length); index += 1) {
    const left = fixtureNodes[index]
    const right = productNodes[index]
    if (left === undefined || right === undefined) {
      problems.push(`node ${index}: fixture ${left === undefined ? 'missing' : 'present'},`
        + ` product ${right === undefined ? 'missing' : 'present'}`)
      continue
    }
    if (left.depth !== right.depth || left.tag !== right.tag) {
      problems.push(`node ${index}: fixture ${label(left)} vs product ${label(right)}`)
      continue
    }
    const leftOnly = left.attributes.filter((name) => !right.attributes.includes(name))
    const rightOnly = right.attributes.filter((name) => !left.attributes.includes(name))
    if (leftOnly.length > 0 || rightOnly.length > 0) {
      problems.push(`node ${index} <${left.tag}>: fixture-only [${leftOnly.join(', ')}],`
        + ` product-only [${rightOnly.join(', ')}]`)
    }
  }
  if (fixture?.composer === null || product.composer === null) {
    problems.push('the composer element was not found in one of the two')
  } else if (fixture.composer.tag !== product.composer.tag) {
    problems.push(`composer tag: fixture <${fixture.composer.tag}>, product <${product.composer.tag}>`)
  }

  console.log('\n  ══ fixture vs product ══')
  console.log('  fixture subtree:')
  for (const node of fixtureNodes) console.log(`    ${label(node)}`)
  console.log('  product subtree:')
  for (const node of productNodes) console.log(`    ${label(node)}`)

  if (problems.length === 0) {
    console.log('\n  OK: the fixture still matches the host decorator')
    process.exitCode = 0
  } else {
    console.log('\n  DRIFT: the fixture no longer matches the host decorator')
    for (const problem of problems) console.log(`    - ${problem}`)
    console.log('\n  Update design/fixture.mjs to match, then re-run `npm run design:update`.')
    process.exitCode = 1
  }
}
