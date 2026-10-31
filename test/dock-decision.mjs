/**
 * The compose panel's dock decision: two thresholds, and exactly one transition per crossing.
 *
 * This exists because the decision used to be an inline expression in a render body, and it was wrong in a way that no
 * amount of reading found: the leaving branch asked "is the panel still out by a margin?", which is one margin away
 * from the entering branch. Between the two, both branches held, so the state alternated on every render — measured on
 * the real app as 23 `data-docked` flips across 23 pixels of scroll, dragging the panel 24px above the header.
 *
 * So the property asserted here is behavioural, not structural: sweep the resting position across the threshold one
 * pixel at a time and count the transitions. A hysteretic rule crosses ONCE. A broken one crosses on every pixel it
 * spends in the overlap.
 *
 * Run: node test/dock-decision.mjs
 */
import { dockDecision, dockSlotTop, DOCK_MARGIN } from '../src/dock-decision.js'

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** The fixture's geometry, in viewport pixels: a 1440x560 window with a 122.5px-tall panel. */
const BAND = { top: 76, bottom: 430 }
const HEIGHT = 122.5

/**
 * Sweep the panel's resting top from `from` to `to`, one pixel at a time, and report the dock-state sequence.
 *
 * `wasDocked` is fed back in, exactly as the component does: each step starts from the previous answer. That feedback
 * is the whole point — a stateless predicate cannot oscillate, and the bug lived in the feedback.
 *
 * @param from - first resting top.
 * @param to - last resting top (inclusive); may be less than `from`.
 * @param startDocked - the state before the sweep.
 * @returns `{ states, transitions }` where `transitions` are the indices where the answer changed.
 */
function sweep(from, to, startDocked) {
  const step = to >= from ? 1 : -1
  const states = []
  let wasDocked = startDocked
  for (let top = from; step > 0 ? top <= to : top >= to; top += step) {
    const answer = dockDecision({
      hasInput: true,
      frozen: false,
      wasDocked,
      restingTop: top,
      restingBottom: top + HEIGHT,
      bandTop: BAND.top,
      bandBottom: BAND.bottom,
    })
    states.push({ top, docked: answer })
    wasDocked = answer
  }
  const transitions = states.filter((item, index) => index > 0 && item.docked !== states[index - 1].docked)
  return { states, transitions }
}

// ── Crossing the TOP edge, downwards ──────────────────────────────────────
{
  // Start comfortably inside the band and scroll until the passage is far above it.
  const { states, transitions } = sweep(200, 20, false)
  check('the top dock is entered exactly once while scrolling out',
    transitions.length === 1, `${transitions.length} transitions at ${transitions.map((item) => item.top).join(', ')}`)
  check('the top dock holds all the way out',
    states.filter((item) => item.top < BAND.top - DOCK_MARGIN).every((item) => item.docked === true),
    'the panel undocked again on its way out')
}

// ── The entry is as early as it can be ────────────────────────────────────
{
  // #9's contract: a panel with text must not be hidden under the header. The entry threshold is what decides how much
  // of it can slide out of view before it is pinned, so it stays at 1px — the hysteresis lives on the release side.
  const justOut = dockDecision({
    hasInput: true, frozen: false, wasDocked: false,
    restingTop: BAND.top - 2, restingBottom: BAND.top - 2 + HEIGHT, bandTop: BAND.top, bandBottom: BAND.bottom,
  })
  const stillInside = dockDecision({
    hasInput: true, frozen: false, wasDocked: false,
    restingTop: BAND.top + 1, restingBottom: BAND.top + 1 + HEIGHT, bandTop: BAND.top, bandBottom: BAND.bottom,
  })
  check('an anchored panel docks as soon as it is out of the band', justOut === true,
    'the panel is allowed to leave the band before it is pinned')
  check('an anchored panel that is inside the band is left alone', stillInside === false,
    'the panel docked while it was fully visible')
}

// ── The overlap window that used to flip ──────────────────────────────────
{
  // This is the measured regression: for resting tops between `bandTop - 24` and `bandTop - 1`, the old rule answered
  // "leave" and "enter" on consecutive frames. Docked is the only stable answer in there.
  const window = []
  for (let top = BAND.top - DOCK_MARGIN; top <= BAND.top - 1; top += 1) {
    window.push(dockDecision({
      hasInput: true, frozen: false, wasDocked: true,
      restingTop: top, restingBottom: top + HEIGHT, bandTop: BAND.top, bandBottom: BAND.bottom,
    }))
  }
  check('a docked panel stays docked inside the hysteresis window',
    window.every((docked) => docked === true),
    `${window.filter((docked) => docked === false).length} of ${window.length} offsets undocked`)
}

// ── Crossing back up, from the dock ───────────────────────────────────────
{
  const { states, transitions } = sweep(20, 260, true)
  check('the top dock is released exactly once on the way back',
    transitions.length === 1, `${transitions.length} transitions at ${transitions.map((item) => item.top).join(', ')}`)
  const released = transitions.length === 0 ? null : transitions[0].top
  check('the release happens only once the panel would be comfortably visible',
    released !== null && released >= BAND.top + DOCK_MARGIN,
    `released at resting top ${released}, band top ${BAND.top}, margin ${DOCK_MARGIN}`)
}

// ── The BOTTOM edge, same two questions ───────────────────────────────────
{
  // Resting below the band: enter once, stay in.
  const down = sweep(240, 460, false)
  check('the bottom dock is entered exactly once while scrolling in',
    down.transitions.length === 1, `${down.transitions.length} transitions`)
  const back = sweep(460, 240, true)
  check('the bottom dock is released exactly once on the way out',
    back.transitions.length === 1, `${back.transitions.length} transitions`)
  const released = back.transitions.length === 0 ? null : back.transitions[0].top
  check('the bottom release also waits for a comfortable fit',
    released !== null && released + HEIGHT <= BAND.bottom - DOCK_MARGIN,
    `released at resting bottom ${released === null ? 'n/a' : released + HEIGHT}, band bottom ${BAND.bottom}`)
}

// ── A panel that fills the band ───────────────────────────────────────────
{
  // Too tall for the 24px margins, but not too tall for the band: plain containment has to be the standard, otherwise
  // the panel would be trapped in the dock forever.
  const tall = (BAND.bottom - BAND.top) - 10
  const inside = BAND.top + 5
  const decision = dockDecision({
    hasInput: true, frozen: false, wasDocked: true,
    restingTop: inside, restingBottom: inside + tall, bandTop: BAND.top, bandBottom: BAND.bottom,
  })
  check('a panel too tall for the margins still leaves the dock once it fits the band', decision === false,
    'the panel stayed docked, so it can never return to its passage')

  // Taller than the band itself: no position can show it whole, so staying docked is the only state that keeps any of
  // it on screen. Pinned is stable; following the passage would scroll it away.
  const oversized = dockDecision({
    hasInput: true, frozen: false, wasDocked: true,
    restingTop: BAND.top, restingBottom: BAND.top + HEIGHT * 4, bandTop: BAND.top, bandBottom: BAND.bottom,
  })
  check('a panel taller than the band stays docked', oversized === true,
    'an oversized panel was released, so it can only be seen while its passage happens to be on screen')
}

// ── The two gates that outrank the hysteresis ─────────────────────────────
{
  const base = {
    frozen: false, wasDocked: true, restingTop: 0, restingBottom: HEIGHT, bandTop: BAND.top, bandBottom: BAND.bottom,
  }
  check('an empty panel is never rescued', dockDecision({ ...base, hasInput: false }) === false,
    'an empty panel is rescued, so it no longer scrolls away with its passage')
  check('a reflow freezes the decision while docked', dockDecision({ ...base, hasInput: true, frozen: true }) === true,
    'the decision is re-taken during a reflow, which is how the state flickered')
  check('a reflow freezes the decision while anchored',
    dockDecision({ ...base, hasInput: true, frozen: true, wasDocked: false }) === false,
    'a reflow docked the panel')
}

// ── The slot is rounded in viewport space ─────────────────────────────────
{
  const size = { width: 420, height: HEIGHT }
  check('the top slot keeps its gap from the band',
    dockSlotTop('top', BAND, size) === BAND.top + 8, String(dockSlotTop('top', BAND, size)))
  check('the bottom slot keeps its gap from the band',
    dockSlotTop('bottom', BAND, size) === Math.round(BAND.bottom - 8 - HEIGHT),
    String(dockSlotTop('bottom', BAND, size)))
  check('both slots are whole pixels',
    Number.isInteger(dockSlotTop('top', { top: 75.5, bottom: 430.5 }, size))
      && Number.isInteger(dockSlotTop('bottom', { top: 75.5, bottom: 430.5 }, size)),
    'a fractional slot cannot be cancelled by a fractional scroll offset')
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
