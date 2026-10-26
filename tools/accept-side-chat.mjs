/**
 * Acceptance for the side chat, with real input.
 *
 * ## What makes this the hardest suite
 *
 * It is the only one that waits on a model. Everything else settles in milliseconds; an answer
 * takes seconds and arrives in pieces. So the waits here are for *content* conditions — a second
 * message body exists, the streaming indicator is gone — rather than fixed sleeps. That is both
 * faster when the model is quick and correct when it is slow, which a `sleep(2500)` was neither.
 *
 * ## The two things most likely to break silently
 *
 * **The quote handoff.** The tab must open on the passage that was selected, not on whatever was
 * carried over. A second open with a *different* passage is the only way to tell a working handoff
 * from one that always returns the first quote, so that check exists and asserts the new text.
 *
 * **Thread isolation.** A new tab is a new conversation. The previous question must not appear. If
 * it does, answers become unattributable — they were about a different passage.
 *
 * ## Real input
 *
 * The question is typed with CDP key events rather than assigned through a setter and a synthetic
 * `input` event. The controlled textarea then sees exactly what a user's typing produces, including
 * the `input` events React needs to enable the send button — which is precisely what the "send
 * control enables" check measures.
 *
 * Usage: node tools/accept-side-chat.mjs <url>
 */
import { openBrowser } from './harness.mjs'

const URL_ARG = process.argv[2]
if (URL_ARG === undefined) {
  console.error('usage: node tools/accept-side-chat.mjs <url>')
  process.exit(2)
}

/** A question with a fixed prefix, so a carried-over thread is unambiguous to detect. */
const QUESTION = '用一句话回答：这段在说什么？'

const startedAt = Date.now()
const results = []
const check = (step, ok, detail = '') => {
  results.push({ step, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${ok || detail === '' ? '' : `  ->  ${detail}`}`)
}

const browser = await openBrowser()
const { goto, waitFor, read, count, click, press, pluginErrors } = browser

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

try {
  await goto(URL_ARG)
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
  // A model answer arrives progressively. Waiting for "two bodies and no streaming indicator" is
  // what actually settles; a fixed sleep either overshoots or flakes.
  const answered = await waitFor(
    "(() => { const t = document.querySelector('[data-slot=\"sidebar.right.pane.tab\"]');"
      + " if (t === null) return false; const bodies = [...t.querySelectorAll('.qc-msg-body')];"
      + " return bodies.length >= 2 && t.querySelector('.qc-dots') === null })()",
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
    }
  })
  check('the answer has content of its own',
    thread !== null && typeof thread.assistant === 'string' && thread.assistant.length > 10,
    JSON.stringify(thread?.assistant?.slice(0, 60)))
  check('the answer is not still streaming', thread !== null && thread.dots === false)

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
} finally {
  await browser.close()
}

const failed = results.filter((item) => item.ok !== true).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
console.log(`elapsed: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
process.exit(failed === 0 ? 0 : 1)
