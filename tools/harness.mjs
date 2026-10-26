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
  // A fixed viewport is opt-in. By default the page follows the window, which is maximised below, so a
  // human watching the run sees the whole app instead of a 1280x800 frame.
  const viewport = options.viewport ?? null
  // Attach to an existing context when one is supplied. Launching is the single most expensive
  // step (~3.4s), and a campaign of several suites pays it once instead of once per suite.
  const context = options.context ?? await (async () => {
    mkdirSync(PROFILE, { recursive: true })
    return chromium.launchPersistentContext(PROFILE, {
      headless: false,
      executablePath: CHROME,
      // Maximised so the run is watchable, and positioned at the origin so two concurrent runs do not
      // land on top of each other at an arbitrary offset.
      args: [
        '--start-maximized',
        '--window-position=0,0',
        // The translation bubble and the crash-restore bubble are browser UI, not app UI, and both sit
        // in the top-right corner — over the header edge where the compose panel docks. They covered
        // the app during both measurement and human inspection, so they are switched off here.
        '--disable-translate',
        '--disable-features=Translate,TranslateUI,TranslateLanguageDetection',
        '--hide-crash-restore-bubble',
        '--no-first-run',
        '--no-default-browser-check',
        // Keep the window focused, so screenshots show the app rather than a dimmed background.
        '--disable-backgrounding-occluded-windows',
      ],
      // null = use the window's size. With a fixed viewport the page would stay 1280x800 regardless of
      // the window, and the point of maximising is lost.
      viewport,
    })
  })()
  const page = context.pages()[0] ?? await context.newPage()

  /**
   * Maximise the window for real, and confirm it took.
   *
   * `--start-maximized` alone left the window in state "normal" and merely larger than the work
   * area, so its edges hung off-screen. Asking through CDP is a request, not a guarantee, so the
   * resulting state is read back; a window that refuses to maximise is reported rather than silently
   * left half-sized.
   *
   * Runs only when this call launched the browser: an attached context belongs to someone else.
   */
  if (options.context === undefined && options.maximize !== false) {
    try {
      const session = await context.newCDPSession(page)
      const { windowId } = await session.send('Browser.getWindowForTarget')
      await session.send('Browser.setWindowBounds', {
        windowId,
        bounds: { windowState: 'maximized' },
      })
      // The OS applies this asynchronously; poll briefly for the state to settle.
      let state = 'unknown'
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const result = await session.send('Browser.getWindowBounds', { windowId })
        state = result.bounds.windowState
        if (state === 'maximized') break
        await new Promise((resolve) => { setTimeout(resolve, 50) })
      }
      if (state !== 'maximized') {
        console.warn(`[harness] window did not maximise (state: ${state}); the run continues`)
      }
      await session.detach()
    } catch (failure) {
      // Never fail a run over a cosmetic window state.
      console.warn('[harness] could not maximise the window:', failure?.message ?? failure)
    }
  }


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
    return result
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
   * Drag across text with the primary button, which is how a reader selects a passage.
   *
   * Emits the whole chain — `pointerdown`, intermediate moves, `pointerup` — because the plugin
   * gates on the button of both ends and positions the toolbar from the release point. A synthetic
   * `Selection` would exercise neither.
   *
   * @param from - `{ x, y }` where the drag starts.
   * @param to - `{ x, y }` where it ends.
   */
  const dragSelect = async (from, to) => {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    // Several steps: one jump can produce a selection the browser has not committed yet.
    const steps = 6
    for (let index = 1; index <= steps; index += 1) {
      await page.mouse.move(
        from.x + ((to.x - from.x) * index) / steps,
        from.y + ((to.y - from.y) * index) / steps,
      )
    }
    await page.mouse.up()
  }

  /**
   * Real right-click at page coordinates.
   *
   * Position is explicit because the target is an existing selection: the assertion is about what
   * a secondary-button press does to a selection that is already there, so the press has to land
   * inside it rather than on whatever element a selector resolves to.
   *
   * @param position - `{ x, y }` in CSS pixels.
   */
  const rightClickAt = async ({ x, y }) => {
    await page.mouse.move(x, y)
    await page.mouse.down({ button: 'right' })
    await page.mouse.up({ button: 'right' })
  }

  /**
   * Real left-click at page coordinates, for the same reason as `rightClickAt`.
   * @param position - `{ x, y }` in CSS pixels.
   */
  const clickAt = async ({ x, y }) => {
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.up()
  }

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

  /** Close the browser, unless it was borrowed from a caller that owns it. */
  const close = async () => {
    if (options.context === undefined) await context.close()
  }

  /**
   * Collapse the RIGHT sidebar, which squeezes the conversation once a chat is open.
   *
   * The sidebar is identified by the app's own column element, and the control by its label — the left
   * rail has a similar-looking control ("收起侧边栏" at left=240) that must not be used.
   *
   * Call this AFTER entering a conversation: the sidebar does not exist on the landing view, so a
   * check made there finds nothing and lets the squeeze happen later.
   *
   * @returns the changes it made, for logging.
   */
  const collapseRightSidebar = async () => {
    const changes = []

    const before = await read(() => {
      const bar = document.querySelector('.pI_x6G_rightbarCol')
      if (bar === null) return { present: false }
      const box = bar.getBoundingClientRect()
      const column = document.querySelector('.pI_x6G_centerCol')
      return {
        present: true,
        width: Math.round(box.width),
        columnWidth: column === null ? null : Math.round(column.getBoundingClientRect().width),
      }
    })
    if (!before.present) return changes
    changes.push(`rightbar: ${before.width}px, column ${before.columnWidth}px`)

    if (before.width === 0) return changes

    const clicked = await read(() => {
      for (const element of document.querySelectorAll('[aria-label], [title]')) {
        const label = element.getAttribute('aria-label') ?? element.getAttribute('title') ?? ''
        // Exact: "收起右侧边栏". The left rail's control is "收起侧边栏" and must be left alone.
        if (!/收起右侧边栏|收起右侧栏|collapse right sidebar/i.test(label)) continue
        const box = element.getBoundingClientRect()
        if (box.width === 0 || box.height === 0) continue
        element.click()
        return label
      }
      return null
    })
    if (clicked === null) {
      changes.push('rightbar: no collapse control found')
      return changes
    }

    await page.waitForTimeout(260)
    const after = await read(() => {
      const bar = document.querySelector('.pI_x6G_rightbarCol')
      const column = document.querySelector('.pI_x6G_centerCol')
      return {
        width: bar === null ? 0 : Math.round(bar.getBoundingClientRect().width),
        columnWidth: column === null ? null : Math.round(column.getBoundingClientRect().width),
      }
    })
    changes.push(`collapsed via "${clicked}": ${after.width}px, column ${after.columnWidth}px`)
    return changes
  }

  /**
   * Put the app into a known state before a run.
   *
   * The launch profile persists layout, so a previous side-chat run leaves the right sidebar open and
   * squeezes the conversation to 424px of 1280 — which changes every placement measurement and hides
   * the app while a human is watching.
   *
   * This only handles what can be handled before a conversation exists. The right sidebar is created
   * when a chat opens, so suites that open one must call `collapseRightSidebar` after entering.
   *
   * @returns the changes it made, for logging.
   */
  const prepareSession = async () => {
    const changes = await collapseRightSidebar()

    // Dismiss anything of ours still showing; Escape is what the plugin itself listens for.
    const leftover = await read(() => ({
      compose: document.querySelector('.qc-compose') !== null,
      panel: document.querySelector('.qc-bubble-panel') !== null,
      popup: document.querySelector('.qc-popup') !== null,
    }))
    if (leftover.compose || leftover.panel || leftover.popup) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(120)
      changes.push('dismissed a leftover surface')
    }

    // Drop any inherited selection, so no suite starts with something already selected.
    await read(() => window.getSelection()?.removeAllRanges())

    return changes
  }

  return {
    page, context, goto, waitFor, read, count, click, tripleClick, hover, type, press,
    moveAway, rightClickAt, clickAt, dragSelect, textOf, pluginErrors, errors, close, prepareSession, collapseRightSidebar,
  }
}

export { PLAYWRIGHT, PROFILE, CHROME }
