/**
 * Read the authored browser source as one searchable text.
 *
 * The suites below assert source shape: "the same whitespace definition is used in both
 * places", "the bubble anchors to a block element". Those assertions are about the package as
 * a whole, not about one file — but they used to read `src/index.js` directly, which broke the
 * moment a function moved to its own module.
 *
 * Reading every module and concatenating them keeps the assertions correct under any future
 * split, and it also keeps them honest: a claim like "there is exactly one whitespace regex"
 * is now checked across the whole package rather than within a single file, which is where the
 * duplicate would actually hurt.
 *
 * Subdirectories are walked too. Components live under `src/ui/`, and a non-recursive read would
 * silently omit them — which is exactly the failure this loader exists to prevent: an assertion
 * about "the whole package" that quietly sees only part of it.
 *
 * Each module is preceded by a `// ── src/<relative path>` banner so a failure message can name
 * the file it came from.
 */
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')

/**
 * Every `.js` file under `src`, recursively, as paths relative to `src`.
 * @param directory - the directory to walk.
 * @param prefix - the relative prefix accumulated so far.
 * @returns a sorted list of relative paths.
 */
async function collectModules(directory = SRC, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const found = []
  for (const entry of entries) {
    const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) {
      found.push(...await collectModules(join(directory, entry.name), relativePath))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.js')) found.push(relativePath)
  }
  return found.sort()
}

/**
 * Concatenate every authored module, with a file banner before each.
 * @returns the combined source text.
 */
export async function readSourceBundle() {
  const names = await collectModules()
  const parts = []
  for (const name of names) {
    const body = await readFile(join(SRC, name), 'utf8')
    parts.push(`// ── src/${name}\n${body}`)
  }
  return parts.join('\n')
}

/**
 * Read exactly one module.
 * @param name - path relative to `src`, e.g. 'text-ranges.js' or 'ui/cards.js'.
 * @returns its text.
 */
export async function readModule(name) {
  return await readFile(join(SRC, name), 'utf8')
}

/**
 * List every authored module, for tests that need to assert coverage.
 * @returns relative paths, sorted.
 */
export async function listModules() {
  return await collectModules()
}
