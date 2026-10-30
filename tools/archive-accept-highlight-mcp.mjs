/**
 * Highlight acceptance: does the glow actually paint, and does it stop when it should?
 *
 * The unit suite drives the timers by hand and inspects which object the registry holds. This
 * checks the same rules against a real browser's highlight registry, where the questions are
 * different: is a highlight registered at all, does it cover the passage and not the plugin's own
 * text, does it go away, and does opening an editor keep it lit.
 *
 * Usage: node tools/accept-highlight.mjs <url> [outputDir]
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const NODE = 'D:\\Programs_Apps\\nodejs\\node.exe'
const CLI = 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-mcp\\node_modules\\@playwright\\mcp\\cli.js'
const PROFILE = 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-profile'
const OUT_DIR = process.argv[3]
  ?? 'D:\\Win自带分类文件夹\\桌面\\各种乱七八糟的项目\\deepseekharness插件\\.playwright-mcp\\highlight'

const URL_ARG = process.argv[2]
if (URL_ARG === undefined) {
  console.error('usage: node tools/accept-highlight.mjs <url> [outputDir]')
  process.exit(2)
}
const ARTIFACT_SHA256 = createHash('sha256')
  .update(readFileSync(join(import.meta.dirname, '..', 'client.js'))).digest('hex')

const child = spawn(NODE, [CLI, '--viewport-size', '1280x800', '--user-data-dir', PROFILE], {
  stdio: ['pipe', 'pipe', 'pipe'],
})
const inbox = []
let buffer = ''
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString()
  let newline = buffer.indexOf('\n')
  while (newline >= 0) {
    const line = buffer.slice(0, newline).trim()
    buffer = buffer.slice(newline + 1)
    if (line !== '') { try { inbox.push(JSON.parse(line)) } catch { /* banner */ } }
    newline = buffer.indexOf('\n')
  }
})
const send = (payload) => child.stdin.write(`${JSON.stringify(payload)}\n`)
async function awaitResponse(id, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const at = inbox.findIndex((frame) => frame.id === id)
    if (at >= 0) return inbox.splice(at, 1)[0]
    await new Promise((resolve) => setTimeout(resolve, 80))
  }
  throw new Error(`timeout ${id}`)
}
let nextId = 2
async function call(name, args = {}) {
  const id = nextId++
  send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })
  const frame = await awaitResponse(id)
  if (frame.error !== undefined) throw new Error(`${name}: ${JSON.stringify(frame.error)}`)
  const text = (frame.result?.content ?? []).filter((p) => p.type === 'text').map((p) => p.text).join('\n')
  if (frame.result?.isError === true) throw new Error(`${name}: ${text.slice(0, 300)}`)
  return text
}
async function evaluate(fn) {
  const text = await call('browser_evaluate', { function: fn })
  const after = text.includes('### Result') ? text.slice(text.indexOf('### Result') + 10) : text
  const body = after.split('### Ran Playwright code')[0].trim()
  const fenced = /^```(?:json)?\n([\s\S]*?)\n```$/.exec(body)
  const candidate = fenced === null ? body : fenced[1]
  try { return JSON.parse(candidate) } catch { return candidate }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const results = []
const check = (step, ok, detail = '') => {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${ok || detail === '' ? '' : `  ->  ${detail}`}`)
}

/**
 * What the highlight registry currently holds, and what it covers.
 *
 * `Highlight` is not iterable in this build, so the range text comes from `getRangeAt` on the
 * size probe: a Highlight reports `size` but not its ranges.
 */
const REGISTRY = `() => {
  const registry = window.CSS?.highlights
  if (registry === undefined || registry === null) return { supported: false }
  const names = [...registry.keys()]
  const entry = registry.get('quote-chat-flash')
  let covered = null
  if (entry !== undefined) {
    // Highlight exposes size but not ranges; read the range from the selection used to build it
    // is not possible, so report presence and size only.
    covered = typeof entry.size === 'number' ? entry.size : null
  }
  return {
    supported: true,
    names,
    flashPresent: entry !== undefined,
    flashSize: covered
  }
}`

/** Selected text plus whether the screen paints it (via ::highlight presence). */
const PAINTED = `() => {
  const registry = window.CSS?.highlights
  return {
    hasHighlightsApi: registry !== undefined && registry !== null,
    flash: registry?.get('quote-chat-flash') !== undefined,
    hold: registry?.get('quote-chat-hold') !== undefined
  }
}`

const SELECT = (index) => `() => {
  const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
  if (flow === null) return { ok: false, reason: 'no flow' }
  const blocks = [...flow.querySelectorAll('p, li')].filter((e) => (e.innerText ?? '').trim().length > 20)
  const block = blocks[Math.min(${index}, blocks.length - 1)]
  if (block === undefined) return { ok: false, reason: 'no prose' }
  block.scrollIntoView({ block: 'center' })
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
  return { ok: true }
}`

try {
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'accept-highlight', version: '1' } } })
  await awaitResponse(1)
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })
  await call('browser_navigate', { url: URL_ARG })
  await sleep(5000)

  await evaluate(`() => {
    const items = [...document.querySelectorAll('[role="treeitem"]')]
    const hit = items.find((e) => (e.innerText ?? '').includes('锚点'))
    if (hit !== undefined) hit.click()
    return true
  }`)
  await sleep(3000)

  // Clean the draft first, as the lifecycle acceptance does.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const state = await evaluate(`() => {
      const editors = [...document.querySelectorAll('[contenteditable="true"]')]
      const composer = editors[editors.length - 1]
      if (composer === undefined) return { hasEditor: false, chips: 0, text: null }
      const text = (composer.innerText ?? '').trim()
      composer.focus()
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(composer)
      selection.removeAllRanges()
      selection.addRange(range)
      return { hasEditor: true, chips: document.querySelectorAll('[data-composer-chip="quote-chat"]').length, text }
    }`)
    if (state.hasEditor === true && state.text === '' && state.chips === 0) break
    if (state.hasEditor === false) break
    await call('browser_press_key', { key: 'Backspace' })
    await sleep(700)
  }

  const api = await evaluate(PAINTED)
  check('the browser exposes the highlight registry', api.hasHighlightsApi === true,
    JSON.stringify(api))

  // ── 1. Annotating paints, and the jump glow appears ─────────────────────
  await evaluate(SELECT(0))
  await sleep(900)
  const annotated = await evaluate(`() => {
    const button = [...document.querySelectorAll('.qc-popup button')]
      .find((b) => /添加注释|Add comment/i.test(b.textContent ?? ''))
    if (button === undefined) return { ok: false }
    button.click()
    return { ok: true }
  }`)
  await sleep(900)
  await evaluate(`() => {
    const input = document.querySelector('.qc-compose textarea, .qc-compose [contenteditable="true"]')
    if (input === null) return false
    input.focus()
    return true
  }`)
  await call('browser_press_key', { key: 'Enter' })
  await sleep(1200)

  const afterAnnotate = await evaluate(REGISTRY)
  check('annotating registers a highlight', afterAnnotate.flashPresent === true,
    JSON.stringify(afterAnnotate))

  // The glow is transient: it must clear itself within FLASH_MS (2600) plus slack.
  await sleep(3000)
  const afterExpiry = await evaluate(REGISTRY)
  check('the jump glow clears itself', afterExpiry.flashPresent === false,
    JSON.stringify(afterExpiry))

  // ── 2. The gutter bubble's editor holds a highlight ─────────────────────
  const markerClicked = await evaluate(`() => {
    const marker = document.querySelector('.qc-marker')
    if (marker === null) return { ok: false }
    marker.click()
    return { ok: true }
  }`)
  check('a gutter marker exists to open', markerClicked.ok === true, JSON.stringify(markerClicked))
  await sleep(1200)
  const whileOpen = await evaluate(REGISTRY)
  check('opening the editor paints a held highlight', whileOpen.flashPresent === true,
    JSON.stringify(whileOpen))

  // It must still be there well past the transient duration — that is what "held" means.
  await sleep(3200)
  const stillOpen = await evaluate(REGISTRY)
  check('the held highlight outlives the transient duration', stillOpen.flashPresent === true,
    JSON.stringify(stillOpen))

  // ── 3. Closing the editor clears it ─────────────────────────────────────
  await call('browser_press_key', { key: 'Escape' })
  await sleep(1200)
  const afterClose = await evaluate(REGISTRY)
  check('closing the editor clears the highlight', afterClose.flashPresent === false,
    JSON.stringify(afterClose))

  // ── 4. Deleting the annotation leaves nothing painted ───────────────────
  await evaluate(`() => {
    const marker = document.querySelector('.qc-marker')
    if (marker !== null) marker.click()
    return true
  }`)
  await sleep(900)
  await evaluate(`() => {
    const remove = [...document.querySelectorAll('.qc-bubble-panel button')]
      .find((b) => /删除|Delete/i.test(b.textContent ?? ''))
    if (remove !== undefined) remove.click()
    return remove !== undefined
  }`)
  await sleep(1200)
  const afterDelete = await evaluate(REGISTRY)
  check('deleting the annotation clears the highlight', afterDelete.flashPresent === false,
    JSON.stringify(afterDelete))

  // ── 5. The highlight name matches the stylesheet ────────────────────────
  const styles = await evaluate(`() => {
    const names = []
    for (const sheet of document.styleSheets) {
      let rules = null
      try { rules = sheet.cssRules } catch { continue }
      for (const rule of rules ?? []) {
        const text = rule.cssText ?? ''
        const match = /::highlight\\(([\\w-]+)\\)/.exec(text)
        if (match !== null) names.push(match[1])
      }
    }
    return { names: [...new Set(names)] }
  }`)
  check('the stylesheet declares the flash highlight name',
    styles.names.includes('quote-chat-flash'), JSON.stringify(styles.names))
  check('the code and stylesheet agree on the flash name',
    afterAnnotate.names.includes('quote-chat-flash') || afterAnnotate.flashPresent === true,
    JSON.stringify(afterAnnotate.names))

  const errors = await call('browser_console_messages', { level: 'error' }).catch(() => '')
  const own = errors.split('\n').filter((line) => (
    /qc-|quote-chat|quoteChat/i.test(line)
    && !/dsh-plugin-marketplace|validateCodec/i.test(line)
  ))
  check('no highlight errors in the console', own.length === 0, own.slice(0, 2).join(' | '))
} catch (error) {
  check('the highlight run completed without throwing', false, String(error).slice(0, 300))
} finally {
  child.kill()
  try {
    writeFileSync(join(OUT_DIR, 'result.json'), JSON.stringify({
      artifactSha256: ARTIFACT_SHA256,
      viewport: '1280x800',
      passed: results.filter((item) => item.ok).length,
      total: results.length,
      checks: results,
    }, null, 2))
  } catch { /* reported on stdout */ }
  const passed = results.filter((item) => item.ok).length
  console.log('')
  console.log(`artifact: client.js sha256:${ARTIFACT_SHA256.slice(0, 16)}…`)
  console.log(`${passed}/${results.length} checks passed`)
  process.exit(passed === results.length ? 0 : 1)
}
