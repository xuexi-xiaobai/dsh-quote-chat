/**
 * Prove the fluorescent highlight never covers plugin chrome.
 *
 * The comment panel is a child of the annotated paragraph, so it sits inside the very
 * subtree the highlight range spans. CSS.highlights paints every character a range
 * covers, including the panel's own label and buttons - the marker appearing over the
 * editor was reported twice, and both times the cause was an offset calculation that
 * counted the panel's text as prose.
 *
 * This builds a minimal DOM with the same shape: a paragraph containing prose, a
 * gutter bubble and the comment panel, all under a data-chat-node-key row. It then
 * runs the REAL rangeAt / paintSafeRange / locateText logic by loading those functions
 * out of client.js, and asserts that the resulting range contains only prose.
 *
 * Run: node test/highlight-scope.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'client.js'), 'utf8')

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

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
  cloneNode() { return new TextNode(this.data) }
}

class Element {
  constructor(tag = 'div', attrs = {}) {
    this.nodeType = 1
    this.tagName = tag.toUpperCase()
    this.childNodes = []
    this.attributes = { ...attrs }
    this.dataset = {}
    this.parentElement = null
  }
  get parentNode() { return this.parentElement }
  get textContent() {
    return this.childNodes.map((node) => (node.nodeType === 3 ? node.data : node.textContent)).join('')
  }
  append(...children) {
    for (const child of children) {
      child.parentElement = this
      this.childNodes.push(child)
    }
    return this
  }
  getAttribute(name) { return this.attributes[name] ?? null }
  hasAttribute(name) { return name in this.attributes }
  setAttribute(name, value) { this.attributes[name] = value }
  get isConnected() { return true }
  getClientRects() { return [{ width: 100, height: 20, left: 0, top: 0, right: 100, bottom: 20 }] }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 500, bottom: 20, width: 500, height: 20 }
  }
  closest(selector) {
    const want = selector.replace(/^\[|\]$/g, '')
    let node = this
    while (node !== null && node !== undefined) {
      if (node.nodeType === 1 && (node.hasAttribute(want) || node.tagName === want.toUpperCase())) {
        return node
      }
      node = node.parentElement
    }
    return null
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null }
  querySelectorAll(selector) {
    const want = selector.replace(/^\[|\]$/g, '')
    const found = []
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue
        if (child.hasAttribute(want) || child.tagName === want.toUpperCase()) found.push(child)
        walk(child)
      }
    }
    walk(this)
    return found
  }
  /** All descendant text nodes, in document order. */
  textNodes() {
    const found = []
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) found.push(child)
        else walk(child)
      }
    }
    walk(this)
    return found
  }
  cloneNode(deep) {
    const copy = new Element(this.tagName.toLowerCase(), { ...this.attributes })
    copy.dataset = { ...this.dataset }
    if (deep) for (const child of this.childNodes) copy.append(child.cloneNode(true))
    return copy
  }
  remove() {
    const parent = this.parentElement
    if (parent === null) return
    const at = parent.childNodes.indexOf(this)
    if (at >= 0) parent.childNodes.splice(at, 1)
    this.parentElement = null
  }
}

function makeDocument() {
  const doc = {
    createTreeWalker(root, _what) {
      const nodes = root.textNodes()
      let index = -1
      return {
        nextNode() {
          index += 1
          return index < nodes.length ? nodes[index] : null
        },
      }
    },
    createRange() {
      const range = {
        startContainer: null, startOffset: 0, endContainer: null, endOffset: 0,
        setStart(node, offset) { this.startContainer = node; this.startOffset = offset },
        setEnd(node, offset) { this.endContainer = node; this.endOffset = offset },
        /**
         * Mirror Range.comparePoint: -1 when the point precedes the range,
         * 0 when inside it, 1 when after it.
         */
        comparePoint(node, offset) {
          const root = (() => {
            let walk = this.startContainer
            while (walk.parentElement !== null) walk = walk.parentElement
            return walk
          })()
          const all = root.textNodes()
          const at = all.indexOf(node)
          const startAt = all.indexOf(this.startContainer)
          const endAt = all.indexOf(this.endContainer)
          if (at < 0 || startAt < 0 || endAt < 0) return 0
          if (at < startAt) return -1
          if (at > endAt) return 1
          if (at === startAt && offset < this.startOffset) return -1
          if (at === endAt && offset > this.endOffset) return 1
          return 0
        },
        /** The text the range covers, walking text nodes in document order. */
        toString() {
          const root = (() => {
            let node = this.startContainer
            while (node.parentElement !== null) node = node.parentElement
            return node
          })()
          const all = root.textNodes()
          const startAt = all.indexOf(this.startContainer)
          const endAt = all.indexOf(this.endContainer)
          if (startAt < 0 || endAt < 0) return ''
          let out = ''
          for (let index = startAt; index <= endAt; index += 1) {
            const text = all[index].data
            const from = index === startAt ? this.startOffset : 0
            const to = index === endAt ? this.endOffset : text.length
            out += text.slice(from, to)
          }
          return out
        },
      }
      return range
    },
  }
  return doc
}

/**
 * Extract one top-level `function name(...) { ... }` body from client.js so the test
 * exercises the shipped implementation rather than a copy of it.
 */
function bodyOf(name) {
  const at = source.indexOf(`    function ${name}(`)
  if (at < 0) throw new Error(`function ${name} not found`)
  let depth = 0
  let opened = false
  for (let index = at; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') { depth += 1; opened = true }
    else if (char === '}') {
      depth -= 1
      if (opened && depth === 0) return source.slice(at, index + 1)
    }
  }
  throw new Error(`function ${name} is unterminated`)
}

// Helpers the extracted functions need, also taken from the real file where they are
// small enough to be worth reusing verbatim.
const BLOCK_SELECTOR = /const BLOCK_SELECTOR = '([^']*)'/.exec(source)?.[1] ?? 'p'
const EXTRA_SPACE = /const EXTRA_SPACE = '([^']*)'/.exec(source)?.[1] ?? ''
const ZERO_WIDTH = /const ZERO_WIDTH = '([^']*)'/.exec(source)?.[1] ?? ''

function buildScope(document) {
  const scope = {
    document,
    NodeFilter: { SHOW_TEXT: 4 },
    BLOCK_SELECTOR,
    EXTRA_SPACE,
    ZERO_WIDTH,
    elementOf: (node) => (node === null || node === undefined
      ? null
      : (node.nodeType === 1 ? node : node.parentElement)),
    squishText: (text) => String(text).replace(/\s+/g, ' ').trim(),
    sameText: (left, right) => String(left).replace(/\s+/g, ' ').trim()
      === String(right).replace(/\s+/g, ' ').trim(),
    textOf: (host) => {
      if (host === null || host === undefined) return ''
      const ignored = host.querySelectorAll('[data-qc-ignore]')
      if (ignored.length === 0) return host.textContent ?? ''
      const copy = host.cloneNode(true)
      for (const node of copy.querySelectorAll('[data-qc-ignore]')) node.remove()
      return copy.textContent ?? ''
    },
  }
  const names = ['rangeAt', 'paintSafeRange', 'locateText']
  const factory = new Function(
    'scope',
    `with (scope) {
       ${names.map((name) => bodyOf(name).replace('} catch {\n        return range\n      }', '} catch (error) {\n        scope.__lastError = error\n        return range\n      }')).join('\n')}
       return { ${names.join(', ')} }
     }`,
  )
  return { ...scope, ...factory(scope) }
}

// ── Build the scenario: prose + bubble + comment panel, all in one paragraph ──
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

const document = makeDocument()
const scope = buildScope(document)

// ── 1. rangeAt must not count plugin text ────────────────────────────────
{
  const { row, paragraph, prose1, prose2 } = buildParagraph()
  // Quote exactly the prose, which is what a real annotation stores.
  const quote = prose1.data + prose2.data
  const range = scope.rangeAt(row, 0, quote.length)
  check('rangeAt builds a range at all', range !== null, 'returned null')
  const covered = range === null ? '' : range.toString()
  check('the range covers exactly the annotated prose',
    covered === quote,
    `covered ${JSON.stringify(covered.slice(0, 60))}, expected the prose only`)
  check('the range does not start or end inside the panel',
    range !== null
      && range.startContainer.parentElement?.closest('[data-qc-ignore]') == null
      && range.endContainer.parentElement?.closest('[data-qc-ignore]') == null,
    'an endpoint sits inside plugin chrome')
  check('the paragraph really does contain plugin chrome',
    paragraph.querySelectorAll('[data-qc-ignore]').length === 2,
    'the fixture is not exercising the interesting case')
}

// ── 2. paintSafeRange must not extend a clean range ─────────────────────
{
  const { row, prose1 } = buildParagraph()
  const range = scope.rangeAt(row, 0, prose1.data.length)
  const safe = scope.paintSafeRange(range)
  check('a clean range is returned unchanged',
    safe === range,
    'a range ending on prose was rebuilt, which can only widen it')
}

// ── 3. The panel must sit OUTSIDE the annotated paragraph ───────────────
// This is the structural guarantee. Filtering the range could never be enough:
// CSS.highlights paints every text node a range covers, and a range that ends at the
// paragraph's end covers everything mounted inside it. Only being a sibling of the
// paragraph puts the panel outside the range.
{
  const mountLine = /\}\),\s*(mount|row \?\? document\.body)\)/.exec(source)
  check('the comment panel mounts to a sibling of the paragraph',
    mountLine !== null && mountLine[1] === 'mount',
    'the panel is mounted inside the paragraph, inside the highlight range')
}

// ── 3b. Every highlight paint site sanitises its range ───────────────────
// The first fix only covered the two immediate paints; the delayed re-resolve paths
// kept using the raw range, so the marker still landed on the panel a second time.
{
  const sites = [...source.matchAll(/new Highlight\(([^)]*)\)/g)].map((m) => m[1])
  check('every highlight is built from a sanitised range',
    sites.length > 0 && sites.every((arg) => arg.includes('paintSafeRange')),
    'a highlight is built from a raw range: ' + JSON.stringify(sites))
  check('the delayed re-resolve paths are covered too',
    !/new Highlight\(live\)/.test(source),
    'a re-resolved range bypasses sanitisation')
}

// ── 4. locateText ignores chrome ────────────────────────────────────────
{
  const { paragraph, prose1 } = buildParagraph()
  const found = scope.locateText(paragraph, prose1.data)
  check('locateText finds prose that precedes the panel',
    found !== null && found.offset === 0,
    `offset was ${found === null ? 'null' : found.offset}`)
  const notFound = scope.locateText(paragraph, '保存')
  check('locateText cannot match the panel button label',
    notFound === null,
    'the panel label is reachable through the text search')
}

// ── Report ──────────────────────────────────────────────────────────────
let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
