/**
 * Verify the right sidebar collapses, from inside a conversation.
 *
 * The check must happen AFTER a chat is open, because that is when the sidebar exists. This walks the
 * same path a suite does and reports the column width before and after.
 *
 * Usage: node tools/close-sidebar.mjs <url>
 */
import { openBrowser } from './harness.mjs'

const url = process.argv[2]
if (url === undefined) {
  console.error('usage: node tools/close-sidebar.mjs <url>')
  process.exit(2)
}

const browser = await openBrowser()
const { goto, waitFor, read, prepareSession, collapseRightSidebar } = browser

/** Column width and right-bar width. */
const measure = () => read(() => {
  const column = document.querySelector('.pI_x6G_centerCol')
  const bar = document.querySelector('.pI_x6G_rightbarCol')
  return {
    column: column === null ? null : Math.round(column.getBoundingClientRect().width),
    rightbar: bar === null ? null : Math.round(bar.getBoundingClientRect().width),
    viewport: window.innerWidth,
  }
})

try {
  await goto(url)
  await waitFor("document.querySelectorAll('[role=\"treeitem\"]').length > 0", { timeoutMs: 20000 })

  console.log('\n  landing view')
  console.log(`  ${JSON.stringify(await measure())}`)

  // Enter a conversation the way a suite does. The sidebar is created here.
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
  await browser.page.waitForTimeout(400)

  console.log('\n  inside the conversation, before collapsing')
  console.log(`  ${JSON.stringify(await measure())}`)

  const changes = await collapseRightSidebar()
  console.log(`\n  collapseRightSidebar: ${changes.join(' | ')}`)

  const after = await measure()
  console.log('\n  after collapsing')
  console.log(`  ${JSON.stringify(after)}`)

  // A collapsed bar keeps a 1px border, so compare against a small tolerance rather than zero.
  const ok = after.rightbar <= 8 && (after.column ?? 0) > 900
  console.log(`\n  ${ok ? 'OK' : 'NOT OK'}: right bar ${after.rightbar}px, column ${after.column}px of ${after.viewport}`)

  // A second call must be harmless: suites call this unconditionally.
  const again = await collapseRightSidebar()
  console.log(`  second call: ${again.length === 0 ? '(no-op)' : again.join(' | ')}`)

  void prepareSession
  process.exitCode = ok ? 0 : 1
} finally {
  await browser.close()
}
