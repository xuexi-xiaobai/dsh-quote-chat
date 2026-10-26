/**
 * Side chat acceptance.
 *
 * Two entry points, one body:
 *
 *   - `run({ browser, check, url })` — used by tools/accept-all.mjs, which drives every suite
 *     through a SINGLE browser. Launching chromium costs ~3.4s, and paying that once per campaign
 *     instead of once per suite is most of the wall-clock difference on a full pass.
 *   - `node accept-side-chat.mjs <url>` — standalone, opening its own browser, for debugging this area alone.
 *
 * A thrown error is reported as one failed assertion rather than crashing the campaign, so the
 * remaining suites still run.
 *
 * Real input throughout: clicks and typing go through CDP. A synthetic `element.click()` skips hit
 * testing and emits no `pointerup`, which this plugin's popover anchors to.
 */
import { openBrowser } from './harness.mjs'
import { pathToFileURL } from 'node:url'

/** A question with a fixed prefix, so a carried-over thread is unambiguous to detect. */
const QUESTION = '用一句话回答：这段在说什么？'

/** The tab's own state: what is rendered, and whether it is still streaming. */
const TAB_STATE = () => {
  const tab = document.querySelector('[data-slot="sidebar.right.pane.tab"]')
  if (tab === null) return { tabOpen: false, text: '', inputPresent: false }
  return {
    tabOpen: true,
    text: (tab.innerText ?? '').replace(/\s+/g, ' ').trim(),
    inputPresent: tab.querySelector('textarea, [contenteditable="true"]') !== null,
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

  const flowSelector = '[data-slot="conversation.chat.flow"]'
  const prose = await waitFor(
    `(() => { const f = document.querySelector('${flowSelector}'); if (f === null) return false;`
      + " return [...f.querySelectorAll('p, li')].filter((el) => (el.innerText ?? '').trim().length > 40).length >= 2 })()",
    { timeoutMs: 20000 },
  )
  check('the transcript has at least two selectable passages', prose !== null)

  // ── Step 1: select the LAST passage ────────────────────────────────────
  const firstPick = await read((sel) => {
    const flow = document.querySelector(sel)
    const blocks = [...flow.querySelectorAll('p, li')].filter((el) => (el.innerText ?? '').trim().length > 40)
    const block = blocks[blocks.length - 1]
    if (block === undefined) return null
    block.setAttribute('data-qc-probe', 'last')
    return (block.innerText ?? '').trim().slice(0, 30)
  }, flowSelector)
  check('a passage is available to select', firstPick !== null, String(firstPick))

  await browser.tripleClick('[data-qc-probe="last"]')
  const popup = await waitFor("document.querySelectorAll('.qc-popup button').length === 2", { timeoutMs: 6000 })
  check('the plugin is live: the popup offers two actions', popup !== null,
    popup === null ? 'no .qc-popup appeared' : '')
  const labels = popup === null ? [] : await read(() =>
    [...document.querySelectorAll('.qc-popup button')].map((b) => (b.textContent ?? '').trim()))
  check('the popup offers the side-chat action',
    labels.some((label) => label.includes('侧边聊天')), JSON.stringify(labels))

  const pickedText = await read(() => (window.getSelection()?.toString() ?? '').trim())
  check('the selection has text to carry', pickedText.length > 4, JSON.stringify(pickedText))

  // ── Step 2: open the side chat on that quote ───────────────────────────
  await click('.qc-popup button:nth-child(2)')
  const opened = await waitFor(
    "(() => { const t = document.querySelector('[data-slot=\"sidebar.right.pane.tab\"]');"
      + ' return t !== null && (t.innerText ?? "").length > 10 })()',
    { timeoutMs: 10000 },
  )
  check('the side-chat tab opens', opened !== null)

  const openedState = await read(TAB_STATE)
  check('the tab shows the selected quote',
    openedState.text.includes(pickedText.slice(0, 6)), JSON.stringify(openedState.text.slice(0, 140)))
  check('the tab offers an input', openedState.inputPresent === true)

  // ── Step 3: ask, with real typing ──────────────────────────────────────
  await click('[data-slot="sidebar.right.pane.tab"] textarea')
  await browser.type(QUESTION)
  const typed = await read(() => document.querySelector('[data-slot="sidebar.right.pane.tab"] textarea')?.value ?? null)
  check('the side chat accepts a question', typed === QUESTION, JSON.stringify(typed))

  // ── Liveness: the send control must enable from the real typing ────────
  const sendReady = await read(() => {
    const tab = document.querySelector('[data-slot="sidebar.right.pane.tab"]')
    if (tab === null) return null
    const button = [...tab.querySelectorAll('button')].find((b) => /发送|Send/i.test(b.textContent ?? ''))
    return button === undefined ? null : { disabled: button.disabled === true }
  })
  check('the send control enables once a question is typed',
    sendReady !== null && sendReady.disabled === false, JSON.stringify(sendReady))

  const sent = await read(() => {
    const tab = document.querySelector('[data-slot="sidebar.right.pane.tab"]')
    const button = tab === null
      ? null
      : [...tab.querySelectorAll('button')].find((b) => /发送|Send/i.test(b.textContent ?? ''))
    if (button === null || button === undefined || button.disabled === true) return false
    button.click()
    return true
  })
  check('the question can be sent', sent === true)

  // ── The answer: wait for content, not for a duration ───────────────────
  // A model answer arrives progressively, and the streaming indicator is NOT a completion signal:
  // the dots render only while the message body is still empty (side-chat.js), so they disappear as
  // soon as the first token lands. Waiting on them accepted a half sentence as a finished answer.
  //
  // Completion is `busy === false`, which the panel shows as the Stop button being replaced by the
  // Send button. That is the condition that actually settles.
  const answered = await waitFor(
    "(() => { const t = document.querySelector('[data-slot=\"sidebar.right.pane.tab\"]');"
      + " if (t === null) return false;"
      + " const bodies = [...t.querySelectorAll('.qc-msg-body')];"
      + " if (bodies.length < 2) return false;"
      + " const buttons = [...t.querySelectorAll('button')];"
      + " const streaming = buttons.some((b) => /停止|Stop/i.test(b.textContent ?? ''));"
      + " return streaming === false && (bodies[bodies.length - 1].textContent ?? '').trim().length > 10 })()",
    { timeoutMs: 90000, intervalMs: 200 },
  )
  check('the tab renders a question and a settled answer', answered !== null,
    answered === null ? 'still streaming or no second turn' : '')

  const thread = await read(() => {
    const tab = document.querySelector('[data-slot="sidebar.right.pane.tab"]')
    if (tab === null) return null
    const bodies = [...tab.querySelectorAll('.qc-msg-body')].map((element) => (element.textContent ?? '').trim())
    return {
      bodies: bodies.map((body) => body.slice(0, 24)),
      assistant: bodies.length > 1 ? bodies[bodies.length - 1] : '',
      dots: tab.querySelector('.qc-dots') !== null,
      // The authoritative signal: the Stop button exists only while a request is in flight.
      streaming: [...tab.querySelectorAll('button')]
        .some((button) => /停止|Stop/i.test(button.textContent ?? '')),
    }
  })
  check('the answer has content of its own',
    thread !== null && typeof thread.assistant === 'string' && thread.assistant.length > 10,
    JSON.stringify(thread?.assistant?.slice(0, 60)))
  check('the answer is not still streaming', thread !== null && thread.streaming === false)

  // The answer must be its own text, not a copy of the question.
  check('the answer is distinct from the question',
    thread !== null && thread.assistant !== QUESTION, JSON.stringify(thread?.assistant?.slice(0, 40)))

  // ── Step 3b: add the answer to the main draft ──────────────────────────
  const beforeDraft = await read(() => (document.querySelector('[contenteditable="true"]')?.innerText ?? '').length)
  const added = await read(() => {
    const tab = document.querySelector('[data-slot="sidebar.right.pane.tab"]')
    if (tab === null) return { ok: false, reason: 'no tab' }
    const button = [...tab.querySelectorAll('button')]
      .find((b) => /加入当前对话|Add to current/i.test(b.textContent ?? ''))
    if (button === undefined) return { ok: false, reason: 'no add control' }
    button.click()
    return { ok: true }
  })
  check('the add control is present once an answer exists', added.ok === true, added.reason ?? '')

  // It inserts a markdown blockquote through the Host's insertText, deliberately NOT a chip, so
  // asserting on chips would check the wrong mechanism.
  const inserted = await waitFor(
    "(() => { const d = document.querySelector('[contenteditable=\"true\"]')?.innerText ?? '';"
      + ' return d.length > 20 && /^\\s*>\\s/m.test(d) ? { isQuoteBlock: true, length: d.length } : false })()',
    { timeoutMs: 8000 },
  )
  check('adding the answer writes a quoted block into the draft',
    inserted !== null, JSON.stringify({ added, beforeDraft }))
  check('the draft grew by the inserted block',
    inserted !== null && inserted.length > beforeDraft, JSON.stringify({ beforeDraft, inserted }))

  // ── Step 4: close the tab ──────────────────────────────────────────────
  const closed = await read(() => {
    const candidates = [...document.querySelectorAll('button, [role="tab"]')]
      .filter((element) => /关闭|close/i.test(
        (element.getAttribute('aria-label') ?? '') + (element.getAttribute('title') ?? ''),
      ))
    if (candidates.length === 0) return { ok: false, reason: 'no close control' }
    candidates[0].click()
    return { ok: true, count: candidates.length }
  })
  const tabClosed = await waitFor(
    "document.querySelector('[data-slot=\"sidebar.right.pane.tab\"]') === null", { timeoutMs: 8000 })
  check('the tab closes', closed.ok === true && tabClosed !== null,
    JSON.stringify({ closed, waited: tabClosed !== null }))

  // ── Step 5: reopen on a DIFFERENT passage ─────────────────────────────
  // This is what proves the handoff carries the current selection rather than always returning
  // the first quote, and that a new open starts a new thread.
  const secondPick = await read((sel) => {
    const flow = document.querySelector(sel)
    const blocks = [...flow.querySelectorAll('p, li')].filter((el) => (el.innerText ?? '').trim().length > 40)
    if (blocks.length < 2) return null
    const block = blocks[blocks.length - 2]
    block.setAttribute('data-qc-probe', 'second')
    return (block.innerText ?? '').trim().slice(0, 30)
  }, flowSelector)
  check('a second, different passage is available', secondPick !== null, String(secondPick))
  check('the second passage differs from the first', secondPick !== firstPick,
    JSON.stringify({ firstPick, secondPick }))

  await browser.tripleClick('[data-qc-probe="second"]')
  await waitFor("document.querySelectorAll('.qc-popup button').length === 2", { timeoutMs: 6000 })
  const secondText = await read(() => (window.getSelection()?.toString() ?? '').trim())
  check('the second selection has text to carry', secondText.length > 4, JSON.stringify(secondText))

  await click('.qc-popup button:nth-child(2)')
  const reopened = await waitFor(
    "(() => { const t = document.querySelector('[data-slot=\"sidebar.right.pane.tab\"]');"
      + ' return t !== null && (t.innerText ?? "").length > 10 })()',
    { timeoutMs: 10000 },
  )
  check('the tab reopens', reopened !== null)

  const reopenedState = await read(TAB_STATE)
  check('reopening shows the new quote',
    reopenedState.text.includes(secondText.slice(0, 6)),
    JSON.stringify({ wanted: secondText.slice(0, 10), shown: reopenedState.text.slice(0, 140) }))
  check('the previous conversation was not carried over',
    !reopenedState.text.includes(QUESTION), 'the old question survived a new open')

  check('no errors originate in this plugin', pluginErrors().length === 0,
    pluginErrors().slice(0, 2).join(' | '))
} catch (error) {
  check('the side-chat run completed without throwing', false,
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
    console.error('usage: node tools/accept-side-chat.mjs <url>')
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
