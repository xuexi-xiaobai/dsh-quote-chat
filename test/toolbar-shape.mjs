/**
 * The toolbar's shape: how wide it is, and the line between its two actions.
 *
 * Two decisions from issues #16 and #17 that would silently undo themselves.
 *
 * ## The label is a label, not a sentence (#16)
 *
 * "在侧边聊天中提问" is eight characters; "添加注释" is four. Measured, that made the second button
 * 139.1px against the first's 88px, and the popup 237px wide over a 742px text column — a floating
 * chip covering a third of the line. Shortened to 侧边提问 both buttons measure 88px and the popup
 * 186px. CJK glyphs are a fixed width, so comparing character counts bounds the width difference
 * without a browser.
 *
 * The trap is that `side.noQuote` quotes the button text inside its own sentence. Renaming the
 * button without editing that string leaves a guide pointing at a label that no longer exists, and
 * `test/locale-parity.mjs` cannot see it: the key is still there in both languages, only the prose
 * is stale. So the quote is checked against the real value, in both languages.
 *
 * ## The divider has to be inset (#17)
 *
 * It was `box-shadow: inset 1px 0 0 var(--dsw-alias-border-l1)`. That token is 4% black, invisible
 * on the popup's #E9ECF2; and an inset shadow spans the full button height, so the line ran into the
 * 7px corner radius and read as a rendering artefact. It is now a pseudo-element inset 6px from each
 * end at 8%, which needs `position:relative` on the button to anchor to.
 *
 * Run: node test/toolbar-shape.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zh, en } from '../src/locales.js'

const here = dirname(fileURLToPath(import.meta.url))
const css = (await readFile(join(here, '..', 'src', 'stylesheet.js'), 'utf8')).replace(/\r\n/g, '\n')

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** The rule body for one selector, so a check reads the rule it names and not the whole sheet. */
const ruleOf = (selector) => {
  const index = css.indexOf(`\n${selector}{`)
  if (index === -1) return ''
  const start = index + selector.length + 2
  const end = css.indexOf('}', start)
  return end === -1 ? '' : css.slice(start, end)
}

const annotate = zh['popup.annotate'] ?? ''
const askInSide = zh['popup.askInSide'] ?? ''

check('both toolbar labels are still there',
  annotate.length > 0 && askInSide.length > 0,
  'a label key was renamed; the checks below would pass vacuously')

// ── #16: the two halves are the same size ────────────────────────────────
check('the side-chat label is a label, not a sentence',
  [...askInSide].length <= 6,
  `"${askInSide}" is ${[...askInSide].length} characters; it was 8 and made the button 58% wider`)

check('the two labels are within two characters of each other',
  Math.abs([...annotate].length - [...askInSide].length) <= 2,
  `"${annotate}" (${[...annotate].length}) vs "${askInSide}" (${[...askInSide].length}): CJK glyphs are a fixed `
  + 'width, so this is the button width difference')

// ── #16: the guide quotes the label, and the quote must still be true ─────
check('the Chinese guide quotes the current button text',
  (zh['side.noQuote'] ?? '').includes(`“${askInSide}”`),
  'side.noQuote still names the old label; the guide points at a button that no longer says that')

check('the English guide quotes the current button text',
  (en['side.noQuote'] ?? '').includes(`“${en['popup.askInSide']}”`),
  'side.noQuote still names the old label in English')

// ── #17: the divider is a pseudo-element, inset, at 8% ───────────────────
check('the button anchors its own pseudo-element',
  /position:relative/.test(ruleOf('.qc-popup button')),
  'no position:relative, so the divider would position against the popup instead of the button')

check('no inset box-shadow divider is left',
  !/box-shadow:\s*inset 1px 0 0/.test(ruleOf('.qc-popup button+button')),
  'the full-height inset shadow is back; it runs into the corner radius and the 4% token is invisible')

const divider = ruleOf('.qc-popup button+button::before')
check('the divider is a pseudo-element',
  divider.length > 0, 'the ::before rule was renamed or removed')

check('the divider stops short of both ends',
  /top:6px/.test(divider) && /bottom:6px/.test(divider),
  'the divider spans the full height again and will touch the 7px corners')

// The line is anchored to the SECOND button's left edge, and the flex gap runs from -gap to 0 in that
// space, so the centre is -gap/2. A width-w line centred there starts at -(gap + w) / 2. At left:-1px
// with a 2px gap the line spanned [-1, 0]: its own left edge sat on the centre and the whole line fell
// in the right half, flush against the button — measured 1px of space on the left and 0 on the right.
const gap = Number.parseFloat(/gap:\s*(-?[\d.]+)px/.exec(ruleOf('.qc-popup'))?.[1] ?? '')
const lineLeft = Number.parseFloat(/left:\s*(-?[\d.]+)px/.exec(divider)?.[1] ?? '')
const lineWidth = Number.parseFloat(/[;{\s]width:\s*(-?[\d.]+)px/.exec(divider)?.[1] ?? '')

check('the divider is centred in the gap, not flush against a button',
  Number.isFinite(gap) && Number.isFinite(lineLeft) && Number.isFinite(lineWidth)
  && Math.abs(lineLeft - -(gap + lineWidth) / 2) < 0.001,
  `left:${lineLeft}px with gap:${gap}px and width:${lineWidth}px is off-centre; `
  + `it should be ${Number.isFinite(gap) && Number.isFinite(lineWidth) ? -(gap + lineWidth) / 2 : '?'}px`)

check('the divider colour comes from a theme token, not a literal',
  /var\(--dsw-alias-[a-z0-9-]+\)/.test(divider) && !/(rgba?|hsla?)\(/.test(divider) && !/#[0-9a-f]{3,8}\b/i.test(divider),
  'a hardcoded colour cannot follow the theme: rgba(0,0,0,.08) read as 19 channel steps in light and 9 in dark, '
  + 'because the host flips its borders to white overlays in dark mode')

check('the divider uses border-l2, not the fainter border-l1',
  /--dsw-alias-border-l2/.test(divider) && !/--dsw-alias-border-l1/.test(divider),
  'border-l1 is 4% black / 6% white, too faint on this popup in either theme')

// ── Report ───────────────────────────────────────────────────────────────
let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok || item.detail === '' ? '' : `\n      ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
