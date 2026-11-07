/**
 * Read a file out of the DSH app.asar and list the slot names it mentions.
 *
 * Used to answer one question: which slot renders the sidebar's TOP navigation entries, so a launcher can be put
 * there instead of in the footer. The asar is a plain archive with a JSON header, so no tooling is needed.
 *
 * Usage: node tools/asar-slots.mjs <package-name> [<package-name> ...]
 */
import { openSync, readSync } from 'node:fs'

const ASAR = 'D:/Programs_Apps/DSH NEXT/resources/app.asar'
const fd = openSync(ASAR, 'r')
const head = Buffer.alloc(16)
readSync(fd, head, 0, 16, 0)
const headerSize = head.readUInt32LE(12)
const headerBuffer = Buffer.alloc(headerSize)
readSync(fd, headerBuffer, 0, headerSize, 16)
const header = JSON.parse(headerBuffer.toString('utf8'))

/** Walk the archive tree to one path. */
const find = (path) => {
  let node = header
  for (const part of path.split('/').filter(Boolean)) {
    node = node.files?.[part]
    if (node === undefined) return null
  }
  return node
}

/** Read one archived file as UTF-8. */
const readFile = (path) => {
  const node = find(path)
  if (node === null || node.files !== undefined) return null
  const offset = 16 + headerSize + Number(node.offset)
  const buffer = Buffer.alloc(node.size)
  readSync(fd, buffer, 0, node.size, offset)
  return buffer.toString('utf8')
}

for (const pkg of process.argv.slice(2)) {
  const source = readFile(`/node_modules/@deepseek-ai/${pkg}/lib/client.js`)
  if (source === null) {
    console.log(`${pkg}: <no lib/client.js>`)
    continue
  }
  const names = [...new Set([...source.matchAll(/"([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9.]+)"/g)].map((match) => match[1]))]
    .filter((name) => name.length < 40)
  console.log(`=== ${pkg} (${source.length} bytes) ===`)
  console.log(names.join('  '))
}
