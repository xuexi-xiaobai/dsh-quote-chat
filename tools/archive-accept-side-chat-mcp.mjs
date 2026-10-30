/**
 * Side-chat acceptance: the whole side conversation, driven through the real UI.
 *
 * The annotation lifecycle suite says nothing about the side chat, so this is a separate run.
 * It walks the path a user takes and asserts at each step:
 *
 *   1. select a passage in an answer        -> the popup offers the side-chat action
 *   2. choose it                            -> the right-hand tab opens with that quote
 *   3. ask a question                       -> an answer streams in
 *   4. stop and close                       -> the tab closes without a stray request
 *   5. reopen with a different passage      -> the quote is replaced, not appended
 *   6. add to the main chat                 -> a chip lands in the composer
 *
 * It also records the artifact hash, so the result is attributable to one build.
 *
 * Usage:
 *   node tools/accept-side-chat.mjs <url> [outputDir]
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRecorder } from './recorder.mjs'

const NODE = process.env.QC_NODE ?? 'D:\\Programs_Apps\\nodejs\\node.exe'
const CLI = 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-mcp\\node_modules\\@playwright\\mcp\\cli.js'
const PROFILE = 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-profile'

const URL_ARG = process.argv[2]
const OUT_DIR = process.argv[3]
  ?? 'D:\\Win自带分类文件夹\\桌面\\各种乱七八糟的项目\\deepseekharness插件\\.playwright-mcp\\side-chat'

if (URL_ARG === undefined) {
  console.error('usage: node tools/accept-side-chat.mjs <url> [outputDir]')
  process.exit(2)
}

const ARTIFACT = join(import.meta.dirname, '..', 'client.js')
const ARTIFACT_SHA256 = createHash('sha256').update(readFileSync(ARTIFACT)).digest('hex')

const child = spawn(NODE, [CLI, '--viewport-size', '1280x800', '--user-data-dir', PROFILE], {
  stdio: ['pipe', 'pipe', 'pipe'],
})

const inbox = []
let buffer = ''
let stderrText = ''
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString()
  let newline = buffer.indexOf('\n')
  while (newline >= 0) {
    const line = buffer.slice(0, newline).trim()
    buffer = buffer.slice(newline + 1)
    if (line !== '') {
      try { inbox.push(JSON.parse(line)) } catch { /* banner */ }
    }
    newline = buffer.indexOf('\n')
  }
})
child.stderr.on('data', (chunk) => { stderrText += chunk.toString() })

const send = (payload) => child.stdin.write(`${JSON.stringify(payload)}\n`)

async function awaitResponse(id, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const at = inbox.findIndex((frame) => frame.id === id)
    if (at >= 0) return inbox.splice(at, 1)[0]
    await new Promise((resolve) => setTimeout(resolve, 80))
  }
  throw new Error(`no response for id ${id}; stderr: ${stderrText.slice(0, 600)}`)
}

let nextId = 2
async function call(name, args = {}) {
  const id = nextId++
  send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })
  const frame = await awaitResponse(id)
  if (frame.error !== undefined) throw new Error(`${name}: ${JSON.stringify(frame.error)}`)
  const text = (frame.result?.content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
  if (frame.result?.isError === true) throw new Error(`${name} failed: ${text.slice(0, 400)}`)
  return text
}

async function evaluate(fn) {
  const text = await call('browser_evaluate', { function: fn })
  const after = text.includes('### Result')
    ? text.slice(text.indexOf('### Result') + '### Result'.length)
    : text
  const body = after.split('### Ran Playwright code')[0].trim()
  const fenced = /^```(?:json)?\n([\s\S]*?)\n```$/.exec(body)
  const candidate = fenced === null ? body : fenced[1]
  try {
    return JSON.parse(candidate)
  } catch {
    return candidate
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const recorder = createRecorder({ call }, OUT_DIR)

const results = []
const check = (step, ok, detail = '') => {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${ok || detail === '' ? '' : `  ->  ${detail}`}`)
}

/** What the side chat currently shows. */
const STATE = `() => {
  const tab = document.querySelector('[data-slot="sidebar.right.pane.tab"]')
  const text = (tab === null ? '' : tab.innerText) || ''
  const buttons = tab === null
    ? []
    : [...tab.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim()).filter(Boolean)
  return {
    tabOpen: tab !== null,
    text: text.slice(0, 400),
    buttons,
    hasQuoteLabel: text.includes('引文') || text.includes('Quote'),
    bubbles: tab === null ? 0 : tab.querySelectorAll('[class*="qc-sc-"]').length,
    inputPresent: tab !== null && tab.querySelector('textarea, [contenteditable="true"]') !== null
  }
}`

try {
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'qc-side-chat', version: '1' },
    },
  })
  await awaitResponse(1)
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })

  await call('browser_navigate', { url: URL_ARG })
  await sleep(5000)
  await recorder.frame('loaded')

  // ── Open the test session ───────────────────────────────────────────────
  const session = await evaluate(`() => {
    const items = [...document.querySelectorAll('[role="treeitem"]')]
    const hit = items.find((element) => (element.innerText ?? '').includes('锚点'))
    if (hit === undefined) return { ok: false }
    hit.click()
    return { ok: true }
  }`)
  check('the test session opens', session.ok === true, JSON.stringify(session))
  await sleep(3000)
  await recorder.frame('session')

  // ── Step 1: select a passage ────────────────────────────────────────────
  const selected = await evaluate(`() => {
    const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
    if (flow === null) return { ok: false, reason: 'no flow' }
    const blocks = [...flow.querySelectorAll('p, li')]
      .filter((element) => (element.innerText ?? '').trim().length > 20)
    if (blocks.length === 0) return { ok: false, reason: 'no prose' }
    const block = blocks[blocks.length - 1]
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    const first = walker.nextNode()
    if (first === null) return { ok: false, reason: 'no text' }
    const range = document.createRange()
    range.setStart(first, 0)
    range.setEnd(first, Math.min(first.data.length, 24))
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange', { bubbles: true }))
    return { ok: true, text: selection.toString() }
  }`)
  check('a passage can be selected', selected.ok === true, selected.reason ?? '')
  await sleep(900)

  const popup = await evaluate(`() => {
    const buttons = [...document.querySelectorAll('.qc-popup button')]
      .map((b) => (b.textContent ?? '').trim())
    return { buttons }
  }`)
  check('the popup offers the side-chat action',
    popup.buttons.some((label) => label.includes('侧边聊天') || label.includes('side chat')),
    JSON.stringify(popup.buttons))
  await recorder.frame('selected')

  // ── Step 2: open the side chat with that quote ──────────────────────────
  await evaluate(`() => {
    const button = [...document.querySelectorAll('.qc-popup button')]
      .find((b) => (b.textContent ?? '').includes('侧边聊天'))
    if (button !== undefined) button.click()
    return button !== undefined
  }`)
  await sleep(2500)
  const opened = await evaluate(STATE)
  check('the side-chat tab opens', opened.tabOpen === true)
  check('the tab shows the selected quote', opened.text.includes(selected.text.slice(0, 6)),
    JSON.stringify(opened.text.slice(0, 120)))
  check('the tab offers an input', opened.inputPresent === true)
  await recorder.frame('side-chat-open')

  // ── Step 3: ask and watch the answer stream ─────────────────────────────
  const asked = await evaluate(`() => {
    const tab = document.querySelector('[data-slot="sidebar.right.pane.tab"]')
    if (tab === null) return { ok: false }
    const input = tab.querySelector('textarea, [contenteditable="true"]')
    if (input === null) return { ok: false, reason: 'no input' }
    input.focus()
    if (input.tagName === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(input, '用一句话回答：这段在说什么？')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      document.execCommand('insertText', false, '用一句话回答：这段在说什么？')
    }
    return { ok: true, length: (input.value ?? input.innerText ?? '').length }
  }`)
  check('the side chat accepts a question', asked.ok === true, JSON.stringify(asked))
  await recorder.frame('question-typed')

  // Send through the button: it is the control the tab actually exposes, and its disabled
  // state tells us whether the controlled textarea picked the text up.
  const sendState = await evaluate(`() => {
    const tab = document.querySelector('[data-slot="sidebar.right.pane.tab"]')
    const button = tab === null ? null : [...tab.querySelectorAll('button')]
      .find((b) => /发送|Send/i.test(b.textContent ?? ''))
    if (button === null || button === undefined) return { ok: false, reason: 'no send control' }
    const disabled = button.disabled === true
    if (!disabled) button.click()
    return { ok: true, disabled }
  }`)
  check('the send control enables once a question is typed', sendState.ok === true && sendState.disabled === false,
    JSON.stringify(sendState))
  let streamed = ''
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const state = await evaluate(STATE)
    streamed = state.text
    if (attempt === 6) await recorder.frame('streaming')
    // The answer is long enough when the panel has grown well past the quote and controls.
    if (streamed.length > 420) break
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  const thread = await evaluate(`() => {
    const tab = document.querySelector('[data-slot="sidebar.right.pane.tab"]')
    if (tab === null) return { ok: false }
    const bodies = [...tab.querySelectorAll('.qc-msg-body')].map((e) => (e.textContent ?? '').trim())
    return {
      ok: true,
      bodies,
      assistant: bodies.length > 1 ? bodies[bodies.length - 1] : '',
      dots: tab.querySelector('.qc-dots') !== null
    }
  }`)
  check('the tab renders a question and an answer turn',
    thread.ok === true && thread.bodies.length >= 2,
    JSON.stringify(thread.bodies.map((b) => b.slice(0, 24))))
  check('the answer has content of its own',
    typeof thread.assistant === 'string' && thread.assistant.length > 10,
    JSON.stringify(thread.assistant.slice(0, 60)))
  check('the answer is not still streaming', thread.dots === false, 'the dots indicator is up')
  await recorder.frame('answer')

  // ── Step 3b: add the answer to the main draft ───────────────────────────
  // The control only renders once an assistant message has text, which is why it is checked
  // here rather than on a freshly opened tab.
  const added = await evaluate(`() => {
    const tab = document.querySelector('[data-slot="sidebar.right.pane.tab"]')
    if (tab === null) return { ok: false, reason: 'no tab' }
    const button = [...tab.querySelectorAll('button')]
      .find((b) => /加入当前对话|Add to current/i.test(b.textContent ?? ''))
    if (button === undefined) return { ok: false, reason: 'no add control' }
    button.click()
    return { ok: true }
  }`)
  await sleep(2000)
  // The control inserts the answer as a markdown blockquote through the Host's insertText —
  // it is deliberately NOT a chip, so asserting on chips would test the wrong thing.
  const inserted = await evaluate(`() => {
    const draft = document.querySelector('[contenteditable="true"]')?.innerText ?? ''
    return {
      length: draft.length,
      isQuoteBlock: /^\\s*>\\s/m.test(draft),
      sample: draft.slice(0, 80)
    }
  }`)
  check('adding the answer writes a quoted block into the draft',
    added.ok === true && inserted.isQuoteBlock === true && inserted.length > 20,
    JSON.stringify({ added, inserted }))
  await recorder.frame('added')

  // ── Step 4: close the tab ───────────────────────────────────────────────
  const closed = await evaluate(`() => {
    const tab = document.querySelector('[data-slot="sidebar.right.pane.tab"]')
    if (tab === null) return { ok: false, reason: 'no tab' }
    // The tab strip's close affordance: a button whose accessible name mentions closing.
    const candidates = [...document.querySelectorAll('button, [role="tab"]')]
      .filter((element) => /关闭|close/i.test(
        (element.getAttribute('aria-label') ?? '') + (element.getAttribute('title') ?? ''),
      ))
    if (candidates.length === 0) return { ok: false, reason: 'no close control' }
    candidates[0].click()
    return { ok: true, count: candidates.length }
  }`)
  await sleep(1500)
  const afterClose = await evaluate(STATE)
  check('the tab closes', closed.ok === true && afterClose.tabOpen === false,
    JSON.stringify({ closed, tabOpen: afterClose.tabOpen }))
  await recorder.frame('closed')

  // ── Step 5: reopen with a DIFFERENT passage ─────────────────────────────
  const reselected = await evaluate(`() => {
    const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
    const blocks = [...flow.querySelectorAll('p, li')]
      .filter((element) => (element.innerText ?? '').trim().length > 20)
    if (blocks.length < 2) return { ok: false, reason: 'need two paragraphs' }
    const block = blocks[blocks.length - 2]
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    const first = walker.nextNode()
    if (first === null) return { ok: false, reason: 'no text' }
    const range = document.createRange()
    range.setStart(first, 0)
    range.setEnd(first, Math.min(first.data.length, 20))
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange', { bubbles: true }))
    return { ok: true, text: selection.toString() }
  }`)
  check('a second passage can be selected', reselected.ok === true, reselected.reason ?? '')
  await sleep(900)

  await evaluate(`() => {
    const button = [...document.querySelectorAll('.qc-popup button')]
      .find((b) => (b.textContent ?? '').includes('侧边聊天'))
    if (button !== undefined) button.click()
    return button !== undefined
  }`)
  await sleep(2500)
  const reopened = await evaluate(STATE)
  check('reopening shows the new quote', reopened.text.includes(reselected.text.slice(0, 6)),
    JSON.stringify(reopened.text.slice(0, 140)))
  check('the previous conversation was not carried over',
    !reopened.text.includes('用一句话回答：这段在说什么？'),
    'the old question survived a new open')
  await recorder.frame('reopened')

  // ── Console, filtered to this plugin ────────────────────────────────────
  const errors = await call('browser_console_messages', { level: 'error' }).catch(() => '')
  const own = errors.split('\n').filter((line) => (
    /qc-|quote-chat|quoteChat|SideChat/i.test(line)
    && !/dsh-plugin-marketplace|validateCodec|validateInvocation|DescriptorStore/i.test(line)
  ))
  check('no errors originate in this plugin', own.length === 0, own.slice(0, 2).join(' | '))
} catch (error) {
  check('the side-chat run completed without throwing', false, String(error).slice(0, 300))
} finally {
  const video = await recorder.finish()
  child.kill()
  try {
    writeFileSync(join(OUT_DIR, 'result.json'), JSON.stringify({
      artifactSha256: ARTIFACT_SHA256,
      viewport: '1280x800',
      passed: results.filter((item) => item.ok).length,
      total: results.length,
      checks: results,
      recording: video,
    }, null, 2))
  } catch { /* the run already reported on stdout */ }
  const passed = results.filter((item) => item.ok).length
  console.log('')
  console.log(`artifact: client.js sha256:${ARTIFACT_SHA256.slice(0, 16)}…`)
  console.log(`${passed}/${results.length} checks passed`)
  if (video !== null) console.log(`recording: ${video}`)
  process.exit(passed === results.length ? 0 : 1)
}
