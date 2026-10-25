/**
 * Build the browser half of dsh-quote-chat.
 *
 * Source lives in `src/` as ordinary ES modules. The shipped artifact is one classic
 * script, `client.js`, because the Host serves exactly one resource per plugin
 * (`<id>/client.js`) and hands the factory a SYNCHRONOUS `require` whose resolution table
 * contains only platform seed words and already-materialized packages. A relative
 * `require('./x.js')` therefore throws at materialization time, and `require.async`
 * would make assembly asynchronous — which `apply` cannot be.
 *
 * So: author in modules, ship one file. This bundler is deliberately minimal and has no
 * dependencies, because the package must stay installable with nothing but Node.
 *
 * What it does:
 *   1. reads `src/index.js` and follows its relative `import` graph;
 *   2. concatenates the modules in dependency order inside a single shared closure, so
 *      module-scope bindings keep working without an import/export shim;
 *   3. rewrites `export`/`import` syntax away;
 *   4. wraps the result in the `__ModuleLoader__.load({ id, factory })` envelope the
 *      Host expects, with `require` forwarded for platform modules (React, ReactDOM).
 *
 * Minification is off by design: the artifact is reviewed in the browser.
 *
 * Usage:
 *   node build.mjs           write client.js
 *   node build.mjs --check   verify client.js matches src/, exit 1 when it does not
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, 'src')
const ENTRY = join(SRC, 'index.js')
const OUTPUT = join(here, 'client.js')

/** The envelope the Host reads; changing either value changes the registration contract. */
const MODULE_ID = 'dsh-quote-chat'

/** Bare specifiers forwarded to the Host's `require`; never bundled. */
const EXTERNAL = new Set(['react', 'react-dom'])

const BANNER = `/**
 * dsh-quote-chat — browser half.
 *
 * GENERATED FILE. Do not edit.
 * Source: src/, assembled by build.mjs. Run \`node build.mjs\` after changing any source
 * module; \`node build.mjs --check\` fails when this file has drifted from src/.
 */`

/**
 * Strip `import`/`export` scaffolding from one module body.
 *
 * The modules are concatenated into ONE closure, so their bindings are already visible to
 * each other. Only the syntax has to go: a bundler would normally re-emit it as a module
 * table, which is unnecessary here and would obscure the artifact.
 *
 * @param source - the module's text.
 * @param file - its path, for error messages.
 * @returns the body, plus the specifiers it imported.
 */
function stripModuleSyntax(source, file) {
  const imported = []
  let body = source

  // `import { a, b as c } from './x.js'` / `import * as ns from '...'` / `import def from '...'`
  body = body.replace(
    /^[ \t]*import\s+(?:([\w$]+)\s*,\s*\{([^}]*)\}|([\w$]+)|\{([^}]*)\}|\*\s+as\s+([\w$]+))\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm,
    (_match, _defaultWithNamed, _namedA, _defaultOnly, _namedB, _ns, spec) => {
      imported.push(spec)
      return ''
    },
  )

  // Side-effect import: `import './x.js'`
  body = body.replace(
    /^[ \t]*import\s+['"]([^'"]+)['"];?[ \t]*$/gm,
    (_match, spec) => {
      imported.push(spec)
      return ''
    },
  )

  // `export const x = …` / `export let` / `export function` / `export class`
  body = body.replace(/^([ \t]*)export\s+(const|let|var|function|class|async\s+function)\b/gm, '$1$2')

  // `export { a, b }` and `export { a } from './x.js'`
  body = body.replace(
    /^[ \t]*export\s+\{([^}]*)\}(\s*from\s+['"]([^'"]+)['"])?;?[ \t]*$/gm,
    (_match, _names, _fromClause, spec) => {
      if (typeof spec === 'string' && spec !== '') imported.push(spec)
      return ''
    },
  )

  // `export default` is not used by this package; fail loudly rather than guess.
  if (/^[ \t]*export\s+default\b/m.test(body)) {
    throw new Error(`build: ${file} uses \`export default\`, which this bundler does not support`)
  }

  if (/^[ \t]*(?:import|export)\s/m.test(body)) {
    throw new Error(`build: ${file} has module syntax this bundler could not strip`)
  }

  return { body: body.replace(/^\s*\n/, '').replace(/\n{3,}/g, '\n\n'), imported }
}

/**
 * Resolve one specifier to an absolute module path.
 * @param spec - the specifier as written.
 * @param fromFile - the importing module.
 * @returns the absolute path, or null for an external package.
 */
function resolveSpecifier(spec, fromFile) {
  if (EXTERNAL.has(spec)) return null
  if (!spec.startsWith('.')) {
    throw new Error(
      `build: ${relative(here, fromFile)} imports "${spec}", which is neither a relative `
      + `path nor a declared external (${[...EXTERNAL].join(', ')}). `
      + 'The shipped factory can only resolve platform seed words.',
    )
  }
  return normalize(resolve(dirname(fromFile), spec))
}

/**
 * Walk the import graph depth-first and return modules in dependency order.
 * @param entry - absolute entry path.
 * @returns [{ file, body }] with dependencies first.
 */
async function collect(entry) {
  const seen = new Map()
  const order = []

  const visit = async (file) => {
    if (seen.has(file)) return seen.get(file)
    const source = await readFile(file, 'utf8')
    const { body, imported } = stripModuleSyntax(source, file)
    const record = { file, body }
    // Register before descending so an import cycle cannot recurse forever.
    seen.set(file, record)
    for (const spec of imported) {
      const target = resolveSpecifier(spec, file)
      if (target === null) continue
      await visit(target)
    }
    order.push(record)
    return record
  }

  await visit(entry)
  return order
}

/** Render one module into the shared closure, with a navigation header per #region. */
function renderModule(record, index) {
  const name = relative(SRC, record.file).replace(/\\/g, '/')
  const rule = '─'.repeat(Math.max(4, 74 - name.length))
  return [
    `    // ── src/${name} ${rule}`,
    record.body.split('\n').map((line) => (line === '' ? '' : `    ${line}`)).join('\n').trimEnd(),
    '',
  ].join('\n')
}

/**
 * Assemble the whole artifact.
 * @returns the file contents.
 */
async function build() {
  const modules = await collect(ENTRY)
  if (modules.length === 0) throw new Error('build: entry module produced no output')

  const parts = [
    BANNER,
    '',
    'window.__ModuleLoader__.load({',
    `  id: '${MODULE_ID}',`,
    '  factory(require) {',
    '    // Platform modules only. Everything else is inlined below, because the Host',
    '    // resolves a relative require by throwing.',
    "    const React = require('react')",
    "    const { createPortal } = require('react-dom')",
    "    const h = React.createElement",
    '',
    ...modules.map(renderModule),
    '    return { inject, apply }',
    '  },',
    '})',
    '',
  ]
  return parts.join('\n').replace(/\n{3,}/g, '\n\n')
}

const checkOnly = process.argv.includes('--check')
const output = await build()

if (checkOnly) {
  let existing = ''
  try {
    existing = await readFile(OUTPUT, 'utf8')
  } catch {
    console.error('build --check: client.js is missing; run `node build.mjs`')
    process.exit(1)
  }
  if (existing !== output) {
    console.error(
      'build --check: client.js does NOT match src/ — run `node build.mjs` and commit the result',
    )
    process.exit(1)
  }
  console.log('build --check: client.js matches src/')
} else {
  await writeFile(OUTPUT, output, 'utf8')
  const lines = output.split('\n').length
  console.log(`build: wrote client.js (${lines} lines) from ${output.length} bytes of source`)
}
