/**
 * Range highlights: scope, identity, and timing.
 *
 * Two things are asserted here, and the second is the reason this suite exists.
 *
 * **Scope.** The comment panel is a child of the annotated paragraph, so it sits inside the very
 * subtree a highlight range spans, and the registry paints every character a range covers. A
 * range that reaches a plugin-owned node must be rebuilt over prose alone.
 *
 * **Identity.** Every deferred callback checks that the registry still holds its own highlight
 * object before acting. Without that guard a replaced highlight's stale range comes back, and an
 * old flash's expiry deletes the highlight a hold just installed. Asserting only that "a
 * highlight eventually appears" would pass with every one of those bugs present, so each case
 * below drives the timers by hand and inspects which object the registry ended up holding.
 *
 * The real functions are imported, not extracted from source: this suite used to slice function
 * bodies out of the bundle and rebuild their dependencies by hand, which meant it could pass
 * while the shipped wiring differed.
 *
 * Run: node test/highlight-scope.mjs
 */
import { createHighlighter, canPaintHighlight, paintSafeRange, FLASH_HIGHLIGHT, FLASH_MS }
  from '../src/highlight.js'

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

// ── A tiny DOM, just enough for the walkers involved ──────────────────────
class TextNode {
  constructor(data) {
    this.nodeType = 3
    this.data = data
    this.textContent = data
    this.parentElement = null
    this.childNodes = []
  }
  get parentNode() { return this.parentElement }
}

class Element {
  constructor(tag = 'div', attrs = {}) {
    this.nodeType = 1
    this.tagName = tag.toUpperCase()
    this.childNodes = []
    this.attributes = { ...attrs }
    this.parentElement = null
  }
  get parentNode() { return this.parentElement }
  get children() { return this.childNodes.filter((node) => node.nodeType === 1) }
  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this
      this.childNodes.push(node)
    }
    return this
  }
  get textContent() { return this.childNodes.map((node) => node.textContent).join('') }
  getAttribute(name) { return this.attributes[name] ?? null }
  setAttribute(name, value) { this.attributes[name] = value }
  matches(selector) {
    const attr = /^\[([\w-]+)\]$/.exec(selector)
    if (attr !== null) return this.attributes[attr[1]] !== undefined
    const attrValue = /^\[([\w-]+)="([^"]*)"\]$/.exec(selector)
    if (attrValue !== null) return this.attributes[attrValue[1]] === attrValue[2]
    return this.tagName === selector.toUpperCase()
  }
  closest(selector) {
    // `p, li, h1, …` arrives as one selector list.
    const parts = selector.split(',').map((part) => part.trim())
    let node = this
    while (node !== null) {
      if (parts.some((part) => node.matches(part))) return node
      node = node.parentElement
    }
    return null
  }
  querySelectorAll(selector) {
    const parts = selector.split(',').map((part) => part.trim())
    const out = []
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue
        if (parts.some((part) => child.matches(part))) out.push(child)
        walk(child)
      }
    }
    walk(this)
    return out
  }
  *[Symbol.iterator]() { yield* this.childNodes }
}

/** A `Range` over this DOM: enough of the API for paintSafeRange. */
class Range {
  constructor(rangeDocument) {
    this.rangeDocument = rangeDocument
    this.startContainer = null
    this.startOffset = 0
    this.endContainer = null
    this.endOffset = 0
  }
  setStart(node, offset) { this.startContainer = node; this.startOffset = offset }
  setEnd(node, offset) { this.endContainer = node; this.endOffset = offset }
  /** The text the range covers, for assertions. */
  get covered() {
    const nodes = []
    const walk = (node) => {
      if (node.nodeType === 3) { nodes.push(node); return }
      for (const child of node.childNodes) walk(child)
    }
    walk(this.rangeDocument.root)
    const first = nodes.indexOf(this.startContainer)
    const last = nodes.indexOf(this.endContainer)
    if (first < 0 || last < 0) return ''
    let text = ''
    for (let index = first; index <= last; index += 1) {
      const node = nodes[index]
      const from = index === first ? this.startOffset : 0
      const to = index === last ? this.endOffset : node.data.length
      text += node.data.slice(from, to)
    }
    return text
  }
}

/** A document stand-in exposing createRange, createTreeWalker and the root. */
function makeDocument(root) {
  return {
    root,
    createRange: () => new Range({ root }),
    createTreeWalker(node) {
      const texts = []
      const walk = (current) => {
        for (const child of current.childNodes) {
          if (child.nodeType === 3) { texts.push(child); continue }
          walk(child)
        }
      }
      walk(node)
      let index = -1
      return { nextNode() { index += 1; return index < texts.length ? texts[index] : null } }
    },
  }
}

/** The scenario: prose + bubble + comment panel, all inside one paragraph. */
function buildParagraph() {
  const prose1 = new TextNode('气泡现在对齐到段落顶部。')
  const bubble = new Element('button', { 'data-qc-ignore': '1', 'data-qc-number': '1' })
  const prose2 = new TextNode('如果注释内容是从段落中间开始的，气泡会比那段文字高一点。')
  const panel = new Element('div', { 'data-qc-ignore': '1' })
  panel.append(
    new Element('div').append(new TextNode('评价')),
    new Element('textarea').append(new TextNode('补充这条注释的说明...')),
    new Element('button').append(new TextNode('删除')),
    new Element('button').append(new TextNode('保存')),
  )
  const paragraph = new Element('p')
  paragraph.append(prose1, bubble, prose2, panel)
  const row = new Element('div', { 'data-chat-node-key': 'row-1' })
  row.append(paragraph)
  return { row, paragraph, prose1, prose2, bubble, panel }
}

// ── Install a controllable clock and a highlight registry ─────────────────
/**
 * Replace the globals the highlighter reads, for one test.
 *
 * The clock is a queue of pending timers rather than a real one: a case then decides exactly
 * when each deferred callback fires, which is the only way to test an ordering between them.
 *
 * @param root - the document root for range construction.
 * @param run - the body.
 * @returns whatever `run` returns.
 */
function withEnvironment(root, run) {
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    Highlight: globalThis.Highlight,
    setTimeout: globalThis.setTimeout,
    Date: globalThis.Date,
    NodeFilter: globalThis.NodeFilter,
  }

  const fakeDocument = makeDocument(root)
  /** name -> Highlight stand-in. */
  const registry = new Map()
  /** Pending timers: `{ at, fn }`, ordered by insertion. */
  const timers = []
  let clock = 0
  let nextTimerId = 1

  class FakeHighlight {
    constructor(range) {
      this.range = range
      this.id = `h${nextTimerId++}`
    }
    get covered() { return this.range.covered }
  }

  globalThis.document = fakeDocument
  globalThis.NodeFilter = { SHOW_TEXT: 4 }
  globalThis.Highlight = FakeHighlight
  globalThis.window = {
    CSS: { highlights: registry },
    Highlight: FakeHighlight,
  }
  let timerId = 1
  globalThis.setTimeout = (fn, delay = 0) => {
    const id = timerId++
    timers.push({ id, at: clock + delay, fn })
    return id
  }
  // A controllable Date.now: `advance` moves both the clock and fires due timers.
  const RealDate = previous.Date
  globalThis.Date = class extends RealDate {
    static now() { return clock }
  }

  const environment = {
    registry,
    fakeDocument,
    get clock() { return clock },
    /** Move the clock forward, firing every timer that is now due, in order. */
    advance(by) {
      const target = clock + by
      for (;;) {
        const due = timers.filter((timer) => timer.at <= target).sort((a, b) => a.at - b.at)[0]
        if (due === undefined) break
        timers.splice(timers.indexOf(due), 1)
        clock = Math.max(clock, due.at)
        due.fn()
      }
      clock = target
    },
    /** Fire every pending timer, regardless of its deadline. */
    flush() {
      while (timers.length > 0) environment.advance(Math.max(0, ...timers.map((t) => t.at - clock)))
    },
    /** How many timers are still pending. */
    get pending() { return timers.length },
    /** What the registry currently holds. */
    get current() { return registry.get(FLASH_HIGHLIGHT) ?? null },
  }

  try {
    return run(environment)
  } finally {
    globalThis.document = previous.document
    globalThis.window = previous.window
    globalThis.Highlight = previous.Highlight
    globalThis.setTimeout = previous.setTimeout
    globalThis.Date = previous.Date
    globalThis.NodeFilter = previous.NodeFilter
  }
}

/** A range over the plain prose of a paragraph. */
function proseRange(document, parts) {
  const range = document.createRange()
  range.setStart(parts.prose1, 0)
  range.setEnd(parts.prose2, parts.prose2.data.length)
  return range
}

// ── 1. Scope: plugin chrome is excluded ───────────────────────────────────
{
  const parts = buildParagraph()
  withEnvironment(parts.row, (environment) => {
    const range = proseRange(environment.fakeDocument, parts)
    const safe = paintSafeRange(range)
    const expected = parts.prose1.data + parts.prose2.data
    check('a clean prose range keeps its exact coverage',
      safe.covered === expected, JSON.stringify(safe.covered))
    check('a clean prose range is returned untouched', safe === range,
      'the range was rebuilt when it did not need to be')
  })
}

{
  // The reported bug: a selection that ends inside the bubble's own text, which is exactly how a
  // user drags across the marker. The end container is a TEXT node inside data-qc-ignore.
  const parts = buildParagraph()
  withEnvironment(parts.row, (environment) => {
    const range = environment.fakeDocument.createRange()
    range.setStart(parts.prose1, 0)
    // The bubble holds an ordinal text node, like the real marker does.
    parts.bubble.append(new TextNode('1'))
    const bubbleText = parts.bubble.childNodes[0]
    range.setEnd(bubbleText, 1)
    const safe = paintSafeRange(range)
    check('a range ending past the prose drops the panel text',
      !safe.covered.includes('评价') && !safe.covered.includes('删除'),
      JSON.stringify(safe.covered))
    // The range stops at the last prose node BEFORE the chrome it ended in. prose2 sits after
    // the bubble, so it is excluded — that is the shipped rule, and it is what keeps a selection
    // dragged onto the marker from sweeping up everything that follows it.
    check('the sanitised range keeps the prose before the marker',
      safe.covered.includes(parts.prose1.data), JSON.stringify(safe.covered.slice(0, 40)))
    check('the sanitised range stops before the following prose',
      !safe.covered.includes(parts.prose2.data), JSON.stringify(safe.covered.slice(0, 40)))
    check('the sanitised range drops the bubble ordinal',
      !safe.covered.includes('1'), JSON.stringify(safe.covered))
  })
}

{
  // A range starting inside the panel begins at the first prose node instead.
  const parts = buildParagraph()
  withEnvironment(parts.row, (environment) => {
    const panelText = parts.panel.childNodes[1].childNodes[0]
    const range = environment.fakeDocument.createRange()
    range.setStart(panelText, 2)
    range.setEnd(parts.prose2, 4)
    const safe = paintSafeRange(range)
    check('a range starting in chrome begins at the prose',
      !safe.covered.includes('评价'), JSON.stringify(safe.covered))
  })
}

// ── 2. Identity: a replaced highlight is not touched by the old timer ─────
{
  const first = buildParagraph()
  const second = buildParagraph()
  withEnvironment(first.row, (environment) => {
    const highlighter = createHighlighter()
    highlighter.flash(proseRange(environment.fakeDocument, first), 1000)
    const firstHighlight = environment.current
    check('a flash installs a highlight', firstHighlight !== null,
      'nothing was painted')
    check('the registry name matches the stylesheet',
      FLASH_HIGHLIGHT === 'quote-chat-flash', FLASH_HIGHLIGHT)

    // A second flash replaces the first under the same name.
    environment.advance(10)
    highlighter.flash(proseRange(environment.fakeDocument, second), 1000)
    const secondHighlight = environment.current
    check('a second flash replaces the first', secondHighlight !== firstHighlight,
      'the registry still holds the first highlight')

    // Advance past the FIRST deadline (t=1000) but not the second (t=1010). Landing exactly on
    // 1010 would expire the second flash on its own schedule and prove nothing.
    environment.advance(995)
    check('the first flash\'s expiry does not clear the second',
      environment.current === secondHighlight, String(environment.current?.id))
  })
}

{
  // The same guard on the re-resolve path: a replaced highlight's stale range must not come back.
  const first = buildParagraph()
  const second = buildParagraph()
  withEnvironment(first.row, (environment) => {
    const highlighter = createHighlighter()
    let firstResolveCalls = 0
    highlighter.flash(
      proseRange(environment.fakeDocument, first),
      5000,
      () => { firstResolveCalls += 1; return proseRange(environment.fakeDocument, first) },
    )
    const firstHighlight = environment.current
    environment.advance(10)
    highlighter.flash(proseRange(environment.fakeDocument, second), 5000)
    const secondHighlight = environment.current

    // The first flash's re-resolve is due at 90ms. It must not run at all once replaced.
    environment.advance(90)
    check('a replaced flash never re-resolves', firstResolveCalls === 0,
      `resolve ran ${firstResolveCalls} times`)
    check('the replacement is still painted', environment.current === secondHighlight,
      String(environment.current?.id))
    check('the replaced highlight is gone from the registry',
      environment.current !== firstHighlight, 'the stale highlight came back')
  })
}

// ── 3. Clearing cancels the pending re-resolve ───────────────────────────
{
  const parts = buildParagraph()
  withEnvironment(parts.row, (environment) => {
    const highlighter = createHighlighter()
    let resolveCalls = 0
    highlighter.flash(proseRange(environment.fakeDocument, parts), 5000,
      () => { resolveCalls += 1; return proseRange(environment.fakeDocument, parts) })
    check('the flash is painted before clearing', environment.current !== null)

    highlighter.clear()
    check('clearing removes the highlight', environment.current === null,
      String(environment.current?.id))

    environment.advance(200)
    check('a cleared flash does not repaint', environment.current === null,
      'the pending re-resolve painted again')
    check('a cleared flash does not re-resolve', resolveCalls === 0,
      `resolve ran ${resolveCalls} times`)
  })
}

// ── 4. A hold survives an older flash's timer ────────────────────────────
{
  const parts = buildParagraph()
  withEnvironment(parts.row, (environment) => {
    const highlighter = createHighlighter()
    highlighter.flash(proseRange(environment.fakeDocument, parts), 1000)
    environment.advance(100)
    // The editor opens: a hold takes over the registry entry.
    highlighter.hold(proseRange(environment.fakeDocument, parts))
    const heldHighlight = environment.current

    environment.advance(1000)
    check('a hold is not cleared by an older flash\'s expiry',
      environment.current === heldHighlight, String(environment.current?.id))
    check('the hold is still painted after the flash would have expired',
      environment.current !== null, 'the passage went dark')
  })
}

{
  // And the hold's own re-resolve respects a later replacement.
  const parts = buildParagraph()
  withEnvironment(parts.row, (environment) => {
    const highlighter = createHighlighter()
    let holdResolveCalls = 0
    highlighter.hold(proseRange(environment.fakeDocument, parts),
      () => { holdResolveCalls += 1; return proseRange(environment.fakeDocument, parts) })
    environment.advance(10)
    highlighter.flash(proseRange(environment.fakeDocument, parts), 1000)
    const flashHighlight = environment.current
    environment.advance(90)
    check('a hold replaced by a flash does not re-resolve', holdResolveCalls === 0,
      `resolve ran ${holdResolveCalls} times`)
    check('the flash is what remains', environment.current === flashHighlight,
      String(environment.current?.id))
  })
}

// ── 5. Timing: the deadline does not restart on re-resolve ───────────────
{
  const parts = buildParagraph()
  withEnvironment(parts.row, (environment) => {
    const highlighter = createHighlighter()
    let resolveCalls = 0
    highlighter.flash(proseRange(environment.fakeDocument, parts), 1000,
      () => { resolveCalls += 1; return proseRange(environment.fakeDocument, parts) })

    // Re-resolve fires at 90ms.
    environment.advance(90)
    check('the re-resolve runs at 90ms', resolveCalls === 1, String(resolveCalls))
    check('the re-resolve keeps a highlight painted', environment.current !== null,
      'the re-resolve cleared the highlight')

    // Expiry must still be measured from paint time, so 1000ms total clears it. If the deadline
    // restarted at the re-resolve, the highlight would still be up at 910ms past the resolve.
    environment.advance(910)
    check('the highlight expires 1000ms after it was painted', environment.current === null,
      'the deadline restarted after the re-resolve')
  })
}

{
  // A re-resolve that returns null keeps the original range rather than clearing.
  const parts = buildParagraph()
  withEnvironment(parts.row, (environment) => {
    const highlighter = createHighlighter()
    highlighter.flash(proseRange(environment.fakeDocument, parts), 5000, () => null)
    const before = environment.current
    environment.advance(90)
    check('a failed re-resolve keeps the original highlight',
      environment.current === before, 'the highlight was replaced or dropped')
    environment.advance(5000)
    check('a failed re-resolve still expires on time', environment.current === null,
      'the highlight outlived its deadline')
  })
}

// ── 6. Capability detection ──────────────────────────────────────────────
{
  const parts = buildParagraph()
  withEnvironment(parts.row, (environment) => {
    check('capability is detected with a registry present', canPaintHighlight() === true,
      'a supported environment reported no support')
    const highlighter = createHighlighter()
    highlighter.flash(proseRange(environment.fakeDocument, parts), 1000)
    check('a supported environment paints', environment.current !== null)
  })
}

{
  // No registry: every operation must be a silent no-op, not a throw.
  const parts = buildParagraph()
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  globalThis.document = makeDocument(parts.row)
  globalThis.window = {}
  globalThis.NodeFilter = { SHOW_TEXT: 4 }
  try {
    check('capability is false without a registry', canPaintHighlight() === false,
      'an unsupported environment reported support')
    const highlighter = createHighlighter()
    let threw = null
    try {
      highlighter.flash(proseRange(globalThis.document, parts), 1000)
      highlighter.hold(proseRange(globalThis.document, parts))
      highlighter.clear()
    } catch (error) {
      threw = error
    }
    check('unsupported operation is a silent no-op', threw === null, String(threw))
  } finally {
    globalThis.window = previousWindow
    globalThis.document = previousDocument
    globalThis.NodeFilter = undefined
  }
}

{
  // paintSafeRange itself never throws, even on a range it cannot reason about.
  const parts = buildParagraph()
  withEnvironment(parts.row, (environment) => {
    const broken = { startContainer: null, endContainer: null, startOffset: 0, endOffset: 0 }
    let threw = null
    let result = null
    try {
      result = paintSafeRange(broken)
    } catch (error) {
      threw = error
    }
    check('paintSafeRange tolerates a malformed range', threw === null && result === broken,
      String(threw))
  })
}

// ── 7. Default duration ──────────────────────────────────────────────────
{
  const parts = buildParagraph()
  withEnvironment(parts.row, (environment) => {
    const highlighter = createHighlighter()
    highlighter.flash(proseRange(environment.fakeDocument, parts))
    environment.advance(FLASH_MS - 1)
    check('the default duration keeps the highlight at FLASH_MS - 1',
      environment.current !== null, 'it expired early')
    environment.advance(2)
    check('the default duration expires at FLASH_MS', environment.current === null,
      'it outlived FLASH_MS')
    check('the default duration is 2600ms', FLASH_MS === 2600, String(FLASH_MS))
  })
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
