/**
 * Locale parity: every key exists in both languages, and every `t('…')` call resolves.
 *
 * A missing translation is the one locale bug that reaches the screen as raw jargon rather
 * than an error, so it survives review. Two failure modes are covered:
 *
 *   1. **Key drift** — `zh` and `en` disagree about which keys exist.
 *   2. **Dead reference** — the source asks for a key that no dictionary defines, which
 *      renders the key itself.
 *
 * The reverse (a key nobody uses) is reported but not failed: an unused key is untidy, not
 * broken, and failing on it would make removing a UI string require touching three files.
 *
 * Run: node test/locale-parity.mjs
 */
import { zh, en } from '../src/locales.js'
import { readSourceBundle } from './source.mjs'

const source = await readSourceBundle()

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

const zhKeys = Object.keys(zh).sort()
const enKeys = Object.keys(en).sort()

check('both dictionaries are non-empty', zhKeys.length > 0 && enKeys.length > 0,
  `zh=${zhKeys.length} en=${enKeys.length}`)

const onlyZh = zhKeys.filter((key) => !(key in en))
const onlyEn = enKeys.filter((key) => !(key in zh))
check('no key is missing from English', onlyZh.length === 0, onlyZh.join(', '))
check('no key is missing from Chinese', onlyEn.length === 0, onlyEn.join(', '))
check('both dictionaries declare the same number of keys', zhKeys.length === enKeys.length,
  `zh=${zhKeys.length} en=${enKeys.length}`)

// A placeholder present in one language but not the other loses information silently:
// `{n}` vanishing from a translation shows a bare label with no number.
const placeholdersOf = (value) => (String(value).match(/\{\w+\}/g) ?? []).sort().join(',')
const placeholderMismatches = zhKeys
  .filter((key) => key in en && placeholdersOf(zh[key]) !== placeholdersOf(en[key]))
  .map((key) => `${key}: zh[${placeholdersOf(zh[key])}] en[${placeholdersOf(en[key])}]`)
check('placeholders match between languages', placeholderMismatches.length === 0,
  placeholderMismatches.slice(0, 6).join(' | '))

// Every literal key the source asks for must exist. Dynamic lookups (a computed key) are
// skipped: those cannot be checked without running the app, and flagging them would be noise.
const literals = [...source.matchAll(/\bt\(\s*'([\w.]+)'/g)].map((match) => match[1])
const uniqueLiterals = [...new Set(literals)].sort()
const missing = uniqueLiterals.filter((key) => !(key in zh) || !(key in en))
check('every literal translation key exists in both languages', missing.length === 0,
  missing.join(', '))
check('the source requests a substantial number of keys', uniqueLiterals.length >= 30,
  `only ${uniqueLiterals.length} literal keys found; the scan may have broken`)

// Reported, not failed: see the header note.
const unused = zhKeys.filter((key) => !uniqueLiterals.includes(key))

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\nkeys: ${zhKeys.length} | referenced: ${uniqueLiterals.length} | unused: ${unused.length}`)
if (unused.length > 0) console.log(`unused (not a failure): ${unused.join(', ')}`)
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
