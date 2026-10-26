/**
 * Side-chat transport: reading one SSE answer from the Host.
 *
 * The framing here is a contract with `index.js` (the Host half), which writes
 * `data: <json>\n\n`. A parser that disagrees produces either a truncated answer or an error
 * where the model succeeded, so the cases below fix the mechanics that are easy to get wrong:
 * frames split across network chunks, several frames in one chunk, and multi-byte characters
 * split across a chunk boundary.
 *
 * `fetch` is a stand-in, so no network and no Host are needed. Responses are supplied as byte
 * chunks the test controls.
 *
 * Run: node test/side-chat-transport.mjs
 */
import { askSideChat, askUrl } from '../src/side-chat-transport.js'

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

const encoder = new TextEncoder()

/**
 * Build a fetch stand-in returning one response.
 * @param spec - `{ chunks, contentType, status, jsonBody, throws }`.
 * @returns `{ fetch, calls }`.
 */
function makeFetch(spec) {
  const calls = []
  const fetch = async (url, init) => {
    calls.push({ url, init })
    if (spec.throws !== undefined) throw spec.throws
    const body = {
      getReader() {
        let index = 0
        return {
          async read() {
            if (index >= spec.chunks.length) return { value: undefined, done: true }
            const chunk = spec.chunks[index]
            index += 1
            return { value: chunk, done: false }
          },
        }
      },
    }
    return {
      status: spec.status ?? 200,
      headers: {
        get: (name) => (name.toLowerCase() === 'content-type'
          ? (spec.contentType ?? 'text/event-stream')
          : null),
      },
      body,
      json: async () => {
        if (spec.jsonThrows === true) throw new Error('not json')
        return spec.jsonBody
      },
    }
  }
  return { fetch, calls }
}

/**
 * A frame the Host would write.
 * @param payload - the event object.
 * @returns the wire form.
 */
const frame = (payload) => `data: ${JSON.stringify(payload)}\n\n`

const REQUEST = {
  quote: '被引用的段落',
  question: '这里的假设成立吗？',
  history: [],
  locale: 'zh',
}

// ── URL construction ───────────────────────────────────────────────────────
{
  check('the ask URL is absolute',
    /^https?:\/\//.test(askUrl()), askUrl())
  check('the ask URL targets the Host route',
    askUrl().endsWith('/quote-chat/api/ask'), askUrl())
}

// ── Request shape ──────────────────────────────────────────────────────────
{
  const { fetch, calls } = makeFetch({ chunks: [encoder.encode(frame({ type: 'done' }))] })
  await askSideChat(REQUEST, undefined, () => {}, { fetch })
  const init = calls[0].init
  check('the request is a POST', init.method === 'POST', String(init.method))
  check('the request is JSON', init.headers['content-type'] === 'application/json',
    JSON.stringify(init.headers))
  check('credentials are same-origin', init.credentials === 'same-origin', String(init.credentials))
  const sent = JSON.parse(init.body)
  check('the request body carries the quote', sent.quote === REQUEST.quote, String(sent.quote))
  check('the request body carries the question', sent.question === REQUEST.question,
    String(sent.question))
  check('the request body carries the locale', sent.locale === 'zh', String(sent.locale))
  check('the request body carries the history array',
    Array.isArray(sent.history), JSON.stringify(sent.history))
  check('the signal is forwarded', 'signal' in init, 'no signal key in the request init')
}

// ── Deltas accumulate and stream ───────────────────────────────────────────
{
  const chunks = [
    encoder.encode(frame({ type: 'delta', text: '第一段' })),
    encoder.encode(frame({ type: 'delta', text: '第二段' })),
    encoder.encode(frame({ type: 'done' })),
  ]
  const { fetch } = makeFetch({ chunks })
  const seen = []
  const answer = await askSideChat(REQUEST, undefined, (text) => seen.push(text), { fetch })
  check('deltas reach the callback in order', seen.join('|') === '第一段|第二段', seen.join('|'))
  check('the returned text is the concatenation', answer === '第一段第二段', answer)
}

// ── Frames split across chunks ─────────────────────────────────────────────
// The Host may write a frame that the network delivers in pieces; the parser must not treat a
// partial frame as a complete one.
{
  const whole = encoder.encode(frame({ type: 'delta', text: 'split' }) + frame({ type: 'done' }))
  const chunks = [whole.slice(0, 10), whole.slice(10, 25), whole.slice(25)]
  const { fetch } = makeFetch({ chunks })
  const answer = await askSideChat(REQUEST, undefined, () => {}, { fetch })
  check('a frame split across three chunks is parsed once', answer === 'split', answer)
}

// ── Several frames in one chunk ────────────────────────────────────────────
{
  const chunk = encoder.encode(
    frame({ type: 'delta', text: 'a' }) + frame({ type: 'delta', text: 'b' }) + frame({ type: 'done' }),
  )
  const { fetch } = makeFetch({ chunks: [chunk] })
  const seen = []
  const answer = await askSideChat(REQUEST, undefined, (t) => seen.push(t), { fetch })
  check('several frames in one chunk are all parsed', seen.join('') === 'ab', seen.join(''))
  check('the answer is complete', answer === 'ab', answer)
}

// ── Multi-byte characters split across a chunk boundary ────────────────────
// A UTF-8 sequence cut in half decodes as garbage unless the decoder is told to stream. This is
// the case that produces mojibake in real use.
{
  const payload = frame({ type: 'delta', text: '中文🙂' }) + frame({ type: 'done' })
  const bytes = encoder.encode(payload)
  // Cut INSIDE a multi-byte character, not merely between frames: find the byte offset of the
  // first CJK character and split one byte into it. Anything coarser tests chunking, not
  // streaming decode.
  const cjkByte = encoder.encode(payload.slice(0, payload.indexOf('中'))).length
  const cut = cjkByte + 1
  const { fetch } = makeFetch({ chunks: [bytes.slice(0, cut), bytes.slice(cut)] })
  const answer = await askSideChat(REQUEST, undefined, () => {}, { fetch })
  check('a UTF-8 sequence split across chunks decodes correctly',
    answer === '中文🙂', JSON.stringify(answer))
}

// ── Error frames ───────────────────────────────────────────────────────────
{
  const chunks = [
    encoder.encode(frame({ type: 'delta', text: 'partial' })),
    encoder.encode(frame({ type: 'error', message: '模型返回了错误' })),
  ]
  const { fetch } = makeFetch({ chunks })
  let caught = null
  try {
    await askSideChat(REQUEST, undefined, () => {}, { fetch })
  } catch (error) {
    caught = error
  }
  check('an error frame throws', caught !== null, 'no error was raised')
  check('the error carries the Host message', caught?.message === '模型返回了错误',
    String(caught?.message))
}

{
  const { fetch } = makeFetch({ chunks: [encoder.encode(frame({ type: 'error' }))] })
  let caught = null
  try {
    await askSideChat(REQUEST, undefined, () => {}, { fetch })
  } catch (error) {
    caught = error
  }
  check('an error frame without a message still throws',
    caught !== null && caught.message === 'the answer failed', String(caught?.message))
}

// ── done stops reading ─────────────────────────────────────────────────────
{
  const chunks = [
    encoder.encode(frame({ type: 'delta', text: 'kept' }) + frame({ type: 'done' })
      + frame({ type: 'delta', text: 'after done' })),
  ]
  const { fetch } = makeFetch({ chunks })
  const answer = await askSideChat(REQUEST, undefined, () => {}, { fetch })
  check('deltas after done are ignored', answer === 'kept', answer)
}

// ── EOF without done ───────────────────────────────────────────────────────
// The existing behaviour returns whatever arrived. Worth pinning: a truncated stream yields a
// partial answer rather than an error.
{
  const chunks = [encoder.encode(frame({ type: 'delta', text: 'truncated' }))]
  const { fetch } = makeFetch({ chunks })
  const answer = await askSideChat(REQUEST, undefined, () => {}, { fetch })
  check('EOF without a done frame returns what arrived', answer === 'truncated', answer)
}

// ── Invalid frames are skipped ─────────────────────────────────────────────
{
  const chunks = [encoder.encode(
    'data: not json\n\n'
    + 'event: ping\n\n'
    + frame({ type: 'delta', text: 'good' })
    + frame({ type: 'done' }),
  )]
  const { fetch } = makeFetch({ chunks })
  const answer = await askSideChat(REQUEST, undefined, () => {}, { fetch })
  check('invalid frames are ignored', answer === 'good', answer)
}

// ── JSON refusal before the stream ─────────────────────────────────────────
{
  const { fetch } = makeFetch({
    chunks: [],
    contentType: 'application/json',
    status: 403,
    jsonBody: { error: { message: '不允许' } },
  })
  let caught = null
  try {
    await askSideChat(REQUEST, undefined, () => {}, { fetch })
  } catch (error) {
    caught = error
  }
  check('a JSON refusal throws the Host message', caught?.message === '不允许', String(caught?.message))
}

{
  const { fetch } = makeFetch({ chunks: [], contentType: 'application/json', status: 500, jsonThrows: true })
  let caught = null
  try {
    await askSideChat(REQUEST, undefined, () => {}, { fetch })
  } catch (error) {
    caught = error
  }
  check('an unparseable refusal falls back to the status',
    caught?.message === 'HTTP 500', String(caught?.message))
}

// ── Cancellation ───────────────────────────────────────────────────────────
{
  const abort = new Error('aborted')
  const { fetch, calls } = makeFetch({ throws: abort })
  let caught = null
  const controller = { aborted: false, reason: undefined }
  try {
    await askSideChat(REQUEST, controller, () => {}, { fetch })
  } catch (error) {
    caught = error
  }
  check('a cancelled request propagates its error', caught === abort, String(caught))
  check('the caller\'s signal object is passed through',
    calls[0].init.signal === controller, 'the signal was replaced or dropped')
}

// ── The Host's own frames parse ────────────────────────────────────────────
// Written exactly as index.js writes them, to keep the two halves in step.
{
  const chunks = [
    encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: '回答' })}\n\n`),
    encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
  ]
  const { fetch } = makeFetch({ chunks })
  const answer = await askSideChat(REQUEST, undefined, () => {}, { fetch })
  check('a frame written exactly as the Host writes it parses', answer === '回答', answer)
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
