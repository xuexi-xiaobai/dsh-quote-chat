/**
 * Where the compose panel anchors when the selection does not start inside a known block.
 *
 * A code block is `div.md-code-block > (title bar, content > pre)`. A drag that starts on the "代码块" title has no
 * `p / li / h* / pre / …` ancestor, so `closest(BLOCK_SELECTOR)` returned null and the block fell back to the whole
 * flow. The panel was then placed above the entire transcript — measured at `top: -132`, off-screen — and the
 * annotation could not be confirmed, so no chip was ever written (#28).
 *
 * The fix is a fallback to the nearest ancestor that wraps a `pre`, before falling back to the flow. These checks
 * pin that order, because dropping the wrapper silently restores the off-screen panel.
 *
 * Run: node test/selection-block.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = (await readFile(join(here, '..', 'src', 'selection.js'), 'utf8')).replace(/\r\n/g, '\n')

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/** The body of `export function name(...)`, by brace matching. */
const functionBody = (name) => {
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

const readSelection = functionBody('readSelection')
check('readSelection exists', readSelection.length > 0, 'the function was renamed; the checks below would pass vacuously')

// The block lookup must try the code-block wrapper BEFORE the flow fallback. The expression spans three lines.
const blockStart = readSelection.indexOf('const block =')
const blockExpr = blockStart === -1 ? '' : readSelection.slice(blockStart, blockStart + 220)
check('the block lookup still starts from BLOCK_SELECTOR',
  /closest\(BLOCK_SELECTOR\)/.test(blockExpr),
  'the block no longer comes from the selection start')

check('a code-block wrapper is tried before the flow',
  /codeBlockWrapper\(/.test(blockExpr) && blockExpr.indexOf('codeBlockWrapper(') < blockExpr.indexOf('?? flow'),
  'without this fallback a selection starting on the "代码块" title anchors to the whole flow, which puts the panel '
  + 'off-screen (measured top:-132)')

check('the wrapper helper exists and looks for a pre',
  /function codeBlockWrapper\(/.test(source) && /querySelector\('pre'\)/.test(source),
  'the helper must find the nearest ancestor that contains the code block\'s <pre>')

check('the wrapper helper also accepts a pre itself',
  /node\.tagName === 'PRE'/.test(source),
  'a start inside the pre should resolve to the pre, not walk past it')

// ── Report ───────────────────────────────────────────────────────────────
let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok || item.detail === '' ? '' : `\n      ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
