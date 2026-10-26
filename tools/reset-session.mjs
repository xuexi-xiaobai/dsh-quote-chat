/**
 * Reset the test session to a clean slate, once, outside any suite.
 *
 * Repeated debugging leaves annotations and persisted draft chips behind. The suites clean up after
 * themselves, but a suite that fails mid-way skips its own cleanup, so pollution accumulates and
 * then makes *unrelated* assertions fail — which reads as a regression when it is leftovers.
 *
 * This deletes every annotation through the plugin's own control and empties the composer through a
 * real Backspace, the same paths the suites use.
 *
 * Usage: node tools/reset-session.mjs <url>
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/reset-session.mjs <url>')
  process.exit(2)
}

const browser = await openBrowser()
const { goto, waitFor, read, count, click, press } = browser

try {
  await goto(url)
  await waitFor("document.querySelectorAll('[role=\"treeitem\"]').length > 0", { timeoutMs: 20000 })
  await read(() => {
    const items = [...document.querySelectorAll('[role="treeitem"]')]
    const hit = items.find((element) => (element.innerText ?? '').includes('锚点'))
    if (hit !== undefined) hit.click()
  })
  await waitFor(
    "(() => { const f = document.querySelector('[data-slot=\"conversation.chat.flow\"]');"
      + " return f !== null && [...f.querySelectorAll('p, li')].some((e) => (e.innerText ?? '').trim().length > 40) })()",
    { timeoutMs: 20000 },
  )

  // Delete every marker, reopening the panel each time. The count is re-read per iteration because
  // deletion also removes the element the loop just clicked.
  let deleted = 0
  for (let guard = 0; guard < 20; guard += 1) {
    const present = await count('.qc-marker')
    if (present === 0) break
    await click('.qc-marker')
    const opened = await waitFor("document.querySelector('.qc-bubble-panel .qc-bp-delete') !== null",
      { timeoutMs: 4000 })
    if (opened === null) {
      console.log(`  could not open the panel for marker ${present}; stopping`)
      break
    }
    await click('.qc-bubble-panel .qc-bp-delete')
    const after = await waitFor(`document.querySelectorAll('.qc-marker').length === ${present - 1}`,
      { timeoutMs: 4000 })
    if (after === null) {
      console.log(`  marker count did not drop from ${present}; stopping`)
      break
    }
    deleted += 1
  }

  // Empty the composer through Lexical: select its contents in the page, then a real Backspace.
  let cleared = 0
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const state = await read(() => {
      const editors = [...document.querySelectorAll('[contenteditable="true"]')]
      const composer = editors[editors.length - 1]
      if (composer === undefined) return { hasEditor: false, chips: 0, text: null }
      const text = (composer.innerText ?? '').trim()
      composer.focus()
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(composer)
      selection.removeAllRanges()
      selection.addRange(range)
      return {
        hasEditor: true,
        chips: document.querySelectorAll('[data-composer-chip="quote-chat"]').length,
        text,
      }
    })
    if (state.hasEditor === false) break
    if (state.text === '' && state.chips === 0) break
    await press('Backspace')
    await waitFor("document.querySelectorAll('[data-composer-chip=\"quote-chat\"]').length === 0",
      { timeoutMs: 4000 }).catch(() => {})
    cleared += 1
  }

  const final = await read(() => ({
    markers: document.querySelectorAll('.qc-marker').length,
    chips: document.querySelectorAll('[data-composer-chip="quote-chat"]').length,
    draftLength: (document.querySelector('[contenteditable="true"]')?.innerText ?? '').trim().length,
  }))
  console.log(`  deleted ${deleted} annotation(s), cleared the draft ${cleared} time(s)`)
  console.log(`  final: markers=${final.markers} chips=${final.chips} draft=${final.draftLength}`)
  process.exitCode = final.markers === 0 && final.chips === 0 && final.draftLength === 0 ? 0 : 1
} finally {
  await browser.close()
}
