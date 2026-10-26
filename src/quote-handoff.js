/**
 * Quote handoff: which passage a freshly opened side chat shows.
 *
 * Two sources compete, and the order matters:
 *
 *   1. **The tab's own navigation params.** Whoever opened the tab said what it is about, so a
 *      non-empty carried string always wins — returned verbatim, not trimmed.
 *   2. **A pending quote.** A fallback for a Host that opens the tab without carrying params.
 *      It is eligible for 15 seconds, so opening the tab from a guide entry minutes later does
 *      not resurrect whatever was selected last.
 *
 * Expiry affects reads only: nothing arms a timer. A background cleanup would be a new
 * lifecycle, and the whole point of this module is to keep the existing one.
 *
 * What this module does NOT do: open tabs, build navigation params, or own the panel's state.
 * It answers one question — "what quote should this tab show?" — and the caller decides what to
 * do with the answer.
 */

/** How long a pending quote stays eligible, in ms. */
export const PENDING_QUOTE_TTL = 15_000

/**
 * Create one quote handoff.
 *
 * One per Host factory call: two plugin instances must not share a pending quote, because each
 * opened its own tab.
 *
 * @param options - `{ now }`, injected so the window is testable. Defaults to `Date.now`.
 * @returns the handoff's operations.
 */
export function createQuoteHandoff({ now = () => Date.now() } = {}) {
  /** The most recent quote, and when it was remembered (in injected-clock units). */
  let text = ''
  let at = 0

  return {
    /**
     * Record the quote a popup action wants the side chat to open with.
     *
     * Called immediately before the tab is opened, so the clock starts at the same moment the
     * tab appears. A later call replaces the earlier one and restarts the window.
     *
     * @param quote - the passage text; empty strings are allowed and mean "no quote".
     */
    remember(quote) {
      text = typeof quote === 'string' ? quote : ''
      at = now()
    },

    /**
     * The quote a tab should show.
     *
     * Reading never consumes: a tab body can re-render many times, and each render asks again.
     *
     * @param carried - the quote the tab's navigation params carried, if any.
     * @returns the carried quote, a fresh pending one, or an empty string.
     */
    forTab(carried) {
      if (typeof carried === 'string' && carried !== '') return carried
      // Strictly less than: a quote exactly at the TTL has expired.
      const fresh = now() - at < PENDING_QUOTE_TTL
      return fresh ? text : ''
    },
  }
}
