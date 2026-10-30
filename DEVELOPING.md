# dsh-quote-chat — development notes

## Layout

| Path | Role |
|---|---|
| `index.js` | Host half. Serves `POST /quote-chat/api/ask` (SSE). |
| `src/` | **Authored** browser half. Edit here. |
| `client.js` | **Generated** browser half. Do not edit. |
| `build.mjs` | The bundler. No dependencies; Node only. |
| `tools/verify-web-build.mjs` | Proves the running Web profile serves the build on disk. |
| `test/` | Behaviour and source-shape suites. |

## Where things are installed

| Target | Path |
|---|---|
| Web profile | `~/.dsh/profiles/web/node_modules/dsh-quote-chat` — a **directory junction** to this package |
| Desktop profile | `~/.dsh/profiles/desktop/node_modules/dsh-quote-chat` — likewise a junction |

Because both are junctions, **building IS deploying**: `node build.mjs` writes `client.js`
and the profiles see it immediately. There is no copy step.

Both are installed with the platform's own tooling rather than by hand:

```sh
# the profile this Harness is running in (the agent's plugin_manager does the same thing)
dsh plugin --profile web add "<absolute path to dsh-quote-chat>"
```

`dsh` refuses `--profile desktop` from the command line while Desktop is running; install into
that profile through the app's plugin manager, or quit the app first.

## Building on macOS

The build is a local esbuild dependency, and `node_modules/` is neither committed nor pruned. A
checkout that travelled from a Windows machine therefore still holds `@esbuild/win32-x64`, and
`node build.mjs` dies inside esbuild's 40-line "you installed esbuild for another platform"
trace. `build.mjs` now detects that case before calling esbuild and prints the one command that
fixes it:

```sh
cd dsh-quote-chat && npm install     # or npm ci for a clean tree
```

Two properties of the build are worth knowing, because both were once mistaken for flakiness:

- **The artifact is reproducible.** A fresh `npm ci` in an empty directory, given the same
  sources, produces byte-identical `client.js` (`sha256:5848438bdcb1ec08` at the time of
  writing). If a rebuild changes bytes without a source change, something in the environment
  changed, not the code.
- **The working directory used to matter.** esbuild writes each module's path *relative to the
  invocation directory* into a comment, so building from the repo root produced
  `// dsh-quote-chat/src/index.js` where the plugin directory produced `// src/index.js` — a
  different artifact and a different hash, which is why `--check` passed in one shell and failed
  in another. `absWorkingDir` now pins it, so the command is cwd-independent. Run it from
  anywhere.

## Update loop

```sh
node build.mjs                                            # 1. regenerate
node tools/verify-web-build.mjs --url "<tokenised base>"  # 2. prove Web serves it
```

The Host watches files and recomputes the bundle `rev`, usually within seconds. If it does
not, restart the server:

```sh
dsh --profile web --host 127.0.0.1 --port 8791 --no-open
```

The **tokenised** URL it prints is required for the index document: that route sits behind
the browser-trust fence and answers 401 without `?token=`. Asset requests are not fenced.

## Verifying the page runs the current build

`tools/verify-web-build.mjs` prints the whole identity chain:

```
  artifact        216573 bytes  sha256:101b3a46114e49ee
  web install     216573 bytes  sha256:101b3a46114e49ee
  index           39211 chars
  boot manifest   a0c950bb674f
  served by host  215006 chars
  host trailer    ;//# sourceMappingURL=??dsh-quote-chat/client.js.map&rev=a0c950bb674f
```

Four facts must hold together: the junction agrees with the artifact; the boot manifest
lists `dsh-quote-chat`; the served bundle **contains** `client.js`; and its `rev` matches.

Two details this script encodes, both discovered the hard way:

- **Content containment, not byte equality.** The Host appends a
  `//# sourceMappingURL=…` trailer to every composed bundle, so the response is always the
  artifact plus a trailer.
- **PowerShell for HTTP, not Node `fetch`.** *(Superseded — the script now uses plain Node
  `fetch` on every platform.)* The observation behind this note was real: a bare
  `fetch(tokenisedUrl)` does return 401. The conclusion was wrong. The token is not a header; it
  is spent once, answering `303` with a `Set-Cookie`, and only that cookie opens the index. A
  request that skips the exchange is anonymous, which the fence correctly rejects. `verify-web-build.mjs`
  now performs the exchange itself — `redirect: 'manual'`, keep the cookie, replay it — so it needs
  no shell, no PowerShell and no platform-specific HTTP client.

## Test data

Use a **dedicated test session** in the right-hand browser. The two surfaces share session
storage, so do not exercise send/delete/draft-rewrite on the main conversation, and do not
send development instructions or start a second agent from the Web composer.

## Why a build step

The Host serves exactly one browser resource per plugin (`<pkg>/client.js`) and hands the
factory a **synchronous** `require` whose table holds only platform seed words and already
materialized packages:

```js
const require = (spec) => {
  if (this.seed.has(spec)) return this.seed.get(spec)
  const id = stripClientSuffix(spec)
  if (this.loadCache.has(id)) return this.loadCache.get(id).exports
  if (this.factories.has(id)) return this.materialize(id).exports
  throw new Error(`client-modules: require("${spec}") missed the module table …`)
}
```

So `require('./lib/x.js')` throws at materialization, and `require.async()` — which *does*
support `./client.<name>.js` chunks — would make assembly asynchronous, which `apply`
cannot be. Hence: author in modules, ship one file.

`react` and `react-dom` stay external; the bundle never inlines them.

## Commands

```sh
node build.mjs          # regenerate client.js from src/
node build.mjs --check  # exit 1 when client.js drifted from src/, prints the artifact hash
node test/boot.mjs      # boots the SHIPPED client.js under a React stub
```

`npm run verify` runs the drift check, a syntax check and every suite.

### Running probes against one long-lived browser

Launching a browser per probe costs 6-9s including navigation and session selection. Start one and reuse it instead:

```sh
# once, leave running
node tools/browser-serve.mjs "<tokenised url>"

# in every other shell
QC_CDP=http://127.0.0.1:9222 node tools/probe-something.mjs "<url>"
```

Attaching takes ~34ms and keeps the open conversation, scroll offset and sidebar state. `goto()` skips re-navigation
when the page is already showing the same URL.

Every probe carries a hard timeout (`QC_PROBE_TIMEOUT_MS`, default 180s) that forces exit with a diagnostic, because a
resource that is opened and never released keeps Node alive and looks exactly like a slow test.

### Where the browser and its dependencies come from

`tools/platform.mjs` resolves the four paths the browser suite needs, so the suite is not tied to the machine it was
written on. Each is `QC_*` override first, then that platform's default:

| What | Variable | Default |
|---|---|---|
| Playwright module | `QC_PLAYWRIGHT` | the `playwright` package (`npm install --save-dev playwright`) |
| Browser profile | `QC_PROFILE` | `~/.qc-playwright-profile` on macOS/Linux, the Windows path on Windows |
| Chrome executable | `QC_CHROME` | Google Chrome, Chromium or Edge in `/Applications`, then a Playwright browser cache |
| ffmpeg | `QC_FFMPEG` | `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin` |

Two consequences worth knowing:

- **Importing `harness.mjs` no longer needs Playwright or ffmpeg.** Both are resolved at use, so the source-shape
  suites (which read `tools/` as text) and a probe that never records video both work on a bare machine. A missing
  Playwright or Chrome now produces a one-line instruction instead of a `MODULE_NOT_FOUND` stack, and a failure
  during launch cancels the hang guard so the process exits immediately instead of sitting for the full timeout.
- **Screen height changes what the geometry assertions mean.** A maximised 1280×800 laptop panel leaves a 632px
  readable band, and several placement checks ("the panel clears the whole block", "the header covers it") cannot be
  set up in that space — they fail as *could not set the test up*, which reads like a product defect. Run the
  geometry suites with a taller virtual viewport:

  ```sh
  QC_VIEWPORT=1440x1000 node tools/accept-lifecycle.mjs "<url>"
  ```

**Three rules that are not negotiable:**

1. **Do not run the full suite for a small change.** Pick the one probe that exercises the change. Run everything only
   at a milestone, or when the blast radius cannot be predicted.
2. **The window must be maximised.** Every band/threshold assertion assumes it, and a half-sized window reports
   "no usable passage", which reads like a product defect.
3. **Use the persistent browser.** Do not kill it to get a "clean" state; use `tools/reset-session.mjs`.

Details and the reasoning behind them: `docs/test-script-lessons.md`.

## Rules

- Edit `src/` only. `client.js` is regenerated and committed so existing installs keep
  working without a build.
- Minification is intentionally off: the artifact is meant to be read.
- **Source is real ES modules.** Each file imports what it uses and exports what it offers, and
  a missing or misspelled export fails the build. Nothing may rely on one shared scope: the
  bundler does not create one.
- **The module graph is evaluated inside the Host factory.** `build.mjs` emits the bundle as
  a function body (`__dshQuoteChatFactory`) and the envelope's `factory` calls it, so each
  factory call builds a fresh instance of every module-scope value. A plain top-level
  `import React from 'react'` therefore works: by the time the graph runs, the factory's
  `require` parameter is in scope and esbuild's external helper resolves through it. Do not
  move that call to module scope — it would reintroduce one shared instance for the whole page.
- `test/boot.mjs` boots the shipped `client.js`; that is the artifact test. Its structural
  assertions read the authored modules instead, because they describe how the code is written
  and must not break when the bundler re-formats its output.
- Suites that extract a function body read through `test/source.mjs`, which concatenates every
  module. Whole-package scanning is the right granularity for claims like "there is exactly one
  whitespace definition"; a direct import is used when a test targets a single unit.

## Working discipline

Six rules, each earned by a mistake actually made on this package. Every one of them cost real
time or shipped a defect, so they are read out loud before starting a task rather than recalled
after something breaks.

### 1. Restate these rules before acting

State them at the start of the work, not in the summary afterwards. The point is to catch the
violation *before* the tool call, and a rule recited at the end has already failed at that.

### 2. Do not run the whole suite

Pick the probe that exercises the change. Run everything only at a milestone. This is repeated
here because it was broken repeatedly: after a chip change, panel probes were run, and their
failures were read as regressions when the two features share no code.

### 3. Never change product code to make a probe pass

If a probe disagrees with the code, decide which of the two is wrong — in writing, with a
measurement — and fix that one. A probe that is wrong gets its *assertion* corrected, with a
comment saying what the old assertion assumed.

There is a real example of the failure mode: `needsRescue` in `popovers.js` was modified so an
offscreen probe would turn green. That change had nothing to do with the task in hand and was
reverted. The tell is a diff that touches a subsystem the task never mentioned.

### 4. Say when a measurement is not comparable

Numbers gathered against different fixtures cannot be compared to each other. A 214-row
conversation and a 29-row one differ by 7× in reflow cost; the same code measured 24.7ms and
33.5ms on the two, and the second was briefly read as a regression.

Check the fixture before quoting a number: `rows`, `scrollHeight`, and which conversation is
open. If the fixture changed, report the comparison as unavailable rather than as a result.

### 5. One frame of skew is not a defect

`getBoundingClientRect()` on a panel reflects the render that already happened; the block
around it reflects the layout that just changed. Comparing them inside one frame produces
phantom movement.

Before calling something jitter, prove it survives settling: sweep the geometry, return to the
starting state, and check the element lands where it started. If it does, the "jitter" was the
sampling.

### 6. A green probe is not proof; the absence of a probe is not innocence

Two failures in one session came from probes that were technically passing:

- A chip-ordinal probe compared `data-qc-label`, which is renumbered on every move — it could
  never observe a reorder.
- A drag probe compared a contiguous string that the successful drop had itself split.

Both were tests of the right thing measuring the wrong quantity. When an assertion and the
observed behaviour disagree, print the raw values and look at them before touching either.

### Two facts about the substrate, worth restating

- **The chip is the Host's node.** A Lexical decorator with `contenteditable="false"` and
  `draggable="false"`; its DOM is not ours to move. Drag is an overlay plus a draft rewrite.
- **The Host's class names are CSS-Module hashes** (`yAWgPa_marker`). Keying a rule on one works
  until the Host's build changes, and then the marker reappears beside the plugin's own label.
  Select structurally, or by an attribute this plugin sets.

## Acceptance

```sh
node tools/verify-web-build.mjs --url "<tokenised base>"
node tools/accept-lifecycle.mjs "<tokenised base>"
```

The lifecycle run drives real pointer and keyboard input through Playwright MCP, asserts 21
observable behaviours, and writes `result.json` next to its recording. That file records the
**artifact sha256 it validated**, so a pass is always attributable to a specific build.
