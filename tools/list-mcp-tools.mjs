/**
 * Print the tool names a Playwright MCP build actually exposes.
 *
 * Guessing names wasted a run (`browser_mouse_move_xy` does not exist in this build). The
 * protocol answers this directly.
 */
import { spawn } from 'node:child_process'

const CLI = 'C:\\Users\\<user>\\AppData\\Local\\qc-playwright-mcp\\node_modules\\@playwright\\mcp\\cli.js'
const NODE = process.env.QC_NODE ?? 'D:\\Programs_Apps\\nodejs\\node.exe'

const child = spawn(NODE, [CLI, '--viewport-size', '1440x900'], { stdio: ['pipe', 'pipe', 'pipe'] })
let buffer = ''
child.stdout.on('data', (chunk) => { buffer += chunk.toString() })
child.stderr.on('data', (chunk) => { buffer += chunk.toString() })

const send = (payload) => child.stdin.write(`${JSON.stringify(payload)}\n`)
send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'names', version: '1' } },
})
await new Promise((resolve) => setTimeout(resolve, 3000))
send({ jsonrpc: '2.0', method: 'notifications/initialized' })
send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
await new Promise((resolve) => setTimeout(resolve, 3000))
child.kill()

for (const line of buffer.split('\n').filter(Boolean)) {
  try {
    const frame = JSON.parse(line)
    if (frame.id === 2 && frame.result?.tools !== undefined) {
      for (const tool of frame.result.tools) {
        console.log(tool.name)
        if (process.argv.includes('--schemas') && tool.name === 'browser_hover') {
          console.log(JSON.stringify(tool.inputSchema, null, 1))
        }
      }
    }
  } catch { /* banner */ }
}
