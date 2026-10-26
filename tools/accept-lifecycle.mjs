/**
 * Annotation lifecycle acceptance.
 *
 * Two entry points, one body:
 *
 *   - `run({ browser, check, url })` — used by tools/accept-all.mjs, which drives every suite
 *     through a SINGLE browser. Launching chromium costs ~3.4s, and paying that once per campaign
 *     instead of once per suite is most of the wall-clock difference on a full pass.
 *   - `node accept-lifecycle.mjs <url>` — standalone, opening its own browser, for debugging this
 *     area alone.
 *
 * A thrown error is reported as one failed assertion rather than crashing the campaign, so the
 * remaining suites still run.
 *
 * Real input throughout: clicks, hovers and typing go through CDP. A synthetic `element.click()`
 * skips hit testing and emits no `pointerup`, which this plugin's popover anchors to — and the
 * hover card is unreachable with a synthetic event entirely.
 */
import { openBrowser } from './harness.mjs'
import { pathToFileURL } from 'node:url'

/** The comment text this suite types, asserted back by value. */
const COMMENT = '快速验收注释'

/**
 * Run this suite against an open browser.
 *
 * @param options - `{ browser, check, url }`.
 * @returns `{ passed, total }`.
 */
export async function run({ browser, check: report, url }) {
  // The tally lives here and every assertion is forwarded to the caller's reporter, so the count and
  // what the runner printed can never disagree.
  const results = []
  /** Record one assertion, then let the caller print it. */
  const check = (step, ok, detail = '') => {
    results.push({ step, ok })
    report(step, ok, detail)
  }
  const { goto, waitFor, read, count, click, hover, type, press, moveAway, pluginErrors } = browser

  try {
  await goto(url)
  const shell = await waitFor("document.querySelectorAll('[role=\"treeitem\"]').length > 0", { timeoutMs: 20000 })
  check('the app shell renders', shell !== null)

  // Opening the session is host-app navigation, not an action this plugin observes, so driving it
  // from evaluate does not weaken any assertion below.
  await read(() => {
    const items = [...document.querySelectorAll('[role="treeitem"]')]
    const hit = items.find((element) => (element.innerText ?? '').includes('锚点'))
    if (hit !== undefined) hit.click()
  })

  const flowSelector = '[data-slot="conversation.chat.flow"]'
  const prose = await waitFor(
    `(() => { const f = document.querySelector('${flowSelector}'); if (f === null) return false;`
      + " return [...f.querySelectorAll('p, li')].some((el) => (el.innerText ?? '').trim().length > 40) })()",
    { timeoutMs: 20000 },
  )
  check('the transcript has selectable prose', prose !== null)

  // ── Clean slate ────────────────────────────────────────────────────────
  // Repeated runs leave annotations and a persisted draft behind, so "numbered 1" and "exactly
  // one" would pass once and fail thereafter. Clearing first is what makes those counts mean
  // something. Deletion goes through the plugin's own delete button, so it exercises the real path.
  for (let guard = 0; guard < 12; guard += 1) {
    const present = await count('.qc-marker')
    if (present === 0) break
    await click('.qc-marker')
    const opened = await waitFor("document.querySelector('.qc-bubble-panel .qc-bp-delete') !== null", { timeoutMs: 4000 })
    if (opened === null) break
    await click('.qc-bubble-panel .qc-bp-delete')
    await waitFor(`document.querySelectorAll('.qc-marker').length === ${present - 1}`, { timeoutMs: 4000 })
  }
  check('the run starts from a clean slate', (await count('.qc-marker')) === 0)

  // The composer is a Lexical editor: select its contents with a real triple-click, then delete.
  // Writing textContent would be ignored, which is exactly the fidelity this harness protects.
  const composerSelector = '[contenteditable="true"]'
  if ((await count(composerSelector)) > 0) {
    await browser.tripleClick(composerSelector + ':last-of-type').catch(() => {})
    await read(() => {
      const editors = [...document.querySelectorAll('[contenteditable="true"]')]
      const composer = editors[editors.length - 1]
      if (composer === undefined) return
      composer.focus()
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(composer)
      selection.removeAllRanges()
      selection.addRange(range)
    })
    await press('Backspace')
    await waitFor("document.querySelectorAll('[data-composer-chip=\"quote-chat\"]').length === 0", { timeoutMs: 6000 })
  }
  check('the draft starts empty', (await count('[data-composer-chip="quote-chat"]')) === 0)

  // ── Liveness gate ──────────────────────────────────────────────────────
  // A real triple-click selects the paragraph and fires pointerup with coordinates. Only a loaded
  // plugin answers with its toolbar, so this is the gate every later assertion depends on.
  const marked = await read((sel) => {
    const flow = document.querySelector(sel)
    if (flow === null) return null
    const blocks = [...flow.querySelectorAll('p, li')].filter((el) => (el.innerText ?? '').trim().length > 40)
    const block = blocks[blocks.length - 1]
    if (block === undefined) return null
    block.setAttribute('data-qc-probe', '1')
    return (block.innerText ?? '').trim().slice(0, 40)
  }, flowSelector)
  check('a prose block is available to select', marked !== null, String(marked))

  await browser.tripleClick('[data-qc-probe="1"]')
  const toolbar = await waitFor("document.querySelectorAll('.qc-popup button').length === 2", { timeoutMs: 6000 })
  check('the plugin is live: selecting shows its two toolbar actions', toolbar !== null,
    toolbar === null ? 'no .qc-popup appeared' : '')
  const toolbarText = toolbar === null ? [] : await read(() =>
    [...document.querySelectorAll('.qc-popup button')].map((b) => (b.textContent ?? '').trim()))
  check('the toolbar offers annotate and ask, in order',
    Array.isArray(toolbarText) && toolbarText.length === 2
      && toolbarText[0].includes('注释') && toolbarText[1].includes('侧边'),
    JSON.stringify(toolbarText))

  // The popover prefers above the selected line and flips below only when it does not fit
  // (placeNear: top = rect.top - height - gap, falling back to rect.bottom + gap). Asserting
  // "above" outright was wrong — it fails whenever the selection sits low in a short viewport.
  // What must hold is that it hugs one edge of the line and stays inside the viewport.
  // Read from the source: ActionPopup gets `overlay.source.rect` and asks
  // `anchorInTranscript(flow, anchor, measured, 'below')`, so the popover is placed BELOW the
  // selection by design, clipped to the transcript container. An "above the line" assertion was
  // simply wrong about this plugin. What must hold is that it sits just under the selected line,
  // horizontally near it, and inside the viewport — that is what proves it used the real rect.
  const anchored = await read(() => {
    const popup = document.querySelector('.qc-popup')
    if (popup === null) return null
    const box = popup.getBoundingClientRect()
    const selection = window.getSelection()
    const range = selection === null || selection.rangeCount === 0 ? null : selection.getRangeAt(0)
    if (range === null) return null
    const line = range.getBoundingClientRect()
    return {
      visible: box.width > 0 && box.height > 0,
      // Its top edge begins at or below the selected line's top: placed under, not over, the text.
      startsBelow: box.top >= line.top - 2,
      // And close enough that it is visibly attached to that line rather than to the viewport.
      attached: box.top - line.bottom < 120,
      horizontal: Math.abs(box.left - line.left) < 420 || Math.abs(box.right - line.right) < 420,
      inViewport: box.top >= 0 && box.left >= 0
        && box.bottom <= window.innerHeight && box.right <= window.innerWidth,
      popupTop: Math.round(box.top),
      lineTop: Math.round(line.top),
      lineBottom: Math.round(line.bottom),
    }
  })
  check('the popover is placed under the selection, from the real pointer rect',
    anchored !== null && anchored.visible === true && anchored.startsBelow === true
      && anchored.attached === true,
    JSON.stringify(anchored))
  check('the popover stays inside the viewport', anchored !== null && anchored.inViewport === true,
    JSON.stringify(anchored))
  check('the popover is horizontally aligned with the selection',
    anchored !== null && anchored.horizontal === true, JSON.stringify(anchored))

  // ── Open the compose surface with a real click ─────────────────────────
  await click('.qc-popup button:first-child')
  const composeOpen = await waitFor("document.querySelector('.qc-compose textarea') !== null", { timeoutMs: 6000 })
  check('clicking annotate opens the comment box', composeOpen !== null)

  const beforeMarkers = await count('.qc-marker')
  const beforeChips = await count('[data-composer-chip="quote-chat"]')

  await click('.qc-compose textarea')
  await type(COMMENT)
  const typed = await read(() => document.querySelector('.qc-compose textarea')?.value ?? null)
  check('the comment box holds exactly the typed text', typed === COMMENT, JSON.stringify(typed))

  await click('.qc-compose .qc-compose-confirm')
  const closed = await waitFor("document.querySelector('.qc-compose') === null", { timeoutMs: 6000 })
  check('the comment box closes on save', closed !== null)

  // ── What a save must produce, by identity ──────────────────────────────
  const markerAppeared = await waitFor(
    `document.querySelectorAll('.qc-marker').length === ${beforeMarkers + 1}`, { timeoutMs: 6000 })
  check('saving adds exactly one marker', markerAppeared !== null,
    `before=${beforeMarkers} after=${await count('.qc-marker')}`)

  const marker = await read(() => {
    const element = document.querySelector('.qc-marker')
    if (element === null) return null
    return { number: element.getAttribute('data-qc-number'), forId: element.getAttribute('data-qc-for') }
  })
  check('the marker is numbered 1', marker !== null && marker.number === '1', JSON.stringify(marker))
  check('the marker carries a stable annotation id',
    marker !== null && typeof marker.forId === 'string' && marker.forId.startsWith('qc-'),
    JSON.stringify(marker))

  const chipAppeared = await waitFor(
    `document.querySelectorAll('[data-composer-chip="quote-chat"]').length === ${beforeChips + 1}`,
    { timeoutMs: 6000 })
  check('saving adds exactly one draft chip', chipAppeared !== null,
    `before=${beforeChips} after=${await count('[data-composer-chip="quote-chat"]')}`)

  const chip = await read(() => {
    const element = document.querySelector('[data-composer-chip="quote-chat"]')
    if (element === null) return null
    return { label: element.getAttribute('data-qc-label'), num: element.getAttribute('data-qc-num') }
  })
  // By design the chip shows `card.content` — "注释 {n}" — not the comment text; the text is what
  // the hover card reveals, asserted next. So the number is the identity to check here.
  check('the chip is numbered and labelled from the locale',
    chip !== null && chip.num === '1' && chip.label === '注释 1', JSON.stringify(chip))

  // ── The hover card, which only a real pointer can open ─────────────────
  await hover('[data-composer-chip="quote-chat"]')
  const cardShown = await waitFor("document.querySelectorAll('.qc-card').length === 1", { timeoutMs: 6000 })
  check('a real pointer hover opens the chip card', cardShown !== null)
  const card = await read(() => {
    const element = document.querySelector('.qc-card')
    return element === null ? null : (element.innerText ?? '').replace(/\s+/g, ' ').trim()
  })
  check('the card shows the comment', card !== null && card.includes(COMMENT), JSON.stringify(card))

  await moveAway()
  const cardHidden = await waitFor("document.querySelectorAll('.qc-card').length === 0", { timeoutMs: 6000 })
  check('the card clears when the pointer leaves', cardHidden !== null)

  // ── Reopening must show the stored comment, not an empty box ───────────
  await click('.qc-marker')
  const reopened = await waitFor("document.querySelector('.qc-bubble-panel textarea') !== null", { timeoutMs: 6000 })
  check('clicking the marker reopens the editor', reopened !== null)
  const seeded = await read(() => document.querySelector('.qc-bubble-panel textarea')?.value ?? null)
  check('the editor is seeded with the stored comment', seeded === COMMENT, JSON.stringify(seeded))

  // `highlighter.hold()` registers under FLASH_HIGHLIGHT ('quote-chat-flash'); there is no separate
  // 'quote-chat-hold' registration. The stylesheet declares a `::highlight(quote-chat-hold)` rule
  // that can therefore never match — a pre-existing defect, recorded here rather than fixed, and
  // not something this suite asserts on. Assert what the code actually paints.
  const held = await read(() => {
    const registry = window.CSS?.highlights
    return registry === undefined || registry === null
      ? { supported: false, held: false }
      : { supported: true, held: registry.get('quote-chat-flash') !== undefined }
  })
  check('opening the editor lights the passage', held.held === true, JSON.stringify(held))

  // ── Delete via the chip's own × ────────────────────────────────────────
  // A second, independent path. `.qc-chip-remove` is rendered only while the chip is hovered, and
  // it is a fixed overlay pinned to the chip's rectangle rather than a child of it — the chip's
  // contents belong to the editor and must not be written into. Closing the editor first is
  // required: its panel sits over the chip and would intercept the pointer.
  await press('Escape')
  await waitFor("document.querySelector('.qc-bubble-panel') === null", { timeoutMs: 4000 })
  await hover('[data-composer-chip="quote-chat"]')
  const removeShown = await waitFor("document.querySelector('.qc-chip-remove') !== null", { timeoutMs: 4000 })
  check('hovering the chip reveals its remove control', removeShown !== null)

  const beforeChipDelete = await count('.qc-marker')
  await click('.qc-chip-remove')
  const goneByChip = await waitFor(
    `document.querySelectorAll('.qc-marker').length === ` + (beforeChipDelete - 1), { timeoutMs: 6000 })
  check('the chip remove control deletes the annotation', goneByChip !== null,
    `markers ${beforeChipDelete} -> ${await count('.qc-marker')}`)
  check('the chip remove control removes the chip itself',
    (await count('[data-composer-chip="quote-chat"]')) === beforeChips,
    `chips=${await count('[data-composer-chip="quote-chat"]')}`)

  // The bubble panel path must stay covered too, so recreate one annotation and delete it there.
  await browser.tripleClick('[data-qc-probe="1"]')
  await waitFor("document.querySelectorAll('.qc-popup button').length === 2", { timeoutMs: 6000 })
  await click('.qc-popup button:first-child')
  await waitFor("document.querySelector('.qc-compose textarea') !== null", { timeoutMs: 6000 })
  await click('.qc-compose textarea')
  await type(COMMENT)
  await click('.qc-compose .qc-compose-confirm')
  await waitFor("document.querySelectorAll('.qc-marker').length === 1", { timeoutMs: 6000 })
  await click('.qc-marker')
  await waitFor("document.querySelector('.qc-bubble-panel .qc-bp-delete') !== null", { timeoutMs: 6000 })

  // ── Delete, and prove the counts return ────────────────────────────────
  await click('.qc-bubble-panel .qc-bp-delete')
  const gone = await waitFor(`document.querySelectorAll('.qc-marker').length === ${beforeMarkers}`,
    { timeoutMs: 6000 })
  check('deleting removes the marker', gone !== null, `count=${await count('.qc-marker')}`)
  const chipGone = await waitFor(
    `document.querySelectorAll('[data-composer-chip="quote-chat"]').length === ${beforeChips}`,
    { timeoutMs: 6000 })
  check('deleting removes the draft chip', chipGone !== null,
    `count=${await count('[data-composer-chip="quote-chat"]')}`)
  const cleared = await read(() => window.CSS?.highlights?.get('quote-chat-flash') === undefined)
  check('deleting clears the held highlight', cleared === true)

  check('no errors originate in this plugin', pluginErrors().length === 0,
    pluginErrors().slice(0, 2).join(' | '))
  } catch (error) {
    check('the lifecycle run completed without throwing', false,
      `${error?.message ?? error}`.slice(0, 300))
  }

  return { passed: results.filter((item) => item.ok === true).length, total: results.length }
}

// ── standalone entry ──────────────────────────────────────────────────────────

/**
 * Open a browser, run the suite, report, close.
 * @returns the process exit code.
 */
async function main() {
  const url = process.argv[2]
  if (url === undefined) {
    console.error('usage: node tools/accept-lifecycle.mjs <url>')
    return 2
  }
  const startedAt = Date.now()
  const results = []
  const check = (step, ok, detail = '') => {
    results.push({ step, ok })
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${ok || detail === '' ? '' : `  ->  ${detail}`}`)
  }
  const browser = await openBrowser()
  try {
    await run({ browser, check, url })
  } finally {
    await browser.close()
  }
  const failed = results.filter((item) => item.ok !== true).length
  console.log(`\n${results.length - failed}/${results.length} checks passed`)
  console.log(`elapsed: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
  return failed === 0 ? 0 : 1
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main())
}
