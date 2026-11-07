/**
 * Search every file in the DSH app.asar for a string, and print the surrounding text.
 *
 * Used to find whether the HOST has its own rules for the composer chip. The chip's DOM belongs to the host's Lexical
 * decorator, so the host's stylesheet applies to it as well as the plugin's - and the plugin's design fixture only
 * loads the plugin's stylesheet. If the host sets a conflicting property on the same element, the fixture cannot show
 * it and every measurement taken from the fixture is measuring the wrong thing.
 *
 * Usage: node tools/asar-search.mjs <needle> [<context-chars>]
 */
import { openSync, readSync } from 'node:fs'

const ASAR = 'D:/Programs_Apps/DSH NEXT/resources/app.asar'
const needle = process.argv[2]
const context = Number(process.argv[3] ?? 260)
if (needle === undefined) {
  console.error('usage: node tools/asar-search.mjs <needle> [context]')
  process.exit(2)
}

const fd = openSync(ASAR, 'r')
const head = Buffer.alloc(16)
readSync(fd, head, 0, 16, 0)
const headerSize = head.readUInt32LE(12)
const headerBuffer = Buffer.alloc(headerSize)
readSync(fd, headerBuffer, 0, headerSize, 16)
const header = JSON.parse(headerBuffer.toString('utf8'))
const dataStart = 16 + headerSize

const files = []
const walk = (node, prefix) => {
  for (const [name, entry] of Object.entries(node.files ?? {})) {
    const path = `${prefix}/${name}`
    if (entry.files !== undefined) walk(entry, path)
    // Symlinked entries carry `link` and no payload of their own.
    else if (entry.offset !== undefined && Number.isFinite(Number(entry.offset))) {
      files.push({ path, offset: Number(entry.offset), size: Number(entry.size) })
    }
  }
}
walk(header, '')

let hits = 0
for (const file of files) {
  if (file.size > 8_000_000) continue
  const buffer = Buffer.alloc(file.size)
  readSync(fd, buffer, 0, file.size, dataStart + file.offset)
  const text = buffer.toString('utf8')
  let index = text.indexOf(needle)
  if (index < 0) continue
  while (index >= 0 && hits < 12) {
    hits += 1
    console.log(`\n── ${file.path} @ ${index} ──`)
    console.log(text.slice(Math.max(0, index - context), index + context).replace(/\s+/g, ' '))
    index = text.indexOf(needle, index + 1)
  }
}
console.log(`\n  ${hits} hit(s) for ${JSON.stringify(needle)} across ${files.length} archived files`)
