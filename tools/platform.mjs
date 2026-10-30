/**
 * Where the acceptance tooling finds Playwright, a browser profile, a Chrome binary and ffmpeg.
 *
 * ## Why this is its own module
 *
 * These four paths were hard-coded Windows strings inside `harness.mjs`, so the whole browser suite
 * — 86 probes and 6 acceptance runs — could only ever execute on the machine that wrote them. On
 * macOS every one of them failed at import time, before a single assertion ran, which reads as "the
 * suite is broken" rather than "the paths are for another operating system".
 *
 * The resolution order is the same for each value, and it is deliberate:
 *
 *   1. **An explicit environment variable.** A CI job, or a second checkout with its own browser,
 *      must be able to point somewhere without editing a tracked file. No `QC_*` variable set means
 *      the machine's own installation is used.
 *   2. **A platform-specific default.** The Windows defaults are the original literal paths, kept
 *      byte for byte so the machine this suite was written on behaves exactly as before.
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
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** The plugin package directory (`dsh-quote-chat/`), one level above `tools/`. */
export const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const isWindows = process.platform === 'win32'

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
      : process.platform === 'darwin'
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
    return firstExisting([
      'C:/Users/<user>/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
    ])
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ].find((candidate) => existsSync(candidate))
      ?? chromiumIn(join(homedir(), 'Library', 'Caches', 'ms-playwright'))
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find((candidate) => existsSync(candidate))
    ?? chromiumIn(join(homedir(), '.cache', 'ms-playwright'))
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
  if (isWindows) return 'C:/Users/<user>/AppData/Local/qc-playwright-profile'
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
  if (isWindows) return 'C:/Users/<user>/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe'
  const candidates = [
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

/**
 * Print what each resolver found, when run directly.
 *
 * These four paths decide whether the browser suites can start at all, and the failure they
 * produce when wrong ("cannot load Playwright", "no Chrome/Chromium found") names neither the
 * resolver nor the alternative. One command that shows all four, and where each came from,
 * turns that into a check you run before debugging anything else.
 *
 * Run: node tools/platform.mjs
 */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = [
    ['playwright', 'QC_PLAYWRIGHT', resolvePlaywright()],
    ['profile', 'QC_PROFILE', resolveProfile()],
    ['chrome', 'QC_CHROME', resolveChrome()],
    ['ffmpeg', 'QC_FFMPEG', resolveFfmpeg()],
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
  }
}
