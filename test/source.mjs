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
 * Each module is preceded by a `// ── src/<name>` banner so a failure message can name the
 * file it came from.
 */
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')

/**
 * Concatenate every authored module, with a file banner before each.
 * @returns the combined source text.
 */
export async function readSourceBundle() {
  const names = (await readdir(SRC)).filter((name) => name.endsWith('.js')).sort()
  const parts = []
  for (const name of names) {
    const body = await readFile(join(SRC, name), 'utf8')
    parts.push(`// ── src/${name}\n${body}`)
  }
  return parts.join('\n')
}

/**
 * Read exactly one module.
 * @param name - file name, e.g. 'text-ranges.js'.
 * @returns its text.
 */
export async function readModule(name) {
  return await readFile(join(SRC, name), 'utf8')
}
