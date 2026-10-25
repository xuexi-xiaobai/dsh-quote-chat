/**
 * dsh-quote-chat — Host half.
 *
 * The browser half owns every pixel: the selection popup, the composer insert,
 * and the side-chat panel. This half exists for one reason: a side chat needs a
 * model answer, and the model lives on the Host. It exposes exactly one
 * streaming endpoint,
 *
 *   POST /quote-chat/api/ask
 *   { quote, question, history: [{ question, answer }], locale?: 'zh' | 'en' }
 *   -> text/event-stream: {"type":"delta","text":…} … {"type":"done"} | {"type":"error","message":…}
 *
 * and nothing else: no session is created, no session event is appended, so a
 * side chat cannot disturb the conversation it was opened from.
 *
 * The model route follows the profile's default selection
 * (`ctx.agentDefaultModel`) — the route a brand-new conversation would use. A
 * side chat is its own request, not a continuation of the visible
 * conversation, so the default is the honest choice instead of guessing the
 * main conversation's route.
 */

/** Route prefix registered on the Host HTTP carrier. */
const ROUTE = '/quote-chat/api'

/** Largest quoted passage accepted, in UTF-16 code units. */
const MAX_QUOTE_CHARS = 8000

/** Largest single question accepted, in UTF-16 code units. */
const MAX_QUESTION_CHARS = 20000

/** Most prior exchanges replayed per request. */
const MAX_HISTORY = 12

/** Largest history answer replayed, in UTF-16 code units. */
const MAX_ANSWER_CHARS = 12000

/** Largest request body accepted, in bytes. */
const MAX_BODY_BYTES = 512 * 1024

/** System briefs, one per interface language. */
const SYSTEM_PROMPTS = {
  zh: [
    '你正在一个“侧边对话”里回答用户的问题。',
    '用户在另一段主对话中选中了助手回答里的一段文字；这段引文在下面用 <quote> 标出。',
    '请只围绕这段引文回答：解释、质疑、举例、展开都可以，但不要假装你知道主对话里引文之外的内容。',
    '如果问题依赖引文之外的信息，就直接说明你只看到了这段引文。',
    '回答使用简体中文，简洁、具体、可读；需要时用小标题或列表，不要复述引文原文。',
  ].join('\n'),
  en: [
    'You are answering inside a side conversation.',
    'The user selected a passage from an assistant reply in another, main conversation; it is the quote inside <quote> below.',
    'Answer about that quoted passage only: explain, challenge, exemplify, or expand it, but never pretend to know anything else from the main conversation.',
    'When a question needs context you do not have, say that all you can see is the quote.',
    'Answer in English, concisely and concretely; use headings or lists when they help, and do not restate the quote.',
  ].join('\n'),
}

/**
 * Write one JSON response.
 * @param res - Host HTTP response.
 * @param status - HTTP status code.
 * @param body - JSON-serializable body.
 */
function writeJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  })
  res.end(text)
}

/**
 * Read one request body with a hard byte ceiling.
 * @param req - Host HTTP request.
 * @returns the parsed JSON value.
 * @throws an Error carrying a user-readable message.
 */
async function readBody(req) {
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > MAX_BODY_BYTES) throw new Error('request body is too large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') throw new Error('request body is empty')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('request body is not valid JSON')
  }
}

/**
 * Bound and shape one request body without trusting any field.
 * @param raw - parsed JSON body, or anything else the caller sent.
 * @returns the normalized request.
 * @throws an Error with a human-readable message on a contract violation.
 */
function readRequest(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('body must be a JSON object')
  }
  const quote = typeof raw.quote === 'string' ? raw.quote.trim() : ''
  if (quote === '') throw new Error('quote is required')
  if (quote.length > MAX_QUOTE_CHARS) throw new Error(`quote is longer than ${MAX_QUOTE_CHARS} characters`)
  const question = typeof raw.question === 'string' ? raw.question.trim() : ''
  if (question === '') throw new Error('question is required')
  if (question.length > MAX_QUESTION_CHARS) throw new Error(`question is longer than ${MAX_QUESTION_CHARS} characters`)
  const input = Array.isArray(raw.history) ? raw.history : []
  const history = []
  for (const turn of input.slice(-MAX_HISTORY)) {
    const asked = typeof turn?.question === 'string' ? turn.question.trim() : ''
    const answered = typeof turn?.answer === 'string' ? turn.answer.trim() : ''
    if (asked === '' || answered === '') continue
    history.push({
      question: asked.slice(0, MAX_QUESTION_CHARS),
      answer: answered.slice(0, MAX_ANSWER_CHARS),
    })
  }
  return { quote, question, history, locale: raw.locale === 'en' ? 'en' : 'zh' }
}

/**
 * The default model route, or undefined when no adapter selection exists.
 * @param ctx - Host context.
 * @returns the provider/model pair plus its optional reasoning effort.
 */
function defaultRoute(ctx) {
  const service = ctx.get('agentDefaultModel')
  if (service === undefined || typeof service.currentSelection !== 'function') return undefined
  const selection = service.currentSelection()
  if (selection === null || typeof selection !== 'object') return undefined
  if (typeof selection.provider !== 'string' || selection.provider === '') return undefined
  if (typeof selection.model !== 'string' || selection.model === '') return undefined
  return {
    provider: selection.provider,
    model: selection.model,
    reasoningEffort: typeof selection.reasoningEffort === 'string' ? selection.reasoningEffort : undefined,
  }
}

/**
 * Compose the system prompt: the fixed brief plus the quoted passage.
 * @param locale - interface language of the requesting panel.
 * @param quote - the selected passage.
 * @returns the complete system prompt.
 */
function systemPrompt(locale, quote) {
  return `${SYSTEM_PROMPTS[locale] ?? SYSTEM_PROMPTS.zh}\n\n<quote>\n${quote}\n</quote>`
}

/**
 * Compose the single user turn: the replayed exchange, then the question. The
 * side chat keeps its own short history, so it arrives folded into one turn
 * rather than as a synthetic message chain the agent loop never wrote.
 * @param request - the normalized request.
 * @param locale - interface language of the requesting panel.
 * @returns the user message text.
 */
function userTurn(request, locale) {
  if (request.history.length === 0) return request.question
  const heading = locale === 'en'
    ? 'Earlier in this side conversation:'
    : '这次侧边对话先前的内容：'
  const body = request.history
    .map((turn) => `Q: ${turn.question}\nA: ${turn.answer}`)
    .join('\n\n')
  const ask = locale === 'en' ? 'New question:' : '新的问题：'
  return `${heading}\n\n${body}\n\n${ask}\n${request.question}`
}

/**
 * Stream one side-chat answer as server-sent events.
 * @param ctx - Host context.
 * @param request - the normalized request.
 * @param res - Host HTTP response.
 * @param signal - cancellation from the closed response.
 */
async function streamAnswer(ctx, request, res, signal) {
  const llm = ctx.get('llm')
  if (llm === undefined || typeof llm.stream !== 'function') {
    writeJson(res, 503, { ok: false, error: { code: 'no-llm', message: 'the model service is unavailable' } })
    return
  }
  const route = defaultRoute(ctx)
  if (route === undefined) {
    writeJson(res, 503, { ok: false, error: { code: 'no-model', message: 'no default model is configured' } })
    return
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  if (typeof res.flushHeaders === 'function') res.flushHeaders()

  let closed = false
  const send = (payload) => {
    if (closed || res.writableEnded) return
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }
  signal.addEventListener('abort', () => { closed = true }, { once: true })

  try {
    const stream = llm.stream({
      provider: route.provider,
      model: route.model,
      system: systemPrompt(request.locale, request.quote),
      // A `role: 'user'` request message carries no id/source: it is the
      // input-only shape the LLM service accepts, and it keeps this call out
      // of every session log.
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: userTurn(request, request.locale) }],
      }],
      signal,
      ...(route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort }),
    })
    let answered = false
    for await (const chunk of stream) {
      if (closed) break
      if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') {
        answered = true
        send({ type: 'delta', text: chunk.text })
      } else if (chunk?.type === 'finish') {
        const kind = chunk.reason?.kind
        if (kind === 'error' || kind === 'aborted') {
          const failure = chunk.reason?.failure
          send({
            type: 'error',
            message: typeof failure?.message === 'string' ? failure.message : `the model stopped (${kind})`,
          })
        } else if (!answered) {
          send({ type: 'error', message: 'the model returned an empty answer' })
        } else send({ type: 'done' })
      }
    }
  } catch (error) {
    if (signal.aborted) return
    send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  } finally {
    closed = true
    if (!res.writableEnded) res.end()
  }
}

/**
 * Required Host services.
 *
 * `webServer` carries the streaming route, and `connection` provides the same-origin /
 * authentication fence the handler applies before reading a byte of the body. Declaring
 * them is what makes the Host wait for those services and permit the access; without the
 * declaration `ctx.webServer` throws "cannot get property without inject" on any profile
 * that has not already materialised the HTTP carrier for some other reason. The desktop
 * profile masked the omission; a plain `dsh --profile web` does not.
 */
export const inject = ['webServer', 'connection']

/**
 * Host plugin body: one streaming route, registered for the fiber's lifetime.
 * @param ctx - Host context carrying `webServer`, `connection`, `llm`, and
 * `agentDefaultModel`.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      // Same fence every Host route uses: reject an unauthenticated or
      // cross-origin peer before reading a byte of the body.
      if (ctx.connection.requestRejection(req) !== undefined) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method', message: 'POST only' } })
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      if (pathname !== `${ROUTE}/ask`) {
        writeJson(res, 404, { ok: false, error: { code: 'not-found', message: 'unknown quote-chat method' } })
        return
      }
      let request
      try {
        request = readRequest(await readBody(req))
      } catch (error) {
        writeJson(res, 400, {
          ok: false,
          error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) },
        })
        return
      }
      const controller = new AbortController()
      res.once('close', () => controller.abort())
      await streamAnswer(ctx, request, res, controller.signal)
    },
  }), 'quote-chat: ask route')
}
