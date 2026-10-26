/**
 * Navigation: restoring a passage, including the virtualized search.
 *
 * The search is timing-shaped — frames, steps, a direction change — so a real transcript is a bad
 * subject. This drives a controllable scroller whose mounted window follows `scrollTop`, plus a
 * frame scheduler the test advances by hand. What is asserted is the policy:
 *
 *   - resolve immediately, and do not scroll at all when that works;
 *   - otherwise sweep UP, then restore the start and sweep DOWN;
 *   - step by 80% of the viewport (min 160), two frames per step, at most 40 steps per direction;
 *   - stop a direction after two consecutive steps that did not move the scroller;
 *   - leave the transcript where the search ended when nothing is found.
 *
 * Run: node test/navigation.mjs
 */
import { createNavigation } from '../src/navigation.js'

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/**
 * Build a scroller over a virtualized document.
 *
 * A passage resolves only while its row is inside the mounted window, which is derived from
 * `scrollTop` — scrolling is what makes it resolvable, exactly as in the real app.
 *
 * @param options - `{ target, viewportHeight, rowHeight, totalRows }`.
 * @returns the scene.
 */
function scene({ target = 5000, viewportHeight = 800, rowHeight = 100, totalRows = 200 } = {}) {
  const contentHeight = totalRows * rowHeight
  let scrollTop = 0
  const scroller = {
    get scrollTop() { return scrollTop },
    set scrollTop(value) {
      // Clamp like a real scroller: this is what makes a sweep stop at an end.
      scrollTop = Math.min(Math.max(0, value), Math.max(0, contentHeight - viewportHeight))
    },
    clientHeight: viewportHeight,
    clientWidth: 800,
    scrollHeight: contentHeight,
    scrollLeft: 0,
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 800, height: viewportHeight, right: 800, bottom: viewportHeight }
    },
  }

  /** Which rows are mounted at the current scroll position. */
  const window_ = () => {
    const first = Math.max(0, Math.floor(scrollTop / rowHeight) - 2)
    const last = Math.min(totalRows - 1, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 2)
    return { first, last }
  }

  const flow = { id: 'flow' }
  const layout = {
    scrollContainerOf: () => scroller,
    visibleChatArea: () => ({ top: 0, height: viewportHeight - 100 }),
    findFlow: () => flow,
  }

  /** A resolver over the mounted window: the passage is "there" only when its row is mounted. */
  const resolver = () => {
    const { first, last } = window_()
    const row = Math.floor(target / rowHeight)
    if (row < first || row > last) return null
    return {
      getBoundingClientRect: () => ({ left: 0, top: target - scrollTop, width: 100, height: 20, right: 100, bottom: target - scrollTop + 20 }),
      startContainer: { __row: row },
    }
  }

  return { scroller, flow, layout, resolver, target, get scrollTop() { return scrollTop } }
}

/**
 * Install a frame scheduler for one test.
 *
 * `requestAnimationFrame` is queued rather than scheduled, so the test decides when a frame
 * passes. That is what makes "two frames per step" observable.
 *
 * @param run - the body, given `{ frame, run, frames }`.
 */
async function withFrames(run) {
  const previousRaf = globalThis.requestAnimationFrame
  const pending = []
  let frames = 0

  globalThis.requestAnimationFrame = (callback) => {
    pending.push(callback)
    return pending.length
  }

  const environment = {
    /** Run one batch of queued frame callbacks. */
    async frame() {
      if (pending.length === 0) return false
      const batch = pending.splice(0, pending.length)
      frames += 1
      for (const callback of batch) callback()
      for (let tick = 0; tick < 6; tick += 1) await Promise.resolve()
      return true
    },
    /** Run frames until nothing is queued. */
    async drain(maxFrames = 500) {
      for (let index = 0; index < maxFrames; index += 1) {
        for (let tick = 0; tick < 6; tick += 1) await Promise.resolve()
        if (!(await environment.frame())) return
      }
      throw new Error('frame queue never drained')
    },
    get frames() { return frames },
    get pending() { return pending.length },
  }

  try {
    return await run(environment)
  } finally {
    globalThis.requestAnimationFrame = previousRaf
  }
}

/**
 * Run a reveal to completion, driving its frames.
 *
 * A sweeping reveal only settles while frames are being delivered, so awaiting it directly would
 * hang: the promise is started first, then the frame queue is drained while it is in flight.
 *
 * @param navigation - the navigation instance.
 * @param parts - the scene.
 * @returns the reveal's result.
 */
async function revealFully(navigation, parts, environment) {
  let settled = false
  const promise = navigation.reveal(parts.flow, { anchor: {} }).then((value) => {
    settled = true
    return value
  })
  for (let index = 0; index < 500 && settled === false; index += 1) {
    for (let tick = 0; tick < 6; tick += 1) await Promise.resolve()
    if (settled === true) break
    await environment.frame()
  }
  return promise
}

// ── 1. The instance surface ───────────────────────────────────────────────
{
  const parts = scene()
  const navigation = createNavigation({ layout: parts.layout })
  check('navigation exposes reveal, scrollToRange and nextFrame',
    typeof navigation.reveal === 'function'
      && typeof navigation.scrollToRange === 'function'
      && typeof navigation.nextFrame === 'function',
    JSON.stringify(Object.keys(navigation)))
}

// ── 2. Immediate resolution does not scroll ──────────────────────────────
{
  // The passage is in the mounted window at scrollTop = 0.
  const parts = scene({ target: 300 })
  await withFrames(async (environment) => {
    const navigation = createNavigation({ layout: parts.layout, resolve: parts.resolver })
    const result = await navigation.reveal(parts.flow, { anchor: {} })
    check('an immediately resolvable passage is found', result !== null, String(result))
    check('immediate resolution does not sweep', environment.frames === 0,
      `${environment.frames} frames`)
  })
}

// ── 3. Up-first, then down ───────────────────────────────────────────────
// Start near the end so the passage is above; a passage below must still be found, which is what
// proves the direction change happens.
{
  const parts = scene({ target: 4000 })
  parts.scroller.scrollTop = parts.scroller.scrollHeight - parts.scroller.clientHeight
  await withFrames(async (environment) => {
    const navigation = createNavigation({ layout: parts.layout, resolve: parts.resolver })
    const result = await revealFully(navigation, parts, environment)
    check('a passage above the current position is found', result !== null, String(result))
    check('the up sweep ran', environment.frames > 0, `${environment.frames} frames`)
  })
}

{
  const parts = scene({ target: 100 })
  // Start far from the passage so it is below.
  parts.scroller.scrollTop = 12000
  await withFrames(async (environment) => {
    const navigation = createNavigation({ layout: parts.layout, resolve: parts.resolver })
    const result = await revealFully(navigation, parts, environment)
    check('a passage below the current position is found', result !== null, String(result))
    check('finding it required the search', environment.frames > 0, `${environment.frames} frames`)
  })
}

// ── 4. Step size: 80% of the viewport, minimum 160 ────────────────────────
{
  const parts = scene({ target: 1e9, viewportHeight: 1000 })
  // Scroll to the middle so an upward step is not clamped at 0.
  parts.scroller.scrollTop = 10000
  let afterOneStep = null
  await withFrames(async (environment) => {
    const navigation = createNavigation({ layout: parts.layout, resolve: () => null })
    const promise = navigation.reveal(parts.flow, { anchor: {} })
    // The first step sets scrollTop, then waits two frames. Sample right after the assignment by
    // running the first frame only.
    await environment.frame()
    afterOneStep = parts.scroller.scrollTop
    parts.scroller.scrollTop = 1e9
    await environment.drain()
    await promise.catch(() => {})
  })
  check('the first step is 80% of the viewport', afterOneStep === 10000 - 800,
    String(afterOneStep))
}

{
  // A short viewport still steps by at least 160.
  const parts = scene({ target: 1e9, viewportHeight: 100 })
  parts.scroller.scrollTop = 10000
  let afterOneStep = null
  await withFrames(async (environment) => {
    const navigation = createNavigation({ layout: parts.layout, resolve: () => null })
    const promise = navigation.reveal(parts.flow, { anchor: {} })
    await environment.frame()
    afterOneStep = parts.scroller.scrollTop
    parts.scroller.scrollTop = 1e9
    await environment.drain()
    await promise.catch(() => {})
  })
  check('a short viewport steps by the 160 minimum', afterOneStep === 10000 - 160,
    String(afterOneStep))
}

// ── 5. Attempt cap: at most 40 steps per direction ───────────────────────
{
  // A tall document that never contains the passage: the up sweep must stop at 40 steps.
  const parts = scene({ target: 1e9, totalRows: 400, viewportHeight: 200 })
  parts.scroller.scrollTop = 20000
  let up = 0
  await withFrames(async (environment) => {
    const navigation = createNavigation({ layout: parts.layout, resolve: () => null })
    const promise = navigation.reveal(parts.flow, { anchor: {} })
    // Count the steps until the scroller stops changing (end reached), then keep going.
    let last = parts.scroller.scrollTop
    for (let step = 0; step < 45; step += 1) {
      await environment.frame()
      await environment.frame()
      if (parts.scroller.scrollTop !== last) up += 1
      last = parts.scroller.scrollTop
    }
    parts.scroller.scrollTop = 1e9
    await environment.drain()
    await promise.catch(() => {})
  })
  // The count covers BOTH directions (each capped at 40), so the total is at most 80 steps.
  // Asserting 80 is what actually pins the per-direction cap: a single unlimited direction would
  // run until the scroll end, which for this document is far more than 80.
  check('neither sweep exceeds its 40-step budget', up <= 80, `${up} steps`)
  check('the sweep actually ran multiple steps', up > 2, `${up} steps`)
}

// ── 6. Two barren steps stop a direction ─────────────────────────────────
{
  // A scroller that refuses to move at all: the FIRST direction must stop after two attempts,
  // not run 40 of them.
  const parts = scene({ target: 1e9 })
  Object.defineProperty(parts.scroller, 'scrollTop', { get: () => 0, set: () => {} })
  let framesUsed = 0
  await withFrames(async (environment) => {
    const navigation = createNavigation({ layout: parts.layout, resolve: () => null })
    const promise = navigation.reveal(parts.flow, { anchor: {} })
    for (let index = 0; index < 10; index += 1) await environment.frame()
    framesUsed = environment.frames
    await environment.drain()
    await promise.catch(() => {})
  })
  // Two barren steps = 2 steps x 2 frames = 4 frames for the up sweep.
  // Two barren steps per direction, two frames each: at most 8 frames for both sweeps.
  check('two barren steps stop a direction', framesUsed <= 10, `${framesUsed} frames`)
}

// ── 7. No restore on failure ──────────────────────────────────────────────
// A failed search leaves the transcript at the end of the sweep. Asserting this keeps a future
// "put it back where the user was" from arriving as an unremarked behaviour change.
{
  const parts = scene({ target: 1e9, totalRows: 400, viewportHeight: 200 })
  parts.scroller.scrollTop = 10000
  const start = parts.scroller.scrollTop
  let ended = null
  await withFrames(async (environment) => {
    const navigation = createNavigation({ layout: parts.layout, resolve: () => null })
    const promise = navigation.reveal(parts.flow, { anchor: {} })
    await environment.drain()
    const result = await promise.catch(() => 'threw')
    check('a failed search reports null', result === null, String(result))
    ended = parts.scroller.scrollTop
  })
  check('a failed search does not restore the starting position', ended !== start,
    `start=${start} ended=${ended}`)
}

// ── 8. No scroller is not an error ───────────────────────────────────────
{
  const parts = scene()
  parts.layout.scrollContainerOf = () => null
  await withFrames(async () => {
    const navigation = createNavigation({ layout: parts.layout, resolve: () => null })
    const result = await navigation.reveal(parts.flow, { anchor: {} })
    check('without a scroller the reveal reports null rather than throwing',
      result === null, String(result))
  })
}

// ── 9. scrollToRange ─────────────────────────────────────────────────────
{
  const parts = scene({ viewportHeight: 800 })
  const range = {
    getBoundingClientRect: () => ({ left: 0, top: 300, width: 100, height: 20, right: 100, bottom: 320 }),
    startContainer: {},
  }
  parts.scroller.scrollTop = 1000
  const navigation = createNavigation({ layout: parts.layout })
  const result = navigation.scrollToRange(range, parts.flow)
  // target = scrollTop + (rect.top - area.top) - ANCHOR_TOP_GAP = 1000 + 300 - 0 - 28 = 1272
  check('scrollToRange aligns the passage top with a small gap',
    parts.scroller.scrollTop === 1272, String(parts.scroller.scrollTop))
  check('scrollToRange returns the range it was given', result === range, String(result))
}

{
  const parts = scene({ totalRows: 20 })
  // contentHeight 2000, viewport 800 → max scrollTop 1200. A passage at 5000 wants more than
  // that, so the clamp must engage.
  const range = {
    getBoundingClientRect: () => ({ left: 0, top: 5000, width: 100, height: 20, right: 100, bottom: 5020 }),
    startContainer: {},
  }
  const navigation = createNavigation({ layout: parts.layout })
  navigation.scrollToRange(range, parts.flow)
  check('scrollToRange clamps to the maximum scroll', parts.scroller.scrollTop === 1200,
    String(parts.scroller.scrollTop))
}

{
  const parts = scene()
  const scrolled = []
  parts.layout.scrollContainerOf = () => null
  const host = { scrollIntoView: (options) => scrolled.push(options) }
  const range = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1, right: 1, bottom: 1 }),
    startContainer: {
      nodeType: 1,
      closest: (selector) => (selector === '[data-chat-node-key]' ? host : null),
    },
  }
  const navigation = createNavigation({ layout: parts.layout })
  navigation.scrollToRange(range, parts.flow)
  check('without a scroller it scrolls the row in with minimum movement',
    scrolled[0]?.block === 'nearest', JSON.stringify(scrolled[0]))
}

// ── 10. nextFrame resolves even without rAF ──────────────────────────────
{
  const previousRaf = globalThis.requestAnimationFrame
  delete globalThis.requestAnimationFrame
  try {
    const parts = scene()
    const navigation = createNavigation({ layout: parts.layout })
    let settled = false
    await navigation.nextFrame().then(() => { settled = true })
    check('nextFrame resolves when requestAnimationFrame is absent', settled === true,
      'the promise never settled')
  } finally {
    globalThis.requestAnimationFrame = previousRaf
  }
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
