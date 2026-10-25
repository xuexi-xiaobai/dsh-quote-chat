/**
 * Guard the chip's interaction contract.
 *
 * Three rules, each of which was wrong at some point and is easy to break again:
 *
 * 1. The chip shows a kind glyph on its left — text vs table.
 * 2. On hover that glyph is replaced, in the same slot, by the red ×.
 * 3. The × sits INSIDE the chip's box, not floating outside it.
 *
 * Run: node test/chip-interaction.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'src', 'index.js'), 'utf8')
const css = /const (?:CSS|STYLESHEET) = `([\s\S]*?)`\n/.exec(source)?.[1] ?? ''

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

// ── 1. Kind glyph ───────────────────────────────────────────────────────────
check('text glyph is defined', css.includes('--qc-glyph-text:url('), 'no --qc-glyph-text')
check('table glyph is defined', css.includes('--qc-glyph-table:url('), 'no --qc-glyph-table')
check('glyph reads the kind variable',
  css.includes('mask-image:var(--qc-glyph, var(--qc-glyph-text))'),
  'the ::before glyph does not read --qc-glyph')
check('table kind swaps the glyph',
  /\[data-composer-chip="quote-chat"\]\[data-qc-kind="table"\]\{--qc-glyph:var\(--qc-glyph-table\)\}/.test(css),
  'no rule switching to the table glyph')
check('the kind attribute is set from the annotation',
  /chip\.dataset\.qcKind = annotation\.kind === 'table' \? 'table' : 'text'/.test(source),
  'data-qc-kind is not derived from annotation.kind')

// ── 2. Glyph and × are mutually exclusive ──────────────────────────────────
check('hover hides the kind glyph',
  /\[data-composer-chip="quote-chat"\]:hover::before[\s\S]{0,120}opacity:0/.test(css),
  'the ::before glyph is still visible on hover')

// ── 3. The × lives inside the chip ─────────────────────────────────────────
const removeRule = /\.qc-chip-remove\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''
check('the x is a fixed overlay', removeRule.includes('position:fixed'),
  `the .qc-chip-remove rule is: ${removeRule.slice(0, 80)}`)
check('the x is red', /background:#e[0-9a-f]{5}/i.test(removeRule) || removeRule.includes('#e8291c'),
  'the x is not red')
// Its centre must land on the glyph's centre: the pill's left padding plus half
// the glyph box. A left-edge anchor would put it visibly off-centre.
check('the x is centred on the glyph slot',
  /left: `\$\{hover\.anchor\.left \+ GLYPH_CENTRE\}px`/.test(source),
  'the x is not positioned by the glyph centre')
check('the glyph centre is derived from the pill padding',
  /const GLYPH_CENTRE = 7 \+ \(13 \/ 2\)/.test(source),
  'GLYPH_CENTRE no longer matches padding-left + half glyph')
check('the x is round like the pill',
  /\.qc-chip-remove\{[\s\S]{0,400}border-radius:999px/.test(css),
  'the x does not share the pill radius')

// The cross is drawn, not typed. A text multiplication sign carries the font's
// baseline and side bearings, so it sat high and looked undersized no matter how
// it was nudged; the SVG is centred by construction.
check('the cross is an svg, not a text character',
  /className: 'qc-chip-remove',[\s\S]{0,800}h\('svg'/.test(source)
    && !/\}, '×'\)/.test(source),
  'the cross is still rendered as a text character')
check('the cross strokes meet at the exact centre',
  /viewBox: '0 0 10 10'/.test(source)
    && /M2\.6 2\.6 L7\.4 7\.4 M7\.4 2\.6 L2\.6 7\.4/.test(source),
  'the cross path is not symmetric about (5,5)')
check('the cross is drawn with round strokes',
  /\.qc-chip-remove svg path\{[^}]*stroke:#fff[^}]*stroke-linecap:round/.test(css),
  'the cross strokes are not round white')
check('the cross icon is at least 10px',
  (() => {
    const size = /\.qc-chip-remove svg\{[^}]*width:(\d+)px/.exec(css)
    return size !== null && Number(size[1]) >= 10
  })(), 'the cross icon is too small')

// ── 4. Hover survives the trip to the × ────────────────────────────────────
check('hover keeps the x reachable',
  /target\.closest\('\.qc-chip-remove'\) !== null/.test(source),
  'pointer logic no longer tolerates the x')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
