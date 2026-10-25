/**
 * Type into the DSH composer and send, using input that the Lexical editor actually accepts.
 *
 * The composer is a Lexical contenteditable. It ignores `textContent` writes and synthetic
 * `input` events: it maintains its own model from real `beforeinput` / `keydown` sequences.
 * So the text has to arrive as genuine keyboard input.
 *
 * Playwright's `browser_type` needs an element to type into, and this editor exposes no
 * stable accessible name. The reliable route is to focus it by clicking its centre, then
 * dispatch character events through `browser_press_key` — or, when the MCP build lacks that,
 * insert via `document.execCommand('insertText')`, which is the one DOM API Lexical honours
 * because it produces a real `beforeinput` with `inputType: insertText`.
 */
import { spawn } from 'node:child_process'

const NODE = process.env.QC_NODE ?? 'D:\\Programs_Apps\\nodejs\\node.exe'
const CLI = 'C:\\Users\\Ethan cole\\AppData\\Local\\qc-playwright-mcp\\node_modules\\@playwright\\mcp\\cli.js'
const PROFILE = process.env.QC_PROFILE ?? 'C:\\Users\\Ethan cole\\AppData\\Local\\qc-playwright-profile'

const URL_ARG = process.argv[2]
const PROMPT = process.argv[3]
  ?? '请输出三段短文，每段约四十字，主题分别是：锚点、高亮、注释。段落之间空一行。最后给出一个三行三列的表格。'

if (URL_ARG === undefined) {
  console.error('usage: node tools/send-prompt.mjs <url> [prompt]')
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

async function awaitResponse(id, timeoutMs = 120_000) {
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

try {
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'qc-send', version: '1' },
    },
  })
  await awaitResponse(1)
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })

  await call('browser_navigate', { url: URL_ARG })
  await sleep(4000)

  // ── 1. Find the composer's geometry ──────────────────────────────────────
  const box = await evaluate(`() => {
    const editor = document.querySelector('[contenteditable="true"]')
    if (editor === null) return { ok: false }
    const rect = editor.getBoundingClientRect()
    return {
      ok: true,
      x: Math.round(rect.left + Math.min(rect.width / 2, 240)),
      y: Math.round(rect.top + rect.height / 2),
      w: Math.round(rect.width),
      h: Math.round(rect.height)
    }
  }`)
  console.log('composer box:', JSON.stringify(box))
  if (box.ok !== true) throw new Error('composer not found')

  // A real click focuses it, exactly as a user would.
  await call('browser_click', { element: 'composer', ref: '' })
    .catch(async () => {
      await evaluate(`() => {
        const editor = document.querySelector('[contenteditable="true"]')
        editor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
        editor.focus()
        return true
      }`)
    })
  await sleep(400)

  // ── 2. Insert the prompt the way Lexical accepts it ─────────────────────
  const inserted = await evaluate(`() => {
    const editor = document.querySelector('[contenteditable="true"]')
    if (editor === null) return { ok: false, reason: 'no editor' }
    editor.focus()
    const selection = window.getSelection()
    if (selection !== null && selection.rangeCount === 0) {
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    const ok = document.execCommand('insertText', false, ${JSON.stringify(PROMPT)})
    return {
      ok,
      textLength: (editor.innerText ?? '').length
    }
  }`)
  console.log('insert:', JSON.stringify(inserted))
  await sleep(600)

  const typed = await evaluate(`() => {
    const editor = document.querySelector('[contenteditable="true"]')
    return { length: (editor?.innerText ?? '').length, sample: (editor?.innerText ?? '').slice(0, 40) }
  }`)
  console.log('typed:', JSON.stringify(typed))

  if (typed.length === 0) {
    console.log('RESULT: the composer rejected automated text')
    process.exitCode = 1
  } else {
    // ── 3. Send ───────────────────────────────────────────────────────────
    const sent = await evaluate(`() => {
      const buttons = [...document.querySelectorAll('button')]
        .filter((b) => (b.getAttribute('aria-label') ?? '').includes('发送')
          || (b.title ?? '').includes('发送')
          || (b.getAttribute('data-testid') ?? '').includes('send'))
      if (buttons.length > 0) {
        buttons[0].click()
        return { method: 'button', label: buttons[0].getAttribute('aria-label') ?? buttons[0].title }
      }
      return { method: 'none' }
    }`)
    console.log('send:', JSON.stringify(sent))
    if (sent.method === 'none') await call('browser_press_key', { key: 'Enter' }).catch(() => {})

    // ── 4. Wait for the answer ────────────────────────────────────────────
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const stats = await evaluate(`() => {
        const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
        return {
          chars: (flow === null ? '' : flow.innerText).length,
          hasTable: flow !== null && flow.querySelector('table') !== null
        }
      }`)
      if (attempt % 12 === 0) console.log(`  waiting… chars=${stats.chars} table=${stats.hasTable}`)
      if (stats.hasTable === true && stats.chars > 400) {
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
        hasTable: flow !== null && flow.querySelector('table') !== null
      }
    }`)
    console.log('FINAL:', JSON.stringify(final, null, 1))
    await call('browser_take_screenshot', { filename: 'qc-answer.png' }).catch(() => {})
  }
} finally {
  child.kill()
}
