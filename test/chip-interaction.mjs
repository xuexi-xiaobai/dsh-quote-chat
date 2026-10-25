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
const source = await readFile(join(here, '..', 'client.js'), 'utf8')
const css = /const CSS = `([\s\S]*?)`\n/.exec(source)?.[1] ?? ''

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
// Its left edge must be the chip's left edge plus the pill's own padding — a
// positive inset. A negative one would put it outside the pill.
check('the x is inset inside the chip, not outside it',
  /left: `\$\{hover\.anchor\.left \+ CHIP_INSET\}px`/.test(source),
  'the x is positioned outside the chip box')
check('the inset matches the pill padding',
  /const CHIP_INSET = 6/.test(source) && /padding:2px 9px 2px 7px/.test(css),
  'CHIP_INSET no longer matches the chip padding')

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
