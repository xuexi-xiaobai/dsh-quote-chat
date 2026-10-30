/**
 * Guard the one rule that broke the composer: never write into a chip's DOM.
 *
 * The chip host span is owned by Lexical's decorator portal — React renders into
 * it. Mutating that element's children or text desynchronises React's tree from
 * the DOM and typing stops working. This test fails the build if such a write
 * ever comes back.
 *
 * Run: node test/chip-dom-guard.mjs
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = await readFile(join(here, '..', 'src', 'index.js'), 'utf8')
// The dock moved to its own module.
const dockSource = await readFile(new URL('../src/ui/dock.js', import.meta.url), 'utf8')
// The annotation strip moved to its own module.
const cardsSource = await readFile(new URL('../src/ui/cards.js', import.meta.url), 'utf8')
// The painter moved to its own module.
const highlightSource = await readFile(join(here, '..', 'src', 'highlight.js'), 'utf8')
const stylesheetSource = await readFile(join(here, '..', 'src', 'stylesheet.js'), 'utf8')

const cases = []
const check = (name, ok, detail) => cases.push({ name, ok, detail })

/** Writes that would corrupt the editor's node mapping. */
const forbidden = [
  [/chip\.append\s*\(/, 'chip.append(...)'],
  [/chip\.textContent\s*=/, 'chip.textContent ='],
  [/chip\.innerHTML\s*=/, 'chip.innerHTML ='],
  [/chip\.appendChild\s*\(/, 'chip.appendChild(...)'],
  [/chip\.removeChild\s*\(/, 'chip.removeChild(...)'],
  [/chip\.insertBefore\s*\(/, 'chip.insertBefore(...)'],
  [/\bhost\.append\s*\(/, 'host.append(...)'],
  [/\bhost\.textContent\s*=/, 'host.textContent ='],
]

for (const [pattern, label] of forbidden) {
  // A comment may mention the pattern; only a real statement counts.
  const offending = source
    .split('\n')
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !/^\s*(\*|\/\/|\/\*)/.test(line))
    .filter(({ line }) => pattern.test(line))
  check(`no ${label}`, offending.length === 0,
    offending.map(({ index, line }) => `${index + 1}: ${line.trim()}`).join(' | '))
}

// The safe path must exist: the card is portaled, the chip gets attributes only.
check('chip gets data attributes',
  /chip\.dataset\.qcNum\s*=/.test(cardsSource), 'chip.dataset.qcNum assignment missing')
check('annotation card is portaled to body',
  /(className: 'qc-card'|'qc-card qc-card-out')/.test(cardsSource) && /createPortal\(/.test(cardsSource),
  'qc-card portal missing')
check('card is pinned to the chip rectangle',
  /anchor\.left/.test(cardsSource) && /getBoundingClientRect\(\)/.test(cardsSource),
  'chip-rectangle anchoring missing')

// The jump flash must ride the highlight registry, not positioned boxes.
check('flash uses CSS.highlights',
  /CSS\.highlights\.set\(/.test(highlightSource), 'no CSS.highlights.set call')
check('no positioned flash overlay remains',
  /className: 'qc-flash'/.test(source) === false, 'a positioned .qc-flash overlay is back')

// The stylesheet is a template literal. A backtick inside it ends the string
// early and the whole bundle fails to parse — this bit twice, so it is a test now.
// The stylesheet lives in its own module now, so this reads it there.
//
// The trailing `\r?` is not cosmetic: this repository is checked out with CRLF on Windows, so the closing backtick is
// followed by `\r\n`, not `\n`. Anchoring on a bare newline made the whole extraction fail there and every following
// assertion was skipped with a message about a missing template literal — a false alarm about the source, caused by the
// line ending.
const cssMatch = /export const STYLESHEET = `([\s\S]*?)`\r?\n/.exec(highlightSource === null ? '' : stylesheetSource)
check('CSS block is extractable', cssMatch !== null, 'could not find the CSS template literal')
if (cssMatch !== null) {
  const css = cssMatch[1]
  check('no backticks inside the stylesheet',
    (css.match(/`/g) || []).length === 0,
    `found ${(css.match(/`/g) || []).length} backtick(s), which truncate the literal`)
  check('stylesheet braces balance',
    (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length,
    'unbalanced braces in the stylesheet')
}

// The card must replay rendered markup, not raw text.
check('card renders captured markup',
  /dangerouslySetInnerHTML: \{ __html: annotation\.previewHtml/.test(cardsSource),
  'the card no longer renders previewHtml')
check('stored field matches what the card reads',
  /previewHtml: source\.kind === 'table' \? '' : source\.previewHtml/.test(dockSource),
  'annotation is stored under a field name the card does not read')

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
