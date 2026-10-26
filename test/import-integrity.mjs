/**
 * Import integrity: every name a module imports, and every name it uses from another module.
 *
 * This is the small check that would have caught the one real bug of the component split:
 * `ui/cards.js` used `CHIP_SOURCE` without importing it. Because the reference sat inside a
 * `useEffect`, the effect threw and did nothing, and 553 source-shape assertions still passed —
 * they prove code is present, not that it resolves.
 *
 * It reports two things per module:
 *
 *   1. an imported name that is never used (dead import, usually a leftover after a move);
 *   2. a name that LOOKS like another module's export but is not imported here.
 *
 * The second part is what catches the real failure. It works by collecting the actual exports of
 * every module, then flagging a module that references an exported name it did not import and
 * did not declare. A name that is declared locally shadows an export and is not reported.
 *
 * Deliberately not a linter: no AST, no typing, no framework. A token pass is enough for this.
 *
 * Run: node test/import-integrity.mjs
 */
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/**
 * Strip comments, strings, template literals and regex literals.
 *
 * Needed because a name inside a string is not a reference, and a regex can contain anything.
 * The regex-vs-division decision uses the previous significant character.
 *
 * @param text - the module source.
 * @returns the code with literals blanked out.
 */
function stripLiterals(text) {
  let out = ''
  let index = 0
  let previous = ''
  while (index < text.length) {
    const character = text[index]
    const next = text[index + 1]
    if (character === '/' && next === '/') {
      const end = text.indexOf('\n', index)
      index = end < 0 ? text.length : end
      out += ' '
      continue
    }
    if (character === '/' && next === '*') {
      const end = text.indexOf('*/', index + 2)
      index = end < 0 ? text.length : end + 2
      out += ' '
      continue
    }
    if (character === "'" || character === '\"' || character === '`') {
      let cursor = index + 1
      while (cursor < text.length && text[cursor] !== character) {
        if (text[cursor] === '\\') cursor += 1
        cursor += 1
      }
      out += ' "" '
      index = cursor + 1
      previous = '"'
      continue
    }
    if (character === '/' && !/[\w$)\]}]/.test(previous)) {
      let cursor = index + 1
      let inClass = false
      while (cursor < text.length) {
        const current = text[cursor]
        if (current === '\\') { cursor += 2; continue }
        if (current === '[') inClass = true
        else if (current === ']') inClass = false
        else if (current === '/' && !inClass) break
        cursor += 1
      }
      out += ' /re/ '
      index = cursor + 1
      while (index < text.length && /[a-z]/.test(text[index])) index += 1
      previous = 'e'
      continue
    }
    out += character
    if (!/\s/.test(character)) previous = character
    index += 1
  }
  return out
}
/**
 * Read one module's imports and its exported names.
 * @param text - the literal-stripped source.
 * @returns `{ imports: Map(name → source), exports: Set(name), declared: Set(name) }`.
 */
function analyse(raw, text) {
  const imports = new Map()
  const exports = new Set()
  const declared = new Set()

  for (const match of raw.matchAll(/^\s*import\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]/gm)) {
    const sources = match[2]
    for (const piece of match[1].replace(/[{}*]/g, ' ').split(',')) {
      const name = piece.trim().split(/\s+as\s+/).pop()?.trim()
      if (name !== undefined && /^[A-Za-z_$][\w$]*$/.test(name)) imports.set(name, sources)
    }
  }
  for (const match of text.matchAll(/^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) {
    exports.add(match[1])
  }
  for (const match of text.matchAll(/^\s*export\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    exports.add(match[1])
  }
  for (const match of text.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) {
    for (const piece of match[1].split(',')) {
      const name = piece.trim().split(/\s+as\s+/).pop()?.trim()
      if (name !== undefined && name !== '') exports.add(name)
    }
  }
  // Local declarations, so an exported name can also be declared here.
  for (const match of text.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) {
    declared.add(match[1])
  }
  for (const match of text.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) {
    for (const piece of match[1].split(',')) {
      const name = piece.trim().replace(/^[.][.][.]/, '').split(/[:=]/).pop()?.trim()
      if (name !== undefined && /^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name)
    }
  }
  for (const match of text.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) declared.add(match[1])
  for (const match of text.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) declared.add(match[1])
  for (const match of text.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*=(?!=)/g)) declared.add(match[1])
  return { imports, exports, declared }
}

/**
 * Every `.js` file under `src`, recursively.
 * @param directory - where to start.
 * @param prefix - the relative prefix so far.
 * @returns `{ name, path }` pairs.
 */
async function collect(directory = SRC, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) {
      out.push(...await collect(join(directory, entry.name), relative))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push({ name: relative, path: join(directory, entry.name) })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

const modules = await collect()
check('the module list is non-empty', modules.length > 0, String(modules.length))

/** Every export of every module, with the name of its owner. */
const allExports = new Map()
const analysed = []
for (const module of modules) {
  const raw = await readFile(module.path, 'utf8')
  const text = stripLiterals(raw)
  const info = analyse(raw, text)
  analysed.push({ module, text, ...info })
  for (const name of info.exports) {
    if (!allExports.has(name)) allExports.set(name, [])
    allExports.get(name).push(module.name)
  }
}
check('the package exports something', allExports.size > 0, String(allExports.size))

for (const { module, text, imports, declared } of analysed) {
  // A name exported by another module, referenced here, neither imported nor declared locally.
  // This is the half that caught a real bug: ui/cards.js used CHIP_SOURCE without importing it,
  // and the reference sat inside a useEffect, so the failure was an effect that silently did
  // nothing rather than a crash.
  const missing = []
  for (const [name, owners] of allExports) {
    if (owners.includes(module.name)) continue
    if (imports.has(name) || declared.has(name)) continue
    const escaped = name.replace(/[$]/g, '[$]')
    const pattern = new RegExp('(?<![.\\w$])' + escaped + '(?![\\w$])')
    if (pattern.test(text)) missing.push(name + ' (from ' + owners[0] + ')')
  }
  check(module.name + ' imports every foreign name it uses',
    missing.length === 0,
    missing.slice(0, 6).join(', '))
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
