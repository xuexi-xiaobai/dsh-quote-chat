/**
 * Build the browser half of dsh-quote-chat.
 *
 * Source lives in `src/` as ordinary ES modules with real `import`/`export`. The shipped
 * artifact is one classic script, `client.js`, because the Host serves exactly one resource
 * per plugin (`<id>/client.js`) and hands the factory a SYNCHRONOUS `require` whose resolution
 * table contains only platform seed words and already-materialized packages. A relative
 * `require('./x.js')` therefore throws at materialization time, and `require.async` would make
 * assembly asynchronous — which `apply` cannot be.
 *
 * ## Why esbuild and not a hand-rolled concatenator
 *
 * The first version of this file stripped `import`/`export` with regexes and concatenated the
 * bodies into one closure. It worked, but for the wrong reason: every module shared one scope,
 * so a module could use a binding it never imported and the build stayed silent. Missing
 * exports were invisible — exactly the class of bug a build system must catch. It was replaced.
 *
 * esbuild resolves the real module graph, so a missing or misspelled export fails the build.
 * It is a development-only dependency: `dependencies` stays empty and the artifact has no
 * runtime dependencies.
 *
 * ## How React stays external
 *
 * esbuild marks `react`/`react-dom` external and emits a `__require` helper that prefers a
 * `require` in scope. The banner below declares that `require` as a variable the factory
 * assigns, so the whole bundle resolves platform modules through the Host's own function. No
 * global is created, and the page still loads a single React shared with the app.
 *
 * ## The envelope
 *
 * `window.__ModuleLoader__.load({ id, factory })` is a Host contract. The factory is
 * synchronous, destructures the bundle's exports, and returns `{ inject, apply }`.
 *
 * Minification stays off: the artifact is read by hand when a field bug needs diagnosing.
 *
 * Usage:
 *   node build.mjs           write client.js
 *   node build.mjs --check   verify client.js matches src/, exit 1 when it does not
 */
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build as esbuild } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const ENTRY = join(here, 'src', 'index.js')
const OUTPUT = join(here, 'client.js')

/** The envelope the Host reads; changing either value changes the registration contract. */
const MODULE_ID = 'dsh-quote-chat'

/**
 * Nothing is external.
 *
 * React cannot be declared as an esbuild external here: esbuild would resolve it when the
 * module graph evaluates, which happens BEFORE the Host calls the factory, so the resolution
 * would fail. The source therefore resolves React through `platform.js`, which the factory
 * binds explicitly. There is no external specifier left to declare.
 */
const EXTERNALS = []

const BANNER = `/**
 * dsh-quote-chat — browser half.
 *
 * GENERATED FILE. Do not edit.
 * Source: src/, assembled by build.mjs. Run \`node build.mjs\` after changing any source
 * module; \`node build.mjs --check\` fails when this file has drifted from src/.
 *
 * Artifact: sha256:__ARTIFACT_HASH__
 */`

/** The `require` variable esbuild's external-module helper looks for. */
/**
 * Bundle `src/` and wrap it in the Host's registration envelope.
 * @returns the file contents.
 */
async function buildBundle() {
  const result = await esbuild({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome110'],
    // No runtime dependencies: React and ReactDOM must come from the Host.
    external: EXTERNALS,
    // Readable output; this file is debugged by hand in a browser.
    minify: false,
    sourcemap: false,
    legalComments: 'none',
    charset: 'utf8',
    write: false,
    logLevel: 'silent',
    globalName: '__dshQuoteChat',
    footer: {
      js: [
        '// The Host reads this envelope: a fixed id and a synchronous factory.',
        'window.__ModuleLoader__.load({',
        `  id: '${MODULE_ID}',`,
        '  factory(hostRequire) {',
        '    // Bind the platform first: everything below reads React through this seam.',
        '    __dshQuoteChat.bindPlatform(hostRequire)',
        '    return { inject: __dshQuoteChat.inject, apply: __dshQuoteChat.apply }',
        '  },',
        '})',
      ].join('\n'),
    },
  })

  if (result.errors.length > 0) {
    throw new Error(result.errors.map((error) => error.text).join('\n'))
  }
  if (result.warnings.length > 0) {
    throw new Error(result.warnings.map((warning) => warning.text).join('\n'))
  }

  const body = result.outputFiles[0].text
  // The hash identifies the BUNDLE, not the file: it is computed before the banner that
  // carries it, so identical source always yields identical bytes and --check can pass.
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 16)
  return { text: `${BANNER.replace('__ARTIFACT_HASH__', hash)}\n${body}`, hash }
}

const built = await buildBundle()
const output = built.text

const checkOnly = process.argv.includes('--check')

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
      'build --check: client.js does NOT match src/ — run `node build.mjs` and commit the result\n'
      + `  expected sha256:${built.hash}`,
    )
    process.exit(1)
  }
  console.log(`build --check: client.js matches src/ (sha256:${built.hash})`)
} else {
  await writeFile(OUTPUT, output, 'utf8')
  const lines = output.split('\n').length
  console.log(
    `build: wrote client.js — ${lines} lines, ${output.length} bytes, sha256:${built.hash}`,
  )
}
