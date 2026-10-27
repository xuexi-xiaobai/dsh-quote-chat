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
import { mkdirSync, writeFileSync, writeFile } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

/** pnpm keeps the real package under .pnpm; createRequire does not resolve a bare name through it. */
const PLAYWRIGHT = 'C:/Users/Ethan cole/AppData/Local/qc-playwright-mcp/node_modules/.pnpm/playwright@1.64.0-alpha-1790635538000/node_modules/playwright/index.js'

/** The same profile the MCP server used, so the login survives. */
const PROFILE = 'C:/Users/Ethan cole/AppData/Local/qc-playwright-profile'

/** ffmpeg, used to rebuild recordings at a constant frame rate. */
const FFMPEG = 'C:/Users/Ethan cole/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe'

/** Where recordings are written when the caller does not name a directory. */
const RECORDINGS = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'recordings')

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
  //
  // `QC_CDP` makes that reuse survive across PROCESSES: when it names a CDP endpoint, this attaches to the browser
  // that `tools/browser-serve.mjs` launched instead of starting another one. That is what stops a debugging loop from
  // paying a full launch — plus navigation, session selection and its settle time — on every single iteration.
  // Measured: a launch-and-setup cycle is 6-9s; attaching is under 0.5s.
  const cdpEndpoint = options.cdp ?? process.env.QC_CDP ?? null
  const attached = cdpEndpoint !== null

  // Hard stop, so a probe can never hang forever.
  //
  // A resource that is not released keeps Node's event loop alive: the probe finishes its work, the browser stops
  // receiving commands, and the process sits there. A shell never sees its prompt and a background job never reports
  // completion, which looks exactly like "the command is still running" — it cost a long debugging detour once.
  // This timer is NOT unref'd on purpose: it must fire even when something else still holds the loop open.
  //
  // `QC_PROBE_TIMEOUT_MS` overrides it; `0` disables the guard for a deliberate long-running session.
  const hangGuardMs = Number(process.env.QC_PROBE_TIMEOUT_MS ?? 180000)
  let hangGuard = null
  if (Number.isFinite(hangGuardMs) && hangGuardMs > 0) {
    hangGuard = setTimeout(() => {
      console.error(
        `[harness] HUNG: still running after ${hangGuardMs}ms. A resource was probably never released —`
        + ' most often an un-closed CDP attachment or a browser that was not closed.'
        + ' Forcing exit so the caller is not left waiting.',
      )
      process.exit(3)
    }, hangGuardMs)
  }
  /**
   * The CDP connection, when attached.
   *
   * Kept so it can be closed explicitly. Without that the socket holds Node's event loop open: the probe finishes its
   * work, the browser stops receiving commands, and the process never exits — so a shell never sees its prompt and a
   * background job never reports completion. That reads as "the command hung", which is exactly what happened.
   */
  let cdpBrowser = null
  const context = options.context ?? await (async () => {
    if (attached) {
      cdpBrowser = await chromium.connectOverCDP(cdpEndpoint)
      const existing = cdpBrowser.contexts()[0]
      if (existing === undefined) throw new Error(`no browser context at ${cdpEndpoint}`)
      return existing
    }
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
   * ALSO runs when attached. A maximised window is a hard requirement for every run: the readable band, the number of
   * paragraphs on screen and therefore every threshold-based assertion all depend on it. Skipping it in attach mode
   * meant probes measured a half-sized window and reported "no usable passage", which looked like a product failure.
   * When the window is already maximised the request is a no-op, so the cost is one round trip.
   */
  if (options.context === undefined && options.maximize !== false) {
    try {
      const session = await context.newCDPSession(page)
      const { windowId } = await session.send('Browser.getWindowForTarget')
      const current = await session.send('Browser.getWindowBounds', { windowId })
      if (current.bounds.windowState !== 'maximized') {
        // A minimised or fullscreen window rejects the request outright:
        // "To maximize a minimized or fullscreen window, restore it to normal state first."
        if (current.bounds.windowState !== 'normal') {
          await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } })
          await new Promise((resolve) => { setTimeout(resolve, 120) })
        }
        await session.send('Browser.setWindowBounds', {
          windowId,
          bounds: { windowState: 'maximized' },
        })
      }
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
  /** Whether the frame recorder has been started for this run. */
  let recordingStarted = false

  const goto = async (url) => {
    // Skip the navigation when the attached browser is already showing this page.
    //
    // A reload throws away the conversation that was opened, the scroll position, the collapsed sidebar and the focus —
    // everything the previous probe spent seconds establishing. In CDP mode the state is meant to SURVIVE between
    // probes, so re-navigating is exactly wrong. Only the origin and path are compared; the token may differ.
    if (attached) {
      const current = page.url()
      const samePage = current.startsWith('http') && current.split('?')[0] === url.split('?')[0]
      if (samePage) {
        if (!recordingStarted && options.video !== undefined && options.video !== false) {
          recordingStarted = true
          await beginRecording()
        }
        return
      }
    }
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    // Recording starts AFTER the first navigation commits. Starting it before meant the CDP session was
    // created against the initial about:blank document, and a cross-document navigation invalidated it:
    // every capture then failed with "Target page, context or browser has been closed".
    if (!recordingStarted && options.video !== undefined && options.video !== false) {
      recordingStarted = true
      await beginRecording()
    }
  }

  /**
   * Keep the compositor painting, so the screencast keeps sending frames.
   *
   * A CDP screencast is paint-driven: a still page sends nothing, and a mostly-static run yields a low
   * capture rate no matter what output rate the file claims. Measured: 4.8fps over 12.7s.
   *
   * This installs a 1x1, fully transparent element with an endless CSS animation. It occupies no layout
   * space and cannot be seen, but its animation makes Chromium produce a frame every vsync, so the
   * transition being recorded is captured at the display's rate rather than at "whenever something else
   * happened to change".
   *
   * Removing it is unnecessary: it disappears with the page.
   */
  const startFramePump = async () => {
    if (options.video === undefined || options.video === false) return
    await read(() => {
      if (document.getElementById('qc-frame-pump') !== null) return
      const style = document.createElement('style')
      style.id = 'qc-frame-pump-style'
      style.textContent = '@keyframes qc-frame-pump{from{opacity:.004}to{opacity:.005}}'
        + '#qc-frame-pump{position:fixed;left:0;bottom:0;width:1px;height:1px;'
        + 'pointer-events:none;z-index:-1;animation:qc-frame-pump .5s linear infinite alternate}'
      document.head.append(style)
      const pump = document.createElement('div')
      pump.id = 'qc-frame-pump'
      document.body.append(pump)
    })
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

  /**
   * Frame capture by polling `Page.captureScreenshot` at a fixed rate.
   *
   * ## Why not a CDP screencast
   *
   * The screencast pushes a frame only when the page paints. On a mostly-static run it delivered 4.8fps —
   * 61 real frames inside a 380-frame file — and an animated element did not help, because opacity is
   * composited and produces no screencast frames. A video whose motion was captured at 5fps cannot answer
   * "was the glide smooth?".
   *
   * ## What the measurements support
   *
   * A screenshot costs ~28ms at quality 60 and full size (35.7fps measured), giving ~19% headroom over
   * 30fps, at ~103KB per frame.
   *
   * Captures are serialised: a slow frame delays the next instead of queueing duplicates. The muxer uses
   * the real capture span, so the duration stays right even if the rate dips.
   */
  let stopRecording = async () => ({ video: null })
  let frameDir = null
  /** The recorder's CDP session, reused by helpers so only one exists per page. */
  let recorderSession = null

  const beginRecording = async (settings = {}) => {
    if (options.video === undefined || options.video === false) return
    const fps = settings.fps ?? 30
    mkdirSync(RECORDINGS, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    frameDir = join(RECORDINGS, `frames-${stamp}`)
    mkdirSync(frameDir, { recursive: true })

    const session = await context.newCDPSession(page)
    // Published so other helpers (the animation rate) reuse it. A second session on the same page
    // disturbed the first one: after detaching it, the recorder's captures failed with "Target page,
    // context or browser has been closed" and the run produced zero frames.
    recorderSession = session
    const interval = 1000 / fps
    let frameIndex = 0
    let running = true
    let loopFinished = false
    /** Writes still in flight; the recording cannot be muxed until they all land. */
    const pending = new Set()
    const startedAt = Date.now()

    // Write asynchronously and do NOT await it in the loop: a slow disk would otherwise show up as a
    // dropped frame. Files are named by capture index, so completion order does not matter.
    const persist = (index, payload) => {
      const task = new Promise((resolve) => {
        writeFile(
          join(frameDir, `frame-${String(index).padStart(6, '0')}.jpg`),
          payload,
          () => resolve(),
        )
      })
      pending.add(task)
      void task.then(() => pending.delete(task))
    }

    // Reschedule from COMPLETION, not on a fixed timer: a timer that fires while a capture is in flight
    // either skips its slot or stacks up, both of which lose frames.
    const loop = async () => {
      while (running) {
        const ticked = Date.now()
        try {
          const shot = await session.send('Page.captureScreenshot', { format: 'jpeg', quality: 60 })
          persist(frameIndex, Buffer.from(shot.data, 'base64'))
          frameIndex += 1
        } catch (failure) {
          if (frameIndex === 0) {
            console.warn('[harness] first frame failed:', failure?.message ?? failure)
          }
        }
        // Sleep only the remainder of the interval that the capture did not already consume.
        const spent = Date.now() - ticked
        const rest = interval - spent
        if (rest > 0) await new Promise((resolve) => setTimeout(resolve, rest))
      }
      loopFinished = true
    }
    if (options.video !== undefined && options.video !== false) void loop()

    stopRecording = async () => {
      running = false
      // Wait for the loop to exit and for every queued write to land, or ffmpeg reads a partial set.
      let waited = 0
      while ((!loopFinished || pending.size > 0) && waited < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 20))
        waited += 20
      }
      await session.detach().catch(() => {})
      const seconds = Math.max(0.001, (Date.now() - startedAt) / 1000)
      const captured = frameIndex
      if (captured === 0) return { video: null, frames: 0, frameDir }

      const output = join(RECORDINGS, `run-${stamp}-${fps}fps.mp4`)
      // The rate the frames REALLY represent, so the duration survives a dip in capture speed. Using the
      // requested rate here would compress the timeline whenever the loop fell behind.
      const sourceFps = Math.max(1, Math.round((captured / seconds) * 1000) / 1000)
      try {
        execFileSync(FFMPEG, [
          '-y',
          '-framerate', String(sourceFps),
          '-i', join(frameDir, 'frame-%06d.jpg'),
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '18',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          '-pix_fmt', 'yuv420p',
          '-r', String(fps),
          output,
        ], { stdio: 'pipe' })
      } catch (failure) {
        console.warn('[harness] ffmpeg mux failed:', failure?.message ?? failure)
        return { video: null, frames: captured, frameDir, error: String(failure?.message ?? failure) }
      }
      return {
        video: output,
        frames: captured,
        fps,
        capturedFps: Math.round((captured / seconds) * 10) / 10,
        sourceFps,
        seconds: Math.round(seconds * 10) / 10,
        frameDir,
      }
    }
  }

  /**
   * Slow down (or speed up) CSS animations and transitions for the whole page.
   *
   * A 300ms transition is captured by only 7 or 8 frames at this machine's 25fps ceiling, which shows that
   * the panel moved but not how. Slowing the page to a quarter speed puts ~30 frames inside the same
   * transition, so a recording can show the easing. Nothing about the plugin changes; this is the browser's
   * own animation timeline.
   *
   * @param rate - playback rate; 0.25 is quarter speed, 1 restores real time.
   */
  const setAnimationRate = async (rate) => {
    // Reuse the recorder's session when there is one. Opening a second session and detaching it broke
    // the recorder: every later capture failed and the run produced no frames at all.
    const borrowed = recorderSession !== null
    const session = borrowed ? recorderSession : await context.newCDPSession(page)
    try {
      await session.send('Animation.enable')
      await session.send('Animation.setPlaybackRate', { playbackRate: rate })
    } catch (failure) {
      console.warn('[harness] could not set the animation rate:', failure?.message ?? failure)
    } finally {
      // Only detach a session this helper opened itself.
      if (!borrowed) await session.detach().catch(() => {})
    }
  }

  /**
   * Close the browser, finishing any recording first.
   *
   * @returns the recording statistics, or `{ video: null }` when nothing was recorded.
   */
  const close = async () => {
    const recording = await stopRecording()
    // Never close a browser this helper did not launch. In CDP mode the browser belongs to
    // `tools/browser-serve.mjs` and must outlive this process, which is the whole point of attaching.
    if (options.context === undefined && attached === false) await context.close()
    // Disconnect the CDP socket even though the browser stays alive. `close()` on a connected browser releases the
    // connection rather than killing the process at the other end, and it is what lets Node exit: without it the
    // socket keeps the event loop alive and the probe appears to hang after finishing.
    if (cdpBrowser !== null) {
      await cdpBrowser.close().catch(() => {})
      cdpBrowser = null
    }
    if (hangGuard !== null) {
      clearTimeout(hangGuard)
      hangGuard = null
    }
    return recording
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

  /**
   * Reload the page so it picks up a freshly built plugin bundle.
   *
   * Necessary after `node build.mjs` when attached to the long-lived browser: `goto()` deliberately skips navigation
   * for the same URL, so the page keeps running the bundle it loaded earlier. A probe that measures the old code
   * produces confident, wrong answers — measured: a dismissal rule that had just been changed still behaved the old
   * way on every trial.
   *
   * Skipped when this handle started a fresh browser, where `goto()` already navigated.
   */
  const reload = async () => {
    if (attached === false) return
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
  }

  return {
    page, context, goto, reload, waitFor, read, count, click, tripleClick, hover, type, press,
    moveAway, rightClickAt, clickAt, dragSelect, setAnimationRate, textOf, pluginErrors, errors, close, prepareSession, collapseRightSidebar,
  }
}

export { PLAYWRIGHT, PROFILE, CHROME }
