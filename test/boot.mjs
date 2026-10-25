/**
 * Boot the client half for real.
 *
 * Two outages in a row were `ReferenceError`s that `node --check` accepted and no
 * diff showed:
 *
 *   - `onWindowResize` referenced above its `const` (temporal dead zone)
 *   - `debounced` deleted but still referenced by a MutationObserver
 *
 * Both take down the whole `conversation.input.dock` slot, so the selection
 * toolbar never appears. Neither is a syntax error.
 *
 * So this loads the module in a stubbed browser and calls `apply(ctx)`. That
 * executes the module body and every top-level effect, which is exactly where a
 * dangling top-level identifier throws.
 *
 * Scope note: this deliberately does NOT deep-render the React tree. A hand-made
 * hook stub cannot reproduce React's scheduling, and a stub that silently disagrees
 * with React produces false failures — worse than no test at all. Render-time
 * correctness is covered by the focused suites.
 *
 * Run: node test/boot.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'client.js'), 'utf8')

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

function makeElement(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    nodeType: 1,
    isConnected: true,
    childNodes: [],
    children: [],
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, contains: () => false },
    attributes: {},
    textContent: '',
    innerHTML: '',
    innerText: '',
    scrollTop: 0,
    scrollLeft: 0,
    clientWidth: 800,
    clientHeight: 600,
    getBoundingClientRect: () => ({
      left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0,
    }),
    getClientRects: () => [{ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }],
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    matches: () => false,
    contains: () => false,
    appendChild(child) { this.childNodes.push(child); return child },
    removeChild(child) {
      const at = this.childNodes.indexOf(child)
      if (at >= 0) this.childNodes.splice(at, 1)
      return child
    },
    insertBefore(child) { this.childNodes.push(child); return child },
    setAttribute(name, value) { this.attributes[name] = value },
    getAttribute(name) { return this.attributes[name] ?? null },
    removeAttribute(name) { delete this.attributes[name] },
    hasAttribute(name) { return name in this.attributes },
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    blur() {},
    click() {},
    scrollIntoView() {},
    remove() {},
    cloneNode() { return makeElement(tag) },
  }
}

const body = makeElement('body')
const documentStub = {
  body,
  documentElement: makeElement('html'),
  head: makeElement('head'),
  readyState: 'complete',
  activeElement: null,
  createElement: (tag) => makeElement(tag),
  createElementNS: (_ns, tag) => makeElement(tag),
  createTextNode: (text) => ({ nodeType: 3, textContent: text, parentElement: null, parentNode: null }),
  createRange: () => ({
    setStart() {}, setEnd() {}, selectNodeContents() {}, collapse() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    getClientRects: () => [],
    cloneContents: () => ({ childNodes: [], querySelectorAll: () => [] }),
    startContainer: null, startOffset: 0, endContainer: null, endOffset: 0,
  }),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  execCommand() {},
}

class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}

function makeReact() {
  // A STACK of slot frames. Nested components each need their own slots; sharing
  // one flat array made a child read the parent's state and produced false
  // failures that had nothing to do with the code under test.
  const frames = [[]]
  let cursor = 0
  const React = {
    Fragment: Symbol('Fragment'),
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useRef(initial) {
      const frame = frames[frames.length - 1]
      const at = cursor++
      if (frame[at] === undefined) frame[at] = { current: initial }
      return frame[at]
    },
    useState(initial) {
      const frame = frames[frames.length - 1]
      const at = cursor++
      if (frame[at] === undefined) {
        frame[at] = { value: typeof initial === 'function' ? initial() : initial }
      }
      const slot = frame[at]
      return [slot.value, (next) => {
        slot.value = typeof next === 'function' ? next(slot.value) : next
      }]
    },
    useMemo(factory) { cursor += 1; return factory() },
    useCallback(fn) { cursor += 1; return fn },
    useEffect() { cursor += 1 },
    useLayoutEffect() { cursor += 1 },
    useContext() { return {} },
    useSyncExternalStore(_subscribe, getSnapshot) {
      cursor += 1
      return typeof getSnapshot === 'function' ? getSnapshot() : undefined
    },
    useReducer(reducer, initial) {
      const frame = frames[frames.length - 1]
      const at = cursor++
      if (frame[at] === undefined) frame[at] = { value: initial }
      const slot = frame[at]
      return [slot.value, (action) => { slot.value = reducer(slot.value, action) }]
    },
    useId() { return 'qc-test' },
    useDeferredValue(value) { return value },
    useTransition() { return [false, (fn) => fn()] },
    useImperativeHandle() {},
    useDebugValue() {},
    memo: (component) => component,
    forwardRef: (fn) => fn,
    createContext: () => ({ Provider: Symbol('Provider'), Consumer: Symbol('Consumer') }),
    isValidElement: (value) => value !== null && typeof value === 'object' && 'type' in value,
  }
  React.__resetHooks = () => { cursor = 0 }
  React.__pushFrame = () => { frames.push([]); cursor = 0 }
  React.__popFrame = () => { frames.pop(); cursor = 0 }
  return React
}

const React = makeReact()
const ReactDOM = { createPortal: (node) => node, render: () => {}, flushSync: (fn) => fn() }

const registered = []
const context = {
  locale: { register: () => {}, bind: () => (key) => key, t: (key) => key },
  effect: (fn) => {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  inject: (_names, fn) => {
    const result = typeof fn === 'function' ? fn({ slots: undefined }) : undefined
    return typeof result === 'function' ? result : () => {}
  },
  get: () => undefined,
  slots: {
    inject: (_name, fn) => {
      const result = typeof fn === 'function' ? fn() : undefined
      return typeof result === 'function' ? result : () => {}
    },
    register: (spec, component) => {
      registered.push({ spec, component })
      return () => {}
    },
  },
  inputTriggers: { registerSource: () => () => {} },
}

const sandbox = {
  document: documentStub,
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  queueMicrotask,
  getComputedStyle: () => ({
    position: 'static', display: 'block', paddingLeft: '0px', paddingRight: '0px',
    paddingTop: '0px', paddingBottom: '0px', marginLeft: '0px', marginRight: '0px',
    overflowY: 'auto', overflowX: 'auto', visibility: 'visible', opacity: '1',
    getPropertyValue: () => '',
  }),
  MutationObserver: StubObserver,
  ResizeObserver: StubObserver,
  IntersectionObserver: StubObserver,
  Element: class Element {},
  Node: class Node {},
  NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
  Range: class Range {},
  Event: class Event {},
  CustomEvent: class CustomEvent {},
  KeyboardEvent: class KeyboardEvent {},
  MouseEvent: class MouseEvent {},
  PointerEvent: class PointerEvent {},
  CSS: { escape: (value) => String(value), highlights: new Map(), supports: () => false },
  Math, JSON, Object, Array, String, Number, Boolean, Set, Map, WeakMap, WeakSet,
  Promise, Date, Error, TypeError, RangeError, RegExp, Symbol,
  parseInt, parseFloat, isNaN, isFinite,
  encodeURIComponent, decodeURIComponent, structuredClone,
  fetch: () => Promise.reject(new Error('no network')),
  navigator: { userAgent: 'node-test' },
  performance: { now: () => Date.now() },
  URL,
}
sandbox.window = sandbox
sandbox.globalThis = sandbox
sandbox.self = sandbox
sandbox.innerWidth = 1440
sandbox.innerHeight = 900
sandbox.devicePixelRatio = 1
sandbox.addEventListener = () => {}
sandbox.removeEventListener = () => {}
sandbox.getSelection = () => null
sandbox.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
sandbox.visualViewport = { width: 1440, height: 900, addEventListener() {}, removeEventListener() {} }
sandbox.__ModuleLoader__ = { load: ({ factory }) => { sandbox.__factory = factory } }

let bootError = null
let exported = null
try {
  new vm.Script(source, { filename: 'client.js' }).runInNewContext(sandbox)
  if (typeof sandbox.__factory !== 'function') {
    throw new Error('the module did not register a factory with __ModuleLoader__')
  }
  exported = sandbox.__factory((name) => {
    if (name === 'react') return React
    if (name === 'react-dom') return ReactDOM
    return {}
  })
} catch (error) {
  bootError = error
}

check('client.js evaluates without throwing', bootError === null,
  bootError === null ? '' : `${bootError.name}: ${bootError.message}`)
check('the factory registers itself', exported !== null, 'no export object')
check('the export exposes inject and apply',
  exported !== null && typeof exported.apply === 'function', 'apply is missing')

let applyError = null
if (exported !== null && typeof exported.apply === 'function') {
  try {
    exported.apply(context)
  } catch (error) {
    applyError = error
  }
}
check('apply() runs without throwing', applyError === null,
  applyError === null ? '' : `${applyError.name}: ${applyError.message}`)
check('the annotation dock is registered',
  registered.some((entry) => entry.spec?.name === 'conversation.input.dock'),
  'conversation.input.dock was not registered')

// --- Render the dock with effects live -------------------------------------
// This is what catches an effect-level ReferenceError. A component's effect body
// only runs when the component renders, so a boot that stops at apply() cannot
// see one. Two outages shipped that way.
function renderValue(value, depth = 0) {
  if (value === null || value === undefined || depth > 8) return
  if (Array.isArray(value)) {
    for (const item of value) renderValue(item, depth + 1)
    return
  }
  if (typeof value === 'function') {
    React.__pushFrame()
    try {
      renderValue(value({}), depth + 1)
    } finally {
      React.__popFrame()
    }
    return
  }
  if (typeof value === 'object' && value.type !== undefined) {
    const { type, props, children } = value
    if (typeof type === 'function') {
      React.__pushFrame()
      try {
        renderValue(type(props ?? {}), depth + 1)
      } finally {
        React.__popFrame()
      }
    } else if (type === React.Fragment) {
      renderValue(children, depth + 1)
    }
    if (Array.isArray(children) && children.length > 0) renderValue(children, depth + 1)
  }
}

// Run effects synchronously: that is where the guarded crash happens.
React.useEffect = (fn) => { fn() }
React.useLayoutEffect = (fn) => { fn() }

const renderErrors = []
for (const entry of registered) {
  if (typeof entry.component !== 'function') continue
  try {
    renderValue(entry.component)
  } catch (error) {
    renderErrors.push({ name: entry.spec?.name ?? 'slot', error })
  }
}
check('rendering the dock runs its effects without throwing',
  renderErrors.length === 0,
  renderErrors.map((item) => item.name + ': ' + item.error.name + ': ' + item.error.message).join('; '))
// --- The bubble must mount into the row it measured ------------------------
// A refactor left the mount target as an undefined `parent`, which threw during
// render: the bubbles never appeared and could not be clicked. `node --check`
// passes on an undefined identifier, so this is checked structurally.
const markerRender = /const nodes = \[\]\s*\n\s*for \(const position of positions\)[\s\S]*?\}\),\s*(\w+)\)\)/.exec(source)
check('the bubble mounts into a variable the render actually defines',
  markerRender !== null && ['row', 'position.row'].includes(markerRender[1]),
  markerRender === null
    ? 'the mount target could not be read'
    : 'the mount target is "' + markerRender[1] + '", which the render does not define')
check('the ordinal is CSS-generated, not a text node',
  /'data-qc-number': String\(position\.number\)/.test(source)
    && /\.qc-marker::after\{content:attr\(data-qc-number\)/.test(source),
  'a real text node inside the paragraph joins textContent and gets painted by the highlight')
check('the mount target is the measured row',
  /setEditing\(already \? null : \{ id: position\.id, row \}\)/.test(source),
  'the click handler stores a different node than the one it mounted into')
let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok || item.detail === '' ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\nregistrations: ${registered.map((entry) => entry.spec?.name).join(', ') || '(none)'}`)
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
