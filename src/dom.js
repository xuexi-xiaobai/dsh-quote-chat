/**
 * Small DOM helpers shared across this package.
 *
 * These earn their own module because several unrelated concerns need them: anchoring needs
 * `elementOf` to walk from a text node to its block, and the gutter needs `cssEscape` to build
 * a selector around a row key that may contain quotes or backslashes.
 *
 * What this module does NOT do: it holds no state, schedules nothing, and knows nothing about
 * annotations, the transcript, or this plugin's surfaces. Anything that needs context beyond
 * a DOM node and a string belongs elsewhere.
 */

/**
 * The element an endpoint node belongs to.
 * @param node - a DOM node.
 * @returns its element, or null.
 */
export function elementOf(node) {
  if (node === null || node === undefined) return null
  return node.nodeType === 1 ? node : node.parentElement
}

/**
 * Escape one string for use inside a CSS attribute selector.
 *
 * Prefers the platform implementation, which handles the full escaping grammar. The fallback
 * only covers quotes and backslashes — enough for the row keys this package produces, and
 * deliberately not pretending to be complete.
 *
 * @param value - the raw attribute value.
 * @returns the escaped form.
 */
export function cssEscape(value) {
  const registry = typeof window === 'undefined' ? undefined : window.CSS
  if (typeof registry === 'object' && registry !== null && typeof registry.escape === 'function') {
    return registry.escape(value)
  }
  return value.replace(/["\\]/g, '\\$&')
}
