/**
 * Where the acceptance tooling finds Node, Playwright, a browser profile, a Chrome binary, ffmpeg
 * and the legacy MCP CLI.
 *
 * ## Why this is its own module
 *
 * These paths were hard-coded Windows strings inside `harness.mjs` and a dozen `tools/*.mjs`
 * scripts, so the whole browser suite could only ever execute on the machine that wrote them. On
 * macOS every one of them failed at import time, before a single assertion ran, which reads as "the
 * suite is broken" rather than "the paths are for another operating system".
 *
 * The resolution order is the same for each value, and it is deliberate:
 *
 *   1. **An explicit environment variable.** A CI job, or a second checkout with its own browser,
 *      must be able to point somewhere without editing a tracked file. No `QC_*` variable set means
 *      the machine's own installation is used.
 *   2. **A platform-specific default, discovered rather than written down.** Home directories are
 *      never spelled out: `C:/Users/<name>` is `homedir()` plus `AppData/Local`, and `/Users/<name>`
 *      is `homedir()` plus `Library`. A path with a literal user name in it is a path that works on
 *      exactly one machine — which is how this module came to exist.
 *   3. **`undefined`, with the failure explained where it is used.** Resolving a path lazily means a
 *      probe that never records video is not blocked by a missing ffmpeg.
 *
 * Nothing here throws at import time. A suite that only reads the DOM must keep working on a machine
 * with no ffmpeg at all, and it did not before: the old module threw while the constants were
 * computed.
 *
 * ## What is NOT auto-detected
 *
 * `playwright` itself. It is a real dependency with a browser download behind it, and guessing an
 * install from a `node_modules` tree has exactly the failure mode this module exists to remove —
 * picking a copy that belongs to something else. Install it where the variable points, or install it
 * in the package and let the bare-specifier fallback find it.
 *
 * The legacy MCP CLI is the exception: it is a *tool* this repository no longer depends on, so
 * `resolveMcpCli` looks in the places it is normally installed and returns `undefined` when it is
 * not. The suites that need it say so instead of dying on a module-not-found.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** The plugin package directory (`dsh-quote-chat/`), one level above `tools/`. */
export const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const isWindows = process.platform === 'win32'
const isMac = process.platform === 'darwin'

/** `%LOCALAPPDATA%` on Windows, `~/Library/Caches` on macOS, `~/.cache` elsewhere. */
const LOCAL_DATA = isWindows
  ? (process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'))
  : isMac
    ? join(homedir(), 'Library', 'Caches')
    : join(homedir(), '.cache')

/** Where a per-user install of a command usually lands, per platform. */
const PROGRAM_FILES = process.env.ProgramFiles ?? 'C:\\Program Files'
const PROGRAM_FILES_X86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'

/**
 * The first candidate path that exists, or undefined.
 *
 * Used for files and directories alike: `existsSync` is the only question asked of these strings,
 * and a browser executable and a browser cache are both "somewhere on this machine or not".
 *
 * @param candidates - absolute paths, most preferred first.
 * @returns the first path that exists.
 */
function firstExisting(candidates) {
  return candidates.find((candidate) => candidate !== undefined && existsSync(candidate))
}

/**
 * The first executable of that name on `PATH`.
 *
 * The last resort for every resolver, and the only one that works when a tool was installed by a
 * package manager this file has never heard of. Windows needs the `PATHEXT` extensions appended;
 * elsewhere the bare name is the file.
 *
 * @param name - the command name, without an extension.
 * @returns the absolute path, or undefined.
 */
function onPath(name) {
  const directories = (process.env.PATH ?? '').split(delimiter).filter((entry) => entry !== '')
  const extensions = isWindows
    ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter((entry) => entry !== '')
    : ['']
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = join(directory, `${name}${extension}`)
      try {
        if (statSync(candidate).isFile()) return candidate
      } catch {
        // Not in this directory; keep looking.
      }
    }
  }
  return undefined
}

/**
 * The Chromium that ships with a Playwright install, if one is unpacked there.
 *
 * Playwright names its browser directories `chromium-<build>` and changes the number on every
 * release, so the number is discovered rather than pinned. On macOS the executable lives inside a
 * `.app` bundle; on Linux and Windows it is a plain file under the same directory.
 *
 * @param cacheRoot - a Playwright browser cache directory.
 * @returns the executable path, or undefined when nothing looks like a Chromium build.
 */
function chromiumIn(cacheRoot) {
  if (cacheRoot === undefined) return undefined
  let entries
  try {
    entries = readdirSync(cacheRoot)
  } catch {
    return undefined
  }
  const builds = entries
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((left, right) => Number(right.slice('chromium-'.length)) - Number(left.slice('chromium-'.length)))
  for (const build of builds) {
    const base = join(cacheRoot, build)
    const candidates = isWindows
      ? [join(base, 'chrome-win64', 'chrome.exe'), join(base, 'chrome-win', 'chrome.exe')]
      : isMac
        ? [join(base, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')]
        : [join(base, 'chrome-linux64', 'chrome'), join(base, 'chrome-linux', 'chrome')]
    const found = candidates.find((candidate) => existsSync(candidate))
    if (found !== undefined) return found
  }
  return undefined
}

/**
 * A real Chrome installation, for `launchPersistentContext({ executablePath })`.
 *
 * The suite pins `executablePath` because the persistent profile it reuses was created by this
 * browser; letting Playwright pick its own download would start from an empty profile and lose the
 * login and the session list the harness depends on.
 *
 * @returns the executable path, or undefined when no browser was found.
 */
function installedChrome() {
  if (isWindows) {
    const installed = firstExisting([
      join(PROGRAM_FILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(PROGRAM_FILES_X86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(LOCAL_DATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(PROGRAM_FILES, 'Chromium', 'Application', 'chrome.exe'),
      join(PROGRAM_FILES_X86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(PROGRAM_FILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ])
    return installed
      ?? chromiumIn(join(LOCAL_DATA, 'ms-playwright'))
      ?? onPath('chrome')
      ?? onPath('msedge')
  }
  if (isMac) {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ].find((candidate) => existsSync(candidate))
      ?? chromiumIn(join(homedir(), 'Library', 'Caches', 'ms-playwright'))
      ?? onPath('chrome')
      ?? onPath('chromium')
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find((candidate) => existsSync(candidate))
    ?? chromiumIn(join(homedir(), '.cache', 'ms-playwright'))
    ?? onPath('google-chrome')
    ?? onPath('chromium')
}

/**
 * The Node binary the legacy MCP suites spawn.
 *
 * `process.execPath` is the interpreter already running this script, which is the only answer that
 * cannot be wrong about the platform — and the one that made `D:\\Programs_Apps\\nodejs\\node.exe`
 * unnecessary. `QC_NODE` stays for the case where a suite must run under a different Node.
 *
 * @returns the absolute path to a Node executable.
 */
export function resolveNode() {
  const configured = process.env.QC_NODE
  if (configured !== undefined && configured !== '') return resolve(configured)
  return process.execPath
}

/**
 * The Playwright module to `require`.
 *
 * A directory is accepted as well as a file, because pnpm stores the real package under
 * `.pnpm/<name>@<version>/node_modules/<name>` and pointing at that directory is the convenient
 * thing to write. When the variable is unset the bare specifier is returned, so a package-local
 * `npm install playwright` is found by ordinary Node resolution.
 *
 * @returns a module id for `createRequire`, or the bare specifier.
 */
export function resolvePlaywright() {
  const configured = process.env.QC_PLAYWRIGHT
  if (configured === undefined || configured === '') return 'playwright'
  const absolute = resolve(configured)
  try {
    if (statSync(absolute).isDirectory()) {
      const manifest = join(absolute, 'package.json')
      return existsSync(manifest) ? absolute : join(absolute, 'index.js')
    }
  } catch {
    // Fall through to the bare path: `require` reports a missing module accurately.
  }
  return absolute
}

/**
 * The persistent browser profile directory.
 *
 * Kept apart from the Playwright install: it holds the app's login, and the suite is expected to
 * reuse it across runs and across machines' rebuilds.
 *
 * @returns the profile directory.
 */
export function resolveProfile() {
  const configured = process.env.QC_PROFILE
  if (configured !== undefined && configured !== '') return resolve(configured)
  if (isWindows) return join(LOCAL_DATA, 'qc-playwright-profile')
  return join(homedir(), '.qc-playwright-profile')
}

/**
 * The Chrome executable, or undefined when none was found.
 * @returns the executable path, or `undefined`.
 */
export function resolveChrome() {
  const configured = process.env.QC_CHROME
  if (configured !== undefined && configured !== '') return resolve(configured)
  return installedChrome()
}

/**
 * The ffmpeg executable, or undefined.
 *
 * ffmpeg is only needed to mux recorded frames into an mp4, which a probe opts into. Returning
 * undefined lets every non-recording run proceed on a machine without it, and `beginRecording`
 * reports the missing binary instead of every suite failing to import.
 *
 * @returns the executable path, or `undefined`.
 */
export function resolveFfmpeg() {
  const configured = process.env.QC_FFMPEG
  if (configured !== undefined && configured !== '') return resolve(configured)
  if (isWindows) {
    return firstExisting([
      join(LOCAL_DATA, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
      join(process.env.ProgramData ?? 'C:\\ProgramData', 'chocolatey', 'bin', 'ffmpeg.exe'),
      join(PROGRAM_FILES, 'ffmpeg', 'bin', 'ffmpeg.exe'),
    ]) ?? onPath('ffmpeg')
  }
  return firstExisting([
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  ]) ?? onPath('ffmpeg')
}

/**
 * The ffprobe that ships beside ffmpeg, or undefined.
 *
 * `verify-glide-frames.mjs` reads frame timestamps with it. It is resolved from ffmpeg's own
 * directory rather than searched for separately, because the two are installed together and a
 * mismatched pair reports nonsense durations.
 *
 * @returns the executable path, or `undefined`.
 */
export function resolveFfprobe() {
  const configured = process.env.QC_FFPROBE
  if (configured !== undefined && configured !== '') return resolve(configured)
  const ffmpeg = resolveFfmpeg()
  if (ffmpeg !== undefined) {
    const sibling = join(dirname(ffmpeg), isWindows ? 'ffprobe.exe' : 'ffprobe')
    if (existsSync(sibling)) return sibling
  }
  return onPath('ffprobe')
}

/**
 * The `@playwright/mcp` CLI, for the suites that predate `harness.mjs`.
 *
 * Those suites drive a browser by spawning this CLI and speaking JSON-RPC to it. They are kept
 * because they still document the acceptance flow, but the CLI is not a dependency of this package,
 * so this returns `undefined` on a machine that never installed it — and the calling suite says so
 * in one line instead of throwing `MODULE_NOT_FOUND` from a string constant.
 *
 * @returns the CLI entry point, or `undefined`.
 */
export function resolveMcpCli() {
  const configured = process.env.QC_MCP_CLI
  if (configured !== undefined && configured !== '') return resolve(configured)
  const relative = join('node_modules', '@playwright', 'mcp', 'cli.js')
  const candidates = isWindows
    ? [
      join(LOCAL_DATA, 'qc-playwright-mcp', relative),
      join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'npm', relative),
    ]
    : [
      join(homedir(), '.local', 'share', 'qc-playwright-mcp', relative),
      join(homedir(), '.npm-global', 'lib', relative),
      join('/usr/local/lib', relative),
      join('/opt/homebrew/lib', relative),
    ]
  return firstExisting(candidates)
}

/**
 * Print what each resolver found, when run directly.
 *
 * These paths decide whether the browser suites can start at all, and the failure they produce when
 * wrong ("cannot load Playwright", "no Chrome/Chromium found") names neither the resolver nor the
 * alternative. One command that shows all of them, and where each came from, turns that into a
 * check you run before debugging anything else.
 *
 * Run: node tools/platform.mjs
 */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = [
    ['node', 'QC_NODE', resolveNode()],
    ['playwright', 'QC_PLAYWRIGHT', resolvePlaywright()],
    ['profile', 'QC_PROFILE', resolveProfile()],
    ['chrome', 'QC_CHROME', resolveChrome()],
    ['ffmpeg', 'QC_FFMPEG', resolveFfmpeg()],
    ['ffprobe', 'QC_FFPROBE', resolveFfprobe()],
    ['mcp cli', 'QC_MCP_CLI', resolveMcpCli()],
  ]
  const width = Math.max(...rows.map(([label]) => label.length))
  for (const [label, variable, value] of rows) {
    // An override is called out, because "why is it using that path" is the usual question.
    const origin = process.env[variable] === undefined ? '' : `  (from ${variable})`
    console.log(`  ${label.padEnd(width)}  ${value ?? '(not found)'}${origin}`)
  }
  const missing = rows.filter(([, , value]) => value === undefined).map(([label]) => label)
  if (missing.length > 0) {
    console.log('')
    console.log(`! not resolved: ${missing.join(', ')}`)
    if (missing.includes('playwright')) console.log('  npm install --save-dev playwright')
    if (missing.includes('chrome')) console.log('  install Google Chrome, or set QC_CHROME')
    if (missing.includes('ffmpeg')) console.log('  optional: only video-recording probes need it')
    if (missing.includes('mcp cli')) console.log('  optional: only the legacy MCP suites need it (npm i -g @playwright/mcp)')
  }
}
