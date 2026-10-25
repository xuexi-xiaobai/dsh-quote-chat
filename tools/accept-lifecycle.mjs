/**
 * Full annotation lifecycle acceptance, recorded for review.
 *
 * Walks the whole feature in one browser session, because each step depends on the previous:
 *
 *   1. open the test session      -> a passage exists to select
 *   2. select it                  -> toolbar appears
 *   3. open the comment box       -> editor opens, passage lit
 *   4. type a comment and save    -> marker, chip, stored entry
 *   5. click the marker           -> jump + flash + editor reopens
 *   6. edit the comment, save     -> chip payload follows the store
 *   7. delete                     -> marker, chip and highlight all clear
 *
 * Every assertion reads DOM state the plugin owns (`.qc-marker`, chip attributes,
 * `.qc-bubble-panel`, `CSS.highlights`), so a pass means the real UI behaved.
 *
 * A frame sequence is captured throughout and stitched into `recording.mp4`, so the run can
 * be reviewed rather than merely trusted.
 *
 * Usage:
 *   node tools/accept-lifecycle.mjs <url> [outputDir]
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRecorder } from './recorder.mjs'

const NODE = process.env.QC_NODE ?? 'D:\\Programs_Apps\\nodejs\\node.exe'
const CLI = 'C:\\Users\\Ethan cole\\AppData\\Local\\qc-playwright-mcp\\node_modules\\@playwright\\mcp\\cli.js'
const PROFILE = 'C:\\Users\\Ethan cole\\AppData\\Local\\qc-playwright-profile'

const URL_ARG = process.argv[2]
// Playwright MCP refuses to write outside its allowed roots, so the recording lives in the
// workspace under .playwright-mcp/recordings (which is git-ignored).
const OUT_DIR = process.argv[3] ?? 'D:\\Win自带分类文件夹\\桌面\\各种乱七八糟的项目\\deepseekharness插件\\.playwright-mcp\\recordings'

if (URL_ARG === undefined) {
  console.error('usage: node tools/accept-lifecycle.mjs <url> [outputDir]')
  process.exit(2)
}

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

async function awaitResponse(id, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const at = inbox.findIndex((frame) => frame.id === id)
    if (at >= 0) return inbox.splice(at, 1)[0]
    await new Promise((resolve) => setTimeout(resolve, 80))
  }
  throw new Error(`no response for id ${id}; stderr: ${stderrText.slice(0, 700)}`)
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

/**
 * Hash of the shipped artifact under test.
 *
 * A pass is only meaningful for a specific build. Without recording which one, a report says
 * "21/21 passed" without saying passed for what, and a later rebuild makes it unverifiable.
 */
const ARTIFACT = join(import.meta.dirname, '..', 'client.js')
const ARTIFACT_SHA256 = createHash('sha256').update(readFileSync(ARTIFACT)).digest('hex')
console.log(`artifact: client.js sha256:${ARTIFACT_SHA256.slice(0, 16)}…`)

const results = []
const check = (step, ok, detail = '') => {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${ok || detail === '' ? '' : `  ->  ${detail}`}`)
}

/** Every observable the plugin exposes. */
const STATE = `() => {
  const registry = window.CSS && window.CSS.highlights ? window.CSS.highlights : null
  const markers = [...document.querySelectorAll('.qc-marker')]
  return {
    selectionText: window.getSelection() === null ? '' : window.getSelection().toString().slice(0, 60),
    toolbarButtons: [...document.querySelectorAll('.qc-popup button')].map((b) => b.textContent.trim()),
    composePresent: document.querySelector('.qc-compose') !== null,
    panelPresent: document.querySelector('.qc-bubble-panel') !== null,
    markers: markers.map((el) => ({
      number: el.getAttribute('data-qc-number'),
      forId: el.getAttribute('data-qc-for')
    })),
    // The chip is a Lexical decorator wrapping the plugin's own span. Its identity lives in
    // data-composer-chip; data-qc-label and data-qc-num are set by this plugin.
    chipSlots: [...document.querySelectorAll('[data-composer-chip="quote-chat"]')]
      .map((el) => ({ label: el.getAttribute('data-qc-label'), num: el.getAttribute('data-qc-num') })),
    draftLength: (document.querySelector('[contenteditable="true"]')?.innerText ?? '').length,
    draftText: (document.querySelector('[contenteditable="true"]')?.innerText ?? '').slice(0, 80),
    flashRegistered: registry === null ? false : registry.get('quote-chat-flash') !== undefined,
    notice: document.querySelector('.qc-notice')?.textContent ?? ''
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
      clientInfo: { name: 'qc-lifecycle', version: '1' },
    },
  })
  await awaitResponse(1)
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })

  await call('browser_navigate', { url: URL_ARG })
  await sleep(5000)
  await recorder.frame('loaded')

  // ── Step 1: open the test session ───────────────────────────────────────
  const session = await evaluate(`() => {
    const items = [...document.querySelectorAll('[role="treeitem"]')]
    const hit = items.find((element) => (element.innerText ?? '').includes('锚点'))
    if (hit === undefined) return { ok: false }
    hit.click()
    return { ok: true, label: (hit.innerText ?? '').split('\\n')[0] }
  }`)
  check('the test session opens', session.ok === true, JSON.stringify(session))
  await sleep(3000)
  await recorder.frame('session-open')

  // ── Step 1b: start from a clean slate ───────────────────────────────────
  //
  // Repeated runs leave annotations and chips behind, and the draft is persisted, so the
  // pollution is visible to the next run. Clearing it keeps every "exactly one" assertion
  // meaningful and lets numbering restart at 1 as the spec requires.
  //
  // Deletion has to happen through Lexical, not through the DOM: the editor owns its model
  // and reverts edits it did not originate. A real Backspace after focusing the composer
  // goes through its command path and clears the whole draft, which was verified to remove
  // every stale chip at once.
  const cleared = await evaluate(`() => {
    const editors = [...document.querySelectorAll('[contenteditable="true"]')]
    const composer = editors[editors.length - 1]
    const chipsBefore = document.querySelectorAll('[data-composer-chip="quote-chat"]').length
    const markersBefore = document.querySelectorAll('.qc-marker').length
    if (composer !== undefined) {
      composer.focus()
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(composer)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    return { chipsBefore, markersBefore, focused: composer !== undefined }
  }`)
  if (cleared.chipsBefore > 0) {
    await call('browser_press_key', { key: 'Backspace' })
    await sleep(900)
  }
  // A leftover marker means a stored annotation survived; open each and delete it.
  const markersCleared = await evaluate(`() => {
    let guard = 0
    while (document.querySelector('.qc-marker') !== null && guard < 12) {
      guard += 1
      const marker = document.querySelector('.qc-marker')
      marker.click()
      const remove = [...document.querySelectorAll('.qc-bubble-panel button')]
        .find((b) => (b.textContent ?? '').includes('删除'))
      if (remove === undefined) break
      remove.click()
    }
    return {
      markersAfter: document.querySelectorAll('.qc-marker').length,
      chipsAfter: document.querySelectorAll('[data-composer-chip="quote-chat"]').length
    }
  }`)
  check('the run starts from a clean slate',
    markersCleared.markersAfter === 0 && markersCleared.chipsAfter === 0,
    JSON.stringify({ ...cleared, ...markersCleared }))
  await sleep(1200)
  await recorder.frame('clean')

  // ── Step 2: select a passage ────────────────────────────────────────────
  const picked = await evaluate(`() => {
    const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
    if (flow === null) return { ok: false, reason: 'no flow' }
    const blocks = [...flow.querySelectorAll('p, li')]
      .filter((el) => (el.innerText ?? '').trim().length > 20)
    if (blocks.length === 0) return { ok: false, reason: 'no prose' }
    const block = blocks[blocks.length - 1]
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    const first = walker.nextNode()
    if (first === null) return { ok: false, reason: 'no text node' }
    const range = document.createRange()
    range.setStart(first, 0)
    range.setEnd(first, Math.min(first.data.length, 28))
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange', { bubbles: true }))
    return { ok: true, text: selection.toString(), passage: first.data.slice(0, 50) }
  }`)
  check('a passage can be selected', picked.ok === true, picked.reason ?? '')
  await sleep(900)
  const selected = await evaluate(STATE)
  check('selecting shows the toolbar',
    selected.toolbarButtons.length === 2, JSON.stringify(selected.toolbarButtons))
  await recorder.frame('selected')

  // ── Step 3: open the comment box ────────────────────────────────────────
  await evaluate(`() => {
    const button = [...document.querySelectorAll('.qc-popup button')]
      .find((b) => (b.textContent ?? '').includes('添加注释'))
    if (button !== undefined) button.click()
    return button !== undefined
  }`)
  await sleep(1100)
  const opened = await evaluate(STATE)
  check('the comment box opens', opened.composePresent === true)
  check('the passage is lit while the box is open', opened.flashRegistered === true)
  await recorder.frame('compose-open')

  // ── Step 4: type and save ───────────────────────────────────────────────
  const COMMENT = '自动化验收写入的评价'
  const typed = await evaluate(`() => {
    const input = document.querySelector('.qc-compose textarea, .qc-compose [contenteditable="true"]')
    if (input === null) return { ok: false }
    input.focus()
    if (input.tagName === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(COMMENT)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      document.execCommand('insertText', false, ${JSON.stringify(COMMENT)})
    }
    return { ok: true, value: (input.value ?? input.innerText ?? '').slice(0, 40) }
  }`)
  check('the comment box accepts text', typed.ok === true, JSON.stringify(typed))
  await recorder.frame('comment-typed')

  await evaluate(`() => {
    const button = [...document.querySelectorAll('.qc-compose button')]
      .find((b) => (b.textContent ?? '').includes('添加注释'))
    if (button !== undefined) button.click()
    return button !== undefined
  }`)
  await sleep(1800)
  const saved = await evaluate(STATE)
  check('saving creates one gutter marker', saved.markers.length === 1, JSON.stringify(saved.markers))
  check('the marker is numbered 1', saved.markers[0]?.number === '1', String(saved.markers[0]?.number))
  check('the marker has a stable annotation id',
    typeof saved.markers[0]?.forId === 'string' && saved.markers[0].forId !== '')
  // The chip is a Lexical node, not a plugin-owned element, so it is observed through the
  // draft text, where it appears as the U+FFFC object-replacement placeholder.
  check('saving puts a chip in the draft', saved.chipSlots.length === 1,
    `chips=${JSON.stringify(saved.chipSlots)}`)
  check('the comment box closed on save', saved.composePresent === false)
  await recorder.frame('saved')

  // ── Step 5: click the marker ────────────────────────────────────────────
  await evaluate(`() => {
    const marker = document.querySelector('.qc-marker')
    if (marker === null) return false
    marker.click()
    return true
  }`)
  await sleep(1500)
  const reopened = await evaluate(STATE)
  check('clicking the marker reopens the editor', reopened.panelPresent === true)
  check('clicking the marker lights the passage', reopened.flashRegistered === true)
  await recorder.frame('marker-clicked')

  // ── Step 6: edit and save ───────────────────────────────────────────────
  const EDITED = '编辑后的评价'
  const edited = await evaluate(`() => {
    const input = document.querySelector('.qc-bubble-panel textarea, .qc-bubble-panel [contenteditable="true"]')
    if (input === null) return { ok: false }
    input.focus()
    if (input.tagName === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(EDITED)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
    } else {
      document.execCommand('selectAll', false, null)
      document.execCommand('insertText', false, ${JSON.stringify(EDITED)})
    }
    return { ok: true }
  }`)
  check('the editor accepts an edited comment', edited.ok === true)

  await evaluate(`() => {
    const button = [...document.querySelectorAll('.qc-bubble-panel button')]
      .find((b) => (b.textContent ?? '').includes('保存'))
    if (button !== undefined) button.click()
    return button !== undefined
  }`)
  await sleep(1800)
  const afterEdit = await evaluate(STATE)
  check('editing keeps one marker', afterEdit.markers.length === 1)
  check('editing keeps the draft chip', afterEdit.chipSlots.length === 1,
    `chips=${JSON.stringify(afterEdit.chipSlots)}`)
  await recorder.frame('edited')

  // ── Step 7: delete ──────────────────────────────────────────────────────
  await evaluate(`() => {
    const marker = document.querySelector('.qc-marker')
    if (marker === null) return false
    marker.click()
    return true
  }`)
  await sleep(1300)
  await evaluate(`() => {
    const button = [...document.querySelectorAll('.qc-bubble-panel button')]
      .find((b) => (b.textContent ?? '').includes('删除'))
    if (button !== undefined) button.click()
    return button !== undefined
  }`)
  await sleep(2000)
  const removed = await evaluate(STATE)
  check('deleting removes the marker', removed.markers.length === 0, `markers=${removed.markers.length}`)
  check('deleting removes the draft chip', removed.chipSlots.length === 0,
    `chips=${JSON.stringify(removed.chipSlots)}`)
  check('deleting clears the highlight', removed.flashRegistered === false)
  await recorder.frame('deleted')

  // ── Console, filtered to this plugin ────────────────────────────────────
  const errors = await call('browser_console_messages', { level: 'error' }).catch(() => '')
  const ownErrors = errors.split('\n').filter((line) => (
    /qc-|quote-chat|quoteChat|BubblePanel|MarkerLayer|ComposerPopover/i.test(line)
    && !/dsh-plugin-marketplace|validateCodec|validateInvocation|DescriptorStore/i.test(line)
  ))
  check('no errors originate in this plugin', ownErrors.length === 0,
    ownErrors.slice(0, 2).join(' | '))
} catch (error) {
  check('the lifecycle ran without throwing', false, String(error).slice(0, 300))
} finally {
  const video = await recorder.finish()
  // Persist the run record next to the video, stamped with the artifact it validated.
  try {
    writeFileSync(join(OUT_DIR, 'result.json'), JSON.stringify({
      artifactSha256: ARTIFACT_SHA256,
      viewport: '1280x800',
      passed: results.filter((item) => item.ok).length,
      total: results.length,
      checks: results,
      recording: video,
    }, null, 2))
  } catch { /* the run already reported its outcome on stdout */ }
  child.kill()
  const passed = results.filter((item) => item.ok).length
  console.log('')
  console.log(`${passed}/${results.length} checks passed`)
  console.log(`frames: ${recorder.count()}`)
  if (video !== null) console.log(`recording: ${video}`)
  process.exit(passed === results.length ? 0 : 1)
}
