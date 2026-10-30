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
 *   1. The index document is behind the browser-trust fence, and the token is not a credential
 *      that rideS on the request: the tokenised URL answers `303` with a `Set-Cookie`, and only
 *      that cookie opens the index. A bare `fetch(tokenisedUrl)` therefore reports 401 — which
 *      looked like "the fence rejects Node" and was worked around by shelling out to PowerShell.
 *      It does not reject Node; it rejects a request that never completed the exchange. Following
 *      the redirect by hand and replaying the cookie works from plain Node on every platform.
 *   2. The served bundle is the artifact PLUS a `//# sourceMappingURL=…` trailer the Host
 *      appends to every composed bundle, so byte equality always fails. Containment is the
 *      honest test of "the browser receives this build".
 *
 * Usage:
 *   node tools/verify-web-build.mjs [--url <tokenised base>]
 */
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

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
 * An HTTP session against one Host, carrying the cookie the token exchange issues.
 *
 * The token is spent once. `open()` performs that exchange and keeps whatever `Set-Cookie`
 * answered; `get()` replays those cookies on the same origin. Two requests are therefore the
 * minimum for any check, which is why this is a small session object rather than a `get` helper.
 */
function createSession() {
  /** `name=value` pairs, already reduced to the cookie header form. */
  let cookie = ''

  /**
   * Exchange the `?token=` for a session cookie.
   * @param tokenisedUrl - the URL `dsh web` printed.
   * @returns the final index body, or null when the server did not accept the token.
   */
  const open = async (tokenisedUrl) => {
    // `redirect: 'manual'` is the point: following automatically would swallow the 303 whose
    // Set-Cookie is the only durable credential, and the follow-up request would be anonymous.
    const exchange = await fetch(tokenisedUrl, { redirect: 'manual' })
    // `getSetCookie` exists on Node 20+; the fallback keeps older runtimes working.
    const issued = typeof exchange.headers.getSetCookie === 'function'
      ? exchange.headers.getSetCookie()
      : [exchange.headers.get('set-cookie')].filter((value) => value != null)
    cookie = issued.map((entry) => entry.split(';')[0]).join('; ')
    if (exchange.status === 200) return exchange.text()
    if (exchange.status < 300 || exchange.status >= 400) return null
    const index = await get(new URL('/', tokenisedUrl).href)
    return index
  }

  /**
   * Read one URL on the session's origin.
   * @param url - absolute URL.
   * @returns the body text, or null when the request failed.
   */
  const get = async (url) => {
    try {
      const response = await fetch(url, {
        ...(cookie === '' ? {} : { headers: { cookie } }),
      })
      if (!response.ok) return null
      return await response.text()
    } catch {
      return null
    }
  }

  return { open, get, cookie: () => cookie }
}

const session = createSession()

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
const html = await session.open(baseUrl)
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
    const body = await session.get(`${parsed.origin}/${resource}`)
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
