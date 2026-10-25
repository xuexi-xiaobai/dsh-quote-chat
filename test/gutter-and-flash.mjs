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
const css = /const CSS = `([\s\S]*?)`\n/.exec(source)?.[1] ?? ''

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
check('the marker sits to the right of the flow',
  /flowRect\.right \+ 8/.test(source), 'the gutter offset is not past the flow right edge')
check('the marker is level with the passage top, not its middle',
  /rect\.top \+ Math\.min\(rect\.height, 20\) \/ 2 - 9/.test(source),
  'the marker is not anchored to the passage top')
check('the marker stays inside the viewport',
  /window\.innerWidth - 28/.test(source), 'the gutter offset can overflow the viewport')

// The bubble must show the same number as the chip. The chip number is the
// chip's position in the draft, so reading annotation.number would disagree.
check('the marker reads the chip ordinal, not the stored number',
  /chipOrdinals\(occurrences\)/.test(source)
    && /ordinals\.get\(annotation\.id\) \?\? annotation\.number/.test(source),
  'the marker does not use the chip ordinal')
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
check('the highlight uses CSS.highlights',
  /CSS\.highlights\.set\(FLASH_HIGHLIGHT/.test(source),
  'the jump no longer paints a registry highlight')
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
check('sameText normalises non-breaking and ideographic spaces',
  /\\u00a0/.test(source) && /\\u3000/.test(source),
  'sameText only collapses \\s, so NBSP/ideographic spaces break the anchor')
check('sameText strips zero-width characters',
  /\\u200b-\\u200d/.test(source), 'sameText keeps zero-width characters')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
