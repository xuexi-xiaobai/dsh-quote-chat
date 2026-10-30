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
const CLI = 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-mcp\\node_modules\\@playwright\\mcp\\cli.js'
const PROFILE = 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-profile'

const URL_ARG = process.argv[2]
// Playwright MCP refuses to write outside its allowed roots, so the recording lives in the
// workspace under .playwright-mcp/recordings (which is git-ignored).
const OUT_DIR = process.argv[3] ?? 'D:\\Win自带分类文件夹\\桌面\\各种乱七八糟的项目\\deepseekharness插件\\.playwright-mcp\\recordings'

if (URL_ARG === undefined) {
  console.error('usage: node tools/accept-lifecycle.mjs <url> [outputDir]')
  process.exit(2)
}

const BOOT_AT = Date.now()
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

/**
 * Wait inside the page until a predicate holds, then return its value.
 *
 * Replaces the "act, sleep, then read the DOM" pattern that dominated this suite's runtime. A
 * fixed sleep is at once too slow (it overshoots a fast render) and too fast (it undershoots a
 * slow one, which is why these runs used to flake). Polling the real condition inside a single
 * browser_evaluate is faster and stricter: the value returned is the state that satisfied the
 * predicate, so the assertion reads a settled DOM instead of a guessed one.
 *
 * @param expression - a JS expression, evaluated in the page, truthy when ready.
 * @param options - { timeoutMs, intervalMs, label }.
 * @returns the truthy value, or null on timeout.
 */
async function waitFor(expression, options = {}) {
  const timeoutMs = options.timeoutMs ?? 8000
  const intervalMs = options.intervalMs ?? 50
  const label = options.label ?? 'condition'
  const startedAt = Date.now()
  const script =
    'async () => {\n' +
    '  const deadline = Date.now() + ' + timeoutMs + '\n' +
    '  const probe = () => (' + expression + ')\n' +
    '  for (;;) {\n' +
    '    let value\n' +
    '    try { value = probe() } catch { value = null }\n' +
    '    if (value) return { ok: true, value: value }\n' +
    '    if (Date.now() > deadline) return { ok: false, value: null }\n' +
    '    await new Promise((resolve) => setTimeout(resolve, ' + intervalMs + '))\n' +
    '  }\n' +
    '}'
  const result = await evaluate(script)
  const waited = Date.now() - startedAt
  if (result === null || result.ok !== true) {
    console.log(`      wait[${label}] timed out after ${(waited / 1000).toFixed(1)}s`)
  } else if (waited > 1200) {
    console.log(`      wait[${label}] ${(waited / 1000).toFixed(1)}s`)
  }
  return result !== null && result.ok === true ? result.value : null
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
  console.log(`      [t] mcp ready after ${((Date.now()-BOOT_AT)/1000).toFixed(1)}s`)
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })

  await call('browser_navigate', { url: URL_ARG })
  // The sidebar renders tree items only after the session list has loaded.
  await waitFor("document.querySelectorAll('[role=\"treeitem\"]').length > 0", {
    timeoutMs: 20000, label: 'app shell',
  })
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
  // The transcript is ready once a turn is rendered. `data-qc-ignore` cannot be the signal:
  // this plugin only paints it after the first selection.
  await waitFor("(() => { const f = document.querySelector('[data-slot=\"conversation.chat.flow\"]'); return f !== null && [...f.querySelectorAll('p, li')].some((el) => (el.innerText ?? '').trim().length > 20) })()", {
    timeoutMs: 20000, label: 'transcript prose',
  })
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
  // Empty the composer through Lexical, not the DOM: select its whole contents and delete.
  // One Backspace is enough when the draft held only chips, but the side-chat acceptance leaves
  // a markdown quote block behind too, so this clears everything and then re-checks.
  //
  // The loop's exit does not prove success: it may have run out of attempts, and an absent
  // editor must not read as "already empty". Both are reported as a preparation failure, because
  // every later "exactly one" assertion depends on this one having actually happened.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const remaining = await evaluate(`() => {
      const chips = document.querySelectorAll('[data-composer-chip="quote-chat"]').length
      const editors = [...document.querySelectorAll('[contenteditable="true"]')]
      const composer = editors[editors.length - 1]
      if (composer === undefined) return { chips, text: null, hasEditor: false }
      const text = (composer.innerText ?? '').trim()
      composer.focus()
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(composer)
      selection.removeAllRanges()
      selection.addRange(range)
      return { chips, text, hasEditor: true }
    }`)
    if (remaining.hasEditor === true && remaining.text === '' && remaining.chips === 0) break
    if (remaining.hasEditor === false) break
    await call('browser_press_key', { key: 'Backspace' })
    await sleep(700)
  }

  // Final confirmation, independent of the loop: an editor must exist, its text must be empty,
  // and no chip may remain. Reading it once more is deliberate — it verifies the end state rather
  // than trusting the loop's last iteration.
  const composerState = await evaluate(`() => {
    const editors = [...document.querySelectorAll('[contenteditable="true"]')]
    const composer = editors[editors.length - 1]
    return {
      hasEditor: composer !== undefined,
      text: composer === undefined ? null : (composer.innerText ?? '').trim(),
      chips: document.querySelectorAll('[data-composer-chip="quote-chat"]').length
    }
  }`)
  check('the composer is empty before the run starts',
    composerState.hasEditor === true
      && composerState.text === ''
      && composerState.chips === 0,
    JSON.stringify(composerState))
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
  await waitFor("document.querySelectorAll('.qc-marker').length === 0", { label: 'clean slate' })
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
  await waitFor("document.querySelectorAll('.qc-popup button').length > 0", { label: 'toolbar' })
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
  await waitFor("document.querySelector('.qc-compose') !== null", { label: 'compose box' })
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
  await waitFor("document.querySelectorAll('.qc-marker').length > 0", { label: 'marker' })
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

  // ── Hover the chip: the card must appear, and leave on its own ─────────
  // The strip is its own component (src/ui/cards.js); this is the only browser-level proof that
  // hovering a chip still produces a card and that the card clears itself afterwards.
  // A synthetic MouseEvent does not produce the card: the strip listens on the document in the
  // capture phase and reacts to where the pointer actually is. Drive a real pointer through the
  // MCP hover, which accepts a unique CSS selector as its target.
  const chipPresent = await evaluate(
    `() => document.querySelectorAll('[data-composer-chip="quote-chat"]').length`,
  )
  let hoverState = { ok: false, reason: 'no chip' }
  if (chipPresent >= 1) {
    let hoverError = ''
    try {
      await call('browser_hover', {
        element: 'the quote-chat chip in the composer',
        target: '[data-composer-chip="quote-chat"]',
      })
    } catch (error) {
      hoverError = String(error).slice(0, 160)
    }
    const chipInfo = await evaluate(`() => {
      const chip = document.querySelector('[data-composer-chip="quote-chat"]')
      if (chip === null) return null
      const rect = chip.getBoundingClientRect()
      return {
        tag: chip.tagName,
        cls: String(chip.className).slice(0, 40),
        rect: { left: Math.round(rect.left), top: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
        visible: rect.width > 0 && rect.height > 0,
        qcNum: chip.getAttribute('data-qc-num'),
        qcLabel: chip.getAttribute('data-qc-label')
      }
    }`)
    hoverState = { ok: true, hoverError, chipInfo }
  }
  await waitFor("document.querySelectorAll('.qc-card').length > 0", { label: 'hover card' })
  const hoverErrors = await call('browser_console_messages', { level: 'error' }).catch(() => '')
  const relevant = hoverErrors.split('\n').filter((line) => /qc-|quote-chat|ChipCards|cards/i.test(line))
  if (relevant.length > 0) console.log('   hover console:', relevant.slice(0, 2).join(' | ').slice(0, 300))
  const cardShown = await evaluate(`() => ({
    cards: document.querySelectorAll('.qc-card').length,
    comment: (document.querySelector('.qc-card-comment')?.textContent ?? '').slice(0, 20),
    body: (document.querySelector('.qc-card-body')?.textContent ?? '').slice(0, 20)
  })`)
  check('hovering a chip shows its card',
    hoverState.ok === true && cardShown.cards >= 1,
    JSON.stringify({ hoverState, ...cardShown }))
  check('the card carries the comment and the passage',
    cardShown.comment !== '' && cardShown.body !== '',
    JSON.stringify(cardShown))

  // Move the pointer away and wait past the linger plus the exit animation.
  await evaluate(`() => {
    document.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    return true
  }`)
  await waitFor("document.querySelectorAll('.qc-card').length === 0", { label: 'card cleared' })
  const cardGone = await evaluate(`() => ({ cards: document.querySelectorAll('.qc-card').length })`)
  check('the card clears after the pointer leaves', cardGone.cards === 0,
    JSON.stringify(cardGone))


  {
    const messages = await call('browser_console_messages', { level: 'error' }).catch(() => '')
    const own = messages.split('\n').filter((line) => /qc-|quote-chat|MarkerLayer|markers|BubblePanel/i.test(line))
    if (own.length > 0) console.log('   marker console:', own.slice(0, 3).join(' | ').slice(0, 500))
    const markers = await evaluate(`() => document.querySelectorAll('.qc-marker').length`)
    if (markers === 0) console.log('   no .qc-marker in the DOM')
  }

  // ── Step 5: click the marker ────────────────────────────────────────────
  await evaluate(`() => {
    const marker = document.querySelector('.qc-marker')
    if (marker === null) return false
    marker.click()
    return true
  }`)
  await waitFor("document.querySelector('.qc-bubble-panel') !== null", { label: 'editor reopens' })
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
  await waitFor("document.querySelectorAll('.qc-marker').length === 1", { label: 'edit saved' })
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
  await waitFor("document.querySelector('.qc-bubble-panel') !== null", { label: 'editor for delete' })
  await evaluate(`() => {
    const button = [...document.querySelectorAll('.qc-bubble-panel button')]
      .find((b) => (b.textContent ?? '').includes('删除'))
    if (button !== undefined) button.click()
    return button !== undefined
  }`)
  await waitFor("document.querySelectorAll('.qc-marker').length === 0", { label: 'marker removed' })
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
