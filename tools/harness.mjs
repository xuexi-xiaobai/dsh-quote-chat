/**
 * Shared browser harness for the acceptance suites, driven directly by Playwright.
 *
 * ## Why this exists
 *
 * The suites used to drive the browser through `@playwright/mcp` over JSON-RPC. Measured against a
 * trivial page, one `browser_evaluate` cost roughly 450ms; the same evaluation through Playwright's
 * own API costs about 1ms. Nearly all of it was protocol overhead — frame marshalling, page
 * snapshotting, actionability checks, result formatting — not the browser. A suite making ~55 calls
 * spent ~25s in transport alone, and no amount of trimming sleeps could fix that.
 *
 * ## Input fidelity is the part that must not regress
 *
 * MCP was itself driving Playwright's real input, so switching to the library loses nothing — as
 * long as the suites use the real input APIs and not `element.click()` inside `page.evaluate`.
 *
 * The difference is not cosmetic. A synthetic `element.click()`:
 *
 *   - skips hit testing, so it "clicks" a covered, transparent or zero-sized element;
 *   - emits only `click`, so `pointerdown` / `pointerup` never fire;
 *   - moves no mouse, so `:hover` and `mouseenter` never happen.
 *
 * This plugin depends on all three. Its popover anchors to `releasePoint`, which is filled from
 * `pointerup`; a synthetic click leaves it null and the popover silently takes a fallback path. Its
 * hover card listens on document capture and was empirically unreachable with a synthetic event.
 *
 * So: `evaluate` here is for READING the DOM. Every action goes through `click`, `hover`,
 * `tripleClick`, `type` or `press`, which are real CDP input.
 *
 * ## What it preserves
 *
 * `launchPersistentContext` against the same profile the MCP server used, so the DSH login and the
 * session list survive exactly as before. Nothing about the app under test changes.
 */
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'

/** pnpm keeps the real package under .pnpm; createRequire does not resolve a bare name through it. */
const PLAYWRIGHT = 'C:/Users/Ethan cole/AppData/Local/qc-playwright-mcp/node_modules/.pnpm/playwright@1.64.0-alpha-1790635538000/node_modules/playwright/index.js'

/** The same profile the MCP server used, so the login survives. */
const PROFILE = 'C:/Users/Ethan cole/AppData/Local/qc-playwright-profile'

/** The bundled Playwright expects a revision that is not installed; use the chromium that exists. */
const CHROME = 'C:/Users/Ethan cole/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'

const require = createRequire(import.meta.url)
const { chromium } = require(PLAYWRIGHT)

/**
 * Open a browser and return helpers bound to it.
 *
 * @param options - `{ viewport }`.
 * @returns the harness handle.
 */
export async function openBrowser(options = {}) {
  const viewport = options.viewport ?? { width: 1280, height: 800 }
  mkdirSync(PROFILE, { recursive: true })
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    executablePath: CHROME,
    viewport,
  })
  const page = context.pages()[0] ?? await context.newPage()

  /** Console errors the page emitted, for the "no errors from this plugin" assertions. */
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => { errors.push(`pageerror: ${error.message}`) })

  /**
   * Navigate.
   * @param url - where to go.
   */
  const goto = async (url) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
  }

  /**
   * Wait inside the page until an expression is truthy.
   *
   * Polling runs in the browser, so the whole wait costs one round trip. This is the replacement
   * for fixed sleeps: it is faster when the app is quick and reliable when it is slow, which a
   * `sleep(1800)` never was.
   *
   * @param expression - a JS expression evaluated in the page, truthy when ready.
   * @param settings - `{ timeoutMs, intervalMs }`.
   * @returns the truthy value, or null on timeout.
   */
  const waitFor = async (expression, settings = {}) => {
    const timeoutMs = settings.timeoutMs ?? 8000
    const intervalMs = settings.intervalMs ?? 25
    return page.evaluate(
      async ({ expression: source, timeoutMs: limit, intervalMs: interval }) => {
        const deadline = Date.now() + limit
        for (;;) {
          let value = null
          try {
            // eslint-disable-next-line no-new-func
            value = new Function(`return (${source})`)()
          } catch {
            value = null
          }
          if (value) return value
          if (Date.now() > deadline) return null
          await new Promise((resolve) => setTimeout(resolve, interval))
        }
      },
      { expression, timeoutMs, intervalMs },
    )
  }

  /**
   * Read from the page. Never acts: a mutation here would bypass the input fidelity this file
   * exists to protect.
   *
   * @param fn - a function, or a string of an expression.
   * @returns the result.
   */
  const read = async (fn, arg) => (arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg))

  /**
   * Count elements matching a selector.
   * @param selector - CSS selector.
   * @returns the count.
   */
  const count = async (selector) => read((sel) => document.querySelectorAll(sel).length, selector)

  /**
   * Real click on the first match. Hit-tests, moves the pointer, emits the full event chain.
   * @param selector - CSS selector.
   * @param settings - `{ timeoutMs }`.
   */
  const click = async (selector, settings = {}) => {
    await page.locator(selector).first().click({ timeout: settings.timeoutMs ?? 8000 })
  }

  /**
   * Real triple click, which selects a paragraph in Chromium. Used to select a passage the way a
   * user does, so `pointerup` carries coordinates and the popover anchors where it should.
   * @param selector - CSS selector.
   */
  const tripleClick = async (selector) => {
    await page.locator(selector).first().click({ clickCount: 3, timeout: 8000 })
  }

  /**
   * Real pointer hover. Required for the hover card, which listens on document capture and was
   * empirically unreachable with a synthetic `mouseover`.
   * @param selector - CSS selector.
   */
  const hover = async (selector) => {
    await page.locator(selector).first().hover({ timeout: 8000 })
  }

  /**
   * Type with real key events. The Lexical composer ignores `textContent` writes and synthetic
   * `input` events, so this is the only faithful way to fill it.
   * @param text - what to type.
   */
  const type = async (text) => { await page.keyboard.type(text) }

  /**
   * Press a real key or chord.
   * @param key - a Playwright key name, e.g. `Control+A`.
   */
  const press = async (key) => { await page.keyboard.press(key) }

  /**
   * Move the real pointer away, which is how a hover card is expected to clear.
   * @param position - `{ x, y }`, defaulting to the top-left corner.
   */
  const moveAway = async (position = { x: 2, y: 2 }) => { await page.mouse.move(position.x, position.y) }

  /**
   * Text content of the first match, or null.
   * @param selector - CSS selector.
   * @returns the text or null.
   */
  const textOf = async (selector) => read((sel) => {
    const element = document.querySelector(sel)
    return element === null ? null : (element.textContent ?? '').trim()
  }, selector)

  /** Console errors logged by this plugin itself. */
  const pluginErrors = () => errors.filter((line) => line.includes('[dsh-quote-chat]'))

  /** Close the browser. */
  const close = async () => { await context.close() }

  return {
    page, context, goto, waitFor, read, count, click, tripleClick, hover, type, press,
    moveAway, textOf, pluginErrors, errors, close,
  }
}

export { PLAYWRIGHT, PROFILE, CHROME }
