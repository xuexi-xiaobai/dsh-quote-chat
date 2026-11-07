/**
 * Print the lines of an archived client bundle around a pattern.
 *
 * Usage: node tools/asar-grep.mjs <package-name> <pattern> [<context-lines>]
 */
import { openSync, readSync } from 'node:fs'

const ASAR = 'D:/Programs_Apps/DSH NEXT/resources/app.asar'
const [pkg, pattern, contextArg] = process.argv.slice(2)
if (pkg === undefined || pattern === undefined) {
  console.error('usage: node tools/asar-grep.mjs <package-name> <pattern> [context]')
  process.exit(2)
}
const context = Number(contextArg ?? 6)

const fd = openSync(ASAR, 'r')
const head = Buffer.alloc(16)
readSync(fd, head, 0, 16, 0)
const headerSize = head.readUInt32LE(12)
const headerBuffer = Buffer.alloc(headerSize)
readSync(fd, headerBuffer, 0, headerSize, 16)
const header = JSON.parse(headerBuffer.toString('utf8'))

const find = (path) => {
  let node = header
  for (const part of path.split('/').filter(Boolean)) {
    node = node.files?.[part]
    if (node === undefined) return null
  }
  return node
}

const readFile = (path) => {
  const node = find(path)
  if (node === null || node.files !== undefined) return null
  const offset = 16 + headerSize + Number(node.offset)
  const buffer = Buffer.alloc(node.size)
  readSync(fd, buffer, 0, node.size, offset)
  return buffer.toString('utf8')
}

const source = readFile(`/node_modules/@deepseek-ai/${pkg}/lib/client.js`)
if (source === null) {
  console.error(`${pkg}: no lib/client.js`)
  process.exit(2)
}
const lines = source.split('\n')
const needle = new RegExp(pattern)
let shown = 0
for (let index = 0; index < lines.length; index += 1) {
  if (!needle.test(lines[index])) continue
  shown += 1
  console.log(`--- ${pkg}:${index + 1} ---`)
  for (let offset = Math.max(0, index - context); offset <= Math.min(lines.length - 1, index + context); offset += 1) {
    console.log(`${String(offset + 1).padStart(5)} | ${lines[offset].slice(0, 220)}`)
  }
  if (shown >= 3) break
}
if (shown === 0) console.log(`${pkg}: no match for ${pattern}`)
