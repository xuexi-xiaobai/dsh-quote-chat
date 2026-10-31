/**
 * The compose panel's visibility contract: one definition of "on screen", and no glide out of a dock.
 *
 * Both defects here came from the same place — the panel's dock slot is derived from `readableBand()`, while the tests
 * that decided whether it was visible compared against the scroll container's own box. The container extends behind the
 * composer (measured at a 1440x560 window: container 76..560, band 76..438), so a panel sitting in that strip counted as
 * visible and was painted over the composer. The two boxes coincide at the TOP, which is why only the bottom showed it.
 *
 * The behavioural check lives in `tools/probe-compose-band.mjs`, which measures the real geometry; that file is a
 * diagnostic and is not shipped. What is pinned here is the shape of the code, so the two definitions cannot drift
 * apart again without something failing.
 *
 * Run: node test/panel-band-contract.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const popovers = await readFile(join(here, '..', 'src', 'ui', 'popovers.js'), 'utf8')
const decision = await readFile(join(here, '..', 'src', 'dock-decision.js'), 'utf8')
const layout = await readFile(join(here, '..', 'src', 'layout.js'), 'utf8')

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

// ── One definition of visible ──────────────────────────────────────────────
check('the band is resolved from the shared helper, not re-measured here',
  /const band = typeof readableBand === 'function' \? readableBand\(\) : null/.test(popovers),
  'the panel measures its own idea of the visible area')

check('the visible edges come from that band',
  /const visibleTop = band === null \? scrollerBox\.top : band\.top/.test(popovers)
    && /const visibleBottom = band === null \? scrollerBox\.bottom : band\.bottom/.test(popovers),
  'the visible edges are not derived from the band')

// The exact regression: these read `scrollerBox` before, which is the box that hides behind the composer. The decision
// itself now lives in a pure module (so `test/dock-decision.mjs` can sweep it), and it is fed the band — never the
// container box.
check('the dock decision is fed the band, not the container box',
  /const needsRescue = dockDecision\(\{/.test(popovers)
    && /bandTop: visibleTop/.test(popovers)
    && /bandBottom: visibleBottom/.test(popovers),
  'the dock decision still compares against the scroll container')

check('the decision module has no access to the container box',
  /scrollerBox/.test(decision) === false && /getBoundingClientRect/.test(decision) === false,
  'the decision module measures DOM, so the two definitions can drift apart again')

check('entering a dock happens as soon as the panel is out at all',
  /return outOfBand\(restingTop, restingBottom, bandTop, bandBottom, ENTER_SLOP\)/.test(decision)
    && /const ENTER_SLOP = 1/.test(decision),
  'the entry branch waits for a margin, so the panel can slide under the header before it docks')

check('leaving a dock needs the panel to be comfortably INSIDE',
  /return comfortablyVisible\(restingTop, restingBottom, bandTop, bandBottom, margin\) === false/.test(decision),
  'the departure branch does not use the containment threshold, which is what made the two thresholds overlap')

// `scrollerBox` is still needed: the panel is positioned in the container's CONTENT space, so the conversion below has
// to keep using it. A fix that removed it entirely would have broken the placement instead.
check('the container box is still used for the coordinate conversion',
  /inViewport\.left - scrollerBox\.left \+ scroller\.scrollLeft/.test(popovers)
    && /inViewport\.top - scrollerBox\.top \+ scroller\.scrollTop/.test(popovers),
  'the conversion lost its container reference')

// ── Leaving a dock is immediate ────────────────────────────────────────────
// Gliding out overshot: the frame that released the top dock drew the panel 20px above the header, because `delta`
// (the distance moved since the previous frame) and the newly-released target disagree by the slot offset.
check('the glide is gated on ENTERING a dock, not on the dock state changing either way',
  /const enteringDock = edgeChanged && dockedEdge !== null/.test(popovers)
    && /&& settledDocked === false && \(enteringDock \|\| reflowed\)\)/.test(popovers),
  'leaving a dock still animates, which is what overshoots the header')

check('a reflow-driven move while anchored is still animated',
  /const reflowed = scrolled === false && previousEdge === dockedEdge/.test(popovers)
    && /\(enteringDock \|\| reflowed\)/.test(popovers),
  'the reflow glide was removed along with the leaving glide')

// ── The empty panel is deliberately not rescued ────────────────────────────
check('an empty panel is never rescued',
  /if \(hasInput === false\) return false/.test(decision),
  'an empty panel is rescued, so it no longer scrolls away with its passage')

// ── The docked slot is rounded where it lives ──────────────────────────────
// Rounding the CONTENT-space `top` instead leaves an integer fighting a fractional `scrollTop`: measured as 1px of
// drift and a snap back on every sub-pixel scroll step.
check('the docked slot is not rounded after the content-space conversion',
  /top: docked === null\s*\n\s*\? Math\.round\(inViewport\.top - scrollerBox\.top \+ scroller\.scrollTop\)\s*\n\s*: inViewport\.top - scrollerBox\.top \+ scroller\.scrollTop/.test(popovers),
  'the docked top is rounded in content space, so it cannot cancel a fractional scroll offset')

check('the slot itself is rounded in viewport space',
  /const top = dockSlotTop\('top', band, size, gap\)/.test(layout)
    && /const bottom = dockSlotTop\('bottom', band, size, gap\)/.test(layout),
  'the slot is not a whole viewport pixel, so the painted edge is soft and the cancellation inexact')

check('the per-frame watcher also reacts to the scroll offset',
  /const scrollNow = scroller === null \|\| scroller === undefined \? 0 : scroller\.scrollTop/.test(popovers)
    && /\&\& scrollNow === lastScroll\) return/.test(popovers),
  'a docked panel is only re-placed when the anchor box changes, so it drifts between those frames')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
