/**
 * Two concurrent answers, one cancelled: isolation and real abort propagation.
 *
 * The transport suite's cancellation case only made `fetch` throw. That proves the error path
 * but not the mechanism: a real cancel goes through an AbortController, which `fetch` observes
 * and which must stop only the request it belongs to.
 *
 * So this drives two real controllers and two paused streams. Both enter reading, data is
 * interleaved, A is aborted mid-flight, and then B is allowed to finish. What must hold:
 * A stops, B completes, and neither one's deltas appear in the other's answer. The whole thing
 * is plain Node — no browser, no Host.
 *
 * Run: node test/side-chat-isolation.mjs
 */
import { askSideChat } from '../src/side-chat-transport.js'

const cases = []
const check = (name, ok, detail = '') => cases.push({ name, ok, detail })

const encoder = new TextEncoder()
const frame = (payload) => `data: ${JSON.stringify(payload)}\n\n`

/**
 * A response body that hands out chunks only when the test says so.
 *
 * Reads park until `push` or `close` is called, which is what makes interleaving deterministic:
 * the test decides exactly which side advances.
 *
 * @param signal - the request's abort signal, observed the way `fetch` observes it.
 * @returns `{ response, push, close, reads }`.
 */
function makeStream(signal) {
  /** Chunks waiting to be read. */
  const queue = []
  /** Reads parked for data. */
  const waiting = []
  /** Set once the stream is closed or aborted. */
  let finished = false
  let aborted = false
  let reads = 0

  const settleReads = () => {
    while (waiting.length > 0 && (queue.length > 0 || finished || aborted)) {
      const resolve = waiting.shift()
      if (aborted) {
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        resolve(Promise.reject(error))
        continue
      }
      if (queue.length > 0) resolve(Promise.resolve({ value: queue.shift(), done: false }))
      else resolve(Promise.resolve({ value: undefined, done: true }))
    }
  }

  if (signal !== undefined) {
    signal.addEventListener('abort', () => {
      aborted = true
      settleReads()
    }, { once: true })
  }

  const response = {
    status: 200,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'text/event-stream' : null) },
    body: {
      getReader() {
        return {
          read() {
            reads += 1
            if (aborted) {
              const error = new Error('The operation was aborted')
              error.name = 'AbortError'
              return Promise.reject(error)
            }
            if (queue.length > 0) return Promise.resolve({ value: queue.shift(), done: false })
            if (finished) return Promise.resolve({ value: undefined, done: true })
            return new Promise((resolve) => { waiting.push(resolve); settleReads() })
          },
        }
      },
    },
  }

  return {
    response,
    /** Deliver one chunk. */
    push(text) {
      queue.push(encoder.encode(text))
      settleReads()
    },
    /** End the stream normally. */
    close() {
      finished = true
      settleReads()
    },
    /** How many times `read` was called. */
    get reads() { return reads },
  }
}

/**
 * A fetch stand-in routing each call to the stream registered for it.
 * @param streams - per-call stream factories, in call order.
 * @returns `{ fetchImpl, calls }`.
 */
function makeFetch(streams) {
  const calls = []
  let index = 0
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    const factory = streams[Math.min(index, streams.length - 1)]
    index += 1
    return factory(init.signal).response
  }
  return { fetchImpl, calls }
}

const REQUEST = { quote: 'q', question: 'question', history: [], locale: 'zh' }

// Wait until a condition holds, polling on the microtask queue.
const until = async (condition, label) => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) return true
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error(`timed out waiting for ${label}`)
}

// ── Two requests, A cancelled, B unaffected ────────────────────────────────
{
  const controllerA = new AbortController()
  const controllerB = new AbortController()
  const streams = []
  const { fetchImpl } = makeFetch([
    (signal) => {
      const stream = makeStream(signal)
      streams[0] = stream
      return stream
    },
    (signal) => {
      const stream = makeStream(signal)
      streams[1] = stream
      return stream
    },
  ])

  const deltasA = []
  const deltasB = []

  const promiseA = askSideChat(REQUEST, controllerA.signal, (text) => deltasA.push(text), { fetch: fetchImpl })
  const promiseB = askSideChat(REQUEST, controllerB.signal, (text) => deltasB.push(text), { fetch: fetchImpl })

  // Both must be inside their read loop before anything is delivered.
  await until(() => streams[0]?.reads >= 1 && streams[1]?.reads >= 1, 'both streams reading')
  check('both requests reach the read loop', streams[0].reads >= 1 && streams[1].reads >= 1,
    `A=${streams[0].reads} B=${streams[1].reads}`)

  // Interleave: A then B, twice, so a shared buffer would mix them.
  streams[0].push(frame({ type: 'delta', text: 'A1' }))
  streams[1].push(frame({ type: 'delta', text: 'B1' }))
  await until(() => deltasA.length === 1 && deltasB.length === 1, 'first interleaved deltas')
  check('interleaved frames reach the right request (round 1)',
    deltasA.join('') === 'A1' && deltasB.join('') === 'B1',
    `A=${deltasA.join('')} B=${deltasB.join('')}`)

  streams[1].push(frame({ type: 'delta', text: 'B2' }))
  streams[0].push(frame({ type: 'delta', text: 'A2' }))
  await until(() => deltasA.length === 2 && deltasB.length === 2, 'second interleaved deltas')
  check('interleaved frames reach the right request (round 2)',
    deltasA.join('') === 'A1A2' && deltasB.join('') === 'B1B2',
    `A=${deltasA.join('')} B=${deltasB.join('')}`)

  // Cancel A while B is still open.
  controllerA.abort()
  let errorA = null
  try {
    await promiseA
  } catch (error) {
    errorA = error
  }
  check('the cancelled request rejects', errorA !== null, 'A resolved instead of rejecting')
  check('the rejection is an abort', errorA?.name === 'AbortError', String(errorA?.name))

  // B must still be usable after A was cancelled.
  streams[1].push(frame({ type: 'delta', text: 'B3' }))
  streams[1].push(frame({ type: 'done' }))
  const answerB = await promiseB
  check('the other request keeps receiving after the cancel',
    answerB === 'B1B2B3', JSON.stringify(answerB))
  check('the cancelled request\'s deltas never leaked into the other',
    !answerB.includes('A'), JSON.stringify(answerB))
  check('the surviving request reports only its own deltas',
    deltasB.join('') === 'B1B2B3', deltasB.join(''))
  check('the aborted request was not signalled by the other controller',
    controllerB.signal.aborted === false, String(controllerB.signal.aborted))
}

// ── Cancelling before any data ─────────────────────────────────────────────
{
  const controller = new AbortController()
  const streams = []
  const { fetchImpl } = makeFetch([(signal) => {
    const stream = makeStream(signal)
    streams[0] = stream
    return stream
  }])
  const promise = askSideChat(REQUEST, controller.signal, () => {}, { fetch: fetchImpl })
  await until(() => streams[0]?.reads >= 1, 'the request enters reading')
  controller.abort()
  let caught = null
  try {
    await promise
  } catch (error) {
    caught = error
  }
  check('cancelling with no data still rejects', caught !== null, 'the promise resolved')
  check('the pre-data cancel is an abort', caught?.name === 'AbortError', String(caught?.name))
}

// ── Cancelling between frames ──────────────────────────────────────────────
{
  const controller = new AbortController()
  const streams = []
  const { fetchImpl } = makeFetch([(signal) => {
    const stream = makeStream(signal)
    streams[0] = stream
    return stream
  }])
  const deltas = []
  const promise = askSideChat(REQUEST, controller.signal, (text) => deltas.push(text), { fetch: fetchImpl })
  await until(() => streams[0]?.reads >= 1, 'reading')
  streams[0].push(frame({ type: 'delta', text: 'kept' }))
  await until(() => deltas.length === 1, 'the first delta')
  controller.abort()
  let caught = null
  try {
    await promise
  } catch (error) {
    caught = error
  }
  check('cancelling mid-stream rejects', caught?.name === 'AbortError', String(caught?.name))
  check('deltas delivered before the cancel were kept',
    deltas.join('') === 'kept', deltas.join(''))
}

// ── The two controllers are genuinely independent objects ──────────────────
{
  const controllerA = new AbortController()
  const controllerB = new AbortController()
  const streams = []
  const { fetchImpl, calls } = makeFetch([
    (signal) => { const s = makeStream(signal); streams[0] = s; return s },
    (signal) => { const s = makeStream(signal); streams[1] = s; return s },
  ])
  const promiseA = askSideChat(REQUEST, controllerA.signal, () => {}, { fetch: fetchImpl })
  const promiseB = askSideChat(REQUEST, controllerB.signal, () => {}, { fetch: fetchImpl })
  await until(() => streams[0]?.reads >= 1 && streams[1]?.reads >= 1, 'both reading')

  check('each request carries its own signal',
    calls[0].init.signal !== calls[1].init.signal
      && calls[0].init.signal === controllerA.signal
      && calls[1].init.signal === controllerB.signal,
    'the requests shared a signal')

  controllerA.abort()
  await promiseA.catch(() => {})
  check('aborting A leaves B\'s signal untouched', controllerB.signal.aborted === false,
    'the abort crossed requests')
  streams[1].push(frame({ type: 'done' }))
  await promiseB
  check('B completes normally after A was aborted', true, '')
}

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.ok ? '' : `  ->  ${item.detail}`}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
