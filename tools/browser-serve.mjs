/**
 * Launch ONE browser and keep it alive, so probes attach instead of launching their own.
 *
 * ## Why this exists
 *
 * Every `tools/*.mjs` probe calls `openBrowser()`, which launched a fresh Chromium. On top of that, a verification
 * cycle ran `reset-session.mjs` first — another launch — so each iteration paid for two full browser starts, a fresh
 * navigation, a session-list wait, a conversation click and its settle time. Measured: 6-9 seconds of setup per
 * iteration. A debugging session that runs thirty iterations spends three minutes per minute of real work staring at
 * browser startup, and the app state it needs (open conversation, scroll offset, collapsed sidebar) is thrown away
 * every single time.
 *
 * This script starts the browser once, listens on a CDP port, and stays running. Probes then attach with
 * `QC_CDP=http://127.0.0.1:<port>` and reuse the SAME page, navigation state and app state.
 *
 * ## Usage
 *
 *   # terminal 1, leave running
 *   node tools/browser-serve.mjs http://127.0.0.1:<port>/?token=<token>
 *
 *   # then, in every other command
 *   set QC_CDP=http://127.0.0.1:9222
 *   node tools/probe-something.mjs <url>
 *
 * The URL argument is optional. When given, the page is navigated once at startup; probes that attach afterwards find
 * it already on the app and skip their own navigation.
 */
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'

/**
 * Playwright is not resolvable by bare name here: it lives under a pnpm store, and `createRequire` does not look
 * through `.pnpm`. harness.mjs loads it the same way, and the path must match so both use one copy.
 */
const PLAYWRIGHT = 'C:/Users/Ethan cole/AppData/Local/qc-playwright-mcp/node_modules/.pnpm/playwright@1.64.0-alpha-1790635538000/node_modules/playwright/index.js'
const { chromium } = createRequire(import.meta.url)(PLAYWRIGHT)

/** Where the persistent profile lives. Must match harness.mjs so the login token survives. */
const PROFILE = 'C:/Users/Ethan cole/AppData/Local/qc-playwright-profile'

/** The browser binary harness.mjs uses. Must match, or attaching would target a different Chromium build. */
const CHROME = process.env.QC_CHROME
  ?? 'C:/Users/Ethan cole/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

const port = Number(process.env.QC_CDP_PORT ?? 9222)
const url = process.argv[2]

mkdirSync(PROFILE, { recursive: true })

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  executablePath: CHROME,
  args: [
    '--start-maximized',
    '--window-position=0,0',
    '--disable-translate',
    '--disable-features=Translate,TranslateUI,TranslateLanguageDetection',
    '--hide-crash-restore-bubble',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-backgrounding-occluded-windows',
    // The point of this script: expose CDP so other processes can attach to this very browser.
    `--remote-debugging-port=${port}`,
  ],
  viewport: null,
})

const page = context.pages()[0] ?? await context.newPage()

// Maximise, and confirm it. This process OWNS the window, so it is the right place to do it: probes attach and skip
// their own maximise when the state is already maximised, and a half-sized window silently breaks every
// threshold-based assertion by shrinking the readable band.
{
  const session = await context.newCDPSession(page)
  const { windowId } = await session.send('Browser.getWindowForTarget')
  const current = await session.send('Browser.getWindowBounds', { windowId })
  if (current.bounds.windowState !== 'maximized') {
    await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } })
  }
  let state = 'unknown'
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await session.send('Browser.getWindowBounds', { windowId })
    state = result.bounds.windowState
    if (state === 'maximized') break
    await new Promise((resolve) => { setTimeout(resolve, 50) })
  }
  await session.detach()
  if (state === 'maximized') {
    console.log('[browser-serve] window maximised')
  } else {
    console.error(`[browser-serve] WINDOW DID NOT MAXIMISE (state: ${state}) — thresholds in the suites assume`
      + ' a maximised window; fix this before trusting any measurement')
  }
}

if (url !== undefined) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
}

console.log(`[browser-serve] CDP ready at http://127.0.0.1:${port}`)
console.log(`[browser-serve] page: ${page.url()}`)
console.log(`[browser-serve] export QC_CDP=http://127.0.0.1:${port} in the shells that run probes`)

// Stay alive until killed. Probes attach and detach; this process owns the browser.
process.on('SIGINT', async () => {
  await context.close()
  process.exit(0)
})
await new Promise(() => {})
