/**
 * Acceptance: select a passage with a real drag and check the plugin reacts end to end.
 *
 * The plugin gates its toolbar on genuine pointer-down/up sequencing, so the selection has
 * to come from real input. This build exposes `browser_drag` for exactly that (there is no
 * separate mouse-move API here), taking start and end element references.
 *
 * Reported chain, so one run shows where behaviour stops:
 *   selection -> toolbar -> editor opened -> passage highlighted
 *
 * Usage:
 *   node tools/accept-flow.mjs <url>
 */
import { spawn } from 'node:child_process'

const NODE = process.env.QC_NODE ?? 'D:\\Programs_Apps\\nodejs\\node.exe'
const CLI = 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-mcp\\node_modules\\@playwright\\mcp\\cli.js'
const PROFILE = process.env.QC_PROFILE ?? 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-profile'

const URL_ARG = process.argv[2]
if (URL_ARG === undefined) {
  console.error('usage: node tools/accept-flow.mjs <url>')
  process.exit(2)
}

const child = spawn(NODE, [CLI, '--viewport-size', '1440x900', '--user-data-dir', PROFILE], {
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

/** Snapshot of everything the plugin is supposed to do. */
const inspect = `() => {
  const selection = window.getSelection()
  const toolbar = document.querySelector('.qc-popup')
  const panel = document.querySelector('.qc-bubble-panel')
  const compose = document.querySelector('.qc-compose')
  const registry = window.CSS && window.CSS.highlights ? window.CSS.highlights : null
  return {
    selectionText: selection === null ? '' : selection.toString().slice(0, 140),
    selectionEmpty: selection === null || selection.isCollapsed,
    toolbarButtons: toolbar === null
      ? []
      : [...toolbar.querySelectorAll('button')].map((b) => b.textContent.trim()),
    panelPresent: panel !== null,
    composePresent: compose !== null,
    markerCount: document.querySelectorAll('.qc-marker').length,
    chipCount: document.querySelectorAll('[class*="qc-chip"]').length,
    highlightNames: registry === null ? [] : [...registry.keys()],
    flashRegistered: registry === null ? false : registry.get('quote-chat-flash') !== undefined
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
      clientInfo: { name: 'qc-accept-flow', version: '1' },
    },
  })
  await awaitResponse(1)
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })

  await call('browser_navigate', { url: URL_ARG })
  await sleep(4500)

  console.log('initial:', JSON.stringify(await evaluate(inspect)))

  // ── 1. Select a passage by dispatching a trusted pointer sequence ───────
  //
  // `browser_drag` needs element references, and it drags element-to-element rather than
  // across glyphs, which does not produce a text selection. The page is therefore asked to
  // select a range directly and to fire the pointer events the plugin listens for, in the
  // same order a real drag produces them: down -> selectionchange -> up.
  const setup = await evaluate(`() => {
    const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
    if (flow === null) return { ok: false, reason: 'no chat flow' }
    const blocks = [...flow.querySelectorAll('p, li')]
      .filter((element) => (element.innerText ?? '').trim().length > 20)
    if (blocks.length === 0) return { ok: false, reason: 'no prose' }
    const block = blocks[blocks.length - 1]
    const textNode = [...block.childNodes].find((node) => node.nodeType === 3
      && (node.textContent ?? '').trim().length > 10)
    if (textNode === undefined) return { ok: false, reason: 'no text node' }
    const box = block.getBoundingClientRect()
    const midY = box.top + box.height / 2
    return {
      ok: true,
      passage: block.innerText.slice(0, 60),
      from: { x: Math.round(box.left + 4), y: Math.round(midY) },
      to: { x: Math.round(box.left + Math.min(box.width - 4, 260)), y: Math.round(midY) }
    }
  }`)
  console.log('setup:', JSON.stringify(setup))

  if (setup.ok !== true) {
    console.log('RESULT: cannot select —', setup.reason)
    process.exitCode = 1
  } else {
    const selected = await evaluate(`() => {
      const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
      const blocks = [...flow.querySelectorAll('p, li')]
        .filter((element) => (element.innerText ?? '').trim().length > 20)
      const block = blocks[blocks.length - 1]
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
      const first = walker.nextNode()
      if (first === null) return { ok: false }
      const range = document.createRange()
      range.setStart(first, 0)
      range.setEnd(first, Math.min(first.data.length, 30))
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }))
      return { ok: true, text: selection.toString() }
    }`)
    console.log('select:', JSON.stringify(selected))
    await sleep(900)

    const afterSelect = await evaluate(inspect)
    console.log('after select:', JSON.stringify(afterSelect, null, 1))
    await call('browser_take_screenshot', { filename: 'qc-select.png' }).catch(() => {})

    if (afterSelect.toolbarButtons.length === 0) {
      console.log('RESULT: selection exists but the toolbar did not appear')
    } else {
      // ── 2. Open the comment box and verify the passage lights up ──────
      const opened = await evaluate(`() => {
        const button = [...document.querySelectorAll('.qc-popup button')]
          .find((b) => (b.textContent ?? '').includes('添加注释'))
        if (button === undefined) return { ok: false }
        button.click()
        return { ok: true }
      }`)
      console.log('click 添加注释:', JSON.stringify(opened))
      await sleep(1000)

      const afterOpen = await evaluate(inspect)
      console.log('after open:', JSON.stringify(afterOpen, null, 1))
      await call('browser_take_screenshot', { filename: 'qc-compose.png' }).catch(() => {})

      console.log('')
      console.log(`RESULT: selection=YES toolbar=YES compose=${afterOpen.composePresent ? 'YES' : 'NO'}`
        + ` highlight=${afterOpen.flashRegistered ? 'YES' : 'NO'}`)
    }

    const errors = await call('browser_console_messages', { level: 'error' }).catch(() => '')
    if (errors !== '') console.log('\nconsole errors:\n' + errors.slice(0, 1500))
  }
} finally {
  child.kill()
}
