/**
 * Layout: finding the transcript, measuring the readable band, placing surfaces.
 *
 * The DOM is a controllable stand-in, so placement rules can be asserted directly instead of
 * inferred from screenshots: a surface must never leave the readable band, must flip above when
 * there is no room below, must align right edges with the bubble, and must fall back sensibly
 * when the measurement is degenerate.
 *
 * Two things are pinned beyond geometry, because they are real DOM side effects:
 *
 *   - the scroll container is given `position: relative` when it is static, once, guarded by
 *     `data-qc-positioned`;
 *   - caches are per-instance and only reused while their entry is still connected.
 *
 * Run: node test/layout.mjs
 */

// ── A tiny controllable DOM ────────────────────────────────────────────────
// jsdom is not a dependency and this module only needs boxes, styles and queries.

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/**
 * Build a fake element.
 * @param spec - `{ children, rect, style, dataset, scroll, classes }`.
 * @returns the element.
 */
function element(spec = {}) {
  const node = {
    children: spec.children ?? [],
    parentElement: null,
    dataset: spec.dataset ?? {},
    style: spec.style ?? {},
    className: spec.className ?? '',
    scrollTop: spec.scrollTop ?? 0,
    scrollLeft: spec.scrollLeft ?? 0,
    scrollHeight: spec.scrollHeight ?? 0,
    clientHeight: spec.clientHeight ?? 0,
    clientWidth: spec.clientWidth ?? 0,
    rect: spec.rect ?? { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 },
    computed: spec.computed ?? { position: 'static', overflowY: 'visible' },
    getBoundingClientRect() {
      const box = node.rect
      return {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        right: box.right ?? box.left + box.width,
        bottom: box.bottom ?? box.top + box.height,
      }
    },
    getClientRects() {
      return node.rect.width > 0 && node.rect.height > 0 ? [{ width: node.rect.width }] : []
    },
    closest(selector) {
      let current = node
      while (current !== null) {
        if (current.__selectors?.includes(selector)) return current
        current = current.parentElement
      }
      return null
    },
    querySelectorAll(selector) {
      const out = []
      const walk = (item) => {
        for (const child of item.children) {
          if (child.__selectors?.includes(selector)) out.push(child)
          walk(child)
        }
      }
      walk(node)
      return out
    },
    contains(other) {
      let current = other
      while (current !== null) {
        if (current === node) return true
        current = current.parentElement
      }
      return false
    },
    isConnected: spec.isConnected ?? true,
    __selectors: spec.selectors ?? [],
  }
  for (const child of node.children) child.parentElement = node
  return node
}

/** Install a document stub for one test, restoring the previous one afterwards. */
function withDocument(root, run) {
  const previousDocument = globalThis.document
  const previousWindow = globalThis.window
  const previousGetComputedStyle = globalThis.getComputedStyle
  globalThis.document = {
    querySelectorAll(selector) {
      const out = []
      const walk = (item) => {
        for (const child of item.children) {
          if (child.__selectors?.includes(selector)) out.push(child)
          walk(child)
        }
      }
      if (root.__selectors?.includes(selector)) out.push(root)
      walk(root)
      return out
    },
    baseURI: 'http://dsh.test/',
  }
  globalThis.window = { innerHeight: 900, innerWidth: 1400 }
  globalThis.getComputedStyle = (node) => ({
    position: node.computed?.position ?? 'static',
    overflowY: node.computed?.overflowY ?? 'visible',
    // Surface fields, so `findComposerDock` can tell a painted input card from a transparent wrapper. Every existing
    // case leaves them unset, which reads as "paints nothing" and keeps the old behaviour.
    backgroundColor: node.computed?.backgroundColor ?? 'rgba(0, 0, 0, 0)',
    backgroundImage: node.computed?.backgroundImage ?? 'none',
    borderTopWidth: node.computed?.borderTopWidth ?? '0px',
    borderTopStyle: node.computed?.borderTopStyle ?? 'none',
  })
  try {
    return run()
  } finally {
    globalThis.document = previousDocument
    globalThis.window = previousWindow
    globalThis.getComputedStyle = previousGetComputedStyle
  }
}

const { createLayout } = await import('../src/layout.js')

/**
 * Build a standard scene: viewport 900 tall, scroller 0..700, composer covering 700..900.
 * @param overrides - per-part adjustments.
 * @returns the pieces.
 */
function scene(overrides = {}) {
  const composer = element({
    selectors: ['[data-slot="conversation.composer.dock"]'],
    rect: { left: 0, top: overrides.composerTop ?? 700, width: 1400, height: 200 },
  })
  const scroller = element({
    rect: { left: 0, top: 0, width: 1400, height: overrides.scrollerHeight ?? 700 },
    computed: { position: overrides.scrollerPosition ?? 'static', overflowY: 'auto' },
    scrollHeight: 2000,
    clientHeight: overrides.scrollerHeight ?? 700,
    clientWidth: 1400,
    scrollTop: overrides.scrollTop ?? 0,
    scrollLeft: 0,
  })
  const row = element({
    selectors: ['[data-chat-node-key]'],
    rect: { left: 200, top: 100, width: 640, height: 40 },
  })
  const flow = element({
    selectors: ['[data-slot="conversation.chat.flow"]'],
    rect: { left: 0, top: 0, width: 0, height: 0 },
    children: [row],
  })
  scroller.children = [flow]
  flow.parentElement = scroller
  const root = element({ children: [scroller, composer] })
  return { root, scroller, flow, row, composer }
}

// ── Finding the transcript ─────────────────────────────────────────────────
{
  const { flow } = scene()
  const layout = createLayout()
  withDocument(flow.parentElement.parentElement, () => {
    const found = layout.findFlow()
    check('findFlow returns the flow anchor', found === flow, String(found))
  })
}

{
  // `display: contents` gives the anchor no box; its rows still count.
  const parts = scene()
  parts.flow.rect = { left: 0, top: 0, width: 0, height: 0 }
  const layout = createLayout()
  withDocument(parts.root, () => {
    const found = layout.findFlow()
    check('a box-less flow is still found through its rows', found === parts.flow, String(found))
  })
}

{
  const layout = createLayout()
  withDocument(element({ children: [] }), () => {
    check('findFlow returns null when there is no transcript', layout.findFlow() === null,
      String(layout.findFlow()))
  })
}

// ── The readable band ──────────────────────────────────────────────────────
{
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const area = layout.visibleChatArea(parts.scroller)
    check('the band starts at the scroller top', area.top === 0, String(area.top))
    check('the band ends at the composer', area.top + area.height === 700,
      String(area.top + area.height))
    check('the band has positive height', area.height > 0, String(area.height))
  })
}

{
  // A taller composer must shrink the band: this is the "input box grew" case.
  const parts = scene({ composerTop: 400 })
  const layout = createLayout()
  withDocument(parts.root, () => {
    const area = layout.visibleChatArea(parts.scroller)
    check('a taller composer narrows the band',
      area.top + area.height === 400, String(area.top + area.height))
  })
}

{
  // A collapsed band falls back to the scroller's own box rather than reporting nothing.
  const parts = scene({ composerTop: 40 })
  const layout = createLayout()
  withDocument(parts.root, () => {
    const area = layout.visibleChatArea(parts.scroller)
    check('a degenerate band falls back to the scroller box', area.height === 700,
      String(area.height))
  })
}

// ── Container lookup ───────────────────────────────────────────────────────
{
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const container = layout.scrollContainerOf(parts.flow)
    check('scrollContainerOf finds the scrolling ancestor',
      container === parts.scroller, String(container))
  })
}

{
  const parts = scene()
  // Not scrollable: nothing exceeds its own height.
  parts.scroller.scrollHeight = 100
  const layout = createLayout()
  withDocument(parts.root, () => {
    check('a non-scrolling ancestor is not picked',
      layout.scrollContainerOf(parts.flow) === null, String(layout.scrollContainerOf(parts.flow)))
  })
}

// ── The one-time positioning side effect ───────────────────────────────────
{
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    layout.anchorInTranscript(parts.flow, { left: 200, top: 200, right: 400, bottom: 220 },
      { width: 300, height: 60 }, 'below')
    check('a static container is made relative',
      parts.scroller.style.position === 'relative', String(parts.scroller.style.position))
    check('the container is marked as positioned',
      parts.scroller.dataset.qcPositioned === '1', String(parts.scroller.dataset.qcPositioned))
  })
}

{
  const parts = scene({ scrollerPosition: 'absolute' })
  const layout = createLayout()
  withDocument(parts.root, () => {
    layout.anchorInTranscript(parts.flow, { left: 200, top: 200, right: 400, bottom: 220 },
      { width: 300, height: 60 }, 'below')
    check('an already-positioned container keeps its own value',
      parts.scroller.style.position === undefined, String(parts.scroller.style.position))
    check('the marker is still set', parts.scroller.dataset.qcPositioned === '1',
      String(parts.scroller.dataset.qcPositioned))
  })
}

{
  // The marker makes the work idempotent: a second call must not re-measure or re-set.
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    layout.anchorInTranscript(parts.flow, { left: 200, top: 200, right: 400, bottom: 220 },
      { width: 300, height: 60 }, 'below')
    const styleAfterFirst = parts.scroller.style.position
    layout.anchorInTranscript(parts.flow, { left: 200, top: 200, right: 400, bottom: 220 },
      { width: 300, height: 60 }, 'below')
    check('positioning happens once', parts.scroller.style.position === styleAfterFirst,
      String(parts.scroller.style.position))
  })
}

// ── Placement: vertical ────────────────────────────────────────────────────
{
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const placed = layout.anchorInTranscript(
      parts.flow,
      { left: 200, top: 200, right: 400, bottom: 220 },
      { width: 300, height: 60 },
      'below',
    )
    check('a surface with room below sits below the selection',
      placed.position.top === 228, String(placed.position.top))
  })
}

{
  // No room below: flip above.
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const placed = layout.anchorInTranscript(
      parts.flow,
      { left: 200, top: 640, right: 400, bottom: 690 },
      { width: 300, height: 100 },
      'below',
    )
    check('a surface with no room below flips above',
      placed.position.top < 640, String(placed.position.top))
  })
}

{
  // prefer 'above' wins regardless of room.
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const placed = layout.anchorInTranscript(
      parts.flow,
      { left: 200, top: 300, right: 400, bottom: 320 },
      { width: 300, height: 60 },
      'above',
    )
    check('prefer "above" is honoured', placed.position.top === 232, String(placed.position.top))
  })
}

{
  // The band top clamps a surface that would leave the top.
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const placed = layout.anchorInTranscript(
      parts.flow,
      { left: 200, top: 0, right: 400, bottom: 10 },
      { width: 300, height: 400 },
      'below',
    )
    check('a surface is clamped inside the band top',
      placed.position.top >= 8, String(placed.position.top))
  })
}

{
  // The band bottom clamps a surface that would cover the composer.
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const placed = layout.anchorInTranscript(
      parts.flow,
      { left: 200, top: 600, right: 400, bottom: 690 },
      { width: 300, height: 300 },
      'below',
    )
    check('a surface never extends past the band bottom',
      placed.position.top + 300 <= 700 - 0 + 1, String(placed.position.top + 300))
  })
}

// ── Placement: horizontal ──────────────────────────────────────────────────
{
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const placed = layout.anchorInTranscript(
      parts.flow,
      { left: 1000, top: 200, right: 1300, bottom: 220 },
      { width: 400, height: 60 },
      'below',
    )
    check('a surface near the right edge is pulled back inside',
      placed.position.left + 400 <= 1400, String(placed.position.left))
    check('a surface never starts left of the inset',
      placed.position.left >= 8, String(placed.position.left))
  })
}

{
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const placed = layout.anchorInTranscript(
      parts.flow,
      { left: 0, top: 200, right: 40, bottom: 220 },
      { width: 300, height: 60 },
      'below',
    )
    check('a surface at the left edge keeps the inset', placed.position.left === 8,
      String(placed.position.left))
  })
}

// ── Placement: above a bubble, right edges flush ───────────────────────────
{
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const placed = layout.anchorAboveBubble(
      parts.flow,
      { left: 1200, top: 300, right: 1240, bottom: 320 },
      { width: 320, height: 200 },
    )
    // The panel's right edge must equal the bubble's, measured from the container's right.
    check('the panel right offset leaves the bubble flush',
      placed.position.right === 1400 - 1240, String(placed.position.right))
    check('the panel reports the bubble top for its own arithmetic',
      typeof placed.position.bubbleTop === 'number', String(placed.position.bubbleTop))
    check('the panel reports the gap', placed.position.gap === 10, String(placed.position.gap))
    check('the panel reports the band for its own clamp',
      typeof placed.position.bandTop === 'number' && typeof placed.position.bandBottom === 'number',
      JSON.stringify({ bandTop: placed.position.bandTop, bandBottom: placed.position.bandBottom }))
  })
}

{
  // The fallback top must clear the bubble by the gap and stay inside the band.
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const placed = layout.anchorAboveBubble(
      parts.flow,
      { left: 1200, top: 500, right: 1240, bottom: 520 },
      { width: 320, height: 100 },
    )
    check('the fallback top sits above the bubble by the gap',
      placed.position.top === 500 - 10 - 100, String(placed.position.top))
  })
}

{
  // A bubble near the top: the fallback top clamps to the band.
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const placed = layout.anchorAboveBubble(
      parts.flow,
      { left: 1200, top: 20, right: 1240, bottom: 40 },
      { width: 320, height: 200 },
    )
    check('the fallback top clamps inside the band', placed.position.top >= 8,
      String(placed.position.top))
  })
}

// ── Fallback paths ─────────────────────────────────────────────────────────
{
  const parts = scene()
  parts.scroller.scrollHeight = 100
  const layout = createLayout()
  withDocument(parts.root, () => {
    check('placement returns null without a scroll container',
      layout.anchorInTranscript(parts.flow, { left: 0, top: 0, right: 1, bottom: 1 },
        { width: 10, height: 10 }, 'below') === null,
      'a position was produced without a container')
    check('bubble placement returns null without a scroll container',
      layout.anchorAboveBubble(parts.flow, { left: 0, top: 0, right: 1, bottom: 1 },
        { width: 10, height: 10 }) === null,
      'a position was produced without a container')
  })
}

{
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    check('placement returns null without a selection box',
      layout.anchorInTranscript(parts.flow, null, { width: 10, height: 10 }, 'below') === null,
      'a position was produced without a box')
  })
}

// ── Caches ─────────────────────────────────────────────────────────────────
{
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const first = layout.containerFor(parts.flow)
    const second = layout.containerFor(parts.flow)
    check('containerFor caches the same answer',
      first === second && first === parts.scroller, String(first))
  })
}

{
  // A cached container that no longer contains the flow must be discarded.
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    layout.containerFor(parts.flow)
    parts.flow.parentElement = element({ children: [parts.flow] })
    check('a stale container is not reused',
      layout.containerFor(parts.flow) === null, String(layout.containerFor(parts.flow)))
  })
}

{
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const first = layout.flowColumnBox(parts.flow)
    const second = layout.flowColumnBox(parts.flow)
    check('flowColumnBox caches the same entry', first === second, 'the cache missed')
    check('flowColumnBox measures the widest row', first?.box.width === 640,
      String(first?.box.width))
  })
}

{
  // A cached entry whose element left the DOM must be recomputed. The row is actually removed
  // from the flow, which is what a virtualized transcript does when a row scrolls out: marking
  // isConnected without unlinking would leave it findable by the fallback walk.
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    const first = layout.flowColumnBox(parts.flow)
    check('the column is measured before invalidation', first?.element === parts.row,
      String(first?.element === parts.row))
    parts.row.isConnected = false
    parts.flow.children = []
    parts.row.parentElement = null
    const wider = element({
      selectors: ['[data-chat-node-key]'],
      rect: { left: 100, top: 100, width: 800, height: 40 },
    })
    parts.flow.children = [wider]
    wider.parentElement = parts.flow
    const again = layout.flowColumnBox(parts.flow)
    check('a disconnected cache entry is not reused',
      again !== null && again.element === wider, 'the disconnected row was reused')
  })
}

{
  // Two layout instances must not share caches: caches are per factory call.
  const parts = scene()
  const first = createLayout()
  const second = createLayout()
  withDocument(parts.root, () => {
    first.containerFor(parts.flow)
    parts.flow.parentElement = element({ children: [parts.flow] })
    check('a second layout instance has its own cache',
      second.containerFor(parts.flow) === null,
      'the second instance read the first one\'s cache')
  })
}

// ── Input area lookup ──────────────────────────────────────────────────────
{
  const parts = scene()
  const layout = createLayout()
  withDocument(parts.root, () => {
    check('the composer dock is found', layout.findComposerDock() === parts.composer,
      String(layout.findComposerDock()))
  })
}

{
  const layout = createLayout()
  withDocument(element({ children: [] }), () => {
    check('no composer dock reads as null', layout.findComposerDock() === null,
      String(layout.findComposerDock()))
  })
}

// ── The composer's PAINTED edge ────────────────────────────────────────────
//
// The band's bottom decides where a docked panel stops. Measuring it at the editable's box put the panel 0.5px below
// the input card's own surface — the card starts 8px above the editable in the shipped build — while the same rule at
// the top leaves 8px under the header. That asymmetry is the reported "no gap at the bottom".
{
  const layout = createLayout()
  const card = element({
    rect: { left: 0, top: 690, width: 1400, height: 100 },
    computed: { backgroundColor: 'rgb(255, 255, 255)' },
  })
  const input = element({
    selectors: ['[contenteditable="true"]'],
    rect: { left: 0, top: 698, width: 1380, height: 40 },
  })
  card.children = [input]
  input.parentElement = card
  const scroller = element({
    rect: { left: 0, top: 0, width: 1400, height: 700 },
    computed: { position: 'static', overflowY: 'auto' },
    scrollHeight: 2000,
    clientHeight: 700,
    clientWidth: 1400,
  })
  const root = element({ children: [scroller, card] })
  withDocument(root, () => {
    check('the composer dock is the painted surface above the editable',
      layout.findComposerDock() === card, `found ${layout.findComposerDock()?.rect?.top}`)
    const area = layout.visibleChatArea(scroller)
    check('the band ends at the painted surface, not at the editable',
      area.top + area.height === 690, String(area.top + area.height))
  })
}

{
  // Guards: a transparent wrapper is skipped, and a page-sized one is refused even when it paints. Without them the
  // walk would climb to a full-height container and collapse the band to nothing.
  const layout = createLayout()
  const page = element({
    rect: { left: 0, top: 0, width: 1400, height: 900 },
    computed: { backgroundColor: 'rgb(255, 255, 255)' },
  })
  const wrapper = element({
    rect: { left: 0, top: 690, width: 1400, height: 120 },
    computed: { backgroundColor: 'rgba(0, 0, 0, 0)' },
  })
  const input = element({
    selectors: ['[contenteditable="true"]'],
    rect: { left: 0, top: 698, width: 1380, height: 40 },
  })
  wrapper.children = [input]
  input.parentElement = wrapper
  page.children = [wrapper]
  wrapper.parentElement = page
  const scroller = element({
    rect: { left: 0, top: 0, width: 1400, height: 700 },
    computed: { position: 'static', overflowY: 'auto' },
    scrollHeight: 2000,
    clientHeight: 700,
    clientWidth: 1400,
  })
  const root = element({ children: [scroller, page] })
  withDocument(root, () => {
    check('a transparent wrapper is not a composer surface',
      layout.findComposerDock() === input, `found ${layout.findComposerDock()?.rect?.top}`)
    check('a page-sized box is never taken for the composer surface',
      layout.findComposerDock() === input, `found ${layout.findComposerDock()?.rect?.top}`)
  })
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
