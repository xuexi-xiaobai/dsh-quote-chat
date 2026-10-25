/**
 * Verify that the Web profile is serving the build currently on disk.
 *
 * The Web profile installs this package through a directory junction, so there is no copy
 * step: rebuilding in the repo IS the Web update. What still has to be checked is that the
 * running server hands the browser the SAME code the repo holds — a stale `rev`, a cached
 * bundle, or a second installation elsewhere would break that.
 *
 * Identity chain:
 *
 *   src/index.js --build--> client.js ==(junction)==> Web install --HTTP--> browser
 *
 * Two details this script has to respect, both discovered empirically:
 *
 *   1. The index document is behind the browser-trust fence. Node's `fetch` is rejected
 *      with 401 even with the correct token, while a plain WinHTTP request is accepted, so
 *      the fence discriminates on request shape rather than on the token alone. This script
 *      therefore shells out to PowerShell for HTTP and only compares bytes itself.
 *   2. The served bundle is the artifact PLUS a `//# sourceMappingURL=…` trailer the Host
 *      appends to every composed bundle, so byte equality always fails. Containment is the
 *      honest test of "the browser receives this build".
 *
 * Usage:
 *   node tools/verify-web-build.mjs [--url <tokenised base>]
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

/**
 * Absolute path to Windows PowerShell.
 *
 * `pwsh` (PowerShell 7) is not on the PATH Node inherits here, and `spawnSync pwsh` fails
 * with ENOENT. The in-box Windows PowerShell is always present at this path.
 */
const POWERSHELL = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

const here = dirname(fileURLToPath(import.meta.url))
const PKG_DIR = dirname(here)
const PKG_ID = 'dsh-quote-chat'

const argv = process.argv.slice(2)
const argOf = (flag, fallback) => {
  const at = argv.indexOf(flag)
  return at >= 0 && argv[at + 1] !== undefined ? argv[at + 1] : fallback
}

const baseUrl = argOf('--url', 'http://127.0.0.1:8791')
const WEB_INSTALL = join(homedir(), '.dsh', 'profiles', 'web', 'node_modules', PKG_ID, 'client.js')

const parsed = new URL(baseUrl)
const AUTH = parsed.search

const sha = (buffer) => createHash('sha256').update(buffer).digest('hex')

/**
 * Fetch a URL through PowerShell, which the Host's trust fence accepts.
 * @param url - absolute URL.
 * @returns the body text, or null when the request failed.
 */
function get(url) {
  // Single-quoted here-string avoids PowerShell interpolation of $ characters in URLs.
  const script = [
    '$ErrorActionPreference = "Stop"',
    `$r = Invoke-WebRequest -Uri '${url.replace(/'/g, "''")}' -UseBasicParsing -TimeoutSec 20`,
    '[Console]::Out.Write($r.Content)',
  ].join('\n')
  try {
    return execFileSync(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

const rows = []
const problems = []
let failed = false
const record = (label, value, ok) => {
  rows.push({ label, value, ok })
  if (!ok) failed = true
}

// ── 1. The artifact on disk ───────────────────────────────────────────────
const artifactPath = join(PKG_DIR, 'client.js')
const artifact = await readFile(artifactPath)
const artifactHash = sha(artifact)
const artifactText = artifact.toString('utf8')
record('artifact', `${artifact.length} bytes  sha256:${artifactHash.slice(0, 16)}`, true)
record('artifact mtime', (await stat(artifactPath)).mtime.toISOString(), true)

// ── 2. The Web installation must be the same code ─────────────────────────
try {
  const web = await readFile(WEB_INSTALL)
  const same = sha(web) === artifactHash
  record('web install', `${web.length} bytes  sha256:${sha(web).slice(0, 16)}`, same)
  if (!same) problems.push('Web install differs from the artifact — re-link or rebuild')
} catch (error) {
  record('web install', `missing at ${WEB_INSTALL}`, false)
  problems.push(`Web install not readable: ${error.message}`)
}

// ── 3. The running server must serve that code ────────────────────────────
const html = get(`${parsed.origin}/${AUTH}`)
if (html === null) {
  record('index', 'unreachable', false)
  problems.push(
    `Could not read the index at ${parsed.origin}. Start the server with `
    + '`dsh --profile web --no-open` and pass the tokenised URL it prints via --url.',
  )
} else {
  record('index', `${html.length} chars`, true)
  // The manifest carries this package's row: {"id":"dsh-quote-chat","url":"plugins/??…"}
  const row = /"id":"dsh-quote-chat","url":"([^"]+)"/.exec(html)
  if (row === null) {
    record('boot manifest', 'dsh-quote-chat not listed', false)
    problems.push('The boot manifest does not list this package — not installed or not enabled')
  } else {
    const resource = row[1].replace(/&amp;/g, '&')
    record('boot manifest', /[?&]rev=([^&]+)/.exec(resource)?.[1] ?? '(no rev)', true)
    const body = get(`${parsed.origin}/${resource}`)
    if (body === null) {
      record('served by host', 'unreachable', false)
      problems.push(`The host did not serve ${resource}`)
    } else {
      const needle = artifactText.trimEnd()
      const contains = body.includes(needle)
      record('served by host', `${body.length} chars`, contains)
      if (!contains) {
        problems.push(
          'The served bundle does not contain client.js on disk — the page would run a stale '
          + 'build. Restart the server, or touch a source file to refresh the revision.',
        )
      } else {
        const trailer = body.slice(body.indexOf(needle) + needle.length).trim()
        record('host trailer', trailer === '' ? '(none)' : trailer.slice(0, 60), true)
      }
    }
  }
}

const pad = Math.max(...rows.map((row) => row.label.length))
for (const row of rows) console.log(`${row.ok ? '  ' : '! '}${row.label.padEnd(pad)}  ${row.value}`)
if (problems.length > 0) {
  console.log('')
  for (const problem of problems) console.log(`! ${problem}`)
}
console.log('')
console.log(failed ? 'verify-web-build: MISMATCH' : 'verify-web-build: OK — Web serves the current build')
process.exit(failed ? 1 : 0)
