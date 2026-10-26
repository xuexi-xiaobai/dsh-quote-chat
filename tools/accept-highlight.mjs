/**
 * Highlight lifecycle acceptance.
 *
 * Two entry points, one body:
 *
 *   - `run({ browser, check, url })` — used by tools/accept-all.mjs, which drives every suite
 *     through a SINGLE browser. Launching chromium costs ~3.4s, and paying that once per campaign
 *     instead of once per suite is most of the wall-clock difference on a full pass.
 *   - `node accept-highlight.mjs <url>` — standalone, opening its own browser, for debugging this
 *     area alone.
 *
 * A thrown error is reported as one failed assertion rather than crashing the campaign, so the
 * remaining suites still run.
 *
 * ## What this checks, and why it needs a live browser
 *
 * The plugin paints passages through `CSS.highlights` and `::highlight(...)`, which exist only in a
 * rendering engine. There is no way to verify from source that a range is registered, that it
 * survives, or that it is removed — the assertions have to read the registry.
 *
 * ## The distinction this file exists to protect
 *
 * Two different kinds of highlight share one registry name (`quote-chat-flash`): the jump glow,
 * which expires by itself after FLASH_MS, and the held highlight, which stays while the editor is
 * open. Both live under the same key, so "a highlight exists" cannot tell them apart. The
 * difference is duration: the held one must still be present well past FLASH_MS. That is what the
 * "outlives the transient duration" check measures, and it is the only way to distinguish them
 * from outside.
 */
import { openBrowser } from './harness.mjs'

/** How long the transient glow lasts, plus slack for the timer to fire. */
const FLASH_MS = 2600
const FLASH_SLACK_MS = 900

/** The comment this suite types. */
const COMMENT = '高亮验收'

/** The registry state, as the only observable that matters here. */
const REGISTRY = () => {
  const registry = window.CSS?.highlights
  if (registry === undefined || registry === null) return { supported: false, present: false }
  return {
    supported: true,
    present: registry.get('quote-chat-flash') !== undefined,
    // Every registered name, so a future rename is visible in the failure rather than silent.
    names: [...registry.keys()],
  }
}

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
  const { goto, waitFor, read, count, click, press, pluginErrors } = browser

  try {
    await goto(url)
    await waitFor("document.querySelectorAll('[role=\"treeitem\"]').length > 0", { timeoutMs: 20000 })

    await read(() => {
      const items = [...document.querySelectorAll('[role="treeitem"]')]
      const hit = items.find((element) => (element.innerText ?? '').includes('锚点'))
      if (hit !== undefined) hit.click()
    })

  // The right sidebar is created when a chat opens and squeezes the conversation to ~424px of 1280.
  // Collapsing it here — after the conversation exists, before anything is measured — keeps every
  // geometry result meaningful and lets a human watch the app instead of a narrow strip.
  {
    const layoutNormalisation = await browser.collapseRightSidebar()
    if (layoutNormalisation.length > 0) console.log(`     layout: ${layoutNormalisation.join(' | ')}`)
  }

    const flowSelector = '[data-slot="conversation.chat.flow"]'
    const prose = await waitFor(
      `(() => { const f = document.querySelector('${flowSelector}'); if (f === null) return false;`
        + " return [...f.querySelectorAll('p, li')].some((el) => (el.innerText ?? '').trim().length > 40) })()",
      { timeoutMs: 20000 },
    )
    check('the transcript has selectable prose', prose !== null)

    // ── Clean slate: remove leftover annotations and clear the draft ─────
    for (let guard = 0; guard < 12; guard += 1) {
      const present = await count('.qc-marker')
      if (present === 0) break
      await click('.qc-marker')
      const opened = await waitFor("document.querySelector('.qc-bubble-panel .qc-bp-delete') !== null",
        { timeoutMs: 4000 })
      if (opened === null) break
      await click('.qc-bubble-panel .qc-bp-delete')
      await waitFor(`document.querySelectorAll('.qc-marker').length === ${present - 1}`, { timeoutMs: 4000 })
    }
    if ((await count('[contenteditable="true"]')) > 0) {
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
      await waitFor("document.querySelectorAll('[data-composer-chip=\"quote-chat\"]').length === 0",
        { timeoutMs: 6000 })
    }
    check('the run starts from a clean slate',
      (await count('.qc-marker')) === 0
        && (await count('[data-composer-chip="quote-chat"]')) === 0)

    const api = await read(() => ({
      hasHighlightsApi: typeof window.CSS?.highlights?.set === 'function',
    }))
    check('the browser exposes the highlight registry', api.hasHighlightsApi === true, JSON.stringify(api))

    // ── Liveness gate: a real selection must summon the toolbar ─────────
    await read((sel) => {
      const flow = document.querySelector(sel)
      const blocks = [...flow.querySelectorAll('p, li')].filter((el) => (el.innerText ?? '').trim().length > 40)
      const block = blocks[blocks.length - 1]
      if (block !== undefined) block.setAttribute('data-qc-probe', '1')
      return block !== undefined
    }, flowSelector)
    await browser.tripleClick('[data-qc-probe="1"]')
    const toolbar = await waitFor("document.querySelectorAll('.qc-popup button').length === 2",
      { timeoutMs: 6000 })
    check('the plugin is live: selecting shows its toolbar', toolbar !== null,
      toolbar === null ? 'no .qc-popup appeared' : '')

    // ── 1. Annotating paints the jump glow, which then expires ───────────
    await click('.qc-popup button:first-child')
    await waitFor("document.querySelector('.qc-compose textarea') !== null", { timeoutMs: 6000 })
    await click('.qc-compose textarea')
    await browser.type(COMMENT)

    const paintedOnSave = await read(() => {
      // Saving through the confirm button is a real click; the glow is painted on commit.
      const button = document.querySelector('.qc-compose .qc-compose-confirm')
      if (button === null) return false
      button.click()
      return true
    })
    check('the comment can be saved', paintedOnSave === true)

    const afterAnnotate = await waitFor("window.CSS?.highlights?.get('quote-chat-flash') !== undefined",
      { timeoutMs: 4000 })
    check('annotating registers a highlight', afterAnnotate !== null, JSON.stringify(await read(REGISTRY)))

    // The glow must clear itself within FLASH_MS plus slack. Waiting for the absence is both faster
    // and stricter than sleeping the full duration.
    const expired = await waitFor("window.CSS?.highlights?.get('quote-chat-flash') === undefined",
      { timeoutMs: FLASH_MS + FLASH_SLACK_MS })
    check('the jump glow clears itself', expired !== null, JSON.stringify(await read(REGISTRY)))

    // ── 2. The gutter editor holds a highlight ───────────────────────────
    const markerCount = await count('.qc-marker')
    check('a gutter marker exists to open', markerCount === 1, `count=${markerCount}`)

    await click('.qc-marker')
    const editorOpen = await waitFor("document.querySelector('.qc-bubble-panel textarea') !== null",
      { timeoutMs: 6000 })
    check('clicking the marker opens the editor', editorOpen !== null)

    const whileOpen = await read(REGISTRY)
    check('opening the editor paints a held highlight', whileOpen.present === true,
      JSON.stringify(whileOpen))

    // Past the transient duration: only a genuinely held highlight survives this.
    const heldAt = Date.now()
    await browser.page.waitForTimeout(FLASH_MS + FLASH_SLACK_MS)
    const stillOpen = await read(REGISTRY)
    check('the held highlight outlives the transient duration', stillOpen.present === true,
      JSON.stringify({ ...stillOpen, waitedMs: Date.now() - heldAt }))

    // ── 3. Closing the editor clears it ──────────────────────────────────
    await press('Escape')
    const closed = await waitFor("document.querySelector('.qc-bubble-panel') === null", { timeoutMs: 6000 })
    check('the editor closes on Escape', closed !== null)
    const afterClose = await read(REGISTRY)
    check('closing the editor clears the highlight', afterClose.present === false,
      JSON.stringify(afterClose))

    // ── 4. Deleting leaves nothing painted ───────────────────────────────
    await click('.qc-marker')
    await waitFor("document.querySelector('.qc-bubble-panel .qc-bp-delete') !== null", { timeoutMs: 6000 })
    await click('.qc-bubble-panel .qc-bp-delete')
    const removed = await waitFor("document.querySelectorAll('.qc-marker').length === 0", { timeoutMs: 6000 })
    check('deleting removes the marker', removed !== null)
    await waitFor("window.CSS?.highlights?.get('quote-chat-flash') === undefined", { timeoutMs: 4000 })
    const afterDelete = await read(REGISTRY)
    check('deleting the annotation clears the highlight', afterDelete.present === false,
      JSON.stringify(afterDelete))

    // ── 5. The registered name matches the stylesheet ────────────────────
    const styles = await read(() => {
      const names = []
      for (const sheet of document.styleSheets) {
        let rules = null
        try {
          rules = sheet.cssRules
        } catch {
          continue
        }
        for (const rule of rules ?? []) {
          const text = rule.cssText ?? ''
          const match = /::highlight\(([\w-]+)\)/.exec(text)
          if (match !== null) names.push(match[1])
        }
      }
      return { names: [...new Set(names)] }
    })
    check('the stylesheet declares the flash highlight name',
      styles.names.includes('quote-chat-flash'), JSON.stringify(styles.names))

    // The code registers 'quote-chat-flash' (asserted above by reading the registry). This check
    // states the agreement as one fact, and would fail if either side were renamed.
    check('the code and stylesheet agree on the flash name',
      styles.names.includes('quote-chat-flash') && afterAnnotate !== null,
      JSON.stringify(styles.names))

    // Recorded, not asserted as a pass: the stylesheet declares a `::highlight(quote-chat-hold)`
    // rule that nothing ever registers, because `highlighter.hold()` reuses the flash name. A
    // pre-existing defect; reported so it stays visible instead of being forgotten.
    if (styles.names.includes('quote-chat-hold')) {
      console.log('      note: stylesheet declares ::highlight(quote-chat-hold), which this code never '
        + 'registers — hold() paints under quote-chat-flash (pre-existing defect, recorded)')
    }

    check('no highlight errors in the console', pluginErrors().length === 0,
      pluginErrors().slice(0, 2).join(' | '))
  } catch (error) {
    check('the highlight run completed without throwing', false,
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
    console.error('usage: node tools/accept-highlight.mjs <url>')
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

import { pathToFileURL } from 'node:url'
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main())
}
