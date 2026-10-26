/**
 * Host–client protocol contract: the frames the Host really writes, parsed by the client.
 *
 * The transport suite keeps a hand-written frame as a smoke check. This file closes the loop:
 * it mounts the real Host half through its real `apply`, drives the real route handler with a
 * stand-in model, captures what the route actually writes, and feeds those bytes to the real
 * client parser.
 *
 * That matters because the two halves are written in different files with no shared schema. A
 * rename on one side — `text` to `content`, `done` to `finish` — would leave both suites green
 * and break every answer in production. Here the mismatch surfaces as a failing assertion.
 *
 * Run: node test/host-client-contract.mjs
 */
import { apply } from '../index.js'
import { askSideChat } from '../src/side-chat-transport.js'

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

/**
 * A response sink in the shape the route writes to.
 * @returns the response object with its captured state.
 */
function response() {
  const state = { status: 0, headers: {}, chunks: [], ended: false }
  const listeners = new Map()
  return {
    state,
    setHeader(name, value) { state.headers[name.toLowerCase()] = value },
    writeHead(status, headers = {}) {
      state.status = status
      for (const [name, value] of Object.entries(headers)) state.headers[name.toLowerCase()] = value
    },
    write(text) {
      if (typeof text === 'string') state.chunks.push(text)
    },
    end(text) {
      if (typeof text === 'string') state.chunks.push(text)
      state.ended = true
    },
    once(name, fn) { listeners.set(name, fn) },
    off(name) { listeners.delete(name) },
    get body() { return state.chunks.join('') },
  }
}

/**
 * A request stand-in for the route handler.
 * @param body - the JSON payload.
 * @returns the request object.
 */
function request(body) {
  return {
    method: 'POST',
    url: '/quote-chat/api/ask',
    async *[Symbol.asyncIterator]() { yield Buffer.from(body, 'utf8') },
  }
}

/**
 * Mount the real Host half over a fake Cordis context.
 * @param options - `{ chunks, failAfter, selection }`.
 * @returns the registered route entry.
 */
function mountHost({ chunks, failAfter = -1, selection = { provider: 'p', model: 'm' } } = {}) {
  let route
  apply({
    effect(fn) { fn(); return () => {} },
    webServer: { register(entry) { route = entry; return () => {} } },
    connection: { requestRejection: () => undefined },
    get(name) {
      if (name === 'agentDefaultModel') {
        return selection === null ? undefined : { currentSelection: () => selection }
      }
      if (name === 'llm') {
        return {
          async *stream() {
            let index = 0
            for (const chunk of chunks) {
              if (failAfter >= 0 && index === failAfter) throw new Error('provider exploded')
              index += 1
              yield chunk
            }
          },
        }
      }
      return undefined
    },
  })
  return route
}

/**
 * A fetch stand-in that replays a captured Host response byte by byte.
 *
 * The bytes are cut into small chunks so the parser has to reassemble frames the way it must in
 * a real stream, rather than receiving one convenient string.
 *
 * @param captured - the Host's response body.
 * @param options - `{ chunkSize, contentType, status }`.
 * @returns the fetch function and the calls it recorded.
 */
function replayFetch(captured, { chunkSize = 7, contentType = 'text/event-stream', status = 200 } = {}) {
  const calls = []
  const bytes = new TextEncoder().encode(captured)
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    let offset = 0
    return {
      status,
      headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
      body: {
        getReader() {
          return {
            async read() {
              if (offset >= bytes.length) return { value: undefined, done: true }
              const slice = bytes.slice(offset, offset + chunkSize)
              offset += chunkSize
              return { value: slice, done: false }
            },
          }
        },
      },
      json: async () => JSON.parse(captured),
    }
  }
  return { fetchImpl, calls }
}

const REQUEST = { quote: '被引用的段落', question: '这里的假设成立吗？', history: [], locale: 'zh' }
const ASK = '/quote-chat/api/ask'

// ── A successful answer, end to end ────────────────────────────────────────
{
  const route = mountHost({
    chunks: [
      { type: 'text-delta', index: 0, text: '第一' },
      { type: 'text-delta', index: 0, text: '段回答' },
      { type: 'finish', reason: { kind: 'stop' } },
    ],
  })
  const sink = response()
  await route.handler(request(JSON.stringify(REQUEST)), sink)

  check('the Host answers with an event stream',
    String(sink.state.headers['content-type']).includes('text/event-stream'),
    String(sink.state.headers['content-type']))
  check('the Host emits frames separated by a blank line',
    sink.body.includes('\n\n'), JSON.stringify(sink.body.slice(0, 40)))

  const { fetchImpl } = replayFetch(sink.body)
  const seen = []
  const answer = await askSideChat(REQUEST, undefined, (text) => seen.push(text), { fetch: fetchImpl })

  check('the client parses the Host\'s real deltas',
    answer === '第一段回答', JSON.stringify(answer))
  check('the client reports deltas in order',
    seen.join('|') === '第一|段回答', seen.join('|'))
  check('the client stops at the Host\'s done frame',
    answer === '第一段回答', 'the parser ran past done or stopped early')
}

// ── A refusal before the stream ────────────────────────────────────────────
{
  const route = mountHost({ chunks: [] })
  const sink = response()
  await route.handler(request(JSON.stringify({ question: 'no quote' })), sink)

  check('the Host refuses with JSON', String(sink.state.headers['content-type'] ?? '').includes('application/json')
    || sink.state.status === 400,
  `${sink.state.status} ${JSON.stringify(sink.state.headers)}`)

  const { fetchImpl } = replayFetch(sink.body, {
    contentType: String(sink.state.headers['content-type'] ?? 'application/json'),
    status: sink.state.status,
  })
  let caught = null
  try {
    await askSideChat({ question: 'no quote' }, undefined, () => {}, { fetch: fetchImpl })
  } catch (error) {
    caught = error
  }
  check('the client surfaces the Host\'s refusal message',
    caught !== null && /quote/i.test(String(caught.message)),
    String(caught?.message))
}

// ── A provider failure becomes a client-visible error ──────────────────────
{
  const route = mountHost({
    chunks: [
      { type: 'text-delta', index: 0, text: '半' },
      { type: 'text-delta', index: 0, text: '句' },
    ],
    failAfter: 1,
  })
  const sink = response()
  await route.handler(request(JSON.stringify(REQUEST)), sink)

  check('the Host turns a provider failure into an error frame',
    sink.body.includes('"type":"error"'), JSON.stringify(sink.body.slice(-160)))

  const { fetchImpl } = replayFetch(sink.body)
  let caught = null
  try {
    await askSideChat(REQUEST, undefined, () => {}, { fetch: fetchImpl })
  } catch (error) {
    caught = error
  }
  check('the client raises the Host\'s error message',
    caught !== null && /provider exploded/.test(String(caught.message)),
    String(caught?.message))
}

// ── An empty answer is an error on the Host side ───────────────────────────
{
  const route = mountHost({ chunks: [{ type: 'finish', reason: { kind: 'stop' } }] })
  const sink = response()
  await route.handler(request(JSON.stringify(REQUEST)), sink)

  const { fetchImpl } = replayFetch(sink.body)
  let caught = null
  try {
    await askSideChat(REQUEST, undefined, () => {}, { fetch: fetchImpl })
  } catch (error) {
    caught = error
  }
  check('an empty answer surfaces as an error the client can show',
    caught !== null && /empty answer/i.test(String(caught.message)),
    String(caught?.message))
}

// ── Every frame the Host writes is a shape the client understands ──────────
// A field rename on either side would pass both suites separately; this catches it.
{
  const route = mountHost({
    chunks: [
      { type: 'text-delta', index: 0, text: 'a' },
      { type: 'finish', reason: { kind: 'stop' } },
    ],
  })
  const sink = response()
  await route.handler(request(JSON.stringify(REQUEST)), sink)

  const frames = sink.body.trim().split('\n\n').filter(Boolean).map((frame) => {
    const line = frame.trim()
    check(`frame starts with "data:": ${line.slice(0, 24)}`, line.startsWith('data:'), line.slice(0, 40))
    return JSON.parse(line.slice(5).trim())
  })
  const types = frames.map((frame) => frame.type)
  check('the Host only emits delta/done/error types',
    types.every((type) => ['delta', 'done', 'error'].includes(type)), types.join(','))
  check('a delta frame carries a string "text"',
    frames.filter((frame) => frame.type === 'delta').every((frame) => typeof frame.text === 'string'),
    JSON.stringify(frames.filter((frame) => frame.type === 'delta')))
  check('the last frame is done',
    types[types.length - 1] === 'done', types.join(','))
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
