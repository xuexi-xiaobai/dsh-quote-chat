/**
 * Run every acceptance suite through ONE browser.
 *
 * ## Why this exists
 *
 * Each suite can run on its own, and that is how a single area gets debugged. But a full pass needs
 * all of them, and each standalone run launches chromium — about 3.4 seconds, measured. Three
 * launches is ten seconds of the same work repeated, which on a fast machine is most of the pass.
 *
 * So this opens one browser, hands it to each suite in turn, and closes it once. An added benefit is
 * that the DSH session stays warm between suites: the first one pays for the transcript render, the
 * rest inherit it.
 *
 * ## Failure isolation
 *
 * A suite that throws is recorded as that suite failing, and the campaign continues. Suites already
 * report a thrown body as a failed assertion, so this is the second line of defence — it also covers
 * a crash during setup, before the suite's own try block.
 *
 * ## Usage
 *
 *   node tools/accept-all.mjs <url> [--only name]
 *
 * Exits non-zero if any check failed.
 */
import { openBrowser } from './harness.mjs'
import { run as runLifecycle } from './accept-lifecycle.mjs'
import { run as runSideChat } from './accept-side-chat.mjs'
import { run as runHighlight } from './accept-highlight.mjs'

const SUITES = [
  { name: 'lifecycle', title: 'Annotation lifecycle', run: runLifecycle },
  { name: 'side-chat', title: 'Side chat', run: runSideChat },
  { name: 'highlight', title: 'Highlight lifecycle', run: runHighlight },
]

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/accept-all.mjs <url> [--only lifecycle|side-chat|highlight]')
  process.exit(2)
}

const onlyAt = process.argv.indexOf('--only')
const only = onlyAt > 0 ? process.argv[onlyAt + 1] : undefined
const selected = only === undefined
  ? SUITES
  : SUITES.filter((suite) => suite.name === only)
if (selected.length === 0) {
  console.error(`unknown suite "${only}"; known: ${SUITES.map((suite) => suite.name).join(', ')}`)
  process.exit(2)
}

const startedAt = Date.now()
const totals = []

const browser = await openBrowser()
try {
  for (const suite of selected) {
    const suiteStart = Date.now()
    console.log(`\n── ${suite.title} ──`)
    /** Print and count one assertion. Each suite gets the same shape. */
    const check = (step, ok, detail = '') => {
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${ok || detail === '' ? '' : `  ->  ${detail}`}`)
    }
    let outcome
    try {
      outcome = await suite.run({ browser, check, url })
    } catch (error) {
      // The suite's own body reports a throw; this catches a crash in its setup instead.
      check(`${suite.title} crashed during setup`, false, `${error?.message ?? error}`.slice(0, 300))
      outcome = { passed: 0, total: 1 }
    }
    const seconds = ((Date.now() - suiteStart) / 1000).toFixed(1)
    console.log(`   ${outcome.passed}/${outcome.total} checks passed in ${seconds}s`)
    totals.push({ ...suite, ...outcome })
  }
} finally {
  await browser.close()
}

const passed = totals.reduce((sum, item) => sum + item.passed, 0)
const total = totals.reduce((sum, item) => sum + item.total, 0)
const failed = total - passed
console.log(`\n${'─'.repeat(60)}`)
for (const item of totals) {
  const mark = item.passed === item.total ? 'ok  ' : 'FAIL'
  console.log(`  ${mark} ${item.title.padEnd(24)} ${item.passed}/${item.total}`)
}
console.log(`${'─'.repeat(60)}`)
console.log(`${passed}/${total} checks passed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`
  + `  (one browser, ${selected.length} suite${selected.length === 1 ? '' : 's'})`)
process.exit(failed === 0 ? 0 : 1)
