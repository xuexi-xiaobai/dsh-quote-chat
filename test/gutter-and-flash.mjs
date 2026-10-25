/**
 * Guard the gutter marker and the jump highlight.
 *
 * Two behaviours the plugin must get right:
 *
 *   1. Each annotation gets a blue bubble in the right gutter, level with the TOP
 *      of the annotated passage, numbered to match its chip.
 *   2. Clicking a chip scrolls to the passage and highlights it — and the
 *      highlight has to survive the transcript's virtualiser rebuilding the rows.
 *
 * Run: node test/gutter-and-flash.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'client.js'), 'utf8')
const css = /const (?:CSS|STYLESHEET) = `([\s\S]*?)`\n/.exec(source)?.[1] ?? ''

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

// ── 1. The gutter bubble ───────────────────────────────────────────────────
const markerRule = /\.qc-marker\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''
check('a marker rule exists', markerRule !== '', 'no .qc-marker rule')
check('the marker is blue', /background:#2f7df6/i.test(markerRule),
  'the marker is not blue')
check('the marker is a bubble, not a plain dot',
  /border-radius:9\.5px 9\.5px 9\.5px 3px/.test(markerRule) || /\.qc-marker::after/.test(css),
  'the marker has no bubble shape/tail')
check('the marker shows a number', /String\(position\.number\)|String\(number\)/.test(source),
  'the marker does not render its ordinal')
check('the marker sits to the right of the text column',
  /column\.right \+ 8/.test(source), 'the gutter offset is not past the column edge')
check('the marker is level with the passage top, not its middle',
  /rect\.top \+ Math\.min\(rect\.height, 20\) \/ 2 - 9/.test(source),
  'the marker is not anchored to the passage top')
check('the marker stays inside the viewport',
  /window\.innerWidth - 28/.test(source), 'the gutter offset can overflow the viewport')

// The flow anchor is `display:contents`: it has NO box, so
// `flow.getBoundingClientRect()` returns zeros. Measuring against it put the
// gutter at the left edge and made the visibility gate reject every passage.
check('the column is measured from rows, not the box-less anchor',
  /function flowColumn\(flow\)/.test(source)
    && /data-chat-node-key/.test(source),
  'the marker still measures the display:contents anchor')
check('the marker does not use flow.getBoundingClientRect',
  !/const flowRect = flow\.getBoundingClientRect\(\)/.test(source),
  'the marker is still framed by the box-less anchor')
check('the visibility gate uses the viewport, not the flow box',
  /rect\.bottom < 0 \|\| rect\.top > window\.innerHeight/.test(source),
  'the gate compares against the zero-height flow box')

// The bubble must show the same number as the chip. The chip number is the
// chip's position in the draft, so reading annotation.number would disagree.
check('the marker reads the chip ordinal',
  /chipOrdinals\(occurrences\)/.test(source)
    && /const number = ordinals\.get\(annotation\.id\)/.test(source),
  'the marker does not use the chip ordinal')
// A chip deleted with the keyboard removes the occurrence without calling back
// into the plugin, so the store keeps an entry with no chip. Marking it would
// leave a bubble for a passage the user already un-annotated.
check('a bubble is drawn only while its chip exists',
  /const number = ordinals\.get\(annotation\.id\)[\s\S]{0,90}if \(number === undefined\) continue/.test(source),
  'annotations without a chip still get a bubble')
check('chipOrdinals pairs by reference id',
  /item\.source === CHIP_SOURCE[\s\S]{0,80}item\.ref/.test(source),
  'chipOrdinals does not pair by ref')
check('chipOrdinals numbers from 1 in DOM order',
  /ordinals\.set\(refs\[index\], index \+ 1\)/.test(source),
  'chipOrdinals does not number by position')
check('MarkerLayer receives occurrences',
  /h\(MarkerLayer, \{ annotations, occurrences, labels, onJump \}\)/.test(source),
  'MarkerLayer is mounted without occurrences')

// ── 2. The jump highlight ──────────────────────────────────────────────────
// The module-scope stylesheet must NOT be called `CSS`. That name shadows the
// browser global for the whole module, and a shadowed global is how the flash
// came to never paint: `CSS.highlights` read back undefined.
check('the stylesheet is not named CSS',
  /const STYLESHEET = `/.test(source) && !/const CSS = `/.test(source),
  'the stylesheet shadows the global CSS object')
check('the highlight reads the global off window',
  /window\.CSS\.highlights\.set\(/.test(source),
  'the highlight reads an identifier that a local binding can shadow')
check('canPaintHighlight does not trust a shadowable identifier',
  /const registry = typeof window === 'undefined' \? undefined : window\.CSS/.test(source),
  'canPaintHighlight checks a bare identifier')

// ── 2b. The jump lands on the passage, not the end of the transcript ──────
// `scrollIntoView` on the containing ROW aligns the row, and a row can be taller
// than the viewport, so its centre is nowhere near the quoted line.
check('the jump scrolls the range to the middle of the viewport',
  /scroller\.scrollTop\s*[\s\S]{0,200}\(box\.height - rect\.height\) \/ 2/.test(source),
  'the jump still centres the row instead of the passage')
check('the jump clamps to the scroll range',
  /Math\.min\(Math\.max\(0, target\), max\)/.test(source),
  'the jump can scroll past the end')
check('the jump falls back to nearest, not center',
  /scrollIntoView\(\{ block: 'nearest'/.test(source),
  'the fallback still centres a possibly-tall row')

check('the highlight rule is registered',
  /::highlight\(quote-chat-flash\)/.test(css),
  'the ::highlight rule is missing')
check('the highlight is yellow',
  /::highlight\(quote-chat-flash\)\{background-color:rgba\(255,214,0/.test(css),
  'the flash is not yellow')
// The virtualiser rebuilds rows after a scroll, unmounting the nodes the first
// range pointed at; a highlight over dead nodes paints nothing.
check('the highlight re-resolves after the scroll settles',
  /flashRange\(range, FLASH_MS, \(\) =>/.test(source),
  'the flash is painted once over a range the virtualiser may have replaced')
check('flashRange accepts a re-resolve callback',
  /function flashRange\(range, ms = FLASH_MS, resolve = null\)/.test(source),
  'flashRange has no re-resolve hook')
check('the re-resolve re-reads the live anchor',
  /const live = findFlow\(\)[\s\S]{0,120}resolveAnchor\(live, annotation\.anchor\)/.test(source),
  'the re-resolve does not re-read the anchor')

// ── 3. Anchor text matching tolerates rich-text whitespace ────────────────
check('one whitespace definition is shared',
  /function squishText\(value\)/.test(source)
    && /function sameText\(left, right\) \{[\s\S]{0,120}squishText/.test(source)
    && /const needle = squishText\(quote\)/.test(source),
  'sameText and locateText do not share a whitespace definition')
check('non-breaking and ideographic spaces are folded',
  /u00a0/.test(source) && /u3000/.test(source),
  'NBSP/ideographic spaces are not handled')
check('zero-width characters are stripped',
  /u200b-/u.test(source) || /\\u200b-\\u200d/.test(source), 'zero-width characters are kept')
check('locateText uses the shared space class',
  /new RegExp\(`\[\\\\s\$\{EXTRA_SPACE\}\]`\)/.test(source),
  'locateText has its own whitespace test')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
