/**
 * Turning captured Markdown into previewable HTML.
 *
 * A table in an answer is captured as Markdown, but the preview has to show the reader what they
 * saw — a rendered table, not pipes and header rules. These two helpers do that and nothing else:
 * no React, no DOM lookup, no state, which is why they can be tested on their own.
 *
 * Known limitation, recorded not fixed: the separator-row test is /^:?-{2,}:?$/, so a GFM
 * alignment row written with one hyphen per side (:--, :-:, --:) is not recognised and renders as
 * a data row. A plain |---|---| row is dropped correctly, which is what most captured tables use.
 * Widening the pattern is a behaviour change and belongs to its own decision.
 */

export function tableHtml(markdown) {
  const rows = markdown
.split('\n')
.map((line) => line.trim())
.filter((line) => line.startsWith('|'))
.map((line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()))
// Drop the `|---|---|` separator row.
.filter((cells) => cells.length > 0 && !cells.every((cell) => /^:?-{2,}:?$/.test(cell)))
  if (rows.length === 0) return `<pre class="qc-card-md">${escapeHtml(markdown)}</pre>`
  const head = rows[0]
  const body = rows.slice(1)
  const cell = (tag, text) => `<${tag}>${escapeHtml(text)}</${tag}>`
  return `<table><thead><tr>${head.map((text) => cell('th', text)).join('')}</tr></thead>`
+ `<tbody>${body.map((cells) => `<tr>${cells.map((text) => cell('td', text)).join('')}</tr>`).join('')}</tbody></table>`
}

/**
 * Escape text for safe insertion into HTML.
 * @param text - the raw text.
 * @returns the escaped text.
 */
export function escapeHtml(text) {
  return String(text)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
}
