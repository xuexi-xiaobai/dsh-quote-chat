/**
 * The small inline glyphs the surfaces draw.
 *
 * They are plain functions returning React elements rather than components with state: each is
 * one 'svg' with fixed geometry, used inside buttons whose label carries the meaning. Kept apart
 * from the surfaces so their markup can be read and compared without scrolling past behaviour.
 *
 * The two toolbar glyphs are Lucide paths (https://lucide.dev), ISC licensed, used unmodified —
 * `message-square-plus` and `panel-right`. Only width/height are ours. Full notice:
 * docs/third-party-notices.md.
 *
 * They share one 24 grid and one 2-unit stroke so the pair reads as a set. At the 14px the toolbar
 * draws them at, the stroke lands on 1.17px; the previous hand-drawn pair used a 16 grid and 1.3,
 * which landed on 1.14px — the same weight, so nothing here is a thickness change. What changed is
 * where the marks sit: Lucide puts the plus INSIDE the bubble, and a plus hung outside it collides
 * with the outline at this size.
 */

import React from 'react'

/** createElement, bound once. */
const h = React.createElement

/** Geometry shared by the Lucide glyphs, spread into each 'svg'. */
const LUCIDE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
}

/** The "annotate" glyph: Lucide `message-square-plus`. */
export function IconAnnotate() {
  return h('svg', { width: 14, height: 14, ...LUCIDE, 'aria-hidden': 'true' },
    h('path', { d: 'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z' }),
    h('path', { d: 'M12 8v6' }),
    h('path', { d: 'M9 11h6' }),
  )
}

/** The "side chat" glyph: Lucide `panel-right`. */
export function IconSideChat() {
  return h('svg', { width: 14, height: 14, ...LUCIDE, 'aria-hidden': 'true' },
    h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
    h('path', { d: 'M15 3v18' }),
  )
}

/** The confirm glyph. */
export function IconCheck() {
  return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
    h('path', {
      d: 'M3.4 8.5l3 3 6.2-7',
      stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }),
  )
}
