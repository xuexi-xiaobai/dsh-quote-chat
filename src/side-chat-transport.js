/**
 * Side-chat transport: getting one answer from the Host half.
 *
 * The Host exposes `POST quote-chat/api/ask` and answers in `text/event-stream`, one JSON
 * object per frame:
 *
 *   data: {"type":"delta","text":"…"}
 *   data: {"type":"done"}
 *   data: {"type":"error","message":"…"}
 *
 * A refusal before the stream opens comes back as `application/json` with
 * `{ error: { message } }`.
 *
 * This module owns the wire: URL construction, the request, and the incremental parser. It does
 * NOT own the conversation — the message list, the busy flag, the error banner and the per-tab
 * `AbortController` all stay with the component, which passes its signal in.
 *
 * ## Parsing, and what it deliberately does not do
 *
 * Frames are split on a blank line; each must start with `data:`. Anything that fails to parse
 * is skipped rather than fatal, because a comment or keep-alive frame is not an answer.
 *
 * Two limitations are recorded rather than fixed, since widening the protocol is not this
 * refactor's job: a trailing partial frame at EOF is dropped (the stream simply ends), and only
 * the `data:` field is read — `event:`, `id:` and `retry:` are ignored.
 *
 * What this module does NOT do: retry, report progress, or decide what an error means to the
 * user. It returns text or throws, and the caller renders the outcome.
 */

/**
 * The Host route for one answer, resolved against the page base so a reverse-proxy prefix — or
 * the desktop shell's custom scheme — keeps working.
 *
 * @returns an absolute URL.
 */
export function askUrl() {
  const base = typeof document !== 'undefined'
    && typeof document.baseURI === 'string'
    && document.baseURI !== ''
    ? document.baseURI
    : 'http://dsh.internal/'
  return new URL('quote-chat/api/ask', base).href
}

/**
 * Stream one answer from the Host half.
 *
 * @param request - `{ quote, question, history, locale }`, sent verbatim as the JSON body.
 * @param signal - the caller's cancellation signal, forwarded to `fetch`.
 * @param onDelta - called with each text fragment, in arrival order, before it is appended.
 * @param options - `{ fetch }` for testing; defaults to the global.
 * @returns the complete answer text.
 * @throws an Error carrying the Host's own message, or the HTTP status when it gave none.
 */
export async function askSideChat(request, signal, onDelta, { fetch: fetchImpl } = {}) {
  const doFetch = fetchImpl ?? fetch
  const response = await doFetch(askUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
    credentials: 'same-origin',
  })

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/event-stream')) {
    // A refusal before the stream opens arrives as the JSON envelope.
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.message ?? `HTTP ${response.status}`)
  }

  const reader = response.body.getReader()
  // Streaming decode: a multi-byte character can be split across chunks, and decoding each
  // chunk independently would corrupt it.
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''

  /**
   * Handle one complete frame.
   * @param line - the frame's text, without its trailing blank line.
   * @returns true when the stream is finished.
   */
  const handleFrame = (line) => {
    if (!line.startsWith('data:')) return false
    let event
    try {
      event = JSON.parse(line.slice(5).trim())
    } catch {
      // Not our frame: a comment, a keep-alive, or a protocol extension. Skipping is safer
      // than failing an answer that is otherwise fine.
      return false
    }
    if (event.type === 'delta' && typeof event.text === 'string') {
      answer += event.text
      onDelta(event.text)
      return false
    }
    if (event.type === 'error') {
      throw new Error(typeof event.message === 'string' ? event.message : 'the answer failed')
    }
    return event.type === 'done'
  }

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const line = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')
      if (handleFrame(line)) return answer
    }
  }
  return answer
}
