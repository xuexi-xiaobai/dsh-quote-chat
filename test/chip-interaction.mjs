/**
 * Guard the chip's interaction contract.
 *
 * Four rules, each of which was wrong at some point and is easy to break again:
 *
 * 1. The chip shows a kind glyph on its left — text vs table.
 * 2. The kind glyph stays visible while the chip is hovered. It used to be swapped for the ×, which made a hovered
 *    chip look like a different component from the one beside it.
 * 3. The × sits at the TRAILING end, inside the chip's reserved right padding, at a 24px pointer target.
 * 4. The × paints no body of its own: the pill's surface runs underneath.
 *
 * Run: node test/chip-interaction.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'src', 'index.js'), 'utf8')
// The annotation strip moved to its own module.
const cardsSource = await readFile(new URL('../src/ui/cards.js', import.meta.url), 'utf8')
// The stylesheet is its own module now.
const stylesheetSource = await readFile(join(here, '..', 'src', 'stylesheet.js'), 'utf8')
const css = /export const STYLESHEET = `([\s\S]*?)`\r?\n/.exec(stylesheetSource)?.[1] ?? ''

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
  /chip\.dataset\.qcKind = annotation\.kind === 'table' \? 'table' : 'text'/.test(cardsSource),
  'data-qc-kind is not derived from annotation.kind')

// ── 2. The × takes the kind glyph's slot ───────────────────────────────────
// They are mutually exclusive because they occupy the same box: the disc is centred on the glyph's slot at the glyph's
// own size, so showing both would stack a red disc on a blue icon.
check('hover hides the kind glyph',
  /\[data-composer-chip="quote-chat"\]:hover::before[\s\S]{0,120}opacity:0/.test(css),
  'the ::before glyph is still visible under the red disc')
check('the glyph stays hidden while the pointer is on the x',
  /\[data-composer-chip="quote-chat"\]\[data-qc-hover\]::before/.test(css)
    && /chip\.setAttribute\('data-qc-hover', '1'\)/.test(cardsSource),
  'the × is a portal, so the chip loses :hover while the pointer is on it and the glyph would reappear under the disc')

// ── 3. The × is a red disc in the leading slot ─────────────────────────────
const removeRule = /\.qc-chip-remove\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''
check('the x is a fixed overlay', removeRule.includes('position:fixed'),
  `the .qc-chip-remove rule is: ${removeRule.slice(0, 80)}`)
// The button's own box is the HIT AREA and stays transparent; the disc is drawn by ::before at the kind glyph's size, so
// the two states share an outline. The review asked for exactly this: same position, same scale as the icon, red.
check('the button box is transparent, the disc is drawn separately',
  /background:transparent/.test(removeRule) && /\.qc-chip-remove::before\{[^}]*background:#e8291c/.test(css),
  'the disc is not drawn by ::before, so it cannot be sized independently of the hit area')
check('the disc matches the kind glyph\'s box',
  /\.qc-chip-remove::before\{[^}]*inset:0/.test(css)
    && /width:var\(--qc-chip-glyph, 1\.12em\);height:var\(--qc-chip-glyph, 1\.12em\)/.test(removeRule),
  'the control is not sized from the kind glyph, so the two states have different outlines')
check('the cross is white on the red disc',
  /\.qc-chip-remove svg path\{[^}]*stroke:#fff/.test(css),
  'the cross is not white')
check('the x has no floating ring', !/box-shadow:\s*0 0 0/.test(removeRule),
  'the surface-coloured ring that made the disc read as pasted on is back')
// The × is placed from the chip's rectangle through custom properties, and the two values that decide its horizontal
// position arrive as PIXELS: the chip's left padding and the kind glyph's width. Em values would drift, because the
// chip inherits the composer's font size while the button carries its own.
check('the x is positioned by the chip rectangle, not by an edge',
  /'--qc-chip-left': `\$\{hover\.anchor\.left\}px`/.test(cardsSource)
    && /'--qc-chip-top': `\$\{hover\.anchor\.top\}px`/.test(cardsSource),
  'the x is no longer placed from the chip rectangle')
check('the x is centred on the leading glyph slot',
  /left:calc\(var\(--qc-chip-left[^)]*\) \+ var\(--qc-chip-pad-left[^)]*\) \+ var\(--qc-chip-glyph[^)]*\) \/ 2\)/.test(css),
  'the x is not centred on the slot the kind glyph occupies')
check('the leading slot is passed in pixels',
  /'--qc-chip-pad-left': `\$\{hover\.anchor\.padLeft\}px`/.test(cardsSource)
    && /'--qc-chip-glyph': `\$\{hover\.anchor\.glyph\}px`/.test(cardsSource),
  'the x slot is positioned from a value that cannot track the chip')
check('the chip reserves no trailing slot',
  /\[data-composer-chip="quote-chat"\]\{[^}]*padding:0 \.5em;/.test(css),
  'the pill still carries the lopsided right padding that the trailing design needed')
check('the x is the icon\'s size, and still a 24px pointer target',
  /width:var\(--qc-chip-glyph, 1\.12em\);height:var\(--qc-chip-glyph, 1\.12em\)/.test(removeRule)
    && /\.qc-chip-remove::after\{[^}]*width:24px;height:24px/.test(css),
  'either the control no longer matches the icon, or the 24px WCAG 2.2 AA hit area is gone')
check('the x is round like the pill',
  /\.qc-chip-remove::before\{[^}]*border-radius:999px/.test(css),
  'the disc does not share the pill radius')

// The cross is drawn, not typed. A text multiplication sign carries the font's
// baseline and side bearings, so it sat high and looked undersized no matter how
// it was nudged; the SVG is centred by construction.
check('the cross is an svg, not a text character',
  /className: 'qc-chip-remove',[\s\S]{0,1600}h\('svg'/.test(cardsSource)
    && !/\}, '×'\)/.test(source),
  'the cross is still rendered as a text character')
check('the cross strokes meet at the exact centre',
  /viewBox: '0 0 10 10'/.test(cardsSource)
    && /M2\.6 2\.6 L7\.4 7\.4 M7\.4 2\.6 L2\.6 7\.4/.test(cardsSource),
  'the cross path is not symmetric about (5,5)')
check('the cross is drawn with round strokes',
  /\.qc-chip-remove svg path\{[^}]*stroke:#fff[^}]*stroke-linecap:round/.test(css),
  'the cross strokes are not round white')
check('the hover tint survives the trip to the x',
  /\[data-composer-chip="quote-chat"\]\[data-qc-hover\]/.test(css)
    && /chip\.setAttribute\('data-qc-hover', '1'\)/.test(cardsSource),
  'the × is a portal, so the chip loses :hover while the pointer is on it; without data-qc-hover the pill drops its tint mid-gesture')
check('the cross icon is at least 10px',
  (() => {
    const size = /\.qc-chip-remove svg\{[^}]*width:(\d+)px/.exec(css)
    return size !== null && Number(size[1]) >= 10
  })(), 'the cross icon is too small')

// ── 4. Hover survives the trip to the × ────────────────────────────────────
check('hover keeps the x reachable',
  /target\.closest\('\.qc-chip-remove'\) !== null/.test(cardsSource),
  'pointer logic no longer tolerates the x')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
