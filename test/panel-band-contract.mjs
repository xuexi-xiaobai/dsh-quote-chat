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

// The exact regression: these three read `scrollerBox` before, which is the box that hides behind the composer.
check('neither hysteresis test reads the container box',
  /const clearlyOut = resting\.top < visibleTop - DOCK_MARGIN/.test(popovers)
    && /const comfortablyVisible = resting\.top >= visibleTop \+ DOCK_MARGIN/.test(popovers),
  'a hysteresis test still compares against the scroll container')

check('entering a dock is judged against the same band as the slot it moves to',
  /resting\.top < visibleTop - 1 \|\| restingBottom > visibleBottom \+ 1/.test(popovers),
  'the entry test still compares against the scroll container, so a panel can hide behind the composer')

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
  /const needsRescue = hasInput === false\s*\n\s*\? false/.test(popovers),
  'an empty panel is rescued, so it no longer scrolls away with its passage')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
