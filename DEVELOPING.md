# dsh-quote-chat — development notes

## Layout

| Path | Role |
|---|---|
| `index.js` | Host half. Serves `POST /quote-chat/api/ask` (SSE). |
| `src/` | **Authored** browser half. Edit here. |
| `client.js` | **Generated** browser half. Do not edit. |
| `build.mjs` | The bundler. No dependencies; Node only. |
| `test/` | Behaviour and source-shape suites. |

## Why a build step

The Host serves exactly one browser resource per plugin (`<pkg>/client.js`) and hands the
factory a **synchronous** `require` whose table holds only platform seed words and
already-materialized packages:

```js
const require = (spec) => {
  if (this.seed.has(spec)) return this.seed.get(spec)
  const id = stripClientSuffix(spec)
  if (this.loadCache.has(id)) return this.loadCache.get(id).exports
  if (this.factories.has(id)) return this.materialize(id).exports
  throw new Error(`client-modules: require("${spec}") missed the module table …`)
}
```

So `require('./lib/x.js')` throws at materialization, and `require.async()` —
which *does* support `./client.<name>.js` chunks — would make assembly asynchronous,
which `apply` cannot be. Hence: author in modules, ship one file.

`react` and `react-dom` stay external; the bundle never inlines them.

## Commands

```sh
node build.mjs          # regenerate client.js from src/
node build.mjs --check  # exit 1 when client.js drifted from src/
node test/boot.mjs      # evaluates the SHIPPED client.js under a React stub
```

`npm run verify` runs the drift check, a syntax check and every suite.

## Rules

- Edit `src/` only. `client.js` is regenerated and committed so existing installs keep
  working without a build.
- Minification is intentionally off: the artifact is meant to be read.
- `test/boot.mjs` reads `client.js` on purpose — it validates the shipped artifact.
  Every other suite reads `src/index.js`, because they match source shape and the bundle
  re-indents every line.
