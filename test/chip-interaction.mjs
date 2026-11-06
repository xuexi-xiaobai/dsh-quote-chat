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

// ── 2. The kind glyph survives hover ───────────────────────────────────────
// The × used to take the leading slot, so the glyph had to disappear. With the × at the trailing end there is no
// reason to hide it, and hiding it is what made two chips in one sentence read as two different components.
check('hover does not hide the kind glyph',
  !/\[data-composer-chip="quote-chat"\]:hover::before[\s\S]{0,120}opacity:0/.test(css),
  'the ::before glyph is still hidden on hover, which is the icon-swap design')

// ── 3. The × lives inside the chip, at the trailing end ────────────────────
const removeRule = /\.qc-chip-remove\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''
check('the x is a fixed overlay', removeRule.includes('position:fixed'),
  `the .qc-chip-remove rule is: ${removeRule.slice(0, 80)}`)
// The × used to be a solid red disc with a white ring — a badge floating over the pill rather than a control of it.
// The integrated design paints no disc at all: the chip's own surface runs underneath and the × uses the label's ink.
check('the x paints no separate disc', /background:transparent/.test(removeRule),
  'the × still has a filled body of its own instead of letting the pill show through')
check('the x has no floating ring', !/box-shadow:\s*0 0 0/.test(removeRule),
  'the × still carries the surface-coloured ring that made it read as pasted on')
check('the x uses the chip ink, not white', /color:color-mix\(in srgb, var\(--qc-accent/.test(removeRule),
  'the × is not drawn in the same ink as the chip label')
check('the destructive red is reserved for the hovered x itself',
  /\.qc-chip-remove:hover\{[^}]*color:#e8291c/.test(css) && !/background:#e8291c/.test(removeRule),
  'the × should only turn red on hover, not carry a red body at rest')
// The × is placed from the chip's rectangle through custom properties, and the two values that decide its horizontal
// position arrive as PIXELS: the chip's width and its reserved right padding. Em values would drift, because the chip
// inherits the composer's font size while the button carries its own.
check('the x is positioned by the chip rectangle, not by an edge',
  /'--qc-chip-left': `\$\{hover\.anchor\.left\}px`/.test(cardsSource)
    && /'--qc-chip-top': `\$\{hover\.anchor\.top\}px`/.test(cardsSource),
  'the x is no longer placed from the chip rectangle')
check('the x is centred in the chip\'s reserved trailing padding',
  /left:calc\(var\(--qc-chip-left[^)]*\) \+ var\(--qc-chip-width[^)]*\) - var\(--qc-chip-pad-right[^)]*\) \/ 2\)/.test(css),
  'the x is not placed at the trailing end of the chip')
check('the chip reserves a trailing slot for the x',
  /\[data-composer-chip="quote-chat"\]\{[^}]*padding:0 1\.75em 0 \.5em/.test(css),
  'without reserved right padding the x would sit on top of the label')
check('the trailing slot and the chip width are passed in pixels',
  /'--qc-chip-width': `\$\{hover\.anchor\.width\}px`/.test(cardsSource)
    && /'--qc-chip-pad-right': `\$\{hover\.anchor\.padRight\}px`/.test(cardsSource),
  'the x slot is positioned from a value that cannot track the chip')
check('the x is a 24px pointer target, not an em-derived one',
  /\.qc-chip-remove\{[\s\S]*?width:24px;height:24px/.test(css),
  'the target is em-based again, so it shrinks below the 24px WCAG 2.2 AA minimum at the composer font size')
check('the x is round like the pill',
  /\.qc-chip-remove\{[\s\S]*?border-radius:999px/.test(css),
  'the x does not share the pill radius')

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
  /\.qc-chip-remove svg path\{[^}]*stroke:currentColor[^}]*stroke-linecap:round/.test(css),
  'the cross strokes do not inherit the control colour')
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
