/**
 * Guard how the bubble is positioned.
 *
 * The bubble must be INDEPENDENT of zoom, pane drags and text reflow: it tracks
 * only the annotated passage. The only way to get that is to let layout own the
 * geometry — mount the bubble inside the row that holds the passage, and position
 * it with CSS.
 *
 * Every previous attempt kept the bubble in a coordinate space of its own and
 * recomputed its position. That is why each new event (zoom, a pane drag, a
 * sidebar toggle, a line wrap) produced a new drift: any event the recomputation
 * did not know about left the stored coordinates stale.
 *
 * Run: node test/bubble-anchoring.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'client.js'), 'utf8')
const css = /const (?:CSS|STYLESHEET) = `([\s\S]*?)`\n/.exec(source)?.[1] ?? ''

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

const markerRule = /\.qc-marker\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''
const markerLayer = /function MarkerLayer\(props\) \{([\s\S]*?)\n    \}\n/.exec(source)?.[1] ?? ''

// ── 1. Anchored by layout, not by arithmetic ──────────────────────────────
check('the bubble is positioned horizontally by CSS',
  /right:\s*\d+px/.test(markerRule),
  'the bubble has no CSS right offset; its x must come from measurement')
check('the bubble is not given an inline x/y',
  !/qc-marker[\\s\\S]{0,400}style: \\{ left:/.test(source),
  'the bubble still receives computed coordinates')
check('the bubble is mounted into its row',
  /String\(position\.number\)\), row\)\)/.test(source),
  'the bubble is not mounted inside the row element')
check('rows hosting a bubble become positioning contexts',
  /getComputedStyle\(row\)\.position === 'static'/.test(source)
    && /row\.style\.position = 'relative'/.test(source),
  'an absolutely positioned bubble has no positioned ancestor')
check('the host row is derived from the passage',
  /function rowOf\(range, flow\)/.test(source)
    && /closest\('\[data-chat-node-key\]'\)/.test(source),
  'the row is not the element containing the passage')

// ── 2. No coordinate recomputation remains ────────────────────────────────
check('the marker layer computes no topInScroller',
  !/topInScroller/.test(markerLayer),
  'a stored vertical coordinate survives, so it can go stale')
check('the marker layer computes no gutter',
  !/const gutter =/.test(markerLayer),
  'a stored horizontal coordinate survives')
check('there is no separate coordinate-shifting path',
  !/const shift = \(\) =>/.test(source),
  'a shift() path still exists to recompute positions')
check('scroll does not re-measure',
  !/addEventListener\('scroll', schedule/.test(markerLayer),
  'scrolling still triggers measurement')

// ── 3. A resize refreshes the set, not the geometry ───────────────────────
check('a resize only refreshes which bubbles exist',
  /const reflow = \(\) =>/.test(source) && /publish\(measured\)/.test(source),
  'a resize recomputes geometry')
check('reflow does not read layout',
  (() => {
    const body = /const reflow = \(\) => \{([\s\S]*?)\n        \}/.exec(source)?.[1] ?? ''
    return body !== '' && !/getBoundingClientRect|clientWidth|getComputedStyle/.test(body)
  })(), 'the resize path still reads layout')

// ── 4. Zoom needs no special handling any more ────────────────────────────
// With CSS positioning the browser re-lays the row on zoom; nothing to invalidate.
check('the marker layer keeps no column cache',
  !/columnCache/.test(/function MarkerLayer\(props\) \{([\s\S]*?)\n    \}\n/.exec(source)?.[1] ?? ''),
  'the marker layer still caches a column box, implying it recomputes geometry')

// ── 5. Identity-based diffing ─────────────────────────────────────────────
check('the diff compares row identity, not coordinates',
  /function samePositions\(left, right\)/.test(source)
    && /a\.row !== b\.row/.test(source),
  'the diff compares stale coordinates')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
