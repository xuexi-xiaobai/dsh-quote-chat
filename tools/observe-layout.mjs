/**
 * Layout observation: sample placement during and after the entrance animation.
 *
 * The earlier baseline recorded `dock` and `band` as null because it read a zero-size placeholder
 * slot, and it took a single sample per scenario. That was not enough to claim the "taller input"
 * and "resize" scenarios were verified, and not enough to tell a stable offset from one caught
 * mid-animation.
 *
 * This version:
 *   - finds the composer dock the way the plugin does (skipping zero-size candidates);
 *   - records the real band, the dock height, and the viewport;
 *   - samples each placement twice: immediately, then after the entrance animation has settled;
 *   - records an actual viewport resize, not just a re-read of the same geometry.
 *
 * Usage: node tools/observe-layout.mjs <url> [label]
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const NODE = 'D:\\Programs_Apps\\nodejs\\node.exe'
const CLI = 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-mcp\\node_modules\\@playwright\\mcp\\cli.js'
const PROFILE = 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-profile'
const OUT = 'D:\\Win自带分类文件夹\\桌面\\各种乱七八糟的项目\\deepseekharness插件\\.playwright-mcp'

const URL_ARG = process.argv[2]
const LABEL = process.argv[3] ?? 'observe'

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
    await new Promise((resolve) => setTimeout(resolve, 60))
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

/** Everything layout.js decides, plus the animation state of the surface. */
const MEASURE = `() => {
  const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
  const scroller = (() => {
    let node = flow === null ? null : flow.parentElement
    while (node !== null) {
      const style = getComputedStyle(node)
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4) return node
      node = node.parentElement
    }
    return null
  })()
  const dock = (() => {
    for (const selector of ['[data-slot="conversation.composer.dock"]', '[data-slot="conversation.input.dock"]', '[data-composer-root]']) {
      for (const candidate of document.querySelectorAll(selector)) {
        if (candidate.closest('[data-sidebar-right-tab]') !== null) continue
        const box = candidate.getBoundingClientRect()
        if (box.width > 0 && box.height > 0) return candidate
      }
    }
    return null
  })()
  const popup = document.querySelector('.qc-popup')
  const selection = window.getSelection()
  const selBox = selection === null || selection.rangeCount === 0 ? null : selection.getRangeAt(0).getBoundingClientRect()
  const scrollerBox = scroller === null ? null : scroller.getBoundingClientRect()
  const dockBox = dock === null ? null : dock.getBoundingClientRect()
  const popupBox = popup === null ? null : popup.getBoundingClientRect()
  const popupStyle = popup === null ? null : getComputedStyle(popup)
  const rows = flow === null ? [] : [...flow.querySelectorAll('[data-chat-node-key]')]
  const widest = rows.map((r) => r.getBoundingClientRect())
    .filter((b) => b.width > 0 && b.height > 0)
    .reduce((best, b) => (best === null || b.right > best.right ? b : best), null)
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
    scroller: scroller === null ? null : {
      top: Math.round(scrollerBox.top), bottom: Math.round(scrollerBox.bottom),
      height: Math.round(scrollerBox.height), clientWidth: scroller.clientWidth,
      scrollTop: Math.round(scroller.scrollTop),
      positioned: scroller.dataset.qcPositioned ?? null,
      positionStyle: scroller.style.position || null
    },
    dock: dockBox === null ? null : {
      top: Math.round(dockBox.top), height: Math.round(dockBox.height),
      tag: dock.tagName, slot: dock.getAttribute('data-slot')
    },
    bandFallback: dockBox === null,
    band: (scrollerBox === null) ? null : (dockBox === null ? {
      top: Math.round(Math.max(0, scrollerBox.top)),
      bottom: Math.round(Math.min(window.innerHeight, scrollerBox.bottom)),
      get height() { return this.bottom - this.top }
    } : {
      top: Math.round(Math.max(0, scrollerBox.top)),
      bottom: Math.round(Math.min(window.innerHeight, scrollerBox.bottom, dockBox.top)),
      get height() { return this.bottom - this.top }
    }),
    column: widest === null ? null : {
      left: Math.round(widest.left), right: Math.round(widest.right), width: Math.round(widest.width)
    },
    selection: selBox === null ? null : {
      top: Math.round(selBox.top), bottom: Math.round(selBox.bottom), height: Math.round(selBox.height)
    },
    popup: popupBox === null ? null : {
      top: Math.round(popupBox.top), left: Math.round(popupBox.left),
      width: Math.round(popupBox.width), height: Math.round(popupBox.height),
      transform: popupStyle.transform,
      animationName: popupStyle.animationName,
      animationRunning: popup.getAnimations().some((a) => a.playState === 'running')
    },
    offsetBelowSelection: (popupBox === null || selBox === null) ? null : Math.round(popupBox.top - selBox.bottom)
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

/**
 * Sample a placement twice: while the entrance animation may still be running, then after it has
 * certainly finished. Both samples include the animation state, so a difference can be attributed
 * rather than guessed.
 */
async function samplePlacement(index) {
  await evaluate(SELECT(index))
  // No sleep: this is the "during animation" sample. Animation state is read in the same
  // evaluation as the geometry so the two describe the same instant.
  const during = await evaluate(MEASURE)
  const motion = await evaluate(`() => {
    const popup = document.querySelector('.qc-popup')
    if (popup === null) return { present: false, running: false, count: 0 }
    const animations = popup.getAnimations()
    return {
      present: true,
      running: animations.some((a) => a.playState === 'running'),
      count: animations.length,
      transform: getComputedStyle(popup).transform
    }
  }`)
  await sleep(900)
  const settled = await evaluate(MEASURE)
  return { during, motion, settled }
}

/**
 * What this tool can and cannot establish about the 2px question.
 *
 * It records the entrance animation's state next to the geometry, so a sample that lands DURING
 * the animation is distinguishable from one that lands after. In practice every sample here came
 * back with no running animation: the popover appears on a selectionchange, and the round trip
 * through the browser reaches it after the 130ms entrance has finished. So this tool has NOT
 * exonerated the animation — it simply never observed it in flight, and the 2px spread remains
 * unattributed.
 *
 * Establishing it would need a sample taken synchronously in the same task that mounts the
 * popover, which this file does not do.
 */
const out = { label: LABEL, samples: {} }
try {
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'observe-layout', version: '1' } } })
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
  out.samples.initial = await evaluate(MEASURE)

  out.samples.popupTop = await samplePlacement(0)
  out.samples.popupBottom = await samplePlacement(99)

  // Taller composer: type four lines, then sample the popup again. The band must shrink and the
  // placement must react to the new band.
  await evaluate(`() => {
    const box = document.querySelector('[contenteditable="true"]')
    if (box === null) return false
    box.focus()
    document.execCommand('insertText', false, '第一行\\n第二行\\n第三行\\n第四行\\n第五行')
    return true
  }`)
  await sleep(900)
  out.samples.tallComposerState = await evaluate(MEASURE)
  out.samples.popupWithTallComposer = await samplePlacement(1)
  await evaluate(`() => {
    const box = document.querySelector('[contenteditable="true"]')
    if (box === null) return false
    box.focus()
    document.execCommand('selectAll')
    document.execCommand('delete')
    return true
  }`)
  await sleep(700)

  // Side panel open: narrows the prose column.
  await evaluate(SELECT(1))
  await sleep(700)
  await evaluate(`() => {
    const button = [...document.querySelectorAll('.qc-popup button')].find((b) => (b.textContent ?? '').includes('侧边聊天'))
    if (button !== undefined) button.click()
    return true
  }`)
  await sleep(2500)
  out.samples.withSidePanel = await samplePlacement(1)

  // A REAL viewport resize: the MCP browser can be resized through the page itself.
  await call('browser_resize', { width: 1100, height: 720 })
  await sleep(1500)
  out.samples.afterResize = {
    viewport: await evaluate(`() => ({ w: window.innerWidth, h: window.innerHeight })`),
    measurement: await evaluate(MEASURE)
  }
  out.samples.popupAfterResize = await samplePlacement(2)

  // Scrolled, popup reopened: the surface must travel with the content.
  await evaluate(`() => {
    const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
    let node = flow === null ? null : flow.parentElement
    let scroller = null
    while (node !== null) {
      const style = getComputedStyle(node)
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4) { scroller = node; break }
      node = node.parentElement
    }
    if (scroller !== null) scroller.scrollTop = Math.max(0, scroller.scrollTop - 250)
    return true
  }`)
  await sleep(700)
  out.samples.afterScroll = await samplePlacement(2)

  writeFileSync(`${OUT}/layout-${LABEL}.json`, JSON.stringify(out, null, 2))
  // A compact summary on stdout, so the shape is visible without opening the file.
  for (const [name, value] of Object.entries(out.samples)) {
    if (value?.settled !== undefined) {
      console.log(`${name.padEnd(24)} during=${value.during.offsetBelowSelection} settled=${value.settled.offsetBelowSelection} animated=${value.motion.running}`)
    } else {
      console.log(`${name.padEnd(24)} dock=${value?.dock?.height ?? 'null'} bandHeight=${value?.band?.height ?? 'null'} columnWidth=${value?.column?.width ?? 'null'}`)
    }
  }
} catch (error) {
  console.error('FAILED:', String(error).slice(0, 400))
} finally {
  child.kill()
}
