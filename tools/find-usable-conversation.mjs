/**
 * Open conversations until one offers a block usable for demonstrating panel placement.
 *
 * ## What the measurements established
 *
 *   - clicking a sidebar row really does switch conversations;
 *   - most conversations here hold only a handful of short headings — 6 blocks and 137 characters;
 *   - the one with real prose holds 140 blocks and 5154 characters, and opens at its TOP with the first
 *     block at `top=-8213`, far above the viewport.
 *
 * So a search that only inspects the first screen rejects everything. This one scrolls to the END of the
 * transcript first — the newest prose is there — and waits for the offset to stop changing before it
 * measures anything.
 *
 * "Usable" means: at least 40 characters, at least 30px tall, fully inside the band between the header and
 * the composer, and with room above it for a panel.
 *
 * @param browser - the harness handle.
 * @param options - `{ maxConversations }`.
 * @returns the chosen conversation's title and usable blocks, or `{ failure, tried }`.
 */
export const findUsableConversation = async (browser, options = {}) => {
  const { read, waitFor, page } = browser
  const maxConversations = options.maxConversations ?? 14

  const titles = await read(() =>
    [...document.querySelectorAll('[role="treeitem"]')]
      .map((element) => (element.innerText ?? '').trim().split('\n')[0])
      .filter((title) => title.length > 0))
  const tried = []

  /** Scroll the transcript as far down as it goes, instantly, and wait for it to settle. */
  const scrollToEnd = async () => {
    const moved = await read(() => {
      const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
      if (flow === null) return null
      let scroller = null
      for (const element of document.querySelectorAll('*')) {
        if (element.scrollHeight <= element.clientHeight + 4) continue
        if (!element.contains(flow)) continue
        if (element === document.body || element === document.documentElement) continue
        scroller = element
        break
      }
      if (scroller === null) return null
      const previous = scroller.style.scrollBehavior
      scroller.style.scrollBehavior = 'auto'
      scroller.scrollTop = scroller.scrollHeight
      void scroller.offsetHeight
      scroller.style.scrollBehavior = previous
      return Math.round(scroller.scrollTop)
    })
    if (moved === null) return false
    // Wait for the offset to stop changing.
    let last = null
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const current = await read(() => {
        const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
        let scroller = null
        for (const element of document.querySelectorAll('*')) {
          if (element.scrollHeight <= element.clientHeight + 4) continue
          if (!element.contains(flow)) continue
          if (element === document.body || element === document.documentElement) continue
          scroller = element
          break
        }
        return scroller === null ? null : Math.round(scroller.scrollTop)
      })
      if (current !== null && current === last) return true
      last = current
      await page.waitForTimeout(50)
    }
    return false
  }

  /** The usable blocks on the current screen, plus the band they must fit in. */
  const scan = () => read(() => {
    const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
    if (flow === null) return { usable: [], band: null }
    const header = document.querySelector('header')
    const bandTop = header === null ? 0 : Math.round(header.getBoundingClientRect().bottom)
    const editors = [...document.querySelectorAll('[contenteditable="true"]')]
      .filter((element) => element.getBoundingClientRect().height > 0)
    const bandBottom = editors.length === 0
      ? window.innerHeight : Math.round(editors[editors.length - 1].getBoundingClientRect().top)

    const usable = []
    for (const element of flow.querySelectorAll('p, li')) {
      const box = element.getBoundingClientRect()
      const text = (element.innerText ?? '').trim()
      // A panel is ~123px tall plus a 10px gap, so the block needs that much clear space above it.
      if (text.length < 40) continue
      if (box.height < 30) continue
      if (box.top < bandTop + 150) continue
      if (box.bottom > bandBottom - 4) continue
      usable.push({
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        height: Math.round(box.height),
        chars: text.length,
        text: text.slice(0, 24),
      })
    }
    return { usable, band: { top: bandTop, bottom: bandBottom } }
  })

  for (let index = 0; index < Math.min(titles.length, maxConversations); index += 1) {
    const title = titles[index]
    tried.push(title)

    await read((wanted) => {
      const items = [...document.querySelectorAll('[role="treeitem"]')]
      const hit = items.find((element) => (element.innerText ?? '').includes(wanted))
      if (hit !== undefined) hit.click()
    }, title)

    // The transcript must at least exist; a row that opens nothing is skipped.
    const ready = await waitFor(
      '(() => { const f = document.querySelector(\'[data-slot="conversation.chat.flow"]\');'
        + ' return f !== null && f.querySelectorAll("p, li").length > 0 })()',
      { timeoutMs: 8000 },
    ).catch(() => null)
    if (ready === null || ready === false) continue
    await page.waitForTimeout(250)

    // A conversation that does not scroll cannot demonstrate the panel approaching the header, and its
    // block positions never change no matter how much scrollTop is assigned. Require real overflow.
    const scrollable = await read(() => {
      const scroller = document.querySelector('.wSkVaW_scrollBody')
      if (scroller === null) return 0
      return scroller.scrollHeight - scroller.clientHeight
    })
    if (scrollable < 400) continue

    await scrollToEnd()
    const result = await scan()
    if (result.usable.length === 0) continue

    // Tag the LAST usable block: it is closest to the bottom, where the newest prose lives.
    const chosen = result.usable[result.usable.length - 1]
    await read((top) => {
      const flow = document.querySelector('[data-slot="conversation.chat.flow"]')
      for (const element of document.querySelectorAll('[data-qc-probe="1"]')) {
        element.removeAttribute('data-qc-probe')
      }
      for (const element of flow.querySelectorAll('p, li')) {
        if (Math.round(element.getBoundingClientRect().top) !== top) continue
        element.setAttribute('data-qc-probe', '1')
        return true
      }
      return false
    }, chosen.top)

    return { title, band: result.band, usable: result.usable, chosen }
  }

  return { failure: true, tried }
}
