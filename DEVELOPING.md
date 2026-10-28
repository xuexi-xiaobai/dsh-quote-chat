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
- **PowerShell for HTTP, not Node `fetch`.** The trust fence discriminates on request
  shape: Node's `fetch` gets 401 even with the right token, while a plain WinHTTP request
  is accepted. The script shells out to `powershell.exe` and only compares bytes itself.

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
