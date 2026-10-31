/**
 * Dismissal: the selection toolbar and the compose panel are two surfaces with two different rules.
 *
 * They share the `overlay` state, and they used to share one dismissal handler. That handler was written for the
 * compose panel — it holds a comment the user is typing, so only a press inside the transcript may close it — which
 * meant the annotation toolbar also survived presses on the side panels, the header and the composer. Measured: after
 * a press on the left rail the toolbar was still up WITH the 335-character selection highlighted; after a press on the
 * header it was still up with no selection at all, and its button still opened an annotation panel for the abandoned
 * passage.
 *
 * Two properties are pinned here, because they are the ones that would silently regress:
 *
 *   1. the toolbar branch comes BEFORE the transcript test, and clears the selection (a press that does not clear it —
 *      the left rail — would otherwise be followed by its own mouseup re-opening the toolbar);
 *   2. the compose panel keeps the transcript test, i.e. the protection the user asked for is untouched.
 *
 * Run: node test/toolbar-dismiss.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dock = await readFile(join(here, '..', 'src', 'ui', 'dock.js'), 'utf8')

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** The body of the dismissal handler, from its opening brace to the transcript test. */
const dismissal = /const onPointerDown = \(event\) => \{([\s\S]*?)\n      \}/.exec(dock)?.[1] ?? ''

check('the dismissal handler is where it is expected',
  dismissal.length > 0, 'the handler body was not found; the checks below would pass vacuously')

// ── The toolbar: any press outside it ────────────────────────────────────
check('an outside press dismisses the selection toolbar',
  /open\.kind === 'actions'/.test(dismissal),
  'the toolbar path does not exist, so it survives presses on the chrome')

check('the toolbar branch runs BEFORE the transcript test',
  dismissal.indexOf("open.kind === 'actions'") !== -1
    && dismissal.indexOf("open.kind === 'actions'") < dismissal.indexOf('isInsideTranscript(event.target)'),
  'the transcript test comes first, so a press outside the transcript is ignored for both surfaces')

check('dismissing the toolbar clears the selection',
  /selection\.removeAllRanges\(\)/.test(dismissal),
  'the selection survives the dismissal, and the following mouseup re-opens the toolbar')

check('the toolbar is closed through the shared cancel, not by setting state here',
  /cancelCompose\(\)/.test(dismissal),
  'the toolbar path bypasses the shared cleanup')

// ── The compose panel: unchanged ──────────────────────────────────────────
check('the compose panel still only closes on a press inside the transcript',
  /if \(!isInsideTranscript\(event\.target\)\) return/.test(dismissal),
  'the compose protection was removed along with the toolbar rule')

// ── Losing the selection must close the toolbar ───────────────────────────
check('a selection that goes away closes the toolbar',
  /current\.kind === 'actions' \? null : current/.test(dock),
  'a toolbar left behind with no selection stays on screen')

check('the selection is still not consulted while the compose panel is open',
  /open !== null && open\.kind !== 'actions'\) return/.test(dock),
  'the compose panel lost its draft protection, or the toolbar stopped noticing a lost selection')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
