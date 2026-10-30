/**
 * Create a dedicated test conversation in the Web UI and ask the model for sample text.
 *
 * The acceptance loop needs transcript text to select, and a fresh session's transcript is
 * empty. Doing this from automation also keeps the live development conversation untouched:
 * a NEW session is created rather than reusing an existing one.
 *
 * Everything happens inside one MCP session on purpose. Each `pw-call.mjs` run starts its own
 * browser, so state cannot survive between runs; a single process has to do the whole
 * sequence.
 *
 * Usage:
 *   node tools/setup-test-session.mjs <url> [prompt]
 */
import { spawn } from 'node:child_process'

const NODE = process.env.QC_NODE ?? 'D:\\Programs_Apps\\nodejs\\node.exe'
const CLI = 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-mcp\\node_modules\\@playwright\\mcp\\cli.js'
const PROFILE = process.env.QC_PROFILE ?? 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-profile'

const URL_ARG = process.argv[2]
const PROMPT = process.argv[3]
  ?? '请输出三段短文，每段约四十字，主题分别是：锚点、高亮、注释。段落之间空一行。另外请给出一个三行三列的表格。'

if (URL_ARG === undefined) {
  console.error('usage: node tools/setup-test-session.mjs <url> [prompt]')
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
  throw new Error(`no response for id ${id}; stderr: ${stderrText.slice(0, 800)}`)
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
  if (frame.result?.isError === true) throw new Error(`${name} failed: ${text.slice(0, 500)}`)
  return text
}

/**
 * Evaluate JS in the page and parse the result.
 *
 * Playwright MCP wraps evaluate output as:
 *   ### Result
 *   { …json… }
 *   ### Ran Playwright code
 *   ```js …
 * The JSON block is therefore the FIRST fenced-or-bare object after `### Result`, not the
 * last code fence in the message.
 */
async function evaluate(fn) {
  const text = await call('browser_evaluate', { function: fn })
  const afterResult = text.includes('### Result')
    ? text.slice(text.indexOf('### Result') + '### Result'.length)
    : text
  const body = afterResult.split('### Ran Playwright code')[0].trim()
  // Strip a surrounding code fence when present.
  const fenced = /^```(?:json)?\n([\s\S]*?)\n```$/.exec(body)
  const candidate = fenced === null ? body : fenced[1]
  try {
    return JSON.parse(candidate)
  } catch {
    return candidate
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

try {
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'qc-setup', version: '1' },
    },
  })
  await awaitResponse(1)
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })

  await call('browser_navigate', { url: URL_ARG })
  await sleep(3500)

  // ── 1. Start a NEW session, so the live conversation is never touched ────
  const clickedNew = await evaluate(`() => {
    const button = [...document.querySelectorAll('button')]
      .find((element) => (element.innerText ?? '').includes('新会话'))
    if (button === undefined) return { ok: false }
    button.click()
    return { ok: true, label: button.innerText.trim() }
  }`)
  console.log('new session:', JSON.stringify(clickedNew))
  await sleep(2500)

  // ── 2. Focus the composer and type the prompt ───────────────────────────
  const focused = await evaluate(`() => {
    const editor = document.querySelector('[contenteditable="true"], textarea')
    if (editor === null) return { ok: false }
    editor.focus()
    return { ok: true, tag: editor.tagName, placeholder: editor.getAttribute('placeholder') ?? '' }
  }`)
  console.log('composer:', JSON.stringify(focused))

  if (focused.ok !== true) {
    console.log('RESULT: composer not found — cannot create the test session')
    process.exitCode = 1
  } else {
    // The composer is a Lexical editor: it ignores direct textContent writes because it
    // only maintains its model through real beforeinput/input events. Playwright's typed
    // input is trusted, so it drives the editor the same way a keyboard does.
    await call('browser_click', { element: 'composer editor', ref: '' }).catch(() => {})
    await call('browser_type', { text: PROMPT, submit: false }).catch(async (error) => {
      console.log('browser_type failed:', String(error).slice(0, 200))
    })
    await sleep(800)

    const typed = await evaluate(`() => {
      const editor = document.querySelector('[contenteditable="true"], textarea')
      return { length: (editor?.innerText ?? editor?.value ?? '').length }
    }`)
    console.log('typed length:', JSON.stringify(typed))

    // ── 3. Send, then wait for an answer to appear ────────────────────────
    await call('browser_press_key', { key: 'Enter' }).catch(() => {})
    await sleep(2000)

    let prose = 0
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const stats = await evaluate(`() => {
        const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
        const blocks = flow === null ? [] : [...flow.querySelectorAll('p, li, table')]
        return {
          chars: (flow === null ? '' : flow.innerText).length,
          blocks: blocks.length,
          hasTable: flow !== null && flow.querySelector('table') !== null
        }
      }`)
      prose = stats.chars ?? 0
      if (attempt % 10 === 0) console.log(`  waiting… chars=${stats.chars} blocks=${stats.blocks} table=${stats.hasTable}`)
      if (stats.hasTable === true || prose > 600) {
        console.log('answer ready:', JSON.stringify(stats))
        break
      }
      await sleep(1000)
    }

    const final = await evaluate(`() => {
      const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
      const paragraphs = flow === null ? [] : [...flow.querySelectorAll('p, li')]
        .filter((element) => (element.innerText ?? '').trim().length > 16)
      return {
        flowChars: (flow === null ? '' : flow.innerText).length,
        selectableBlocks: paragraphs.length,
        firstBlock: paragraphs.length === 0 ? '' : paragraphs[0].innerText.slice(0, 120),
        hasTable: flow !== null && flow.querySelector('table') !== null,
        sessionTitle: document.querySelector('[data-slot="conversation.session.header"]')?.innerText ?? ''
      }
    }`)
    console.log('FINAL:', JSON.stringify(final, null, 1))

    const shot = await call('browser_take_screenshot', { filename: 'qc-test-session.png' }).catch(() => '')
    console.log('screenshot result:', shot.split('\n').slice(0, 3).join(' '))
  }
} finally {
  child.kill()
}
