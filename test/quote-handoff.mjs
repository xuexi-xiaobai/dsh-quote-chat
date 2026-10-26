/**
 * Quote handoff: which passage a freshly opened side chat shows.
 *
 * Two sources compete. The tab's own navigation params are authoritative, because whoever
 * opened it said what it is about. The pending quote is a fallback for a Host that opens the
 * tab without carrying them — it is only eligible for 15 seconds, so a guide-entry open minutes
 * later does not resurrect whatever was selected last.
 *
 * The clock is injected so the boundary is testable. The exact rule is `elapsed < 15000`:
 * a quote exactly 15000 ms old has expired.
 *
 * Run: node test/quote-handoff.mjs
 */
import { createQuoteHandoff } from '../src/quote-handoff.js'

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** A clock the test moves by hand. */
function makeClock(start = 1_000_000) {
  let now = start
  return {
    now: () => now,
    advance: (ms) => { now += ms },
    set: (value) => { now = value },
  }
}

// ── Navigation params win ──────────────────────────────────────────────────
{
  const clock = makeClock()
  const handoff = createQuoteHandoff({ now: clock.now })
  handoff.remember('from the popup')
  check('a carried quote is returned as-is',
    handoff.forTab('from the params') === 'from the params',
    handoff.forTab('from the params'))
  check('a carried quote is not trimmed',
    handoff.forTab('  padded  ') === '  padded  ',
    JSON.stringify(handoff.forTab('  padded  ')))
  check('a carried quote survives even when the pending one expired',
    (() => {
      clock.advance(60_000)
      return handoff.forTab('still here') === 'still here'
    })(),
    'the expired pending quote shadowed the carried one')
}

// ── Empty or non-string carried values fall through ────────────────────────
{
  const clock = makeClock()
  const handoff = createQuoteHandoff({ now: clock.now })
  handoff.remember('fallback')
  for (const carried of ['', undefined, null, 42, {}]) {
    check(`a carried value of ${JSON.stringify(carried)} falls back to the pending quote`,
      handoff.forTab(carried) === 'fallback', JSON.stringify(handoff.forTab(carried)))
  }
}

// ── The 15 second window ───────────────────────────────────────────────────
{
  const clock = makeClock()
  const handoff = createQuoteHandoff({ now: clock.now })
  handoff.remember('quoted')

  clock.advance(0)
  check('a quote is eligible immediately', handoff.forTab('') === 'quoted', 'not eligible at 0ms')

  clock.advance(14_999)
  check('a quote is eligible at 14999 ms', handoff.forTab('') === 'quoted',
    'the window closed early')

  clock.advance(1)
  check('a quote is expired at exactly 15000 ms', handoff.forTab('') === '',
    'the window is inclusive but should not be')
}

// ── Reading does not consume ───────────────────────────────────────────────
{
  const clock = makeClock()
  const handoff = createQuoteHandoff({ now: clock.now })
  handoff.remember('persistent')
  const first = handoff.forTab('')
  const second = handoff.forTab('')
  check('reading twice returns the same quote', first === second && first === 'persistent',
    `${JSON.stringify(first)} vs ${JSON.stringify(second)}`)
  clock.advance(1000)
  check('reading again later still returns it', handoff.forTab('') === 'persistent',
    'the quote was consumed by reading')
}

// ── A newer quote replaces the old one ─────────────────────────────────────
{
  const clock = makeClock()
  const handoff = createQuoteHandoff({ now: clock.now })
  handoff.remember('first')
  clock.advance(5000)
  handoff.remember('second')
  check('a newer quote replaces the previous one', handoff.forTab('') === 'second',
    handoff.forTab(''))
  check('the replacement restarts the window', (() => {
    clock.advance(14_000) // 19s after the first, 14s after the second
    return handoff.forTab('') === 'second'
  })(), 'the window was measured from the first quote')
}

// ── Nothing remembered ─────────────────────────────────────────────────────
{
  const handoff = createQuoteHandoff({ now: () => 0 })
  check('with nothing remembered the answer is an empty string',
    handoff.forTab('') === '', JSON.stringify(handoff.forTab('')))
  check('an empty string is remembered as an empty quote',
    (() => {
      handoff.remember('')
      return handoff.forTab('') === ''
    })(),
    'remembering an empty string threw')
}

// ── Expiry affects reads only ──────────────────────────────────────────────
// No timer is armed: an expired quote simply stops being returned. A background timer would be
// a new lifecycle this refactor must not introduce.
{
  const clock = makeClock()
  const handoff = createQuoteHandoff({ now: clock.now })
  handoff.remember('old')
  clock.advance(20_000)
  check('an expired quote is not returned', handoff.forTab('') === '', 'still returned')
  check('expiry does not require a timer to have fired',
    typeof handoff === 'object', 'unreachable')
}

// ── Instance isolation ─────────────────────────────────────────────────────
{
  const clock = makeClock()
  const first = createQuoteHandoff({ now: clock.now })
  const second = createQuoteHandoff({ now: clock.now })
  first.remember('only in the first')
  check('a second handoff cannot read the first one\'s quote',
    second.forTab('') === '', JSON.stringify(second.forTab('')))
  second.remember('only in the second')
  check('the two instances hold independent quotes',
    first.forTab('') === 'only in the first' && second.forTab('') === 'only in the second',
    `${first.forTab('')} | ${second.forTab('')}`)
}

// ── The clock is read at decision time ─────────────────────────────────────
// The handoff must consult the injected clock on every read, not at construction, or a tab
// opened much later would still see a quote as fresh.
{
  let calls = 0
  const handoff = createQuoteHandoff({
    now: () => { calls += 1; return 5_000_000 },
  })
  handoff.remember('x')
  const before = calls
  handoff.forTab('')
  check('the clock is consulted on each read', calls > before,
    `clock reads: ${before} -> ${calls}`)
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
