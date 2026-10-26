/**
 * The side chat: a self-contained conversation about one quoted passage.
 *
 * ## What it is not
 *
 * Not a second transcript. It has its own message list, its own composer and its own abort
 * controller, and it talks to this package's Host half rather than to the session. That is what
 * makes it safe to open on a passage the main conversation has already moved past.
 *
 * ## The quote it opens with
 *
 * A tab is opened with `params.quote`. The handoff module decides what that means when the params
 * are empty, and the tab body asks it once, on mount. A new quote is a new thread: the previous
 * exchange was about a different passage, and mixing the two would make answers unattributable.
 *
 * ## Lifetimes
 *
 * The abort controller is per request and is aborted on unmount: closing the tab must stop the
 * fetch, not leave it streaming into a component that no longer exists. `busy` is derived from
 * that controller, not tracked separately, so a cancel cannot leave the composer disabled.
 */

import React from 'react'
import { askSideChat } from '../side-chat-transport.js'
import { useDraft, useDraftOccurrences } from './draft-hooks.js'

/** createElement, bound once. */
const h = React.createElement

/** The longest passage the side chat will carry, matching the main compose limit. */
const MAX_QUOTE_CHARS = 8000


/**
 * Create the side chat bound to one plugin instance.
 *
 * Call once during wiring: the returned component is a stable type, and minting it per render
 * would remount the tab body, losing the exchange and aborting the request in flight.
 *
 * @param services - `{ quoteForTab }` from the instance's quote handoff.
 * @returns `{ SideChat, SideChatTab }`.
 */
export function createSideChat({ quoteForTab }) {
  /**
   * One side-chat thread: the quoted passage, the exchange so far, and the
   * composer. All state is local to this tab.
   * @param props - the quote, a translate function, and the composer actions.
   */
  function SideChat(props) {
    const { quote, t, locale, inputActions, useInput } = props
    const draft = useDraft(useInput)
    const [messages, setMessages] = React.useState([])
    const [question, setQuestion] = React.useState('')
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState('')
    const [expanded, setExpanded] = React.useState(false)
    const [added, setAdded] = React.useState(false)
    const abortRef = React.useRef(null)
    const threadRef = React.useRef(null)

    // A new passage is a new thread: the previous exchange was about a
    // different quote, and mixing the two would make answers unattributable.
    React.useEffect(() => {
      abortRef.current?.abort()
      abortRef.current = null
      setMessages([])
      setQuestion('')
      setError('')
      setBusy(false)
      setAdded(false)
    }, [quote])

    React.useEffect(() => () => { abortRef.current?.abort() }, [])

    const scrollToEnd = React.useCallback(() => {
      const element = threadRef.current
      if (element !== null) element.scrollTop = element.scrollHeight
    }, [])

    React.useEffect(scrollToEnd, [messages, scrollToEnd])

    const submit = React.useCallback(async () => {
      const text = question.trim()
      if (text === '' || busy) return
      const history = messages
        .filter((message) => message.text.trim() !== '')
        .map((message) => ({ role: message.role, text: message.text }))
      // The Host wants completed Q/A pairs, so fold the finished exchange and
      // send the new question separately.
      const replayed = []
      for (let index = 0; index < history.length; index += 1) {
        const current = history[index]
        const next = history[index + 1]
        if (current.role === 'user' && next !== undefined && next.role === 'assistant') {
          replayed.push({ question: current.text, answer: next.text })
          index += 1
        }
      }
      setMessages((current) => [...current, { role: 'user', text }, { role: 'assistant', text: '' }])
      setQuestion('')
      setError('')
      setBusy(true)
      const controller = new AbortController()
      abortRef.current = controller
      try {
        await askSideChat({ quote, question: text, history: replayed, locale }, controller.signal, (delta) => {
          setMessages((current) => {
            const copy = current.slice()
            const last = copy.length - 1
            if (last < 0) return current
            copy[last] = { role: 'assistant', text: copy[last].text + delta }
            return copy
          })
        })
      } catch (failure) {
        if (controller.signal.aborted) {
          setMessages((current) => {
            const copy = current.slice()
            const last = copy.length - 1
            if (last >= 0 && copy[last].role === 'assistant' && copy[last].text === '') copy.pop()
            return copy
          })
        } else {
          setError(failure instanceof Error ? failure.message : String(failure))
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setBusy(false)
      }
    }, [question, busy, messages, quote, locale])

    const stop = React.useCallback(() => {
      abortRef.current?.abort()
      abortRef.current = null
      setBusy(false)
    }, [])

    /** Append one passage to the current session's composer draft. */
    const addToChat = React.useCallback((text) => {
      const payload = text
        .split(/\r?\n/)
        .map((line) => (line === '' ? '>' : `> ${line}`))
        .join('\n')
      const current = typeof draft === 'string' ? draft : ''
      if (typeof inputActions?.captureInsertion === 'function'
        && typeof inputActions?.insertText === 'function') {
        const span = inputActions.captureInsertion()
        if (inputActions.insertText(`${payload}\n\n`, span) === true) {
          setAdded(true)
          return
        }
      }
      if (typeof inputActions?.setDraft === 'function') {
        inputActions.setDraft(current.trim() === '' ? payload : `${current}\n\n${payload}`)
        setAdded(true)
      }
    }, [draft, inputActions])

    React.useEffect(() => {
      if (!added) return undefined
      const timer = setTimeout(() => setAdded(false), 2200)
      return () => clearTimeout(timer)
    }, [added])

    const lastAssistant = [...messages].reverse()
      .find((message) => message.role === 'assistant' && message.text !== '')
    const lastQuestion = [...messages].reverse().find((message) => message.role === 'user')

    return h('div', { className: 'qc-side' },
      h('div', { className: 'qc-side-head' },
        h('span', { className: 'qc-side-head-title' }, t('side.title')),
        messages.length > 0
          ? h('button', {
            type: 'button',
            onClick: () => { setMessages([]); setError(''); setAdded(false) },
          }, t('side.clear'))
          : null,
      ),
      h('div', { className: 'qc-quote' },
        h('div', { className: 'qc-quote-label' },
          h('span', null, t('side.quote')),
          quote.length > 260
            ? h('button', {
              type: 'button',
              onClick: () => setExpanded((value) => !value),
            }, expanded ? t('side.collapseQuote') : t('side.expandQuote'))
            : null,
        ),
        h('div', { className: `qc-quote-body${expanded ? '' : ' qc-clamped'}` }, quote),
      ),
      h('div', { ref: threadRef, className: 'qc-thread' },
        messages.length === 0
          ? h('div', { className: 'qc-empty' }, t('side.empty'))
          : messages.map((message, index) => h('div', {
            key: `${index}-${message.role}`,
            className: `qc-msg qc-msg-${message.role}`,
          },
          h('div', { className: 'qc-msg-role' },
            message.role === 'user' ? t('side.you') : t('side.assistant')),
          h('div', { className: 'qc-msg-body' },
            message.text === '' && busy && index === messages.length - 1
              ? h('span', { className: 'qc-dots' })
              : message.text),
          message.role === 'assistant' && message.text !== ''
            ? h('div', { className: 'qc-msg-actions' },
              h('button', {
                type: 'button',
                onClick: () => addToChat(message.text),
              }, t('side.addToChat')))
            : null,
          )),
        error === ''
          ? null
          : h('div', { className: 'qc-msg-error' }, `${t('side.errorPrefix')}${error}`),
      ),
      h('div', { className: 'qc-side-compose' },
        h('textarea', {
          value: question,
          placeholder: t('side.placeholder'),
          rows: 2,
          onChange: (event) => setQuestion(event.target.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
              event.preventDefault()
              submit()
            }
          },
        }),
        h('div', { className: 'qc-side-compose-row' },
          h('span', { className: 'qc-side-compose-hint' }, added ? t('side.added') : ''),
          lastAssistant !== undefined
            ? h('button', {
              type: 'button',
              className: 'qc-btn qc-btn-ghost',
              onClick: () => addToChat(
                `> ${lastQuestion === undefined ? '' : lastQuestion.text}\n\n${lastAssistant.text}`,
              ),
            }, t('side.addToChat'))
            : null,
          busy
            ? h('button', { type: 'button', className: 'qc-btn qc-btn-ghost', onClick: stop }, t('side.stop'))
            : h('button', {
              type: 'button',
              className: 'qc-btn',
              disabled: question.trim() === '',
              onClick: submit,
            }, t('side.send')),
        ),
      ),
    )
  }

  /**
   * The passage a freshly opened side chat should show.
   *
   * One handoff per plugin instance: navigation params win, and a pending quote is a
   * 15-second fallback for a Host that opens the tab without carrying them. The rules and
   * the window live in quote-handoff.js.
   */
  /**
   * The tab body: read the quote the tab was opened with, then hand it to the
   * panel.
   *
   * `t` arrives from the framework (a registration with `locale` gets the
   * bound translate seat), `pluginCtx` from this registration's `inject`, and
   * `inputActions`/`useInput` are standard session props.
   * @param props - standard session props, the tab hook context, and the
   * injected seats.
   */
  function SideChatTab(props) {
    const { useTabInfo, inputActions, useInput, t, pluginCtx } = props
    const info = typeof useTabInfo === 'function' ? useTabInfo() : undefined
    const quote = quoteForTab(info?.tab?.navigation?.params?.quote)
    // A locale switch must reach the Host prompt language, so subscribe to the
    // locale snapshot rather than reading it once.
    const localeService = pluginCtx?.locale
    const locale = React.useSyncExternalStore(
      React.useCallback(
        (listener) => (typeof localeService?.subscribe === 'function' ? localeService.subscribe(listener) : () => {}),
        [localeService],
      ),
      React.useCallback(
        () => (typeof localeService?.getLocale === 'function' ? localeService.getLocale().active : 'zh'),
        [localeService],
      ),
      React.useCallback(() => 'zh', []),
    )

    if (quote === '') {
      return h('div', { className: 'qc-side' },
        h('div', { className: 'qc-quote' },
          h('div', { className: 'qc-quote-body' }, t('side.noQuote')),
        ),
      )
    }
    return h(SideChat, { quote, t, locale: locale === 'en' ? 'en' : 'zh', inputActions, useInput })
  }

  return { SideChat: SideChat, SideChatTab: SideChatTab }
}
