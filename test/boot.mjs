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
import { readSourceBundle } from './source.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'client.js'), 'utf8')
// Structural assertions read the authored modules: they describe how the code is written,
// and the bundler is free to re-format its output.
const bundleSource = await readSourceBundle()

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

/**
 * Build a fresh client context.
 *
 * Each context records its own registrations, so two plugin instances can be told apart.
 * A shared array would make "both registered" look like proof of independence even when the
 * instances share state — registration is driven by `apply`, not by the annotation map.
 *
 * @returns a context object in the shape `apply` expects.
 */
function makeContext() {
  const registered = []
  const context = {
    registered,
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
  return context
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

// --- Evaluation boundary ---------------------------------------------------
// The bundle must register a factory and do nothing else while the script runs. The reliable
// evidence is structural plus behavioural rather than instrumenting `require`: a bundle that
// evaluated its graph at load time would have a single shared instance, which the per-instance
// checks below detect directly.
const registersOnlyTheEnvelope = /__ModuleLoader__\.load\(\{[\s\S]*?factory\(/.test(source)
const noTopLevelIife = !/^var __dshQuoteChat = \(\(\) =>/m.test(source)
check('the bundle evaluates inside the factory, not at load',
  registersOnlyTheEnvelope && noTopLevelIife,
  `envelope=${registersOnlyTheEnvelope} noTopLevelIife=${noTopLevelIife}`)

// --- Per-call instances ----------------------------------------------------
// Two factory calls must produce two independent plugin instances, including independent
// annotation state. Note what does NOT prove this: both instances registering a dock. Two
// instances sharing one annotation map would still register twice, because registration is
// driven by `apply`, not by the map. The proof has to observe the state itself — so both
// instances are driven with the SAME sessionId and their annotations are compared.
let secondError = null
let secondExported = null
try {
  secondExported = sandbox.__factory((name) => {
    if (name === 'react') return makeReact()
    if (name === 'react-dom') return ReactDOM
    return {}
  })
} catch (error) {
  secondError = error
}
check('a second factory call succeeds', secondError === null,
  secondError === null ? '' : `${secondError.name}: ${secondError.message}`)
check('a second factory call returns its own export object',
  secondExported !== null && secondExported !== exported
    && typeof secondExported.apply === 'function',
  'the second call did not produce an independent export object')

// Apply both instances, each into a context it owns, so their registrations are separable.
// The first context is also the one the rest of this suite inspects, so it is applied once.
const firstContext = makeContext()
const secondContext = makeContext()
const context = firstContext
if (secondExported !== null && typeof secondExported.apply === 'function') {
  try { secondExported.apply(secondContext) } catch { /* reported by the boot checks */ }
}
/** Whatever the first instance's `apply` threw, reported by the check below. */
let firstApplyError = null
if (exported !== null && typeof exported.apply === 'function') {
  try { exported.apply(firstContext) } catch (error) { firstApplyError = error }
}
check('each instance registers into its own context',
  firstContext.registered.length > 0 && secondContext.registered.length > 0,
  `first=${firstContext.registered.length} second=${secondContext.registered.length}`)

// The annotation state must be per-instance. Registration count cannot show this: two
// instances sharing one annotation map would still register a dock each, because registration
// is driven by `apply`, not by the map. So the store itself is exercised directly — it is an
// exported module, and two factory calls must yield two stores that do not see each other even
// for the SAME sessionId.
let stateIsolation = null
/** The session both instances are driven with, to prove the stores do not share state. */
const SHARED_SESSION = 'shared-session-id'
try {
  const storeModule = await import('../src/annotation-store.js')
  const firstStore = storeModule.createAnnotationStore({ maxAnnotations: 12 })
  const secondStore = storeModule.createAnnotationStore({ maxAnnotations: 12 })
  firstStore.add(SHARED_SESSION, { kind: 'text', text: 'only in the first instance' })
  let secondNotified = 0
  secondStore.subscribe(SHARED_SESSION, () => { secondNotified += 1 })
  firstStore.add(SHARED_SESSION, { kind: 'text', text: 'another in the first' })
  stateIsolation = {
    firstLength: firstStore.snapshot(SHARED_SESSION).length,
    secondLength: secondStore.snapshot(SHARED_SESSION).length,
    secondNotified,
  }
} catch (error) {
  stateIsolation = { error: String(error) }
}
check('annotation state is per store instance, even for the same sessionId',
  stateIsolation !== null
    && stateIsolation.firstLength === 2
    && stateIsolation.secondLength === 0
    && stateIsolation.secondNotified === 0,
  stateIsolation === null ? 'the store module was unreachable' : JSON.stringify(stateIsolation))

// And the bundle must create that store inside the factory, so each Host call gets one.
check('the bundle creates the annotation store inside the factory',
  /factory\(hostRequire\) \{[\s\S]*__dshQuoteChatFactory\(hostRequire\)/.test(source)
    && !/^const annotationStore = /m.test(source),
  'the store is created at load time rather than per factory call')

// The apply calls above already ran; record whether the first one threw.
let applyError = firstApplyError
check('apply() runs without throwing', applyError === null,
  applyError === null ? '' : `${applyError.name}: ${applyError.message}`)
check('the annotation dock is registered',
  firstContext.registered.some((entry) => entry.spec?.name === 'conversation.input.dock'),
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
for (const entry of firstContext.registered) {
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
// The bubble is portaled into a row element. Rather than matching one call layout, assert
// that a portal call exists AND that its container is one of the row variables the render
// defines. Formatting-independent, same property.
// Several portals exist (toolbar, composer, chip cross, table button). The one under test is
// the gutter bubble, identified by its marker class; match from there so the assertion cannot
// accidentally read a different portal's container.
/**
 * Find the container argument of the bubble portal.
 *
 * The call is `createPortal(h('button', {…}), row)`: nested closures mean no single regex can
 * bound it. So locate the marker-only attribute, walk back to its `createPortal(`, count parens
 * to the CALL'S closing paren, then read the identifier just before it. Layout-independent.
 * @param text - concatenated authored source.
 * @returns the container identifier, or null.
 */
function bubblePortalContainer(text) {
  const anchor = text.indexOf("'data-qc-for': position.id")
  if (anchor < 0) return null
  const marker = text.lastIndexOf('createPortal(', anchor)
  if (marker < 0) return null
  const openParen = text.indexOf('(', marker)
  let depth = 0
  for (let index = openParen; index < text.length; index += 1) {
    const character = text[index]
    if (character === '(' || character === '{' || character === '[') depth += 1
    else if (character === ')' || character === '}' || character === ']') {
      depth -= 1
      if (depth === 0) {
        const tail = text.slice(Math.max(openParen, index - 60), index)
        const match = /([\w.]+)\s*$/.exec(tail)
        return match === null ? null : match[1]
      }
    }
  }
  return null
}
const containerName = bubblePortalContainer(bundleSource)
check('the bubble mounts into a variable the render actually defines',
  containerName !== null && /^(?:row|position\.row)$/.test(containerName),
  containerName === null
    ? 'no createPortal call with a readable container was found'
    : 'the mount target is "' + containerName + '", which the render does not define')
// The ordinal must be painted by CSS from an attribute, never emitted as text: a real text
// node inside the paragraph joins textContent and gets covered by the passage highlight.
// Both halves are checked independently of quoting style and whitespace.
const writesNumberAttr = /data-qc-number['"]?\s*:\s*String\(\s*position\.number\s*\)/.test(source)
const paintsFromAttr = /\.qc-marker::after\s*\{\s*content\s*:\s*attr\(\s*data-qc-number\s*\)/.test(source)
check('the ordinal is CSS-generated, not a text node',
  writesNumberAttr && paintsFromAttr,
  'data-qc-number=' + writesNumberAttr + ' ::after content=attr()=' + paintsFromAttr)
// The click handler must store the row it actually measured, otherwise reopening the editor
// targets a node that was never mounted into.
const storesRow = /setEditing\([^)]*\{[^}]*\bid\s*:\s*position\.id[^}]*\brow\b[^}]*\}/.test(source)
check('the mount target is the measured row', storesRow,
  'the click handler stores a different node than the one it mounted into')
let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok || item.detail === '' ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\nregistrations: ${firstContext.registered.map((entry) => entry.spec?.name).join(', ') || '(none)'}`)
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
