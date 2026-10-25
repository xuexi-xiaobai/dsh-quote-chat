/**
 * Offline harness for the Host half: exercises the route's request validation,
 * the SSE framing, and the failure paths against a fake Cordis context. Not
 * part of the plugin; kept beside it so the contract stays executable.
 */
import { apply } from '../index.js'

/** Minimal IncomingMessage stand-in. */
function request(method, url, body) {
  const chunks = body === undefined ? [] : [Buffer.from(body, 'utf8')]
  return {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  }
}

/** Minimal ServerResponse stand-in capturing status, headers, and body. */
function response() {
  const listeners = new Map()
  const state = { status: 0, headers: {}, chunks: [], ended: false, writableEnded: false }
  return {
    state,
    writeHead(status, headers) { state.status = status; state.headers = headers ?? {} },
    flushHeaders() {},
    write(text) { state.chunks.push(text); return true },
    end(text) {
      if (typeof text === 'string') state.chunks.push(text)
      state.ended = true
      state.writableEnded = true
    },
    once(name, fn) { listeners.set(name, fn) },
    off(name) { listeners.delete(name) },
    emit(name) { listeners.get(name)?.() },
    get body() { return state.chunks.join('') },
  }
}

/**
 * Mount the plugin over a fake context.
 * @param options - the streamed chunks, an optional failure index, and the
 * default model selection.
 * @returns the registered route.
 */
function context({ chunks, failAfter = -1, selection = { provider: 'p', model: 'm' } } = {}) {
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

/** Parse the SSE body into its event objects. */
function framesOf(res) {
  return res.body.trim().split('\n\n').filter(Boolean).map((frame) => JSON.parse(frame.slice(5)))
}

const textChunks = [
  { type: 'text-delta', index: 0, text: '第一' },
  { type: 'text-delta', index: 0, text: '段' },
  { type: 'finish', reason: { kind: 'stop' } },
]

const cases = []
function check(name, condition, detail) {
  cases.push({ name, ok: Boolean(condition), detail })
}

// 1. A normal answer streams deltas and a done frame.
{
  const route = context({ chunks: textChunks })
  const res = response()
  await route.handler(request('POST', '/quote-chat/api/ask', JSON.stringify({ quote: 'q', question: '为什么？' })), res)
  const frames = framesOf(res)
  check('stream status 200', res.state.status === 200, res.state.status)
  check('stream content type', String(res.state.headers['content-type']).includes('text/event-stream'))
  check('deltas preserved', frames.filter((f) => f.type === 'delta').map((f) => f.text).join('') === '第一段', JSON.stringify(frames))
  check('done frame last', frames[frames.length - 1]?.type === 'done', JSON.stringify(frames[frames.length - 1]))
}

// 2. A missing quote is refused before any model call.
{
  const route = context({ chunks: textChunks })
  const res = response()
  await route.handler(request('POST', '/quote-chat/api/ask', JSON.stringify({ question: 'hi' })), res)
  check('missing quote is 400', res.state.status === 400, res.state.status)
  check('missing quote names the field', JSON.parse(res.body).error.message.includes('quote'), res.body)
}

// 3. A provider failure becomes an error frame, not a dropped socket.
{
  const route = context({ chunks: textChunks, failAfter: 1 })
  const res = response()
  await route.handler(request('POST', '/quote-chat/api/ask', JSON.stringify({ quote: 'q', question: 'q' })), res)
  const frames = framesOf(res)
  check('failure becomes error frame', frames.some((f) => f.type === 'error' && f.message.includes('provider exploded')), res.body)
  check('failure still ends the response', res.state.ended === true)
}

// 4. A model answering nothing reports an error instead of a silent stop.
{
  const route = context({ chunks: [{ type: 'finish', reason: { kind: 'stop' } }] })
  const res = response()
  await route.handler(request('POST', '/quote-chat/api/ask', JSON.stringify({ quote: 'q', question: 'q' })), res)
  check('empty answer is an error frame', res.body.includes('empty answer'), res.body)
}

// 5. No configured model is a clean 503, not a crash.
{
  const route = context({ chunks: textChunks, selection: null })
  const res = response()
  await route.handler(request('POST', '/quote-chat/api/ask', JSON.stringify({ quote: 'q', question: 'q' })), res)
  check('no model is 503', res.state.status === 503, res.state.status)
  check('no model names the code', JSON.parse(res.body).error.code === 'no-model', res.body)
}

// 6. Wrong method and unknown method are refused.
{
  const route = context({ chunks: textChunks })
  const res = response()
  await route.handler(request('GET', '/quote-chat/api/ask', ''), res)
  check('GET is 405', res.state.status === 405, res.state.status)
  const other = response()
  await route.handler(request('POST', '/quote-chat/api/other', '{}'), other)
  check('unknown method is 404', other.state.status === 404, other.state.status)
}

// 7. History folds into one user turn, and the quote rides the system prompt.
{
  let seen
  let registered
  apply({
    effect: (fn) => fn(),
    webServer: { register: (entry) => { registered = entry; return () => {} } },
    connection: { requestRejection: () => undefined },
    get: (name) => {
      if (name === 'llm') {
        return {
          async *stream(options) {
            seen = options
            yield { type: 'finish', reason: { kind: 'stop' } }
          },
        }
      }
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'm' }) }
      return undefined
    },
  })
  const res = response()
  await registered.handler(request('POST', '/quote-chat/api/ask', JSON.stringify({
    quote: '引文',
    question: '新问题',
    history: [{ question: '旧问题', answer: '旧回答' }],
    locale: 'zh',
  })), res)
  const text = seen?.messages?.[0]?.content?.[0]?.text ?? ''
  check('one user message only', seen?.messages?.length === 1, JSON.stringify(seen?.messages))
  check('history folded into the turn', text.includes('旧问题') && text.includes('新问题'), text)
  check('system prompt carries the quote',
    String(seen?.system).includes('<quote>') && String(seen?.system).includes('引文'),
    String(seen?.system).slice(-80))
}

// 8. An oversized body is refused without buffering it forever.
{
  const route = context({ chunks: textChunks })
  const res = response()
  const huge = JSON.stringify({ quote: 'q', question: 'x'.repeat(600 * 1024) })
  await route.handler(request('POST', '/quote-chat/api/ask', huge), res)
  check('oversized body is 400', res.state.status === 400, res.state.status)
  check('oversized body says so', JSON.parse(res.body).error.message.includes('too large'), res.body)
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  -> ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
