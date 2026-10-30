/**
 * Run one Playwright MCP tool call with arguments taken from a JSON file.
 *
 * Passing JSON on the command line is unreliable here: PowerShell rewrites the quoted
 * argument before Node sees it, so the parser receives `{url:...}` and fails. Reading the
 * arguments from a file removes the shell from the path entirely.
 *
 * Usage:
 *   node tools/pw-call.mjs <tool> <argsFile.json>
 */
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'

const NODE = process.env.QC_NODE ?? 'D:\\Programs_Apps\\nodejs\\node.exe'
const CLI = 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-mcp\\node_modules\\@playwright\\mcp\\cli.js'
// Attach to an existing CDP browser when one is running; otherwise let Playwright launch its
// own. The launcher keeps a profile on disk so the DSH login survives between calls.
const CDP = process.env.QC_CDP ?? ''
const PROFILE = process.env.QC_PROFILE ?? 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-profile'

const launchArgs = [CLI, '--viewport-size', '1440x900', '--user-data-dir', PROFILE]
if (CDP !== '') launchArgs.push('--cdp-endpoint', CDP)

const [toolName, argsFile] = process.argv.slice(2)
if (toolName === undefined) {
  console.error('usage: node tools/pw-call.mjs <tool> [argsFile.json|-]')
  process.exit(2)
}

/**
 * Arguments come from one of three places, because each shell mangles the others:
 *   - `QC_ARGS` environment variable (plain, no BOM, no quoting trouble);
 *   - a file path (read with BOM stripped);
 *   - `-` for stdin.
 * Environment variable is the most reliable from PowerShell.
 */
let rawArgs = '{}'
if (process.env.QC_ARGS !== undefined) {
  rawArgs = process.env.QC_ARGS
} else if (argsFile === '-') {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  rawArgs = Buffer.concat(chunks).toString('utf8')
} else if (argsFile !== undefined) {
  rawArgs = await readFile(argsFile, 'utf8')
}

// PowerShell's -Encoding utf8 writes a BOM, and JSON.parse rejects it.
const toolArgs = JSON.parse(rawArgs.replace(/^\uFEFF/, ''))

const child = spawn(NODE, launchArgs, { stdio: ['pipe', 'pipe', 'pipe'] })

const inbox = []
let buffer = ''
let stderrText = ''

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString()
  let newline = buffer.indexOf('\n')
  while (newline >= 0) {
    const line = buffer.slice(0, newline).trim()
    buffer = buffer.slice(newline + 1)
    if (line !== '') {
      try {
        inbox.push(JSON.parse(line))
      } catch { /* banner */ }
    }
    newline = buffer.indexOf('\n')
  }
})
child.stderr.on('data', (chunk) => { stderrText += chunk.toString() })

const send = (payload) => child.stdin.write(`${JSON.stringify(payload)}\n`)

async function awaitResponse(id, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const at = inbox.findIndex((frame) => frame.id === id)
    if (at >= 0) return inbox.splice(at, 1)[0]
    await new Promise((resolve) => setTimeout(resolve, 60))
  }
  throw new Error(`no response for id ${id}; stderr: ${stderrText.slice(0, 600)}`)
}

try {
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'qc-acceptance', version: '1' },
    },
  })
  await awaitResponse(1)
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })
  send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: toolName, arguments: toolArgs },
  })
  const frame = await awaitResponse(2)
  if (frame.error !== undefined) {
    console.error(`tool error: ${JSON.stringify(frame.error)}`)
    process.exitCode = 1
  } else {
    for (const part of frame.result?.content ?? []) {
      if (part.type === 'text') console.log(part.text)
      else if (part.type === 'image') {
        console.log(`[image ${part.mimeType} ${String(part.data).length} base64 chars]`)
      } else console.log(JSON.stringify(part))
    }
    if (frame.result?.isError === true) process.exitCode = 1
  }
} finally {
  child.kill()
}
