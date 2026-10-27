/**
 * Prove the plugin survives a build whose DOM lacks the web build's `data-slot` markers.
 *
 * The desktop profile has its own set of plugins, and its layout does not necessarily carry the attributes the web
 * build uses. Every lookup that depended on one specific selector would then fail, and the plugin would look broken
 * on the desktop with no error to explain it.
 *
 * This suite renders minimal DOM fixtures that imitate both shapes and asserts the fundamental lookups resolve:
 *
 *   1. the web shape, with `data-slot="conversation.chat.flow"`;
 *   2. the desktop shape, with no data-slot at all, only message rows inside a scroller;
 *   3. a shape where the flow IS the scroller;
 *   4. a shape with no flow at all, which must return null rather than throwing.
 *
 * It runs against a tiny fake DOM so it needs no browser; the point is the selector logic, not layout.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const root = new URL('./', import.meta.url)
const srcRoot = new URL('../src/', import.meta.url)

let failures = 0
let checks = 0

const check = (label, condition, detail) => {
  checks += 1
  if (condition === true) {
    console.log(`PASS  ${label}`)
  } else {
    failures += 1
    console.log(`FAIL  ${label}${detail === undefined ? '' : `  ->  ${detail}`}`)
  }
}

/* ── A minimal element: enough of the DOM API for the selectors under test. ── */

class FakeClassList {
  constructor(element) { this.element = element }
  contains(name) {
    const list = (this.element.className ?? '').split(/\s+/).filter(Boolean)
    return list.includes(name)
  }
}

class FakeElement {
  constructor(tag, attrs = {}, children = []) {
    this.tagName = tag.toUpperCase()
    this.attributes = { ...attrs }
    this.children = children
    this.parentElement = null
    this.className = attrs.class ?? ''
    this.classList = new FakeClassList(this)
    // Scroll geometry: `clientHeight` is the visible box, `scrollHeight` the full content.
    this.clientHeight = attrs.clientHeight === undefined ? 0 : attrs.clientHeight
    this.scrollHeight = attrs.scrollHeight === undefined ? 0 : attrs.scrollHeight
    this.scrollTop = 0
    this.scrollLeft = 0
    for (const child of children) child.parentElement = this
  }

  getClientRects() { return this.clientHeight > 0 || this.scrollHeight > 0 ? [{}] : [] }

  /** Attribute lookup used by `[data-x="y"]` matching during a manual scan. */
  getAttribute(name) { return this.attributes[name] ?? null }

  hasAttribute(name) { return this.attributes[name] !== undefined }

  /** Depth-first search by predicate. */
  findAll(predicate, out = []) {
    for (const child of this.children) {
      if (predicate(child) === true) out.push(child)
      child.findAll(predicate, out)
    }
    return out
  }

  contains(other) {
    for (let node = other; node !== null && node !== undefined; node = node.parentElement) {
      if (node === this) return true
    }
    return false
  }

  closest(selector) {
    // The plugin passes a selector string, exactly as the real DOM does.
    for (let node = this; node !== null && node !== undefined; node = node.parentElement) {
      if (matchesSelector(node, selector) === true) return node
    }
    return null
  }
}

/* ── Install a fake document that honours the selectors the plugin actually uses. ── */

/**
 * Parse the subset of CSS selector syntax the plugin relies on: a single compound selector with an optional attribute
 * predicate or a class. That is all `FLOW_SELECTORS`, `COMPOSER_SELECTORS` and `SIDEBAR_TAB_SELECTOR` need.
 */
function matchesSelector(element, selector) {
  // Only single-compound selectors are used, so no comma or descendant combinator handling is needed.
  const attrMatch = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector)
  if (attrMatch !== null) {
    const value = element.getAttribute(attrMatch[1])
    if (value === null) return false
    return attrMatch[2] === undefined || value === attrMatch[2]
  }
  const classMatch = /^\.([A-Za-z0-9_-]+)$/.exec(selector)
  if (classMatch !== null) return element.classList.contains(classMatch[1])
  const tagMatch = /^([a-z][a-z0-9]*)$/i.exec(selector)
  if (tagMatch !== null) return element.tagName === tagMatch[1].toUpperCase()
  return false
}

const installDocument = (root) => {
  const all = [root, ...root.findAll(() => true)]
  globalThis.document = {
    documentElement: root,
    body: root,
    querySelectorAll: (selector) => all.filter((element) => matchesSelector(element, selector)),
    querySelector: (selector) => all.find((element) => matchesSelector(element, selector)) ?? null,
  }
  globalThis.window = { innerHeight: 665, innerWidth: 1440 }
  globalThis.getComputedStyle = () => ({
    position: 'static', overflowY: 'visible', visibility: 'visible', display: 'block',
  })
}

/* ── Load the module under test once per shape, since it reads globals lazily. ── */

const load = async () => import(`${srcRoot.href}text-ranges.js?t=${Date.now()}${Math.random()}`)

/* ── Shape 1: the web build, marked with data-slot. ── */
{
  const flow = new FakeElement('div', { 'data-slot': 'conversation.chat.flow', clientHeight: 589, scrollHeight: 9000 })
  const body = new FakeElement('div', {}, [flow])
  installDocument(body)
  const module = await load()
  const found = module.findFlowElement()
  check('the web shape resolves through data-slot', found === flow,
    found === null ? 'returned null' : `returned ${found.getAttribute('data-slot')}`)
}

/* ── Shape 2: the desktop shape, no data-slot, rows carrying data-message-id inside a scroller. ── */
{
  const row1 = new FakeElement('div', { 'data-message-id': 'm1' })
  const row2 = new FakeElement('div', { 'data-message-id': 'm2' })
  const inner = new FakeElement('div', {}, [row1, row2])
  const scroller = new FakeElement('div', { class: 'scroller', clientHeight: 589, scrollHeight: 9000 }, [inner])
  const body = new FakeElement('div', {}, [scroller])
  installDocument(body)
  const module = await load()
  const found = module.findFlowElement()
  check('the desktop shape resolves through data-message-id', found !== null && found !== undefined,
    found === null || found === undefined ? 'returned null' : 'ok')
  check('and climbs to the scrolling container, not the row',
    found === scroller,
    `returned ${found === null ? 'null' : found.className || found.tagName}`)
}

/* ── Shape 3: the flow IS the scroller. ── */
{
  const flow = new FakeElement('div', { 'data-slot': 'conversation.chat.flow', clientHeight: 589, scrollHeight: 9000 })
  const body = new FakeElement('div', {}, [flow])
  installDocument(body)
  const module = await load()
  const found = module.findFlowElement()
  check('a flow that is itself the scroller is returned as-is', found === flow)
}

/* ── Shape 4: no chat at all. ── */
{
  const body = new FakeElement('div', {}, [new FakeElement('div', { class: 'empty' })])
  installDocument(body)
  const module = await load()
  const found = module.findFlowElement()
  check('no chat yields null rather than throwing', found === null, String(found))
}

/* ── The selector list itself must stay ordered specific-to-generic. ── */
{
  const source = readFileSync(new URL('text-ranges.js', srcRoot), 'utf8')
  const listMatch = /FLOW_SELECTORS = \[([\s\S]*?)\n\]/.exec(source)
  check('the flow selector list exists', listMatch !== null)
  if (listMatch !== null) {
    const entries = [...listMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
    check('it starts with the most specific marker', entries[0] === '[data-slot="conversation.chat.flow"]',
      entries[0])
    check('and includes a structural fallback that needs no marker',
      entries.some((entry) => entry.includes('data-message-id')),
      entries.join(', '))
  }
}

/* ── readableBand must not silently fall back to zero when no header is recognised. ── */
{
  const source = readFileSync(new URL('layout.js', srcRoot), 'utf8')
  check('readableBand has a container-based fallback for an unrecognised header',
    /if \(top === 0\)/.test(source) && /scrollHeight <= node\.clientHeight \+ 8/.test(source),
    'the fallback that keeps the docked panel below the chrome is missing')
  check('a pinned top bar can be recognised structurally',
    /function firstPinnedTopBar/.test(source))
}

console.log(`\n${checks - failures}/${checks} checks passed`)
if (failures > 0) process.exitCode = 1






