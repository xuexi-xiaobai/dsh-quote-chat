/**
 * Guard the hover card's interaction contract.
 *
 * Four behaviours were asked for and each is easy to undo by accident:
 *
 *   1. Leaving the chip starts a grace period instead of closing at once.
 *   2. Coming back inside that window cancels the close.
 *   3. The card has no ordinal and no removal control of its own.
 *   4. The card is sized to its content, not to a fixed wide sheet.
 *
 * Run: node test/hover-card.mjs
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
const css = /export const STYLESHEET = `([\s\S]*?)`\n/.exec(stylesheetSource)?.[1] ?? ''

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

// ── 1 & 2. The grace period ────────────────────────────────────────────────
check('a linger delay is defined',
  /const HOVER_LINGER_MS = \d+/.test(source), 'no HOVER_LINGER_MS constant')
check('leaving schedules a close instead of closing',
  /closeTimer = setTimeout\(\(\) => \{[\s\S]{0,120}setHover\(null\)/.test(cardsSource),
  'the pointer-out path closes immediately')
check('the close is a timeout, not a synchronous clear',
  /if \(annotation === undefined \|\| annotation === null\) \{[\s\S]{0,400}setTimeout/.test(cardsSource),
  'the exit path does not use a timer')
check('coming back cancels the pending close',
  /if \(closeTimer !== 0\) \{\s*clearTimeout\(closeTimer\)/.test(cardsSource),
  're-entering does not cancel the close')
check('the pending close is cleared on unmount',
  /if \(closeTimer !== 0\) clearTimeout\(closeTimer\)/.test(cardsSource),
  'the close timer leaks on unmount')

// The card must survive the trip from chip to card, so the pointer logic has to
// treat both as "still on this annotation".
check('the card counts as part of the hover',
  /target\.closest\('\.qc-card'\) !== null/.test(cardsSource),
  'the card is not treated as hoverable')

// ── 3. No ordinal, no removal control in the card ─────────────────────────
check('the card renders no number badge',
  !/qc-card-num/.test(cardsSource) && !/qc-card-head/.test(cardsSource),
  'the card still builds a header/badge')
check('the card renders no removal button',
  !/qc-card-remove/.test(cardsSource) && !/qc-card-hint/.test(cardsSource),
  'the card still builds a removal control')
check('the card carries a comment block and a body',
  /className: 'qc-card-comment'/.test(cardsSource) && /className: 'qc-card-body'/.test(cardsSource),
  'the card is missing its comment or body block')

// ── 4. Compact sizing ──────────────────────────────────────────────────────
const cardRule = /\.qc-card\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''
check('the card sizes to its content',
  cardRule.includes('width:max-content'),
  'the card still has a fixed width')
check('the card caps its width',
  /max-width:min\(\d+px,\s*\d+vw\)/.test(cardRule),
  'the card has no max-width cap')
check('the card is narrower than the old 560px sheet',
  (() => {
    const cap = /max-width:min\((\d+)px/.exec(cardRule)
    return cap !== null && Number(cap[1]) <= 400
  })(), 'the max-width cap is still wide')
check('the body scrolls instead of growing without bound',
  /\.qc-card-body\{[^}]*max-height:\d+px[^}]*overflow:auto/.test(css),
  'the body has no capped height with scroll')

// ── Animation ─────────────────────────────────────────────────────────────
check('the card fades in',
  /animation:qc-card-in/.test(cardRule) && /@keyframes qc-card-in/.test(css),
  'the card has no entrance animation')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
