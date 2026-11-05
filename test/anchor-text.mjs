/**
 * What `textOfWithin` compares when the block contains a plugin-owned node.
 *
 * The transcript mounts each annotation bubble inside the paragraph it marks, and the bubble carries
 * `data-qc-ignore`. `textOfWithin` is what `resolveAnchor` uses to ask "does this recorded DOM path still cover the
 * quote?". It used to answer with the WHOLE BLOCK's text as soon as the block contained a plugin node:
 *
 *   if (box.querySelector('[data-qc-ignore]') === null) return raw
 *   return textOf(box)          // whole paragraph, not the range
 *
 * For a short selection (an inline `<code>` in a longer paragraph) the whole paragraph never equals the quote, so the
 * path check failed as soon as the bubble was mounted; the text-search fallback then landed on the first occurrence
 * of a repeated quote, or on a row-level node. The bubble moved to the fallback, the paragraph became marker-free, the
 * path check passed again - and the bubble moved back. That loop is the reported flicker (#29).
 *
 * These checks pin the range-scoped behaviour: strip plugin nodes from the RANGE's own contents, never fall back to
 * the whole block.
 *
 * Run: node test/anchor-text.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = (await readFile(join(here, '..', 'src', 'text-ranges.js'), 'utf8')).replace(/\r\n/g, '\n')

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

const body = functionBody('textOfWithin')
check('textOfWithin exists', body.length > 0, 'the function was renamed; the checks below would pass vacuously')

check('the whole-block shortcut is gone',
  !/return\s+textOf\(box\)/.test(body),
  'returning textOf(box) compares the entire paragraph against a partial quote; that is the flicker root cause')

check('the returned text comes from the range itself',
  /range\.cloneContents\(\)/.test(body),
  'the range text must be cloned so plugin nodes can be removed without touching the live DOM')

check('plugin-owned nodes are removed from the clone',
  /querySelectorAll\('\[data-qc-ignore\]'\)/.test(body) && /\.remove\(\)/.test(body),
  'the bubble inside the selected range would otherwise contribute its ordinal to the compared text')

check('the stripped fragment is what gets returned',
  /textContent/.test(body),
  'the comparison must see exactly the range text with plugin nodes removed')

check('a range without plugin nodes still takes the raw fast path',
  /=== null\) return raw/.test(body),
  'the common case must not pay for a clone')

// ── Report ───────────────────────────────────────────────────────────────
let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok || item.detail === '' ? '' : `\n      ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
