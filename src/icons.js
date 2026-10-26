/**
 * The small inline glyphs the surfaces draw.
 *
 * They are plain functions returning React elements rather than components with state: each is
 * one 'svg' with fixed geometry, used inside buttons whose label carries the meaning. Kept apart
 * from the surfaces so their markup can be read and compared without scrolling past behaviour.
 */

import React from 'react'

/** createElement, bound once. */
const h = React.createElement

/** The "annotate" glyph: a quote bubble with a plus. */
export function IconAnnotate() {
  return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
    h('path', {
      d: 'M2.6 4.4h6a1.3 1.3 0 0 1 1.3 1.3v3.6a1.3 1.3 0 0 1-1.3 1.3H5.3L3 12.8V5.7',
      stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }),
    h('path', {
      d: 'M12 3.1v3.8M10.1 5h3.8',
      stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.7,
    }),
  )
}

/** The "side chat" glyph: a panel split off the main one. */
export function IconSideChat() {
  return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
    h('rect', { x: 1.8, y: 2.6, width: 8.2, height: 8.9, rx: 1.4, stroke: 'currentColor', 'stroke-width': 1.3 }),
    h('path', {
      d: 'M10.1 5.2h2.6a1.3 1.3 0 0 1 1.3 1.3v6.2l-2.1-1.6',
      stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }),
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
