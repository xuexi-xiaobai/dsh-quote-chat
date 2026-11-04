/**
 * Table annotations: the anchor's text and the comment box.
 *
 * Two defects on the same path, both invisible in a passing suite because nothing checked the table branch:
 *
 *   - #25: `tableAnchor` stored `table.innerText`, which puts a tab between cells and a newline between rows. The
 *     matcher compares against `Range.toString()` / `textOf`, both of which are `textContent` and have no separators,
 *     so the recorded quote never matched the table it came from and the jump reported "row present, quote missing".
 *   - #26: `ComposeBody` skipped the textarea for `source.kind === 'table'` and passed `''` on confirm, so a table
 *     annotation could never carry a comment.
 *
 * Run: node test/table-annotation.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const table = (await readFile(join(here, '..', 'src', 'ui', 'table.js'), 'utf8')).replace(/\r\n/g, '\n')
const popovers = (await readFile(join(here, '..', 'src', 'ui', 'popovers.js'), 'utf8')).replace(/\r\n/g, '\n')
const dock = (await readFile(join(here, '..', 'src', 'ui', 'dock.js'), 'utf8')).replace(/\r\n/g, '\n')

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** The body of `export function name(...)`, by brace matching. */
const functionBody = (source, name) => {
  const start = source.indexOf(`export function ${name}(`)
  if (start === -1) return ''
  const brace = source.indexOf('{', start)
  if (brace === -1) return ''
  let depth = 0
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    else if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(brace, index + 1)
    }
  }
  return ''
}

const anchor = functionBody(table, 'tableAnchor')

check('tableAnchor exists', anchor.length > 0, 'the function was renamed; the checks below would pass vacuously')

// ── #25: the anchor stores the text the matcher will see ─────────────────
check('the anchor quote is textContent, not innerText',
  /quote:\s*table\.textContent/.test(anchor) && !/quote:\s*table\.innerText/.test(anchor),
  'innerText inserts tabs and newlines between cells that Range.toString()/textOf do not have, so the quote can '
  + 'never match the table it came from — the jump reports "row present, quote missing"')

// ── #26: a table gets the same comment box as a passage ──────────────────
const compose = popovers.slice(
  popovers.indexOf('const ComposeBody = React.memo('),
  popovers.indexOf('function ComposerPopover('),
)

check('the compose body exists', compose.length > 0, 'ComposeBody was renamed')

check('the textarea is not skipped for tables',
  !/source\.kind === 'table'\s*\?\s*null/.test(compose),
  'the table branch still omits the textarea, so a table annotation cannot carry a comment')

check('the textarea is rendered unconditionally',
  /h\('textarea'/.test(compose),
  'no textarea at all')

check('confirm passes the typed comment for every source kind',
  !/onConfirm\(source\.kind === 'table' \? '' : comment\)/.test(compose) && /onConfirm\(comment\)/.test(compose),
  'the table branch still passes an empty comment, so the box would be decorative')

// ── #27: the table panel gets the same live block as a text selection ────
// `ComposerPopover` watches `source.block` every frame to re-place itself and to re-decide the dock. A table source
// without `block` made that watcher return early, so the panel docked once and then stayed at a fixed content position,
// and never docked to the bottom at all.
const annotateTable = (() => {
  const start = dock.indexOf('const annotateTable = ')
  if (start === -1) return ''
  const arrow = dock.indexOf('=>', start)
  const brace = dock.indexOf('{', arrow)
  if (arrow === -1 || brace === -1) return ''
  let depth = 0
  for (let index = brace; index < dock.length; index += 1) {
    if (dock[index] === '{') depth += 1
    else if (dock[index] === '}') {
      depth -= 1
      if (depth === 0) return dock.slice(brace, index + 1)
    }
  }
  return ''
})()

check('annotateTable exists', annotateTable.length > 0, 'the table compose opener was renamed')

check('the table source carries the live element as `block`',
  /block:\s*table\b/.test(annotateTable),
  'without `block` the per-frame watcher returns early: the panel stops sticking after one dock and never docks to '
  + 'the composer')

check('the table source also carries `blockRect`',
  /blockRect:/.test(annotateTable),
  'the first paint has no live measurement to fall back on')

// ── Report ───────────────────────────────────────────────────────────────
let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok || item.detail === '' ? '' : `\n      ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
