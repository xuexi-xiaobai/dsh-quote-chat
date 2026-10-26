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

## Acceptance

```sh
node tools/verify-web-build.mjs --url "<tokenised base>"
node tools/accept-lifecycle.mjs "<tokenised base>"
```

The lifecycle run drives real pointer and keyboard input through Playwright MCP, asserts 21
observable behaviours, and writes `result.json` next to its recording. That file records the
**artifact sha256 it validated**, so a pass is always attributable to a specific build.
