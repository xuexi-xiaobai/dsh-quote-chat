/**
 * Accessibility and the states nobody looks at: the toolbar's name, its focus ring, its disabled
 * dimming, and motion for people who asked for less of it. Issues #18 and #19.
 *
 * ## The name
 *
 * `role="toolbar"` with no accessible name announces "toolbar" and stops. The label has to say what
 * the toolbar acts on, and it has to exist in both languages — `test/locale-parity.mjs` covers key
 * alignment, this covers the wiring from the locale table to the element.
 *
 * ## The focus ring
 *
 * This surface had no `:focus-visible` rule at all. Measured by setting `outline:none` and getting a
 * byte-identical screenshot, which proved the browser's own ring was the only thing painted. The host
 * draws rings as `outline:<width> solid <colour>` and sets `--dsw-focus-ring-color` to transparent for
 * pointer users, so the rule has to read that token — writing a colour of our own would override a
 * policy the host applies on purpose.
 *
 * ## The disabled dim
 *
 * `opacity:.45` on the button multiplied with `opacity:.8` on the icon, so the icon faded to .36 while
 * its label faded to .45 — the same double-opacity mistake the toolbar icons themselves came out of.
 *
 * ## The motion
 *
 * Eleven animations and transitions, none of which read `prefers-reduced-motion`. The OS setting is not
 * a preference for these users, it is whether the interface is usable.
 *
 * Run: node test/accessibility.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zh, en } from '../src/locales.js'

const here = dirname(fileURLToPath(import.meta.url))
const read = async (file) => (await readFile(join(here, '..', file), 'utf8')).replace(/\r\n/g, '\n')

const css = await read('src/stylesheet.js')
const popovers = await read('src/ui/popovers.js')
const dock = await read('src/ui/dock.js')

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** The declaration block for one selector, so a check reads the rule it names. */
const ruleOf = (selector) => {
  const index = css.indexOf(`\n${selector}{`)
  if (index === -1) return ''
  const start = index + selector.length + 2
  const end = css.indexOf('}', start)
  return end === -1 ? '' : css.slice(start, end)
}

// ── #18, part one: the toolbar has a name ────────────────────────────────
check('the toolbar element carries an accessible name',
  /role: 'toolbar',[\s\S]{0,240}'aria-label': labels\.toolbarLabel/.test(popovers),
  'role="toolbar" without a label announces the role and nothing about what it acts on')

check('the name is wired from the locale table, not hardcoded',
  /toolbarLabel: t\('popup\.toolbarLabel'\)/.test(dock),
  'the label bypasses t(), so it will not follow the interface language')

check('both languages define the name, and they differ',
  (zh['popup.toolbarLabel'] ?? '').length > 0
  && (en['popup.toolbarLabel'] ?? '').length > 0
  && zh['popup.toolbarLabel'] !== en['popup.toolbarLabel'],
  'a missing or copied translation would read as untranslated jargon on screen')

// ── #18, part two: a focus ring of our own ───────────────────────────────
const focus = ruleOf('.qc-popup button:focus-visible')

check('the toolbar declares its own focus ring',
  focus.length > 0,
  'no :focus-visible rule, so keyboard focus falls through to the browser default')

check('the ring reads the host focus tokens instead of picking a colour',
  /var\(--dsw-focus-ring-color/.test(focus) && /var\(--dsw-focus-ring-width/.test(focus),
  'a hardcoded colour would override the host policy that hides the ring for pointer users')

check('the ring falls back when the host tokens are absent',
  /var\(--dsw-focus-ring-color,\s*var\(--dsw-alias-state-business-primary\)\)/.test(focus)
  && /var\(--dsw-focus-ring-width,\s*\d/.test(focus),
  'an undefined token makes the whole outline declaration invalid, which leaves no ring at all')

check('the ring is drawn inside the button',
  /outline-offset:\s*-\d/.test(focus),
  'the buttons sit 3px inside the popup, so an outward ring lands on the popup edge')

// ── #18, part three: disabled dims once ──────────────────────────────────
check('a disabled button still dims as a whole',
  /opacity:\.45/.test(ruleOf('.qc-popup button:disabled')),
  'the disabled state stopped being distinguishable at all')

check('the icon does not dim a second time inside a disabled button',
  /opacity:\s*1/.test(ruleOf('.qc-popup button:disabled svg')),
  'the icon multiplies .45 by its own .8 and lands at .36 while the label sits at .45')

// ── #19: motion, for people who asked for less of it ─────────────────────
const reduced = /@media \(prefers-reduced-motion: reduce\)\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''

check('the stylesheet answers the reduced-motion setting',
  reduced.length > 0,
  'the setting is ignored, so the toolbar still slides in and the cards still pop')

check('the rule covers pseudo-elements as well as elements',
  /\*,?\s*\*::before,?\s*\*::after/.test(reduced),
  'animations on ::before/::after would keep running')

check('both durations are collapsed',
  /animation-duration:\s*\.01ms!important/.test(reduced)
  && /transition-duration:\s*\.01ms!important/.test(reduced),
  'one of the two is still full length')

check('durations collapse to .01ms rather than none',
  !/animation:\s*none/.test(reduced) && !/transition:\s*none/.test(reduced),
  'a value of none never fires transitionend/animationend, and code waits on those')

check('repeating animations are capped at one iteration',
  /animation-iteration-count:\s*1!important/.test(reduced),
  'an infinite animation would keep looping even at .01ms per cycle')

// ── Report ───────────────────────────────────────────────────────────────
let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok || item.detail === '' ? '' : `\n      ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
