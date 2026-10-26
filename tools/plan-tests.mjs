/**
 * Work out the smallest test set for a change, from the actual dependency graph.
 *
 * The question being answered is "do I have to run everything?". Running everything costs ~23s, which
 * is fine once per commit and wasteful three times while debugging a single surface. But guessing a
 * subset is how a regression slips through: the right-click fix touched only `dock.js` and still
 * changed whether the toolbar appeared at all.
 *
 * So the subset is computed, not guessed. Two sources are combined:
 *
 *   1. `src/` module graph — if A imports B, a change to B can affect any suite that reads A;
 *   2. each test's own source reads — which `src/` files it asserts against.
 *
 * Browser suites are mapped by hand, because they assert behaviour rather than source shape and the
 * mapping is a judgement about which surface they cover:
 *
 *   lifecycle   — selection, toolbar, compose, markers, editor panel, chips, hover card, delete
 *   side-chat   — toolbar's "ask" action, the side-chat tab, its transport
 *   highlight   — the highlight registry: flash expiry, hold, clearing
 *
 * Usage:
 *   node tools/plan-tests.mjs src/ui/dock.js          # what to run for a change to that file
 *   node tools/plan-tests.mjs --all                   # the full list
 *   node tools/plan-tests.mjs --since HEAD~1          # files changed since a commit
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, posix, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const srcDir = join(root, 'src')
const testDir = join(root, 'test')

/** Every source module, relative to src/, with the modules it imports. */
function moduleGraph() {
  const out = new Map()
  /**
   * Walk a directory collecting ES modules.
   * @param directory - where to start.
   * @returns every .js file below it.
   */
  const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.name.endsWith('.js') ? [full] : []
  })
  for (const file of walk(srcDir)) {
    const key = relative(srcDir, file).replaceAll('\\', '/')
    const text = readFileSync(file, 'utf8')
    const imports = [...text.matchAll(/from '(\.[^']+)'/g)]
      .map((match) => posix.normalize(posix.join(posix.dirname(key), match[1])))
    out.set(key, imports)
  }
  return out
}

/** Which modules a given module transitively depends on. */
function closure(graph, start, seen = new Set()) {
  if (seen.has(start) || !graph.has(start)) return seen
  seen.add(start)
  for (const dependency of graph.get(start)) closure(graph, dependency, seen)
  return seen
}

/**
 * Which modules depend on a given module, directly or transitively.
 *
 * `index.js` is skipped as a dependent: it imports almost the whole tree, so including it makes
 * every change look global. It is the assembly layer — creating instances and handing them to the
 * registrations — and a changed leaf does not change what it assembles. When the entry itself
 * changes, that is handled separately as a global change.
 */
function reverse(graph, target) {
  const affected = new Set([target])
  let grew = true
  while (grew) {
    grew = false
    for (const [module, dependencies] of graph) {
      if (affected.has(module)) continue
      if (module === 'index.js' && target !== 'index.js') continue
      if (dependencies.some((dependency) => affected.has(dependency))) {
        affected.add(module)
        grew = true
      }
    }
  }
  return affected
}

/** Unit suites, by the source files they assert against. */
const UNIT_SUITES = [
  'import-integrity', 'html', 'locale-parity', 'chip-draft', 'chip-registry', 'chip-bridge',
  'quote-handoff', 'side-chat-transport', 'host-client-contract', 'side-chat-isolation', 'layout',
  'navigation', 'boot', 'chip-dom-guard', 'chip-interaction', 'numbering', 'hover-card',
  'gutter-and-flash', 'bubble-editor', 'bubble-anchoring', 'highlight-scope', 'host-selftest',
]

/** Unit suites that read a given source module (by literal path or by banner lookup). */
function unitSuitesFor(changed) {
  const hits = new Set()
  for (const suite of UNIT_SUITES) {
    const file = join(testDir, `${suite}.mjs`)
    if (!existsSync(file)) continue
    const text = readFileSync(file, 'utf8')
    // A literal path, e.g. '../src/ui/dock.js'.
    if (text.includes(`../src/${changed}`)) { hits.add(suite); continue }
    // Suites that glob the whole tree still see everything.
    if (text.includes('collectSource') || text.includes('source.mjs')) hits.add(suite)
  }
  return hits
}

/** Browser suites and the surfaces they cover. */
const BROWSER_SURFACES = {
  lifecycle: [
    'index.js', 'ui/dock.js', 'ui/popovers.js', 'ui/markers.js', 'ui/cards.js', 'ui/table.js',
    'selection.js', 'layout.js', 'navigation.js', 'highlight.js', 'text-ranges.js', 'dom.js',
    'annotation-store.js', 'annotation-hooks.js', 'chip-registry.js', 'chip-bridge.js',
    'chip-draft.js', 'stylesheet.js', 'locales.js', 'registrations.js',
  ],
  'side-chat': [
    'index.js', 'ui/side-chat.js', 'ui/dock.js', 'ui/popovers.js', 'side-chat-transport.js',
    'quote-handoff.js', 'registrations.js', 'locales.js', 'stylesheet.js', 'ui/draft-hooks.js',
  ],
  highlight: [
    'index.js', 'highlight.js', 'stylesheet.js', 'ui/dock.js', 'ui/markers.js', 'text-ranges.js',
    'layout.js', 'dom.js',
  ],
}

/** Browser suites covering a changed module. */
function browserSuitesFor(changed) {
  return Object.entries(BROWSER_SURFACES)
    .filter(([, files]) => files.includes(changed))
    .map(([name]) => name)
}

// ── entry ──
const args = process.argv.slice(2)
const graph = moduleGraph()

let changed = []
if (args.includes('--all')) {
  changed = [...graph.keys()]
} else if (args.includes('--since')) {
  const revision = args[args.indexOf('--since') + 1] ?? 'HEAD~1'
  const output = execFileSync('git', ['-C', root, 'diff', '--name-only', revision, '--', 'src'],
    { encoding: 'utf8' })
  changed = output.split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && line.includes('/src/'))
    .map((line) => line.slice(line.indexOf('/src/') + 5))
} else {
  changed = args
    .filter((arg) => !arg.startsWith('--'))
    .map((arg) => arg.replaceAll('\\', '/').replace(/^.*?src\//, ''))
}

if (changed.length === 0) {
  console.log('usage: node tools/plan-tests.mjs <src/file.js ...> | --all | --since <rev>')
  process.exit(2)
}

const unknown = changed.filter((file) => !graph.has(file))
if (unknown.length > 0) {
  console.log(`not a source module: ${unknown.join(', ')}`)
  process.exit(2)
}

// Anything that imports a changed module can also be affected, so the reverse closure matters.
const affectedModules = new Set()
const affectedBy = new Map()
for (const file of changed) {
  for (const module of reverse(graph, file)) {
    affectedModules.add(module)
    if (!affectedBy.has(module)) affectedBy.set(module, file)
  }
}

const units = new Set()
const browsers = new Set()
// Unit suites assert source shape, so the transitive set is right for them.
for (const module of affectedModules) {
  for (const suite of unitSuitesFor(module)) units.add(suite)
}
// Browser suites assert behaviour. Their surface lists name the modules they exercise, so the
// decision is membership of the changed modules — not of everything transitively reachable.
for (const module of changed) {
  for (const suite of browserSuitesFor(module)) browsers.add(suite)
}
// A change to the entry or to a registration really is global: it alters what the plugin registers.
if (changed.includes('index.js') || changed.includes('registrations.js')) {
  for (const suite of Object.keys(BROWSER_SURFACES)) browsers.add(suite)
  for (const suite of UNIT_SUITES) units.add(suite)
}

console.log(`changed:      ${changed.join(', ')}`)
console.log(`can affect:   ${[...affectedModules].sort().join(', ')}`)
console.log('')
console.log(`unit suites (${units.size}): ${[...units].sort().join(', ') || '(none)'}`)
console.log(`browser      (${browsers.size}): ${[...browsers].sort().join(', ') || '(none)'}`)
console.log('')

if (units.size === 0 && browsers.size === 0) {
  console.log('minimal check: build --check only (nothing asserts against this module)')
} else {
  console.log('minimum:')
  console.log('  node build.mjs --check')
  if (units.size > 0) {
    const list = [...units].sort().map((suite) => `test/${suite}.mjs`).join(' ')
    console.log(`  node ${list}`)
  }
  if (browsers.size > 0) {
    // accept-all takes one suite per run, so emit the flag it actually accepts.
    const names = [...browsers].sort()
    console.log(names.length === 3
      ? '  node tools/accept-all.mjs <url>          (all three)'
      : names.map((name) => `  node tools/accept-all.mjs <url> --only ${name}`).join('\n'))
  }
}

// Full campaigns are still the right default before a commit; say so rather than implying otherwise.
if (units.size < UNIT_SUITES.length || browsers.size < 3) {
  console.log('')
  console.log('before committing: run everything (node build.mjs --check && npm test && accept-all)')
}
