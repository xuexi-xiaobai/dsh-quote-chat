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
const source = await readFile(join(here, '..', 'client.js'), 'utf8')
const css = /const CSS = `([\s\S]*?)`\n/.exec(source)?.[1] ?? ''

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

// ── 1 & 2. The grace period ────────────────────────────────────────────────
check('a linger delay is defined',
  /const HOVER_LINGER_MS = \d+/.test(source), 'no HOVER_LINGER_MS constant')
check('leaving schedules a close instead of closing',
  /closeTimer = setTimeout\(\(\) => \{[\s\S]{0,120}setHover\(null\)/.test(source),
  'the pointer-out path closes immediately')
check('the close is a timeout, not a synchronous clear',
  /if \(annotation === undefined \|\| annotation === null\) \{[\s\S]{0,400}setTimeout/.test(source),
  'the exit path does not use a timer')
check('coming back cancels the pending close',
  /if \(closeTimer !== 0\) \{\s*clearTimeout\(closeTimer\)/.test(source),
  're-entering does not cancel the close')
check('the pending close is cleared on unmount',
  /if \(closeTimer !== 0\) clearTimeout\(closeTimer\)/.test(source),
  'the close timer leaks on unmount')

// The card must survive the trip from chip to card, so the pointer logic has to
// treat both as "still on this annotation".
check('the card counts as part of the hover',
  /target\.closest\('\.qc-card'\) !== null/.test(source),
  'the card is not treated as hoverable')

// ── 3. No ordinal, no removal control in the card ─────────────────────────
check('the card renders no number badge',
  !/qc-card-num/.test(source) && !/qc-card-head/.test(source),
  'the card still builds a header/badge')
check('the card renders no removal button',
  !/qc-card-remove/.test(source) && !/qc-card-hint/.test(source),
  'the card still builds a removal control')
check('the card markup is only comment + body',
  /className: 'qc-card',[\s\S]{0,700}qc-card-body/.test(source),
  'the card has extra furniture')

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
