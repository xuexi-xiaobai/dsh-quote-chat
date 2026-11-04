/**
 * The table button must survive the pointer moving onto it.
 *
 * The button is portaled to `document.body`, so it is outside the chat flow. Both of the hover listeners used to
 * read that as "the pointer left the table":
 *
 *   - `onMove` looked up `closest(FLOW_SELECTOR)` and got null when the target was the button;
 *   - `onLeave` is captured on document for `mouseleave`, so it fired for every element on the way to the button,
 *     with `relatedTarget` set to the button.
 *
 * Either one removed the button under the cursor. The next mousemove re-added it — the flicker — and a click aimed
 * at it landed after it was gone, so the compose panel never opened and no chip was added (#24).
 *
 * These are source-shape checks: the defect is a missing guard in two handlers, and a browser probe
 * (`tools/probe-table-add.mjs`, a scratch probe) is what demonstrates the behaviour.
 *
 * Run: node test/table-add-guard.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = (await readFile(join(here, '..', 'src', 'ui', 'table.js'), 'utf8')).replace(/\r\n/g, '\n')

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** The body of an arrow function assigned to `name`, by brace matching. */
const functionBody = (name) => {
  const start = source.indexOf(`const ${name} = `)
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

const onMove = functionBody('onMove')
const onLeave = functionBody('onLeave')

check('the move handler exists', onMove.length > 0, 'onMove was renamed; the checks below would pass vacuously')
check('the leave handler exists', onLeave.length > 0, 'onLeave was renamed')

// ── #24: the button itself is not "outside the table" ────────────────────
const moveGuard = onMove.indexOf("closest('.qc-table-add')")
const moveFlow = onMove.indexOf('closest(FLOW_SELECTOR)')
check('onMove ignores the button before asking where the pointer is',
  moveGuard !== -1 && moveFlow !== -1 && moveGuard < moveFlow,
  'onMove must return early when the target is inside .qc-table-add; otherwise the button removes itself')

check('onLeave reads the element the pointer moved to',
  /relatedTarget/.test(onLeave),
  'without relatedTarget every mouseleave clears the target, including the move from the table onto the button')

check('onLeave keeps the target when the pointer moves onto the button',
  /qc-table-add/.test(onLeave) && /return/.test(onLeave),
  'the button is portaled to body, so a mouseleave with relatedTarget inside it must not clear the target')

check('onLeave also keeps the target when the pointer stays inside the table',
  /pending\s*!==\s*null/.test(onLeave) && /pending\.contains\(related\)/.test(onLeave),
  'moving between cells fires mouseleave too; without this the button flickers on every cell boundary')

// ── Report ───────────────────────────────────────────────────────────────
let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok || item.detail === '' ? '' : `\n      ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
