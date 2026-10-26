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
  const { goto, waitFor, read, count, click, hover, type, press, moveAway, pluginErrors, tripleClick } = browser

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
  // The composer is a Lexical editor: writing textContent would be ignored, so its contents are
  // selected and removed with a real Backspace. Selecting happens in the page (selectNodeContents)
  // rather than with a click: a click on an arbitrary position would land inside the text and
  // select nothing useful.
  const composerSelector = '[contenteditable="true"]'
  if ((await count(composerSelector)) > 0) {
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
      // Measured against the real page: about -12px, i.e. the popup's top sits inside the line box.
      overlapsLine: box.top >= line.top - 2 && box.top <= line.bottom + 2,
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

  // Measured, not assumed: the toolbar overlaps the selected line by about 12px rather than
  // clearing it. `anchorInTranscript(…, 'below')` positions it relative to the line box, and the
  // line box is taller than the glyphs. The requirement is that it is attached to the line, which
  // an overlap still satisfies — a fallback to the viewport corner would fail this.
  check('the toolbar overlaps the line it belongs to rather than floating away',
    anchored !== null && anchored.overlapsLine === true, JSON.stringify(anchored))

  // ── Open the compose surface with a real click ─────────────────────────
  await click('.qc-popup button:first-child')
  const composeOpen = await waitFor("document.querySelector('.qc-compose textarea') !== null", { timeoutMs: 6000 })
  check('clicking annotate opens the comment box', composeOpen !== null)

  // The compose box follows the same rule as the toolbar it replaces: near the pointer release
  // point, inside the readable band. Asserting that it is attached to the selection is what
  // distinguishes a positioned panel from one that defaulted to a corner.
  // The compose box replaces the toolbar for the same selection. Its anchor is the passage
  // rectangle, which has to be read from the probe block rather than from `getSelection()`:
  // clicking 添加注释 consumes the selection, so a live range would report a zero rect and the
  // measurement would silently become "distance from the top of the viewport".
  const composeGeometry = await read(() => {
    const box = document.querySelector('.qc-compose')
    const passage = document.querySelector('[data-qc-probe="1"]')
    if (box === null || passage === null) return null
    const r = box.getBoundingClientRect()
    const p = passage.getBoundingClientRect()
    return {
      width: Math.round(r.width),
      height: Math.round(r.height),
      // Vertical distance from the passage it describes. The panel is tall, so it may extend
      // beyond the passage; what matters is that it starts near it rather than at a corner.
      topVersusPassage: Math.round(r.top - p.top),
      overlapVertically: r.top < p.bottom && r.bottom > p.top,
      inViewport: r.top >= 0 && r.left >= 0
        && r.bottom <= window.innerHeight && r.right <= window.innerWidth,
    }
  })
  check('the compose box is inside the viewport',
    composeGeometry !== null && composeGeometry.inViewport === true,
    JSON.stringify(composeGeometry))
  check('the compose box is anchored near the selection, not parked at a corner',
    composeGeometry !== null
      && Math.abs(composeGeometry.topVersusPassage) <= 340
      && composeGeometry.overlapVertically === true,
    JSON.stringify(composeGeometry))


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
  // The gutter marker must be level with the TOP of the passage it belongs to, which is what makes
  // a marker read as "this paragraph". Measured delta on the real page is 0.
  const markerGeometry = await read(() => {
    const marker = document.querySelector('.qc-marker')
    const block = document.querySelector('[data-qc-probe="1"]')
    if (marker === null || block === null) return null
    const markerBox = marker.getBoundingClientRect()
    const blockBox = block.getBoundingClientRect()
    return {
      deltaTop: Math.round(markerBox.top - blockBox.top),
      inViewport: markerBox.top >= 0 && markerBox.left >= 0
        && markerBox.bottom <= window.innerHeight && markerBox.right <= window.innerWidth,
    }
  })
  check('the marker is level with the top of its passage',
    markerGeometry !== null && Math.abs(markerGeometry.deltaTop) <= 6,
    JSON.stringify(markerGeometry))
  check('the marker is inside the viewport',
    markerGeometry !== null && markerGeometry.inViewport === true,
    JSON.stringify(markerGeometry))

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

  // The card floats above its chip. On the live page the measured gap is about 3px, and the card
  // must not cover the chip — covering it would hide the number the card refers to.
  const cardGeometry = await read(() => {
    const element = document.querySelector('.qc-card')
    const chip = document.querySelector('[data-composer-chip="quote-chat"]')
    if (element === null || chip === null) return null
    const c = element.getBoundingClientRect()
    const h = chip.getBoundingClientRect()
    return {
      gap: Math.round(h.top - c.bottom),
      aboveChip: c.bottom <= h.top + 2,
      coversChip: c.top < h.bottom && c.bottom > h.top
        && c.left < h.right && c.right > h.left,
      inViewport: c.top >= 0 && c.left >= 0
        && c.bottom <= window.innerHeight && c.right <= window.innerWidth,
    }
  })
  check('the card sits above its chip without covering it',
    cardGeometry !== null && cardGeometry.aboveChip === true
      && cardGeometry.coversChip === false,
    JSON.stringify(cardGeometry))
  check('the card is inside the viewport',
    cardGeometry !== null && cardGeometry.inViewport === true,
    JSON.stringify(cardGeometry))


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

  // ── Dismissing the compose box must also clear the highlight ───────────
  // Two listeners used to compete for this dismissal: the dock's called setOverlay(null)
  // directly and ran first, unmounting the popover before its own onCancel could clear the
  // passage. The window was never observably open: the box vanished and the highlight stayed,
  // and a snapshot taken later looks exactly like "the highlight was never painted".
  //
  // So the assertion checks both halves of the same frame, not just that the box is gone.
  await tripleClick('[data-qc-probe="1"]')
  await waitFor("document.querySelectorAll('.qc-popup button').length === 2", { timeoutMs: 6000 })
  await click('.qc-popup button:first-child')
  await waitFor("document.querySelector('.qc-compose') !== null", { timeoutMs: 6000 })

  const composeLit = await read(() => ({
    compose: document.querySelector('.qc-compose') !== null,
    painted: window.CSS?.highlights?.get('quote-chat-flash') !== undefined,
  }))
  check('opening the compose box lights the passage',
    composeLit.compose === true && composeLit.painted === true,
    JSON.stringify(composeLit))

  // Click a point that is provably outside the box AND outside the popover it replaced.
  const outsidePoint = await read(() => {
    const box = document.querySelector('.qc-compose').getBoundingClientRect()
    const candidate = { x: Math.max(6, Math.round(box.left / 2)), y: Math.round(box.top + 12) }
    const hit = document.elementFromPoint(candidate.x, candidate.y)
    return {
      ...candidate,
      // Verified outside both surfaces, so a failure cannot be blamed on the coordinates.
      outsideCompose: hit?.closest('.qc-compose') === null
        && hit?.closest('.qc-popup') === null,
    }
  })
  check('the dismissal point is outside both floating surfaces',
    outsidePoint.outsideCompose === true,
    JSON.stringify(outsidePoint))

  await browser.clickAt({ x: outsidePoint.x, y: outsidePoint.y })
  await waitFor("document.querySelector('.qc-compose') === null", { timeoutMs: 4000 })

  const afterDismiss = await read(() => ({
    compose: document.querySelector('.qc-compose') !== null,
    painted: window.CSS?.highlights?.get('quote-chat-flash') !== undefined,
  }))
  check('clicking outside closes the compose box',
    afterDismiss.compose === false,
    JSON.stringify(afterDismiss))
  check('clicking outside also clears the held highlight',
    afterDismiss.painted === false,
    JSON.stringify(afterDismiss))

  // The 取消 button and Escape must reach the same state; the pointer path used to be the odd one
  // out, and asserting all three keeps them from diverging again.
  await tripleClick('[data-qc-probe="1"]')
  await waitFor("document.querySelectorAll('.qc-popup button').length === 2", { timeoutMs: 6000 })
  await click('.qc-popup button:first-child')
  await waitFor("document.querySelector('.qc-compose') !== null", { timeoutMs: 6000 })
  await click('.qc-compose .qc-compose-cancel')
  await waitFor("document.querySelector('.qc-compose') === null", { timeoutMs: 4000 })
  const afterCancel = await read(
    () => window.CSS?.highlights?.get('quote-chat-flash') !== undefined,
  )
  check('the 取消 button clears the highlight too',
    afterCancel === false, `painted=${afterCancel}`)

  await tripleClick('[data-qc-probe="1"]')
  await waitFor("document.querySelectorAll('.qc-popup button').length === 2", { timeoutMs: 6000 })
  await click('.qc-popup button:first-child')
  await waitFor("document.querySelector('.qc-compose') !== null", { timeoutMs: 6000 })
  await press('Escape')
  await waitFor("document.querySelector('.qc-compose') === null", { timeoutMs: 4000 })
  const afterEscape = await read(
    () => window.CSS?.highlights?.get('quote-chat-flash') !== undefined,
  )
  check('Escape clears the highlight too',
    afterEscape === false, `painted=${afterEscape}`)

  // ── A secondary click must not open the toolbar ────────────────────────
  // Selecting text and then right-clicking is how a reader copies a passage. A secondary click
  // does not clear the selection, so a listener that treats "a button was released" as "the
  // selection is finished" paints the toolbar underneath the browser's own copy menu.
  //
  // The editor is closed first: it is a floating surface over the text, and both the click
  // coordinates and the "selection still exists" precondition are meaningless while it is open.
  await press('Escape')
  await waitFor("document.querySelector('.qc-bubble-panel') === null", { timeoutMs: 4000 })

  // A fresh selection, made the way a reader makes one.
  await browser.tripleClick('[data-qc-probe="1"]')
  const toolbarUp = await waitFor("document.querySelectorAll('.qc-popup button').length === 2",
    { timeoutMs: 6000 })
  check('selecting a passage raises the toolbar', toolbarUp !== null)

  const selectionBox = await read(() => {
    const selection = window.getSelection()
    const range = selection === null || selection.rangeCount === 0 ? null : selection.getRangeAt(0)
    if (range === null) return null
    const box = range.getBoundingClientRect()
    return {
      chars: (selection.toString() ?? '').trim().length,
      x: Math.round(box.left + box.width / 2),
      y: Math.round(box.top + box.height / 2),
      // Verified to be over the passage, not over a floating surface.
      overPassage: (() => {
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        return hit !== null
          && hit.closest('.qc-popup, .qc-bubble-panel, .qc-compose, .qc-card') === null
      })(),
    }
  })
  check('the click point is over the passage and not a floating surface',
    selectionBox !== null && selectionBox.chars > 0 && selectionBox.overPassage === true,
    JSON.stringify(selectionBox))

  await browser.rightClickAt({ x: selectionBox.x, y: selectionBox.y })
  await browser.page.waitForTimeout(260)

  const afterRight = await read(() => {
    const selection = window.getSelection()
    return {
      toolbarButtons: document.querySelectorAll('.qc-popup button').length,
      selectionChars: (selection?.toString() ?? '').trim().length,
    }
  })
  check('the selection survives a secondary click',
    afterRight.selectionChars > 0,
    JSON.stringify(afterRight))
  check('a secondary click does not open the action toolbar',
    afterRight.toolbarButtons === 0,
    JSON.stringify(afterRight))

  // The counterpart that keeps the fix honest: a primary-button DRAG must still open the toolbar.
  //
  // The native context menu has to be dismissed first. While it is open the page receives the press
  // but never the release — the probe recorded a drag consisting of `pointerdown` alone — so no
  // selection is finished and the plugin rightly does nothing. That is the environment, not the
  // plugin.
  await press('Escape')
  await browser.page.waitForTimeout(120)

  // Clear the selection first, so the assertion below cannot be satisfied by the selection that is
  // already there. Without this, "selection exists" would be true before the drag even started.
  await read(() => window.getSelection()?.removeAllRanges())
  const clearedBeforeDrag = await read(
    () => (window.getSelection()?.toString() ?? '').trim().length === 0,
  )
  check('the selection is cleared before the drag', clearedBeforeDrag === true)

  const dragBox = await read(() => {
    const probe = document.querySelector('[data-qc-probe="1"]')
    if (probe === null) return null
    const box = probe.getBoundingClientRect()
    return {
      from: { x: Math.round(box.left + 12), y: Math.round(box.top + box.height / 2) },
      to: { x: Math.round(box.right - 12), y: Math.round(box.top + box.height / 2) },
    }
  })
  check('a draggable passage is available', dragBox !== null, JSON.stringify(dragBox))

  await browser.dragSelect(dragBox.from, dragBox.to)
  const afterDrag = await waitFor("document.querySelectorAll('.qc-popup button').length === 2",
    { timeoutMs: 4000 })
  const dragState = await read(() => ({
    selected: (window.getSelection()?.toString() ?? '').trim().length,
    buttons: document.querySelectorAll('.qc-popup button').length,
  }))
  // Both halves are asserted: the drag must select something (or the plugin was never given a
  // chance) AND the toolbar must appear.
  check('the drag selects text', dragState.selected > 0, JSON.stringify(dragState))
  check('a primary-button drag still opens the toolbar',
    afterDrag !== null,
    JSON.stringify({ dragBox, after: dragState }))

  // Leave no overlay behind for the placement checks that follow.
  await press('Escape')
  await waitFor("document.querySelector('.qc-popup') === null", { timeoutMs: 4000 })

  // Reopen the editor: the placement section asserts against it.
  await click('.qc-marker')
  await waitFor("document.querySelector('.qc-bubble-panel .qc-bp-delete') !== null", { timeoutMs: 6000 })

  // ── Placement: the editor panel against its bubble ─────────────────────
  // Measured on the live page: the panel sits 4-8px above its bubble and its right edge lands
  // within 8px of the bubble's. It does NOT sit BUBBLE_CLEARANCE (30px) above, because that
  // constant is an offset in the scroll container's coordinate space, not a visible gap.
  const panelGeometry = await read(() => {
    const panel = document.querySelector('.qc-bubble-panel')
    const bubble = document.querySelector('.qc-marker')
    if (panel === null || bubble === null) return null
    const p = panel.getBoundingClientRect()
    const b = bubble.getBoundingClientRect()
    return {
      gap: Math.round(b.top - p.bottom),
      rightDelta: Math.round(p.right - b.right),
      above: p.bottom <= b.top + 2,
      inViewport: p.top >= 0 && p.left >= 0
        && p.bottom <= window.innerHeight && p.right <= window.innerWidth,
    }
  })
  check('the editor panel sits just above its bubble',
    panelGeometry !== null && panelGeometry.above === true
      && panelGeometry.gap >= 0 && panelGeometry.gap <= 12,
    JSON.stringify(panelGeometry))
  check('the editor panel is horizontally aligned with its bubble',
    panelGeometry !== null && Math.abs(panelGeometry.rightDelta) <= 12,
    JSON.stringify(panelGeometry))
  check('the editor panel is inside the viewport',
    panelGeometry !== null && panelGeometry.inViewport === true,
    JSON.stringify(panelGeometry))

  // ── Placement survives a scroll ────────────────────────────────────────
  // The surfaces are absolutely positioned inside the transcript's scroll container, so they ride
  // the content. A surface that positioned itself once against the viewport would pass every other
  // assertion in this file and fail only here, which is why this check exists.
  //
  // The scroll is verified before the geometry is compared: the transcript starts pinned to the
  // bottom, so a downward scroll is a no-op and would make the comparison vacuously true.
  const scrollProbe = await read(() => {
    const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
    if (flow === null) return { found: false }
    let scroller = flow.parentElement
    while (scroller !== null && scroller.scrollHeight <= scroller.clientHeight + 4) {
      scroller = scroller.parentElement
    }
    if (scroller === null) return { found: false }
    const start = scroller.scrollTop
    // Upward: the transcript is pinned to the bottom on open.
    scroller.scrollTop = Math.max(0, start - 120)
    return {
      found: true,
      start: Math.round(start),
      end: Math.round(scroller.scrollTop),
      moved: Math.round(scroller.scrollTop) !== Math.round(start),
    }
  })
  await browser.page.waitForTimeout(180)

  if (scrollProbe.found !== true || scrollProbe.moved !== true) {
    // Reported as skipped, not passed: without a real scroll this comparison proves nothing.
    check('the surfaces follow their anchors when the transcript scrolls',
      false, 'SKIP: the transcript could not scroll in this session')
  } else {
    const afterScroll = await read(() => {
      const marker = document.querySelector('.qc-marker')
      const panel = document.querySelector('.qc-bubble-panel')
      const block = document.querySelector('[data-qc-probe="1"]')
      if (marker === null || block === null) return null
      const m = marker.getBoundingClientRect()
      const b = block.getBoundingClientRect()
      const out = {
        markerToPassage: Math.round(m.top - b.top),
        inViewport: m.top >= 0 && m.left >= 0
          && m.bottom <= window.innerHeight && m.right <= window.innerWidth,
      }
      if (panel !== null) {
        const p = panel.getBoundingClientRect()
        const bubble = marker.getBoundingClientRect()
        out.panelGap = Math.round(bubble.top - p.bottom)
      }
      return out
    })
    check('the marker still sits level with its passage after a scroll',
      afterScroll !== null && Math.abs(afterScroll.markerToPassage) <= 6,
      JSON.stringify({ scroll: scrollProbe, after: afterScroll }))
    check('the marker stays inside the viewport after a scroll',
      afterScroll !== null && afterScroll.inViewport === true,
      JSON.stringify(afterScroll))
    // A few pixels of drift is expected and recorded in layout.js as an open observation; an
    // unanchored panel would lose its relationship to the bubble entirely.
    check('the editor panel keeps its gap to the bubble after a scroll',
      afterScroll !== null && afterScroll.panelGap !== undefined
        && afterScroll.panelGap >= 0 && afterScroll.panelGap <= 16,
      JSON.stringify({ scroll: scrollProbe, after: afterScroll }))
  }

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
